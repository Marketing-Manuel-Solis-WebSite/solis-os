import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/oauth-providers';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;

    // Generate state for CSRF protection
    const state = randomBytes(16).toString('hex');

    const authUrl = buildAuthUrl(provider, state);
    if (!authUrl) {
      return NextResponse.json(
        { error: `OAuth not configured for provider: ${provider}` },
        { status: 400 },
      );
    }

    // Store state in a short-lived cookie for verification
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(`oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
