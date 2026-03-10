import { NextRequest, NextResponse } from 'next/server';

// FAIL-CLOSED: Discord webhook integration is disabled until a verification
// secret is configured. Discord Bot interactions require Ed25519 signature
// verification which needs a public key configured.
// To enable: implement Discord signature verification with DISCORD_PUBLIC_KEY.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Discord webhook integration is not configured. Contact admin.' },
    { status: 422 },
  );
}
