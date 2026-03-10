import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.HUBSPOT_CLIENT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'HubSpot webhook secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Require valid HubSpot v3 signature
    const signature = req.headers.get('x-hubspot-signature-v3') || '';
    const timestamp = req.headers.get('x-hubspot-request-timestamp') || '';
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    // Verify timestamp freshness (5 minute window)
    const age = Math.abs(Date.now() - parseInt(timestamp));
    if (isNaN(age) || age > 300_000) {
      return NextResponse.json({ error: 'Request timestamp too old' }, { status: 401 });
    }

    const sourceString = `${req.method}${req.url}${bodyText}${timestamp}`;
    const expected = createHmac('sha256', secret).update(sourceString).digest('base64');
    if (signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const events = Array.isArray(payload) ? payload : [payload];
    for (const event of events.slice(0, 50)) { // Cap batch size
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
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
