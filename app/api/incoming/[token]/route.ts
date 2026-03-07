import { NextRequest, NextResponse } from 'next/server';
import { getIncomingWebhookByToken, addIncomingEvent, updateIncomingWebhook } from '@/lib/integrations-db';
import { createTask } from '@/lib/db';
import { verifySignature } from '@/lib/integrations-crypto';
import { notifyMany } from '@/lib/notifications';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    // Find incoming webhook by token
    const webhook = await getIncomingWebhookByToken(token);
    if (!webhook) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
    }

    const bodyText = await req.text();

    // Verify HMAC signature if secret is configured (fail-closed: reject if no signature provided)
    if (webhook.secret) {
      const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-hub-signature-256') || '';
      if (!signature || !verifySignature(webhook.secret, bodyText, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      payload = { raw: bodyText };
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || '';

    // Record the event
    await addIncomingEvent(webhook.id, {
      eventType: webhook.provider || 'custom',
      payload,
      sourceIp: ip,
    });

    // Increment event count
    await updateIncomingWebhook(webhook.id, {
      eventCount: (webhook.eventCount || 0) + 1,
    });

    // Execute action
    try {
      switch (webhook.actionType) {
        case 'create_task': {
          const config = webhook.actionConfig || {};
          const title = extractField(payload, config.titleField) || `Incoming: ${webhook.name}`;
          const description = extractField(payload, config.descriptionField) || JSON.stringify(payload).slice(0, 500);
          await createTask({
            title,
            description,
            status: config.defaultStatus || 'todo',
            priority: config.defaultPriority || 'medium',
            teamId: config.teamId || '',
            tags: config.tags || ['incoming-webhook'],
            createdBy: `webhook:${webhook.id}`,
          });
          break;
        }
        case 'create_notification': {
          const config = webhook.actionConfig || {};
          const recipients = config.notifyUsers || [];
          if (recipients.length > 0) {
            await notifyMany(recipients, {
              type: 'system',
              title: config.notificationTitle || `Webhook: ${webhook.name}`,
              message: extractField(payload, config.messageField) || 'Nuevo evento recibido',
              entityUrl: '/app/integrations',
            });
          }
          break;
        }
        case 'trigger_automation':
          // Placeholder — automations are client-side in this app
          break;
      }
    } catch {
      // Action failures shouldn't return errors to the sender
    }

    // Always return 200 quickly
    return NextResponse.json({ ok: true, received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

function extractField(payload: any, fieldPath?: string): string {
  if (!fieldPath || !payload) return '';
  const parts = fieldPath.split('.');
  let current = payload;
  for (const part of parts) {
    if (current == null) return '';
    current = current[part];
  }
  return typeof current === 'string' ? current : (current != null ? String(current) : '');
}
