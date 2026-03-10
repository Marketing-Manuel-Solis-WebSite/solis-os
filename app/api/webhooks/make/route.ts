import { NextRequest, NextResponse } from 'next/server';

// FAIL-CLOSED: Make (Integromat) webhook integration is disabled until a
// verification secret is configured. Make supports custom headers for auth.
// To enable: set MAKE_WEBHOOK_SECRET env var and configure Make to send
// the secret in x-webhook-secret header.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Make webhook integration is not configured. Contact admin.' },
    { status: 422 },
  );
}
