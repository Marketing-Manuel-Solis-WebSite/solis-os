import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.ticket?.id?.toString() || payload.id?.toString() || '',
      entityType: 'zendesk_ticket',
      payload: {
        provider: 'zendesk',
        ticketId: payload.ticket?.id || payload.id || '',
        subject: payload.ticket?.subject || payload.subject || '',
        status: payload.ticket?.status || payload.status || '',
        priority: payload.ticket?.priority || payload.priority || '',
        requester: payload.ticket?.requester?.name || payload.requester?.name || '',
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
