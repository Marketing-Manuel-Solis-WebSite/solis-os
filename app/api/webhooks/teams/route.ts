import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const eventType = payload.type || 'message';

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.id || '',
      entityType: 'teams_event',
      payload: {
        provider: 'teams',
        teamsEventType: eventType,
        channelId: payload.channelData?.channel?.id || '',
        teamId: payload.channelData?.team?.id || '',
        text: payload.text || '',
        from: payload.from?.name || '',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
