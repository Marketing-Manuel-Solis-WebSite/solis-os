import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { payload = { raw: bodyText }; }

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.id?.toString() || payload.scenarioId?.toString() || '',
      entityType: 'make_trigger',
      payload: {
        provider: 'make',
        data: payload,
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
