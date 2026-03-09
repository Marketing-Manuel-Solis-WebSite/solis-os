import { NextRequest, NextResponse } from 'next/server';
import { queueEvent } from '@/lib/integrations-db-admin';
import { timingSafeEqual } from 'crypto';

function verifyWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_PROCESSOR_SECRET;
  if (!secret) return false; // Fail-closed: no secret configured → reject

  const provided = req.headers.get('x-webhook-secret') || '';
  if (!provided || provided.length !== secret.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyText = await req.text();
    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { payload = { raw: bodyText }; }

    const eventType = payload.event || payload.type || 'custom.event';

    await queueEvent({
      eventType: 'task.created',
      entityId: payload.id?.toString() || '',
      entityType: 'custom_webhook',
      payload: {
        provider: 'custom_webhook',
        eventType,
        data: payload,
        receivedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
