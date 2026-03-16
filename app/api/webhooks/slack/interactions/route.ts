import { NextRequest, NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/connectors/slack-commands';
import { dispatchSlackInteraction } from '@/lib/connectors/slack-interactions';

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

    // Slack sends interactive payloads as URL-encoded with a "payload" field
    const params = new URLSearchParams(bodyText);
    const rawPayload = params.get('payload');

    if (!rawPayload) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in payload' }, { status: 400 });
    }

    const response = await dispatchSlackInteraction(payload);

    // Acknowledge the interaction
    if (!response) {
      return new NextResponse(null, { status: 200 });
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[Slack Interactions] Error:', err?.message);
    return new NextResponse(null, { status: 200 }); // Acknowledge to prevent Slack retries
  }
}
