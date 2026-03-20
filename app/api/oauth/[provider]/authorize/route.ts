import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/oauth-providers';
import { randomBytes } from 'crypto';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID } from '@/lib/org';
import { INTEGRATION_CATALOG } from '@/lib/integrations-catalog';

// Known OAuth-capable providers from the integration catalog
const VALID_OAUTH_PROVIDERS = INTEGRATION_CATALOG
  .filter(i => i.oauthSupported)
  .map(i => i.provider);

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    // Require authenticated user — anonymous visitors must not start OAuth flows
    const authedUser = await authenticateRequest(req);
    if (!authedUser) {
      return NextResponse.json(
        { error: 'Authentication required. Pass Authorization: Bearer <idToken>' },
        { status: 401 },
      );
    }

    // Verify the user has at least manager role to connect integrations
    const memberSnap = await adminDb.collection(`orgs/${ORG_ID}/members`).doc(authedUser.uid).get();
    const callerRole = memberSnap.data()?.role as string | undefined;
    const ALLOWED_OAUTH_ROLES = ['owner', 'admin', 'manager'];
    if (!memberSnap.exists || !callerRole || !ALLOWED_OAUTH_ROLES.includes(callerRole)) {
      return NextResponse.json({ error: 'Manager role required to connect integrations' }, { status: 403 });
    }

    const { provider } = await params;

    // Validate provider against known OAuth-capable catalogue
    if (!provider || !VALID_OAUTH_PROVIDERS.includes(provider as any)) {
      return NextResponse.json({ error: 'Invalid or unsupported OAuth provider' }, { status: 400 });
    }

    // Generate state for CSRF protection — include uid to bind flow to user
    const raw = randomBytes(16).toString('hex');
    const state = `${raw}:${authedUser.uid}`;

    const authUrl = buildAuthUrl(provider, state);
    if (!authUrl) {
      return NextResponse.json(
        { error: `OAuth not configured for provider: ${provider}` },
        { status: 400 },
      );
    }

    // Store state in a short-lived cookie for verification on callback
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(`oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });

    // Also store the authenticated uid so callback can verify
    response.cookies.set(`oauth_uid_${provider}`, authedUser.uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (err) {
    console.error('[OAuth] authorize failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
