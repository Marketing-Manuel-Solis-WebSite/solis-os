import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { payload = { raw: bodyText }; }

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.id?.toString() || '',
      entityType: 'zapier_trigger',
      payload: {
        provider: 'zapier',
        data: payload,
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
