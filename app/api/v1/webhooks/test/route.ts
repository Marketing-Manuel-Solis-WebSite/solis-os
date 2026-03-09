import { NextRequest, NextResponse } from 'next/server';
import { deliverWebhookEvent } from '@/lib/webhook-delivery';
import { getWebhook } from '@/lib/integrations-db-admin';

export async function POST(req: NextRequest) {
  try {
    // This endpoint requires WEBHOOK_PROCESSOR_SECRET
    const authHeader = req.headers.get('authorization') || '';
    const secret = process.env.WEBHOOK_PROCESSOR_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { webhookId } = body;
    if (!webhookId) {
      return NextResponse.json({ error: 'webhookId is required' }, { status: 400 });
    }

    // Load webhook via admin SDK
    const webhook = await getWebhook(webhookId);
    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Send test event
    const testEvent = {
      id: `test_${Date.now()}`,
      eventType: 'task.created',
      payload: {
        test: true,
        message: 'This is a test event from Solis Center',
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date(),
    };

    const result = await deliverWebhookEvent(webhook, testEvent);

    return NextResponse.json({
      ok: result.success,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
    });
  } catch (err) {
    console.error('[WebhookTest] test delivery failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
