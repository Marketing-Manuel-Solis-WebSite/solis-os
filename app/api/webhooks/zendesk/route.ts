import { NextRequest, NextResponse } from 'next/server';

// FAIL-CLOSED: Zendesk webhook integration is disabled until a verification
// secret is configured. Zendesk supports webhook signing with a shared secret.
// To enable: set ZENDESK_WEBHOOK_SECRET env var and configure Zendesk to sign.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Zendesk webhook integration is not configured. Contact admin.' },
    { status: 422 },
  );
}
