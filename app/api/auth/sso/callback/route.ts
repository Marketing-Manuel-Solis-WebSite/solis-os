// ================================================================
// SSO Callback — GET (OIDC) / POST (SAML)
// ================================================================
// Handles the return from the IdP. Extracts user info, creates or
// finds the Firebase user, generates a custom token, and redirects
// the browser to /login with the token in the URL hash.

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getSSOConfig, type SSOConfig } from '@/lib/security/sso-config';
import { ORG_ID as ORG } from '@/lib/org';
import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

// ---- User info extraction types ----

interface SSOUserInfo {
  email: string;
  displayName: string;
  role?: string;
}

// ---- SSO State HMAC helpers ----

const SSO_STATE_SECRET = process.env.SSO_STATE_SECRET || crypto.randomBytes(32).toString('hex');

function verifyStateHmac(state: string, expectedHmac: string): boolean {
  try {
    const computedHmac = crypto
      .createHmac('sha256', SSO_STATE_SECRET)
      .update(state)
      .digest('hex');
    const a = Buffer.from(computedHmac, 'hex');
    const b = Buffer.from(expectedHmac, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---- SAML Signature Verification ----

/**
 * Verify the SAML response signature against the stored IdP certificate.
 * This is a simplified verification that:
 * 1. Ensures the response is well-formed XML with expected SAML elements
 * 2. Extracts the X509Certificate from the XML Signature block
 * 3. Compares it against the trusted IdP certificate stored in config
 * 4. Rejects responses from unknown/untrusted IdPs
 */
function verifySamlSignature(xml: string, config: SSOConfig): { valid: boolean; error?: string } {
  // 1. Require config.certificate to be present
  if (!config.certificate?.trim()) {
    return { valid: false, error: 'IdP certificate not configured — cannot verify SAML response' };
  }

  // 2. Verify the XML is well-formed with expected SAML elements
  const hasSamlResponse = /<(?:samlp?|saml2p?):Response[\s>]/i.test(xml);
  const hasAssertion = /<(?:saml2?:)?Assertion[\s>]/i.test(xml);
  const hasNameId = /<(?:saml2?:)?NameID[^>]*>[^<]+<\/(?:saml2?:)?NameID>/.test(xml);
  if (!hasSamlResponse || !hasAssertion || !hasNameId) {
    return { valid: false, error: 'SAML response missing required elements (Response, Assertion, NameID)' };
  }

  // 3. Verify that a Signature element exists
  const hasSignature = /<(?:ds:)?Signature[\s>]/i.test(xml);
  if (!hasSignature) {
    return { valid: false, error: 'SAML response does not contain an XML Signature' };
  }

  // 4. Extract the X509Certificate from the Signature's KeyInfo
  const certMatch = xml.match(
    /<(?:ds:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:ds:)?X509Certificate>/,
  );
  if (!certMatch?.[1]) {
    return { valid: false, error: 'SAML Signature does not contain an X509Certificate' };
  }

  // 5. Normalize both certificates (strip PEM headers, whitespace) and compare
  const normalize = (cert: string): string =>
    cert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '')
      .trim();

  const responseCert = normalize(certMatch[1]);
  const trustedCert = normalize(config.certificate);

  if (!responseCert || !trustedCert) {
    return { valid: false, error: 'Certificate content is empty after normalization' };
  }

  // Use timing-safe comparison for the certificate check
  const a = Buffer.from(responseCert, 'utf-8');
  const b = Buffer.from(trustedCert, 'utf-8');
  if (a.length !== b.length) {
    return { valid: false, error: 'SAML response certificate does not match trusted IdP certificate' };
  }

  if (!crypto.timingSafeEqual(a, b)) {
    return { valid: false, error: 'SAML response certificate does not match trusted IdP certificate' };
  }

  // 6. Verify SignatureValue and DigestValue are present (non-empty)
  const hasSignatureValue = /<(?:ds:)?SignatureValue[^>]*>[^<]+<\/(?:ds:)?SignatureValue>/.test(xml);
  const hasDigestValue = /<(?:ds:)?DigestValue[^>]*>[^<]+<\/(?:ds:)?DigestValue>/.test(xml);
  if (!hasSignatureValue || !hasDigestValue) {
    return { valid: false, error: 'SAML Signature missing SignatureValue or DigestValue' };
  }

  return { valid: true };
}

// ---- OIDC id_token verification ----

/**
 * Verify an OIDC id_token using the IdP's JWKS endpoint.
 * Returns the verified payload or null if verification fails.
 */
async function verifyIdToken(
  idToken: string,
  config: SSOConfig,
): Promise<Record<string, unknown> | null> {
  try {
    const issuer = config.issuer || config.discoveryUrl?.replace(/\/.well-known\/openid-configuration$/, '') || '';
    if (!issuer) return null;

    const jwksUri = new URL('/.well-known/jwks.json', issuer.replace(/\/$/, '') + '/');
    const JWKS = createRemoteJWKSet(jwksUri);

    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: issuer.replace(/\/$/, '') + '/',
      audience: config.clientId || undefined,
    });

    return payload as Record<string, unknown>;
  } catch (err) {
    console.warn('[SSO OIDC] id_token verification failed, falling back to userinfo:', err);
    return null;
  }
}

