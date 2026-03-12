import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { queueEvent, checkReplayProtection } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.JIRA_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Jira webhook integration is not configured. Contact admin.' },
        { status: 422 },
      );
    }

    // Jira doesn't natively support HMAC signing. Verify via shared secret header.
    // Configure Jira to send: X-Jira-Secret: <your-secret>
    const providedSecret = req.headers.get('x-jira-secret') || '';
    if (!providedSecret || providedSecret.length !== secret.length ||
        !timingSafeEqual(Buffer.from(providedSecret), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Replay protection via Jira's timestamp + issue key combo
    const webhookEvent = payload.webhookEvent || '';
    const issueKey = payload.issue?.key || '';
    const replayId = `${webhookEvent}_${issueKey}_${payload.timestamp || Date.now()}`;
    const isNew = await checkReplayProtection('jira', replayId);
    if (!isNew) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Map Jira webhook events to internal event types
    let internalEvent: 'task.created' | 'task.updated' | 'task.status_changed' = 'task.updated';
    if (webhookEvent === 'jira:issue_created') {
      internalEvent = 'task.created';
    } else if (webhookEvent === 'jira:issue_updated') {
      // Check if it was a status transition
      const changelog = payload.changelog?.items || [];
      const hasStatusChange = changelog.some((item: any) => item.field === 'status');
      internalEvent = hasStatusChange ? 'task.status_changed' : 'task.updated';
    } else if (webhookEvent === 'jira:issue_deleted') {
      internalEvent = 'task.updated'; // No 'task.deleted' from external → treat as update
    }

    await queueEvent({
      eventType: internalEvent,
      entityId: payload.issue?.id?.toString() || '',
      entityType: `jira_${webhookEvent.replace('jira:', '')}`,
      payload: {
        provider: 'jira',
        jiraEvent: webhookEvent,
        issueKey,
        issueType: payload.issue?.fields?.issuetype?.name || '',
        summary: payload.issue?.fields?.summary || '',
        status: payload.issue?.fields?.status?.name || '',
        priority: payload.issue?.fields?.priority?.name || '',
        assignee: payload.issue?.fields?.assignee?.displayName || '',
        project: payload.issue?.fields?.project?.key || '',
        url: payload.issue?.self || '',
        sender: payload.user?.displayName || '',
        changelog: (payload.changelog?.items || []).slice(0, 5).map((item: any) => ({
          field: item.field,
          from: item.fromString,
          to: item.toString,
        })),
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
