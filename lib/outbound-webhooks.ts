// ============================================================
// Outbound Webhook Dispatch — send events to subscriber endpoints
// ============================================================
//
// When a domain event occurs (task created, updated, etc.), this module
// queries active webhook subscriptions matching the event type, then
// POSTs the payload with HMAC signature. Retries once on failure.
// ============================================================

import { createHmac } from 'crypto';
import {
  getActiveWebhooksForEvent,
  addWebhookLog,
  incrementWebhookDeliveryStats,
} from './integrations-db-admin';
import type { WebhookEvent } from './integrations-types';

// ---- Types ----

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdBy: string;
  deliveryStats: {
    total: number;
    success: number;
    failed: number;
    lastDeliveredAt: any;
  };
}

export interface WebhookDeliveryResult {
  webhookId: string;
  success: boolean;
  statusCode: number | null;
  error?: string;
  attempts: number;
}

// ---- HMAC Signing ----

function signPayload(secret: string, payload: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

// ---- Single Delivery (with 1 retry) ----

async function deliverWebhook(
  webhook: WebhookSubscription,
  eventType: WebhookEvent,
  payload: Record<string, any>,
): Promise<WebhookDeliveryResult> {
  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = signPayload(webhook.secret, body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Solis-Signature': signature,
    'X-Solis-Event': eventType,
    'User-Agent': 'SOLIS-Webhooks/1.0',
  };

  let lastStatusCode: number | null = null;
  let lastError: string | undefined;

  // Attempt up to 2 times (initial + 1 retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatusCode = res.status;

      if (res.ok) {
        // Log success
        await addWebhookLog(webhook.id, {
          event: eventType,
          payload,
          status: 'success',
          statusCode: res.status,
          responseBody: (await res.text().catch(() => '')).slice(0, 500),
          attemptCount: attempt,
        }).catch(() => {});

        await incrementWebhookDeliveryStats(webhook.id, true).catch(() => {});

        return {
          webhookId: webhook.id,
          success: true,
          statusCode: res.status,
          attempts: attempt,
        };
      }

      lastError = `HTTP ${res.status}`;
    } catch (err: any) {
      lastError = err?.message || 'Network error';
      lastStatusCode = null;
    }

    // Wait before retry (only if first attempt failed)
    if (attempt === 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Log failure after all attempts
  await addWebhookLog(webhook.id, {
    event: eventType,
    payload,
    status: 'failed',
    statusCode: lastStatusCode,
    responseBody: lastError || '',
    attemptCount: 2,
  }).catch(() => {});

  await incrementWebhookDeliveryStats(webhook.id, false).catch(() => {});

  return {
    webhookId: webhook.id,
    success: false,
    statusCode: lastStatusCode,
    error: lastError,
    attempts: 2,
  };
}

// ---- Main Dispatch Function ----

/**
 * Dispatch a webhook event to all matching subscriptions.
 * Queries active webhooks subscribed to this event type,
 * then POSTs the payload to each endpoint with HMAC signature.
 */
export async function dispatchWebhookEvent(
  eventType: WebhookEvent,
  payload: Record<string, any>,
): Promise<WebhookDeliveryResult[]> {
  try {
    const webhooks = await getActiveWebhooksForEvent(eventType);
    if (webhooks.length === 0) return [];

    // Deliver to all matching webhooks in parallel
    const results = await Promise.allSettled(
      webhooks.map(w => deliverWebhook(w as WebhookSubscription, eventType, payload)),
    );

    return results.map(r => {
      if (r.status === 'fulfilled') return r.value;
      return {
        webhookId: 'unknown',
        success: false,
        statusCode: null,
        error: r.reason?.message || 'Delivery failed',
        attempts: 0,
      };
    });
  } catch (err: any) {
    console.error('[OutboundWebhooks] Dispatch error:', err?.message);
    return [];
  }
}

// ---- Re-export subscription management from integrations-db-admin ----
// These are already implemented in integrations-db-admin.ts:
//   addWebhook (createSubscription)
//   getActiveWebhooksForEvent (getSubscriptions for event)
//   deleteWebhook (deleteSubscription)
export { getActiveWebhooksForEvent as getSubscriptions } from './integrations-db-admin';
