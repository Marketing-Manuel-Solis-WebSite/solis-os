import { NextRequest, NextResponse } from 'next/server';
import {
  verifySlackSignature,
  parseCommand,
  dispatchSlackCommand,
} from '@/lib/connectors/slack-commands';

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

    // Parse URL-encoded form body
    const params = new URLSearchParams(bodyText);
    const commandText = params.get('text') || '';
    const slackUserId = params.get('user_id') || '';

    // Parse and dispatch the command
    const parsed = parseCommand(commandText);
    const response = await dispatchSlackCommand(parsed, slackUserId);

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[Slack Commands] Error:', err?.message);
    return NextResponse.json(
      {
        response_type: 'ephemeral',
        text: 'An internal error occurred. Please try again later.',
      },
      { status: 200 }, // Slack expects 200 even for errors
    );
  }
}
