// ================================================================
// Rate limiter — Firestore-backed persistent rate limiting
// ================================================================
// Replaces the previous in-memory implementation which was ineffective
// in Vercel serverless (state lost between cold starts).
// Uses Firestore transactions for atomic check-and-increment.

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Check rate limit for a given key within a named store.
 * Persistent across serverless instances via Firestore.
 * Returns { allowed, remaining, resetAt }.
 */
export async function checkRateLimit(
  storeName: string,
  key: string,
  maxRequests: number,
  windowMs = 60_000,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const docId = `${storeName}:${key}`.replace(/\//g, '_');
  const ref = adminDb.doc(`rateLimits/${docId}`);
  const now = Date.now();

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();

      // Window expired or no record — start fresh
      if (!data || now > data.resetAt) {
        const resetAt = now + windowMs;
        tx.set(ref, { count: 1, resetAt, updatedAt: FieldValue.serverTimestamp() });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
      }

      // Window active — check limit
      if (data.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: data.resetAt };
      }

      // Increment
      tx.update(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      return { allowed: true, remaining: maxRequests - (data.count + 1), resetAt: data.resetAt };
    });
  } catch {
    // On Firestore failure, allow the request (fail-open for availability)
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
  }
}
