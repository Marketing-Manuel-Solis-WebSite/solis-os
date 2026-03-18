// ================================================================
// SSO Status — GET /api/auth/sso/status
// ================================================================
// Public endpoint: returns whether SSO is enabled and the provider name.
// Used by the login page to conditionally show the SSO button.

import { NextResponse } from 'next/server';
import { getSSOConfig } from '@/lib/security/sso-config';

export async function GET() {
  try {
    const config = await getSSOConfig();
    return NextResponse.json({
      enabled: config.enabled,
      providerName: config.providerName || 'SSO',
      provider: config.provider,
    });
  } catch {
    return NextResponse.json({ enabled: false, providerName: 'SSO', provider: 'oidc' });
  }
}
