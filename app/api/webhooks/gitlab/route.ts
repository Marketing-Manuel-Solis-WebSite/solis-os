import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.GITLAB_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'GitLab webhook secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    // Require valid token (timing-safe comparison)
    const token = req.headers.get('x-gitlab-token') || '';
    if (!token || token.length !== secret.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

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
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
