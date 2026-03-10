import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.AIRTABLE_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Airtable webhook secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Require valid HMAC signature
    const signature = req.headers.get('x-airtable-content-mac') || '';
    const expected = 'hmac-sha256=' + createHmac('sha256', secret).update(bodyText).digest('hex');
    if (!signature || signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const baseId = payload.base?.id || '';

    await queueEvent({
      eventType: 'task.updated',
      entityId: baseId,
      entityType: 'airtable_change',
      payload: {
        provider: 'airtable',
        baseId,
        actionMetadata: payload.actionMetadata || {},
        changedTablesById: payload.changedTablesById || {},
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
