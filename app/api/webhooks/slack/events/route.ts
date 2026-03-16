import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/connectors/slack-commands';
import { dispatchSlackEvent } from '@/lib/connectors/slack-events';

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if signing secret not configured
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      return NextResponse.json(
        { error: 'Slack signing secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    const bodyText = await req.text();

    // Verify Slack signature
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';

    if (!verifySlackSignature(signingSecret, timestamp, bodyText, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // URL verification must return the challenge immediately
    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge });
    }

    const response = await dispatchSlackEvent(payload);
    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[Slack Events] Error:', err?.message);
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 to prevent Slack retries
  }
}
