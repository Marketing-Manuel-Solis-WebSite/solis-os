import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // Verify HubSpot signature
    const secret = process.env.HUBSPOT_CLIENT_SECRET;
    if (secret) {
      const signature = req.headers.get('x-hubspot-signature-v3') || '';
      const timestamp = req.headers.get('x-hubspot-request-timestamp') || '';
      if (signature && timestamp) {
        const sourceString = `${req.method}${req.url}${bodyText}${timestamp}`;
        const expected = createHmac('sha256', secret).update(sourceString).digest('base64');
        if (signature !== expected) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const events = Array.isArray(payload) ? payload : [payload];
    for (const event of events) {
      await queueEvent({
        eventType: 'task.created',
        entityId: event.objectId?.toString() || '',
        entityType: `hubspot_${event.subscriptionType || 'event'}`,
        payload: {
          provider: 'hubspot',
          eventType: event.subscriptionType || '',
          objectId: event.objectId,
          propertyName: event.propertyName || '',
          propertyValue: event.propertyValue || '',
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
