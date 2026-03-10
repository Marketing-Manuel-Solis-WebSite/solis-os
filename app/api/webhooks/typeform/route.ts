import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { queueEvent } from '@/lib/integrations-db-admin';

const MAX_PAYLOAD = 1_048_576; // 1MB

export async function POST(req: NextRequest) {
  try {
    // FAIL-CLOSED: reject if secret not configured
    const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Typeform webhook secret not configured. Contact admin.' },
        { status: 422 },
      );
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Require valid signature
    const signature = req.headers.get('typeform-signature') || '';
    const expected = 'sha256=' + createHmac('sha256', secret).update(bodyText).digest('base64');
    if (!signature || signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = payload.event_type || 'form_response';

    await queueEvent({
      eventType: 'form.submitted',
      entityId: payload.form_response?.form_id || payload.event_id || '',
      entityType: 'typeform_response',
      payload: {
        provider: 'typeform',
        typeformEventType: eventType,
        formId: payload.form_response?.form_id || '',
        answers: payload.form_response?.answers || [],
        submittedAt: payload.form_response?.submitted_at || new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true, received: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
