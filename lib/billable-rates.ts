// ================================================================
// Billable Rates — per-user billing configuration
// ================================================================
// Stores hourly rates per user/role for time tracking billing.
// Used to compute billable amounts from approved time entries.

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';

// ---- Types ----

export interface BillableRate {
  id?: string;
  userId: string;
  ratePerHour: number;
  currency: string; // e.g. 'USD', 'EUR', 'MXN'
  effectiveFrom?: string; // ISO date
  createdAt?: any;
  updatedAt?: any;
}

export interface BillableAmount {
  hours: number;
  ratePerHour: number;
  currency: string;
  total: number;
}

// ---- Path helpers ----

const RATES_PATH = `orgs/${ORG}/billableRates`;

// ---- Functions ----

/**
 * Compute billable amount from hours and rate.
 */
export function computeBillableAmount(hours: number, rate: BillableRate): BillableAmount {
  const total = Math.round(hours * rate.ratePerHour * 100) / 100;
  return {
    hours,
    ratePerHour: rate.ratePerHour,
    currency: rate.currency,
    total,
  };
}

/**
 * Get all billable rates for the org.
 */
export async function getBillableRates(): Promise<BillableRate[]> {
  const snap = await adminDb.collection(RATES_PATH).get();
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as BillableRate));
}

/**
 * Get billable rate for a specific user.
 */
export async function getBillableRateForUser(userId: string): Promise<BillableRate | null> {
  const snap = await adminDb.collection(RATES_PATH)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as BillableRate;
}

/**
 * Set (create or update) a billable rate for a user.
 */
export async function setBillableRate(data: {
  userId: string;
  ratePerHour: number;
  currency: string;
}): Promise<string> {
  // Check if rate already exists for this user
  const existing = await getBillableRateForUser(data.userId);

  if (existing?.id) {
    await adminDb.doc(`${RATES_PATH}/${existing.id}`).update({
      ratePerHour: data.ratePerHour,
      currency: data.currency,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return existing.id;
  }

  const ref = await adminDb.collection(RATES_PATH).add({
    userId: data.userId,
    ratePerHour: data.ratePerHour,
    currency: data.currency,
    effectiveFrom: new Date().toISOString().split('T')[0],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
