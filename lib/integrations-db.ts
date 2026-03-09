import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit, writeBatch,
  serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  IntegrationProvider, IntegrationCategory, IntegrationStatus,
  ApiKeyScope, WebhookEvent,
  IntegrationRecord, ApiKeyRecord, WebhookRecord, WebhookLogRecord,
  IncomingWebhookRecord, WebhookEventRecord, IncomingWebhookRecord as IWR,
} from './integrations-types';

const ORG = 'solis-center';

// ============================================
// GENERIC HELPERS (mirrors lib/db.ts)
// ============================================
async function addTo(path: string, data: any) {
  return addDoc(collection(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

async function updateAt(path: string, data: any) {
  return updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
}

async function deleteAt(path: string) { return deleteDoc(doc(db, path)); }

async function getOne(path: string) {
  const s = await getDoc(doc(db, path));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

async function getByOrg(col: string, maxResults = 500) {
  const q = query(collection(db, col), where('orgId', '==', ORG), limit(maxResults));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
}

// ============================================
// INTEGRATIONS (connected providers)
// ============================================
export async function getIntegrations() {
  return getByOrg('integrations') as Promise<any[]>;
}

export async function getIntegrationByProvider(provider: IntegrationProvider) {
  const q2 = query(
    collection(db, 'integrations'),
    where('orgId', '==', ORG),
    where('provider', '==', provider),
    limit(1),
  );
  const s = await getDocs(q2);
  if (s.empty) return null;
  return { id: s.docs[0].id, ...s.docs[0].data() } as any;
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

// ============================================
// API KEYS
// ============================================
export async function getApiKeys() {
  return getByOrg('apiKeys') as Promise<any[]>;
}

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
  // Dynamic import to avoid pulling Node.js crypto into client bundle
  const { hashApiKey } = await import('./integrations-crypto');
  const hash = hashApiKey(rawKey);
  const q2 = query(
    collection(db, 'apiKeys'),
    where('orgId', '==', ORG),
    where('keyHash', '==', hash),
    where('active', '==', true),
    limit(1),
  );
  const s = await getDocs(q2);
  if (s.empty) return { valid: false };
  const record = { id: s.docs[0].id, ...s.docs[0].data() } as any;

  // Check expiration
  if (record.expiresAt) {
    const expires = record.expiresAt?.seconds ? record.expiresAt.seconds * 1000 : record.expiresAt;
    if (Date.now() > expires) return { valid: false };
  }

  // Update lastUsedAt (fire-and-forget)
  updateAt(`apiKeys/${record.id}`, { lastUsedAt: serverTimestamp() }).catch((err) => console.error('[IntegrationsDB] update API key lastUsedAt failed:', err));

  return { valid: true, record };
}

export async function revokeApiKey(id: string) {
  return updateAt(`apiKeys/${id}`, { active: false });
}

// ============================================
// WEBHOOKS (outgoing)
// ============================================
export async function getWebhooks() {
  return getByOrg('webhooks') as Promise<any[]>;
}

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

export async function updateWebhook(id: string, data: any) {
  return updateAt(`webhooks/${id}`, data);
}

export async function deleteWebhook(id: string) {
  // Cascade: delete webhook logs subcollection
  try {
    const logsSnap = await getDocs(collection(db, `webhooks/${id}/logs`));
    if (!logsSnap.empty) {
      const CHUNK = 450;
      for (let i = 0; i < logsSnap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        logsSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch { /* proceed with parent delete */ }
  return deleteAt(`webhooks/${id}`);
}

export async function getActiveWebhooksForEvent(eventType: WebhookEvent) {
  const q2 = query(
    collection(db, 'webhooks'),
    where('orgId', '==', ORG),
    where('active', '==', true),
  );
  const s = await getDocs(q2);
  return s.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter((w: any) => w.events?.includes(eventType));
}

// Webhook Logs (subcollection)
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
    deliveredAt: data.status === 'success' ? serverTimestamp() : null,
  });
}

export async function getWebhookLogs(webhookId: string, max = 50) {
  const q2 = query(
    collection(db, `webhooks/${webhookId}/logs`),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const s = await getDocs(q2);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================
// INCOMING WEBHOOKS
// ============================================
export async function getIncomingWebhooks() {
  return getByOrg('incomingWebhooks') as Promise<any[]>;
}

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

export async function updateIncomingWebhook(id: string, data: any) {
  return updateAt(`incomingWebhooks/${id}`, data);
}

export async function deleteIncomingWebhook(id: string) {
  // Cascade: delete incoming webhook events subcollection
  try {
    const eventsSnap = await getDocs(collection(db, `incomingWebhooks/${id}/events`));
    if (!eventsSnap.empty) {
      const CHUNK = 450;
      for (let i = 0; i < eventsSnap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        eventsSnap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch { /* proceed with parent delete */ }
  return deleteAt(`incomingWebhooks/${id}`);
}

export async function getIncomingWebhookByToken(token: string) {
  const q2 = query(
    collection(db, 'incomingWebhooks'),
    where('token', '==', token),
    where('active', '==', true),
    limit(1),
  );
  const s = await getDocs(q2);
  if (s.empty) return null;
  return { id: s.docs[0].id, ...s.docs[0].data() } as any;
}

// Incoming Webhook Events (subcollection)
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

// ============================================
// WEBHOOK EVENT QUEUE (internal events)
// ============================================
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

export async function getPendingEvents(max = 20) {
  const q2 = query(
    collection(db, 'webhookEvents'),
    where('orgId', '==', ORG),
    where('processed', '==', false),
    orderBy('createdAt', 'asc'),
    limit(max),
  );
  const s = await getDocs(q2);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markEventProcessed(id: string) {
  return updateAt(`webhookEvents/${id}`, { processed: true, processedAt: serverTimestamp() });
}

// ============================================
// REAL-TIME LISTENERS
// ============================================
export function onIntegrationsSnapshot(callback: (items: any[]) => void) {
  const q2 = query(collection(db, 'integrations'), where('orgId', '==', ORG));
  return onSnapshot(q2, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, () => callback([]));
}

export function onApiKeysSnapshot(callback: (items: any[]) => void) {
  const q2 = query(collection(db, 'apiKeys'), where('orgId', '==', ORG));
  return onSnapshot(q2, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, () => callback([]));
}

export function onWebhooksSnapshot(callback: (items: any[]) => void) {
  const q2 = query(collection(db, 'webhooks'), where('orgId', '==', ORG));
  return onSnapshot(q2, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, () => callback([]));
}

export function onIncomingWebhooksSnapshot(callback: (items: any[]) => void) {
  const q2 = query(collection(db, 'incomingWebhooks'), where('orgId', '==', ORG));
  return onSnapshot(q2, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, () => callback([]));
}

export function onWebhookEventsSnapshot(callback: (items: any[]) => void, max = 50) {
  const q2 = query(
    collection(db, 'webhookEvents'),
    where('orgId', '==', ORG),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  return onSnapshot(q2, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

export { ORG };