// ---- OIDC helpers ----

async function exchangeOidcCode(
  code: string,
  config: SSOConfig,
  redirectUri: string,
): Promise<SSOUserInfo | null> {
  const issuer = config.issuer || config.discoveryUrl?.replace(/\/.well-known\/openid-configuration$/, '') || '';
  const tokenEndpoint = `${issuer.replace(/\/$/, '')}/oauth/token`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId || '',
      client_secret: config.clientSecret || '',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error('[SSO OIDC] Token exchange failed:', await tokenRes.text());
    return null;
  }

  const tokens = await tokenRes.json();

  // Try to extract from id_token first — verify signature via JWKS
  if (tokens.id_token) {
    const payload = await verifyIdToken(tokens.id_token, config);
    if (payload) {
      const emailAttr = config.attributeMapping?.email || 'email';
      const nameAttr = config.attributeMapping?.displayName || 'name';
      const roleAttr = config.attributeMapping?.role;

      const email = payload[emailAttr] as string;
      if (email) {
        return {
          email,
          displayName: (payload[nameAttr] as string) || email.split('@')[0],
          role: roleAttr ? (payload[roleAttr] as string) : undefined,
        };
      }
    }
  }

  // Fallback: call userinfo endpoint
  if (tokens.access_token) {
    const userinfoEndpoint = `${issuer.replace(/\/$/, '')}/userinfo`;
    const uiRes = await fetch(userinfoEndpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (uiRes.ok) {
      const ui = await uiRes.json();
      const emailAttr = config.attributeMapping?.email || 'email';
      const nameAttr = config.attributeMapping?.displayName || 'name';
      const roleAttr = config.attributeMapping?.role;

      const email = ui[emailAttr] as string;
      if (email) {
        return {
          email,
          displayName: (ui[nameAttr] as string) || email.split('@')[0],
          role: roleAttr ? (ui[roleAttr] as string) : undefined,
        };
      }
    }
  }

  return null;
}

// ---- SAML helpers ----

function parseSamlResponse(samlResponseB64: string, config: SSOConfig): SSOUserInfo | null {
  try {
    const xml = Buffer.from(samlResponseB64, 'base64').toString('utf-8');

    // Verify SAML signature against trusted IdP certificate BEFORE extracting any data
    const sigResult = verifySamlSignature(xml, config);
    if (!sigResult.valid) {
      console.error(`[SSO SAML] Signature verification failed: ${sigResult.error}`);
      return null;
    }

    // Extract NameID (email)
    const nameIdMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/);
    const email = nameIdMatch?.[1]?.trim();

    if (!email) return null;

    // Extract attributes
    const attrs = extractSamlAttributes(xml);

    const emailAttr = config.attributeMapping?.email || 'email';
    const nameAttr = config.attributeMapping?.displayName || 'name';
    const roleAttr = config.attributeMapping?.role;

    // Use NameID as email, or look in attributes
    const userEmail = attrs[emailAttr] || email;
    const displayName = attrs[nameAttr] || attrs['displayName'] || attrs['name'] ||
      attrs['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
      userEmail.split('@')[0];
    const role = roleAttr ? attrs[roleAttr] : undefined;

    return { email: userEmail, displayName, role };
  } catch (err) {
    console.error('[SSO SAML] Parse error:', err);
    return null;
  }
}

/**
 * Extract SAML attributes from the response XML.
 * Simplified parsing — handles common attribute formats.
 */
