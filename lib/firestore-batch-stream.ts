// ================================================================
// Firestore Batch Stream — process large collections in chunks
// ================================================================
// Avoids loading entire collections into memory. Uses cursor-based
// pagination with __name__ ordering for deterministic, resumable
// iteration. Never holds more than `batchSize` docs in memory.
// ================================================================

import { adminDb } from '@/lib/firebase-admin';

const DEFAULT_BATCH_SIZE = 1000;

/**
 * Stream through a Firestore query in batches, accumulating results
 * via a reducer function. Never loads more than `batchSize` docs
 * into memory at once.
 *
 * @param baseQuery - Firestore query (without orderBy/__name__/limit)
 * @param accumulator - Initial accumulator value
 * @param reducer - Called for each doc: (acc, docData, docId) => newAcc
 * @param batchSize - Number of docs per batch (default 1000)
 * @returns Final accumulated value
 */
export async function streamBatches<T>(
  baseQuery: FirebaseFirestore.Query,
  accumulator: T,
  reducer: (acc: T, data: FirebaseFirestore.DocumentData, docId: string) => T,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<T> {
  let acc = accumulator;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let q = baseQuery.orderBy('__name__').limit(batchSize);
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      acc = reducer(acc, doc.data(), doc.id);
    }

    if (snap.docs.length < batchSize) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return acc;
}

/**
 * Count documents matching a query using Firestore's native count
 * aggregation (no documents transferred).
 */
export async function countQuery(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.count().get();
  return snap.data().count;
}

/**
 * Stream through a Firestore query in batches, calling an async
 * callback for each batch. Useful when you need to process batches
 * with side effects (e.g., existence checks).
 */
export async function streamBatchesAsync<T>(
  baseQuery: FirebaseFirestore.Query,
  accumulator: T,
  reducer: (acc: T, docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<T>,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<T> {
  let acc = accumulator;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let q = baseQuery.orderBy('__name__').limit(batchSize);
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snap = await q.get();
    if (snap.empty) break;

    acc = await reducer(acc, snap.docs);

    if (snap.docs.length < batchSize) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return acc;
}
