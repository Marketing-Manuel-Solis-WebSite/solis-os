import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/oauth-providers';
import { randomBytes } from 'crypto';
import { authenticateRequest } from '@/lib/server-auth';

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

    const { provider } = await params;

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
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
