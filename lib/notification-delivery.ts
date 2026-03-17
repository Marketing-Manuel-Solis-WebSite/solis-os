'use client';

// ================================================================
// Notification Delivery Tracking
// ================================================================
// Tracks email delivery status for sent notifications.
// Integrates with Resend webhooks for delivery/bounce/open events.

import { doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId } from '@/lib/org';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'bounced' | 'opened' | 'failed';

export interface DeliveryRecord {
  id: string;
  orgId: string;
  notificationId?: string;
  reportId?: string;
  recipient: string;
  status: DeliveryStatus;
  messageId?: string;       // From email provider
  sentAt?: any;
  deliveredAt?: any;
  openedAt?: any;
  bouncedAt?: any;
  failedAt?: any;
  error?: string;
  retryCount: number;
  lastRetryAt?: any;
  createdAt: any;
}

function deliveryCol() {
  return collection(db, 'orgs', getCurrentOrgId(), 'deliveryRecords');
}

/**
 * Record a new delivery attempt.
 */
export async function recordDelivery(data: {
  recipient: string;
  notificationId?: string;
  reportId?: string;
  messageId?: string;
  status: DeliveryStatus;
}): Promise<string> {
  const ref = doc(deliveryCol());
  await setDoc(ref, {
    orgId: getCurrentOrgId(),
    ...data,
    retryCount: 0,
    sentAt: data.status === 'sent' ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update delivery status (called by webhook handler).
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  extra?: { error?: string; messageId?: string },
): Promise<void> {
  const ref = doc(deliveryCol(), deliveryId);
  const update: any = { status };

  if (status === 'delivered') update.deliveredAt = serverTimestamp();
  if (status === 'opened') update.openedAt = serverTimestamp();
  if (status === 'bounced') update.bouncedAt = serverTimestamp();
  if (status === 'failed') update.failedAt = serverTimestamp();
  if (extra?.error) update.error = extra.error;
  if (extra?.messageId) update.messageId = extra.messageId;

  await setDoc(ref, update, { merge: true });
}

/**
 * Record a retry attempt.
 */
export async function recordRetry(deliveryId: string): Promise<void> {
  const ref = doc(deliveryCol(), deliveryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = snap.data();
  await setDoc(ref, {
    retryCount: (current.retryCount || 0) + 1,
    lastRetryAt: serverTimestamp(),
    status: 'pending',
    error: null,
  }, { merge: true });
}

/**
 * Get failed deliveries eligible for retry (max 3 attempts).
 */
export async function getRetryableDeliveries(maxResults = 50): Promise<DeliveryRecord[]> {
  const q = query(
    deliveryCol(),
    where('status', '==', 'failed'),
    where('retryCount', '<', 3),
    orderBy('retryCount', 'asc'),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryRecord));
}

/**
 * Get delivery records for a specific report or notification.
 */
export async function getDeliveryRecords(
  filters: { reportId?: string; notificationId?: string; recipient?: string },
  maxResults = 50,
): Promise<DeliveryRecord[]> {
  let q = query(deliveryCol(), orderBy('createdAt', 'desc'), limit(maxResults));

  // Note: Firestore requires composite indexes for multi-field queries.
  // In practice, filter client-side for simplicity.
  const snap = await getDocs(q);
  let records = snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryRecord));

  if (filters.reportId) records = records.filter(r => r.reportId === filters.reportId);
  if (filters.notificationId) records = records.filter(r => r.notificationId === filters.notificationId);
  if (filters.recipient) records = records.filter(r => r.recipient === filters.recipient);

  return records;
}
