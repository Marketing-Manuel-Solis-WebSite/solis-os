import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const webhookEvent = payload.webhookEvent || payload.issue_event_type_name || 'unknown';

    let internalEvent: 'task.created' | 'task.updated' | 'task.status_changed' = 'task.updated';
    if (webhookEvent.includes('created')) internalEvent = 'task.created';
    else if (webhookEvent.includes('deleted')) internalEvent = 'task.status_changed';

    await queueEvent({
      eventType: internalEvent,
      entityId: payload.issue?.id?.toString() || '',
      entityType: 'jira_issue',
      payload: {
        provider: 'jira',
        jiraEvent: webhookEvent,
        issueKey: payload.issue?.key || '',
        summary: payload.issue?.fields?.summary || '',
        status: payload.issue?.fields?.status?.name || '',
        priority: payload.issue?.fields?.priority?.name || '',
        assignee: payload.issue?.fields?.assignee?.displayName || '',
        reporter: payload.issue?.fields?.reporter?.displayName || '',
        project: payload.issue?.fields?.project?.key || '',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
