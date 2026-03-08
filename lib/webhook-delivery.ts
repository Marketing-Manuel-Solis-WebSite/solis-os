import { signPayload } from './integrations-crypto';
import { addWebhookLog, updateWebhook } from './integrations-db-admin';

export interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  responseBody: string;
  error?: string;
}

export async function deliverWebhookEvent(
  webhook: { id: string; url: string; secret: string; deliveryStats: any },
  event: { id: string; eventType: string; payload: any; createdAt: any },
): Promise<DeliveryResult> {
  const body = JSON.stringify({
    event: event.eventType,
    data: event.payload,
    timestamp: new Date().toISOString(),
    webhookId: webhook.id,
    eventId: event.id,
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signaturePayload = `${timestamp}.${body}`;
  const signature = signPayload(webhook.secret, signaturePayload);

  let result: DeliveryResult;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SolisCenter-Webhook/1.0',
        'X-Solis-Signature': signature,
        'X-Solis-Timestamp': timestamp,
        'X-Solis-Event': event.eventType,
        'X-Solis-Delivery': event.id,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text().catch(() => '');
    const isSuccess = response.status >= 200 && response.status < 300;

    result = {
      success: isSuccess,
      statusCode: response.status,
      responseBody: responseText.slice(0, 500),
    };
  } catch (err: any) {
    result = {
      success: false,
      statusCode: null,
      responseBody: '',
      error: err?.name === 'AbortError' ? 'Timeout (10s)' : (err?.message || 'Network error'),
    };
  }

  // Log the delivery attempt
  try {
    await addWebhookLog(webhook.id, {
      event: event.eventType,
      payload: event.payload,
      status: result.success ? 'success' : 'failed',
      statusCode: result.statusCode,
      responseBody: result.error || result.responseBody,
      attemptCount: 1,
      nextRetryAt: result.success ? undefined : getNextRetryTime(1),
    });

    // Update stats
    const stats = webhook.deliveryStats || { total: 0, success: 0, failed: 0 };
    await updateWebhook(webhook.id, {
      deliveryStats: {
        total: (stats.total || 0) + 1,
        success: (stats.success || 0) + (result.success ? 1 : 0),
        failed: (stats.failed || 0) + (result.success ? 0 : 1),
        lastDeliveredAt: result.success ? new Date().toISOString() : stats.lastDeliveredAt,
      },
    });
  } catch {
    // Log failures shouldn't block the main flow
  }

  return result;
}

function getNextRetryTime(attemptCount: number): Date | undefined {
  if (attemptCount >= 3) return undefined;
  const delayMs = Math.pow(2, attemptCount) * 60 * 1000; // exponential backoff: 2min, 4min
  return new Date(Date.now() + delayMs);
}
