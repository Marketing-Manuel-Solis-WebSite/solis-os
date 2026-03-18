// ================================================================
// SSO Initiate — GET /api/auth/sso/initiate
// ================================================================
// Reads SSO config, builds the appropriate redirect URL
// for either SAML AuthnRequest or OIDC Authorization Code flow.

import { NextResponse } from 'next/server';
import { getSSOConfig } from '@/lib/security/sso-config';
import crypto from 'crypto';

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * Build a SAML AuthnRequest XML and return the redirect URL with SAMLRequest param.
 */
function buildSamlRedirectUrl(config: {
  entityId: string;
  ssoUrl: string;
}, baseUrl: string, state: string): string {
  const id = `_${crypto.randomUUID()}`;
  const issueInstant = new Date().toISOString();
  const acsUrl = `${baseUrl}/api/auth/sso/callback`;

  const authnRequest = [
    `<samlp:AuthnRequest`,
    `  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    `  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    `  ID="${id}"`,
    `  Version="2.0"`,
    `  IssueInstant="${issueInstant}"`,
    `  Destination="${config.ssoUrl}"`,
    `  AssertionConsumerServiceURL="${acsUrl}"`,
    `  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
    `  <saml:Issuer>${config.entityId}</saml:Issuer>`,
    `  <samlp:NameIDPolicy`,
    `    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"`,
    `    AllowCreate="true" />`,
    `</samlp:AuthnRequest>`,
  ].join('\n');

  // Deflate + Base64 encode for HTTP-Redirect binding
  const encoded = Buffer.from(authnRequest, 'utf-8').toString('base64');
  const samlRequest = encodeURIComponent(encoded);
  const relayState = encodeURIComponent(state);

  const separator = config.ssoUrl.includes('?') ? '&' : '?';
  return `${config.ssoUrl}${separator}SAMLRequest=${samlRequest}&RelayState=${relayState}`;
}

/**
 * Build an OIDC authorization URL for the Authorization Code flow.
 */
function buildOidcAuthorizationUrl(config: {
  issuer?: string;
  discoveryUrl?: string;
  clientId: string;
}, baseUrl: string, state: string): string {
  // Derive authorization endpoint from issuer
  const issuer = config.issuer || config.discoveryUrl?.replace(/\/.well-known\/openid-configuration$/, '') || '';
  const authEndpoint = `${issuer.replace(/\/$/, '')}/authorize`;

  const redirectUri = `${baseUrl}/api/auth/sso/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    nonce: crypto.randomUUID(),
  });

  return `${authEndpoint}?${params.toString()}`;
}

const SSO_STATE_SECRET = process.env.SSO_STATE_SECRET || crypto.randomBytes(32).toString('hex');

export async function GET(request: Request) {
  try {
    const ssoConfig = await getSSOConfig();

    if (!ssoConfig.enabled) {
      return NextResponse.json({ error: 'SSO is not enabled' }, { status: 400 });
    }

    const baseUrl = getBaseUrl(request);
    const state = crypto.randomBytes(32).toString('hex');

    // Create HMAC signature of the state parameter for CSRF protection
    const stateHmac = crypto
      .createHmac('sha256', SSO_STATE_SECRET)
      .update(state)
      .digest('hex');

    let redirectUrl: string;

    if (ssoConfig.provider === 'saml') {
      if (!ssoConfig.entityId || !ssoConfig.ssoUrl) {
        return NextResponse.json({ error: 'SAML configuration incomplete' }, { status: 400 });
      }
      redirectUrl = buildSamlRedirectUrl(
        { entityId: ssoConfig.entityId, ssoUrl: ssoConfig.ssoUrl },
        baseUrl,
        state,
      );
    } else {
      if (!ssoConfig.clientId) {
        return NextResponse.json({ error: 'OIDC configuration incomplete' }, { status: 400 });
      }
      redirectUrl = buildOidcAuthorizationUrl(
        { issuer: ssoConfig.issuer, discoveryUrl: ssoConfig.discoveryUrl, clientId: ssoConfig.clientId },
        baseUrl,
        state,
      );
    }

    // Return the URL + state for the client to store and redirect
    const response = NextResponse.json({ url: redirectUrl, state });

    // Set the HMAC of the state in an httpOnly cookie for validation on callback
    response.cookies.set('sso_state', stateHmac, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/api/auth/sso',
    });

    return response;
  } catch (err: any) {
    console.error('[SSO Initiate] Error:', err);
    return NextResponse.json({ error: 'Failed to initiate SSO' }, { status: 500 });
  }
}
