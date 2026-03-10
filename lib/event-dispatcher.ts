import { getPendingEvents, markEventProcessed, markEventExhausted, markEventRetry, getActiveWebhooksForEvent } from './integrations-db-admin';
import { deliverWebhookEvent } from './webhook-delivery';
import type { WebhookEvent } from './integrations-types';

export interface ProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

const MAX_ATTEMPTS = 3;

export async function processEventQueue(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, failed: 0, skipped: 0 };

  const events = await getPendingEvents(20);
  if (events.length === 0) return result;

  const now = Date.now();

  for (const event of events) {
    const ev = event as any;

    // Skip events not yet ready for retry (exponential backoff)
    if (ev.nextAttemptAt) {
      const ts = ev.nextAttemptAt;
      const retryMs = typeof ts.toMillis === 'function' ? ts.toMillis() :
                      (ts.seconds || ts._seconds || 0) * 1000;
      if (retryMs > now) continue;
    }

    try {
      // Find active webhooks subscribed to this event type
      const webhooks = await getActiveWebhooksForEvent(ev.eventType as WebhookEvent);

      if (webhooks.length === 0) {
        // No webhooks for this event, mark as processed
        await markEventProcessed(ev.id);
        result.skipped++;
        continue;
      }

      // Deliver to each webhook
      let allSuccess = true;
      for (const webhook of webhooks) {
        const delivery = await deliverWebhookEvent(webhook, ev);
        if (!delivery.success) allSuccess = false;
      }

      if (allSuccess) {
        // All deliveries succeeded — mark event as done
        await markEventProcessed(ev.id);
        result.processed++;
      } else {
        // At least one delivery failed — schedule retry or exhaust
        const attempts = (ev.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await markEventExhausted(ev.id, attempts);
        } else {
          await markEventRetry(ev.id, attempts);
        }
        result.failed++;
      }
    } catch (err) {
      // Unexpected error processing event — track attempt
      console.error('[EventDispatcher] event processing error:', err);
      const attempts = (ev.attempts || 0) + 1;
      try {
        if (attempts >= MAX_ATTEMPTS) {
          await markEventExhausted(ev.id, attempts);
        } else {
          await markEventRetry(ev.id, attempts);
        }
      } catch (markErr) {
        console.error('[EventDispatcher] failed to update event state:', markErr);
      }
      result.failed++;
    }
  }

  return result;
}
