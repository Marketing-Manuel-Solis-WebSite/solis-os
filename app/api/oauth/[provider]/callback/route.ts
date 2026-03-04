import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/oauth-providers';
import { encryptToken } from '@/lib/integrations-crypto';
import { addIntegration, getIntegrationByProvider, updateIntegration } from '@/lib/integrations-db';
import type { IntegrationProvider } from '@/lib/integrations-types';
import { INTEGRATION_CATALOG } from '@/lib/integrations-catalog';

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const appUrl = rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`;
  const redirectUrl = `${appUrl}/app/integrations`;

  try {
    const { provider } = await params;
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${redirectUrl}?error=oauth_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${redirectUrl}?error=missing_code`);
    }

    // Verify state
    const storedState = req.cookies.get(`oauth_state_${provider}`)?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(`${redirectUrl}?error=invalid_state`);
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(provider, code);
    if (!tokens || !tokens.accessToken) {
      return NextResponse.redirect(`${redirectUrl}?error=token_exchange_failed`);
    }

    // Encrypt tokens before storing
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : '';

    // Find catalog entry
    const catalogEntry = INTEGRATION_CATALOG.find(i => i.provider === provider);

    // Check if integration already exists
    const existing = await getIntegrationByProvider(provider as IntegrationProvider);

    if (existing) {
      // Update existing integration
      await updateIntegration(existing.id, {
        status: 'connected',
        oauthTokens: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : 0,
          scope: tokens.scope,
        },
      });
    } else {
      // Create new integration
      await addIntegration({
        provider: provider as IntegrationProvider,
        category: catalogEntry?.category || 'automation',
        status: 'connected',
        displayName: catalogEntry?.name || provider,
        oauthTokens: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : 0,
          scope: tokens.scope,
        },
        createdBy: 'oauth',
      });
    }

    // Clear state cookie
    const response = NextResponse.redirect(`${redirectUrl}?connected=${provider}`);
    response.cookies.delete(`oauth_state_${provider}`);

    return response;
  } catch (err: any) {
    return NextResponse.redirect(`${redirectUrl}?error=oauth_error`);
  }
}
