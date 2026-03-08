import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    // Verify GitLab webhook token
    const secret = process.env.GITLAB_WEBHOOK_SECRET;
    if (secret) {
      const token = req.headers.get('x-gitlab-token') || '';
      if (token !== secret) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const gitlabEvent = req.headers.get('x-gitlab-event') || payload.object_kind || 'unknown';

    let internalEvent: 'task.created' | 'task.updated' | 'task.status_changed' = 'task.created';
    if (gitlabEvent.includes('Issue') || gitlabEvent === 'issue') {
      if (payload.object_attributes?.action === 'open') internalEvent = 'task.created';
      else if (payload.object_attributes?.action === 'close') internalEvent = 'task.status_changed';
      else internalEvent = 'task.updated';
    } else if (gitlabEvent.includes('Merge Request') || gitlabEvent === 'merge_request') {
      if (payload.object_attributes?.action === 'open') internalEvent = 'task.created';
      else if (payload.object_attributes?.action === 'merge' || payload.object_attributes?.action === 'close') internalEvent = 'task.status_changed';
      else internalEvent = 'task.updated';
    }

    await queueEvent({
      eventType: internalEvent,
      entityId: payload.object_attributes?.id?.toString() || '',
      entityType: `gitlab_${payload.object_kind || 'event'}`,
      payload: {
        provider: 'gitlab',
        gitlabEvent,
        action: payload.object_attributes?.action || '',
        project: payload.project?.path_with_namespace || '',
        title: payload.object_attributes?.title || '',
        url: payload.object_attributes?.url || '',
        author: payload.user?.username || '',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
