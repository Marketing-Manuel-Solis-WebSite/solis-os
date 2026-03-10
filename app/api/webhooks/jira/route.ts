import { NextRequest, NextResponse } from 'next/server';

// FAIL-CLOSED: Jira webhook integration is disabled until a verification
// secret is configured. Jira webhooks don't natively support HMAC signatures,
// so a shared secret header must be configured in Jira and validated here.
// To enable: set JIRA_WEBHOOK_SECRET env var and configure Jira to send it.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Jira webhook integration is not configured. Contact admin.' },
    { status: 422 },
  );
}
