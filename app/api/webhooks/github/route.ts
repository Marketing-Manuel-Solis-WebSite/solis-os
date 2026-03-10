import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'GitHub webhook secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Require valid signature
    const signature = req.headers.get('x-hub-signature-256') || '';
    const expected = 'sha256=' + createHmac('sha256', secret).update(bodyText).digest('hex');
    if (!signature || signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const githubEvent = req.headers.get('x-github-event') || 'ping';

    let internalEvent: 'task.created' | 'task.updated' | 'task.status_changed' = 'task.created';
    if (githubEvent === 'issues' && payload.action === 'opened') {
      internalEvent = 'task.created';
    } else if (githubEvent === 'issues' && payload.action === 'closed') {
      internalEvent = 'task.status_changed';
    } else if (githubEvent === 'issues') {
      internalEvent = 'task.updated';
    } else if (githubEvent === 'pull_request' && payload.action === 'opened') {
      internalEvent = 'task.created';
    } else if (githubEvent === 'pull_request' && payload.action === 'closed') {
      internalEvent = 'task.status_changed';
    }

    await queueEvent({
      eventType: internalEvent,
      entityId: payload.issue?.id?.toString() || payload.pull_request?.id?.toString() || '',
      entityType: `github_${githubEvent}`,
      payload: {
        provider: 'github',
        githubEvent,
        action: payload.action || '',
        repository: payload.repository?.full_name || '',
        title: payload.issue?.title || payload.pull_request?.title || '',
        url: payload.issue?.html_url || payload.pull_request?.html_url || '',
        sender: payload.sender?.login || '',
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
