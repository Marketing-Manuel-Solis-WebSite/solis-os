import { getPendingEvents, markEventProcessed, getActiveWebhooksForEvent } from './integrations-db-admin';
import { deliverWebhookEvent } from './webhook-delivery';
import type { WebhookEvent } from './integrations-types';

export interface ProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

export async function processEventQueue(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, failed: 0, skipped: 0 };

  const events = await getPendingEvents(20);
  if (events.length === 0) return result;

  for (const event of events) {
    const ev = event as any;
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

      // Mark event as processed regardless (retries are handled per-webhook-log)
      await markEventProcessed(ev.id);

      if (allSuccess) {
        result.processed++;
      } else {
        result.failed++;
      }
    } catch {
      result.failed++;
      // Still mark as processed to avoid infinite loops
      try { await markEventProcessed(ev.id); } catch (markErr) { console.error('[EventDispatcher] failed to mark event processed:', markErr); }
    }
  }

  return result;
}
