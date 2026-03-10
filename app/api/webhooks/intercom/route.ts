import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.INTERCOM_CLIENT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Intercom webhook secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Require valid HMAC signature (timing-safe)
    const signature = req.headers.get('x-hub-signature') || '';
    const expected = 'sha1=' + createHmac('sha1', secret).update(bodyText).digest('hex');
    if (!signature || signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
