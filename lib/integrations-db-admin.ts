// ================================================================
// Server-side Integrations DB helpers using Firebase Admin SDK
// Mirrors functions from lib/integrations-db.ts used by API routes.
// ================================================================

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
  IntegrationProvider, IntegrationCategory, IntegrationStatus,
  ApiKeyScope, WebhookEvent,
} from './integrations-types';

const ORG = 'solis-center';

// ===== GENERIC HELPERS =====

async function addTo(path: string, data: any) {
  return adminDb.collection(path).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function updateAt(path: string, data: any) {
  await adminDb.doc(path).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

async function deleteAt(path: string) {
  await adminDb.doc(path).delete();
}

// ===== INTEGRATIONS =====

export async function getIntegrationByProvider(provider: IntegrationProvider) {
  const snap = await adminDb.collection('integrations')
    .where('orgId', '==', ORG)
    .where('provider', '==', provider)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
}

export async function addIntegration(data: {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  status: IntegrationStatus;
  displayName: string;
  config?: Record<string, any>;
  oauthTokens?: { accessToken: string; refreshToken: string; expiresAt: number; scope: string };
  createdBy: string;
}) {
  return addTo('integrations', {
    orgId: ORG,
    provider: data.provider,
    category: data.category,
    status: data.status,
    displayName: data.displayName,
    config: data.config || {},
    oauthTokens: data.oauthTokens || null,
    createdBy: data.createdBy,
  });
}

export async function updateIntegration(id: string, data: any) {
  return updateAt(`integrations/${id}`, data);
}

export async function deleteIntegration(id: string) {
  return deleteAt(`integrations/${id}`);
}

// ===== API KEYS =====

export async function addApiKey(data: {
  name: string;
  keyHash: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdBy: string;
  expiresAt?: any;
}) {
  return addTo('apiKeys', {
    orgId: ORG,
    name: data.name,
    keyHash: data.keyHash,
    prefix: data.prefix,
    scopes: data.scopes,
    createdBy: data.createdBy,
    lastUsedAt: null,
    expiresAt: data.expiresAt || null,
    active: true,
  });
}

export async function validateApiKey(rawKey: string): Promise<{ valid: boolean; record?: any }> {
  const { hashApiKey } = await import('./integrations-crypto');
  const hash = hashApiKey(rawKey);
  const snap = await adminDb.collection('apiKeys')
    .where('orgId', '==', ORG)
    .where('keyHash', '==', hash)
    .where('active', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return { valid: false };
  const record = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

  // Check expiration
  if (record.expiresAt) {
    const expires = record.expiresAt?.seconds || record.expiresAt?._seconds
      ? (record.expiresAt.seconds || record.expiresAt._seconds) * 1000
      : record.expiresAt;
    if (Date.now() > expires) return { valid: false };
  }

  // Update lastUsedAt (fire-and-forget)
  adminDb.doc(`apiKeys/${record.id}`).update({ lastUsedAt: FieldValue.serverTimestamp() }).catch((err) => console.error('[IntegrationsDB-Admin] update API key lastUsedAt failed:', err));

  return { valid: true, record };
}

export async function revokeApiKey(id: string) {
  return updateAt(`apiKeys/${id}`, { active: false });
}

// ===== WEBHOOKS (outgoing) =====

export async function addWebhook(data: {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  createdBy: string;
}) {
  return addTo('webhooks', {
    orgId: ORG,
    name: data.name,
    url: data.url,
    events: data.events,
    secret: data.secret,
    active: true,
    createdBy: data.createdBy,
    deliveryStats: { total: 0, success: 0, failed: 0, lastDeliveredAt: null },
  });
}

export async function getWebhook(id: string) {
  const snap = await adminDb.doc(`webhooks/${id}`).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as any;
}

export async function updateWebhook(id: string, data: any) {
  return updateAt(`webhooks/${id}`, data);
}

export async function deleteWebhook(id: string) {
  // Cascade: delete webhook logs subcollection
  try {
    const logsSnap = await adminDb.collection(`webhooks/${id}/logs`).get();
    if (!logsSnap.empty) {
      const CHUNK = 450;
      for (let i = 0; i < logsSnap.docs.length; i += CHUNK) {
        const batch = adminDb.batch();
        logsSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch { /* proceed with parent delete */ }
  return deleteAt(`webhooks/${id}`);
}

// ===== INCOMING WEBHOOKS =====

export async function addIncomingWebhook(data: {
  name: string;
  provider: string;
  token: string;
  secret: string;
  actionType: 'create_task' | 'create_notification' | 'trigger_automation';
  actionConfig: Record<string, any>;
  createdBy: string;
}) {
  return addTo('incomingWebhooks', {
    orgId: ORG,
    name: data.name,
    provider: data.provider,
    token: data.token,
    secret: data.secret,
    actionType: data.actionType,
    actionConfig: data.actionConfig,
    active: true,
    eventCount: 0,
    createdBy: data.createdBy,
  });
}

export async function deleteIncomingWebhook(id: string) {
  // Cascade: delete incoming webhook events subcollection
  try {
    const eventsSnap = await adminDb.collection(`incomingWebhooks/${id}/events`).get();
    if (!eventsSnap.empty) {
      const CHUNK = 450;
      for (let i = 0; i < eventsSnap.docs.length; i += CHUNK) {
        const batch = adminDb.batch();
        eventsSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch { /* proceed with parent delete */ }
  return deleteAt(`incomingWebhooks/${id}`);
}

// ===== WEBHOOK EVENT QUEUE =====

export async function queueEvent(data: {
  eventType: WebhookEvent;
  entityId: string;
  entityType: string;
  payload: any;
}) {
  return addTo('webhookEvents', {
    orgId: ORG,
    eventType: data.eventType,
    entityId: data.entityId,
    entityType: data.entityType,
    payload: data.payload,
    processed: false,
    processedAt: null,
  });
}

// ===== WEBHOOK LOGS =====

export async function addWebhookLog(webhookId: string, data: {
  event: string;
  payload: any;
  status: 'success' | 'failed' | 'pending';
  statusCode: number | null;
  responseBody: string;
  attemptCount: number;
  nextRetryAt?: any;
}) {
  return addTo(`webhooks/${webhookId}/logs`, {
    event: data.event,
    payload: data.payload,
    status: data.status,
    statusCode: data.statusCode,
    responseBody: data.responseBody,
    attemptCount: data.attemptCount,
    nextRetryAt: data.nextRetryAt || null,
    deliveredAt: data.status === 'success' ? FieldValue.serverTimestamp() : null,
  });
}

export async function getActiveWebhooksForEvent(eventType: WebhookEvent) {
  const snap = await adminDb.collection('webhooks')
    .where('orgId', '==', ORG)
    .where('active', '==', true)
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter((w: any) => w.events?.includes(eventType));
}

// ===== EVENT QUEUE =====

export async function getPendingEvents(max = 20) {
  const snap = await adminDb.collection('webhookEvents')
    .where('orgId', '==', ORG)
    .where('processed', '==', false)
    .orderBy('createdAt', 'asc')
    .limit(max)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markEventProcessed(id: string) {
  return updateAt(`webhookEvents/${id}`, { processed: true, processedAt: FieldValue.serverTimestamp() });
}

// ===== INCOMING WEBHOOKS (server-side lookups) =====

export async function getIncomingWebhookByToken(token: string) {
  const snap = await adminDb.collection('incomingWebhooks')
    .where('token', '==', token)
    .where('active', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
}

export async function updateIncomingWebhook(id: string, data: any) {
  return updateAt(`incomingWebhooks/${id}`, data);
}

export async function addIncomingEvent(webhookId: string, data: {
  eventType: string;
  payload: any;
  sourceIp?: string;
}) {
  return addTo(`incomingWebhooks/${webhookId}/events`, {
    eventType: data.eventType,
    payload: data.payload,
    sourceIp: data.sourceIp || '',
    processed: false,
    processedAt: null,
  });
}

// ===== ATOMIC COUNTER HELPERS =====

export async function incrementIncomingEventCount(webhookId: string) {
  await adminDb.doc(`incomingWebhooks/${webhookId}`).update({
    eventCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function incrementWebhookDeliveryStats(webhookId: string, success: boolean) {
  const update: Record<string, any> = {
    'deliveryStats.total': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (success) {
    update['deliveryStats.success'] = FieldValue.increment(1);
    update['deliveryStats.lastDeliveredAt'] = new Date().toISOString();
  } else {
    update['deliveryStats.failed'] = FieldValue.increment(1);
  }
  await adminDb.doc(`webhooks/${webhookId}`).update(update);
}

// ===== EVENT QUEUE — RETRY / EXHAUST =====

export async function markEventExhausted(id: string, attempts: number) {
  await adminDb.doc(`webhookEvents/${id}`).update({
    processed: true,
    exhausted: true,
    attempts,
    lastAttemptAt: FieldValue.serverTimestamp(),
    processedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markEventRetry(id: string, attempts: number) {
  const backoffMs = Math.pow(2, attempts) * 60 * 1000; // 2min, 4min, 8min
  const nextAttemptAt = new Date(Date.now() + backoffMs);
  await adminDb.doc(`webhookEvents/${id}`).update({
    attempts,
    lastAttemptAt: FieldValue.serverTimestamp(),
    nextAttemptAt: Timestamp.fromDate(nextAttemptAt),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export { ORG };
