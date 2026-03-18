// ================================================================
// SSO Config Admin API — GET / PUT /api/auth/sso/config
// ================================================================
// Protected: requires admin role.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getSSOConfig, saveSSOConfig, validateSSOConfig, type SSOConfig } from '@/lib/security/sso-config';

export async function GET(request: Request) {
  const authed = await requireAdmin(request);
  if (authed instanceof Response) return authed;

  try {
    const config = await getSSOConfig();
    // Mask client secret for security
    const masked = {
      ...config,
      clientSecret: config.clientSecret ? '••••••••' : '',
    };
    return NextResponse.json(masked);
  } catch {
    return NextResponse.json({ error: 'Failed to read SSO config' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authed = await requireAdmin(request);
  if (authed instanceof Response) return authed;

  try {
    const body = await request.json();
    const config = body as SSOConfig;

    // If client secret is masked, preserve the existing one
    if (config.clientSecret === '••••••••') {
      const existing = await getSSOConfig();
      config.clientSecret = existing.clientSecret;
    }

    const errors = validateSSOConfig(config);
    if (errors.length > 0 && config.enabled) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    await saveSSOConfig(config, authed.uid);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[SSO Config] Save error:', err);
    return NextResponse.json({ error: 'Failed to save SSO config' }, { status: 500 });
  }
}
