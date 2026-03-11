import { NextRequest, NextResponse } from 'next/server';
import { getIncomingWebhookByToken, addIncomingEvent, incrementIncomingEventCount } from '@/lib/integrations-db-admin';
import { createTask } from '@/lib/db-admin';
import { verifySignature } from '@/lib/integrations-crypto';
import { notifyUsersAdmin } from '@/lib/notify-admin';
import { afterTaskCreatedAdmin } from '@/lib/task-side-effects-admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    // Find incoming webhook by token
    const webhook = await getIncomingWebhookByToken(token);
    if (!webhook) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
    }

    const bodyText = await req.text();
    if (bodyText.length > 1_048_576) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Verify HMAC signature — fail-closed: always require secret + valid signature
    if (!webhook.secret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured. Please set a secret for this endpoint.' },
        { status: 400 },
      );
    }
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-hub-signature-256') || '';
    if (!signature || !verifySignature(webhook.secret, bodyText, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch (err) {
      console.error('[IncomingWebhook] JSON parse failed:', err);
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

    // Atomic event count increment — prevents counter drift under concurrent requests
    await incrementIncomingEventCount(webhook.id);

    // Execute action
    try {
      switch (webhook.actionType) {
        case 'create_task': {
          const config = webhook.actionConfig || {};
          const title = extractField(payload, config.titleField) || `Incoming: ${webhook.name}`;
          const description = extractField(payload, config.descriptionField) || JSON.stringify(payload).slice(0, 500);
          const taskData = {
            title,
            description,
            status: config.defaultStatus || 'todo',
            priority: config.defaultPriority || 'medium',
            teamId: config.teamId || '',
            tags: config.tags || ['incoming-webhook'],
            createdBy: `webhook:${webhook.id}`,
            assignees: [] as string[],
          };
          const taskRef = await createTask(taskData);
          // Trigger unified task side effects (audit, webhooks, automations)
          await afterTaskCreatedAdmin({
            taskId: taskRef.id,
            task: taskData,
            actor: { actorId: `webhook:${webhook.id}`, actorName: `Webhook: ${webhook.name}` },
          });
          break;
        }
        case 'create_notification': {
          const config = webhook.actionConfig || {};
          const recipients = config.notifyUsers || [];
          if (recipients.length > 0) {
            await notifyUsersAdmin(recipients, {
              eventType: 'system',
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
    } catch (err) {
      // Action failures shouldn't return errors to the sender
      console.error('[IncomingWebhook] action execution failed:', err);
    }

    // Always return 200 quickly
    return NextResponse.json({ ok: true, received: true });
  } catch (err) {
    console.error('[IncomingWebhook] request handling failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function extractField(payload: any, fieldPath?: string): string {
  if (!fieldPath || !payload) return '';
  const parts = fieldPath.split('.');
  if (parts.length > 10) return ''; // prevent deep traversal
  let current = payload;
  for (const part of parts) {
    if (current == null || BLOCKED_KEYS.has(part)) return '';
    current = current[part];
  }
  return typeof current === 'string' ? current.slice(0, 2000) : (current != null ? String(current).slice(0, 2000) : '');
}
