import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { queueEvent } from '@/lib/integrations-db';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // Verify Typeform signature if secret is configured
    const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get('typeform-signature') || '';
      const expected = 'sha256=' + createHmac('sha256', secret).update(bodyText).digest('base64');
      if (signature !== expected) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
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
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
