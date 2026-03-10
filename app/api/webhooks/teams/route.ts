import { NextRequest, NextResponse } from 'next/server';

// FAIL-CLOSED: Microsoft Teams webhook integration is disabled until proper
// Bot Framework authentication is configured.
// To enable: implement Bot Framework token validation with TEAMS_APP_ID.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Teams webhook integration is not configured. Contact admin.' },
    { status: 422 },
  );
}
