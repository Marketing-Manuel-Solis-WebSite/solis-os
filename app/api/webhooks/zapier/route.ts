import { NextRequest, NextResponse } from 'next/server';

// FAIL-CLOSED: Zapier webhook integration is disabled until a verification
// secret is configured. Zapier supports custom headers for authentication.
// To enable: set ZAPIER_WEBHOOK_SECRET env var and configure Zapier to send
// the secret in x-webhook-secret header.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Zapier webhook integration is not configured. Contact admin.' },
    { status: 422 },
  );
}
