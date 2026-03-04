import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { queueEvent } from '@/lib/integrations-db';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // Verify Intercom webhook signature
    const secret = process.env.INTERCOM_CLIENT_SECRET;
    if (secret) {
      const signature = req.headers.get('x-hub-signature') || '';
      if (signature) {
        const expected = 'sha1=' + createHmac('sha1', secret).update(bodyText).digest('hex');
        if (signature !== expected) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const topic = payload.topic || 'unknown';

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.data?.item?.id || '',
      entityType: `intercom_${topic}`,
      payload: {
        provider: 'intercom',
        topic,
        type: payload.data?.item?.type || '',
        conversationId: payload.data?.item?.id || '',
        author: payload.data?.item?.source?.author?.name || '',
        body: payload.data?.item?.source?.body?.slice(0, 200) || '',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