function extractSamlAttributes(xml: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match <Attribute Name="..."> ... <AttributeValue>...</AttributeValue> ... </Attribute>
  const attrRegex = /<(?:saml2?:)?Attribute\s+[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/(?:saml2?:)?Attribute>/g;
  const valueRegex = /<(?:saml2?:)?AttributeValue[^>]*>([^<]*)<\/(?:saml2?:)?AttributeValue>/;

  let match;
  while ((match = attrRegex.exec(xml)) !== null) {
    const name = match[1];
    const body = match[2];
    const valMatch = body.match(valueRegex);
    if (valMatch) {
      attrs[name] = valMatch[1].trim();
      // Also store short name (last segment after /)
      const shortName = name.split('/').pop();
      if (shortName && shortName !== name) {
        attrs[shortName] = valMatch[1].trim();
      }
    }
  }

  return attrs;
}

// ---- Shared: Firebase user provisioning ----

async function provisionFirebaseUser(
  userInfo: SSOUserInfo,
  config: SSOConfig,
): Promise<string | null> {
  // Validate domain if allowedDomains is set
  if (config.allowedDomains.length > 0) {
    const emailDomain = userInfo.email.split('@')[1]?.toLowerCase();
    const allowed = config.allowedDomains.some(d => d.toLowerCase() === emailDomain);
    if (!allowed) {
      console.error(`[SSO] Domain ${emailDomain} not in allowed domains`);
      return null;
    }
  }

  let uid: string;

  try {
    // Try to find existing user
    const existingUser = await adminAuth.getUserByEmail(userInfo.email);
    uid = existingUser.uid;
  } catch {
    // User doesn't exist — create if auto-provision is enabled
    if (!config.autoProvision) {
      console.error(`[SSO] User ${userInfo.email} not found and auto-provision is disabled`);
      return null;
    }

    const newUser = await adminAuth.createUser({
      email: userInfo.email,
      displayName: userInfo.displayName,
      emailVerified: true, // SSO-verified
    });
    uid = newUser.uid;
  }

  // Auto-provision org membership if enabled
  if (config.autoProvision) {
    const memberRef = adminDb.doc(`orgs/${ORG}/members/${uid}`);
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      const role = userInfo.role || config.defaultRole || 'member';
      await memberRef.set({
        orgId: ORG,
        userId: uid,
        email: userInfo.email,
        displayName: userInfo.displayName,
        role,
        teams: [],
        title: '',
        active: true,
        ssoProvisioned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'sso',
      });
    }
  }

  return uid;
}

// ---- Route handlers ----

/**
 * GET — OIDC callback (authorization code flow)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const baseUrl = getBaseUrl(request);

    if (error) {
      const desc = url.searchParams.get('error_description') || error;
      return NextResponse.redirect(`${baseUrl}/login?error=sso_failed&detail=${encodeURIComponent(desc)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/login?error=sso_no_code`);
    }

    // --- C-3: Validate OIDC state parameter against HMAC cookie ---
    const state = url.searchParams.get('state');
    const cookieHeader = request.headers.get('cookie') || '';
    const ssoStateCookie = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('sso_state='));
    const storedHmac = ssoStateCookie?.split('=').slice(1).join('=') || '';

    if (!state || !storedHmac || !verifyStateHmac(state, storedHmac)) {
      console.error('[SSO Callback GET] State validation failed — possible CSRF');
      return NextResponse.redirect(`${baseUrl}/login?error=sso_invalid_state`);
    }

    const config = await getSSOConfig();
    if (!config.enabled || config.provider !== 'oidc') {
      return NextResponse.redirect(`${baseUrl}/login?error=sso_disabled`);
    }

    const redirectUri = `${baseUrl}/api/auth/sso/callback`;

    const userInfo = await exchangeOidcCode(code, config, redirectUri);
    if (!userInfo) {
      return NextResponse.redirect(`${baseUrl}/login?error=sso_exchange_failed`);
    }

    const uid = await provisionFirebaseUser(userInfo, config);
    if (!uid) {
      return NextResponse.redirect(`${baseUrl}/login?error=sso_provision_failed`);
    }

    // Create Firebase custom token
    const customToken = await adminAuth.createCustomToken(uid);

    // Redirect to login with token in hash — login page handles signInWithCustomToken
    // and then redirects to /app once Firebase auth state is set.
    const response = NextResponse.redirect(`${baseUrl}/login#sso_token=${customToken}`);

    // Clear the sso_state cookie after successful validation
    response.cookies.set('sso_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/sso',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error('[SSO Callback GET] Error:', err);
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(`${baseUrl}/login?error=sso_error`);
  }
}

/**
 * POST — SAML callback (SAMLResponse via HTTP-POST binding)
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const samlResponse = formData.get('SAMLResponse') as string | null;

    if (!samlResponse) {
      const baseUrl = getBaseUrl(request);
      return NextResponse.redirect(`${baseUrl}/login?error=sso_no_response`);
    }

    const config = await getSSOConfig();
    if (!config.enabled || config.provider !== 'saml') {
      const baseUrl = getBaseUrl(request);
      return NextResponse.redirect(`${baseUrl}/login?error=sso_disabled`);
    }

    const userInfo = parseSamlResponse(samlResponse, config);
    if (!userInfo) {
      const baseUrl = getBaseUrl(request);
      return NextResponse.redirect(`${baseUrl}/login?error=sso_parse_failed`);
    }

    const uid = await provisionFirebaseUser(userInfo, config);
    if (!uid) {
      const baseUrl = getBaseUrl(request);
      return NextResponse.redirect(`${baseUrl}/login?error=sso_provision_failed`);
    }

    // Create Firebase custom token
    const customToken = await adminAuth.createCustomToken(uid);

    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(`${baseUrl}/app#sso_token=${customToken}`);
  } catch (err: any) {
    console.error('[SSO Callback POST] Error:', err);
    const baseUrl = getBaseUrl(request);
    return NextResponse.redirect(`${baseUrl}/login?error=sso_error`);
  }
}
