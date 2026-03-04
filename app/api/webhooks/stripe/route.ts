import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('stripe-signature') || '';

    // Verify Stripe webhook signature
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (endpointSecret && signature) {
      const isValid = verifyStripeSignature(bodyText, signature, endpointSecret);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = payload.type || 'stripe.event';

    // Queue event for internal processing
    await queueEvent({
      eventType: 'form.submitted', // Map to closest internal event
      entityId: payload.id || '',
      entityType: 'stripe_event',
      payload: {
        provider: 'stripe',
        stripeEventType: eventType,
        data: payload.data?.object || payload,
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  try {
    const parts = header.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const sig = parts.find(p => p.startsWith('v1='))?.slice(3);

    if (!timestamp || !sig) return false;

    // Check timestamp is within 5 minutes
    const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
    if (age > 300) return false;

    const expectedSig = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}
