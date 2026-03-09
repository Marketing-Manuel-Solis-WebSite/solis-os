import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // Verify Airtable webhook signature
    const secret = process.env.AIRTABLE_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get('x-airtable-content-mac') || '';
      if (signature) {
        const expected = 'hmac-sha256=' + createHmac('sha256', secret).update(bodyText).digest('hex');
        if (signature !== expected) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const baseId = payload.base?.id || '';
    const tableId = payload.webhook?.notification_url ? '' : '';

    await queueEvent({
      eventType: 'task.updated',
      entityId: baseId,
      entityType: 'airtable_change',
      payload: {
        provider: 'airtable',
        baseId,
        tableId,
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
