import 'server-only';

import { adminDb, Timestamp, ORG, extractCursor, parseCursor } from './helpers';
import type { PaginatedResult } from './helpers';

export type { PaginatedResult };

// ===== CURSOR-BASED PAGINATED QUERIES =====
// Used by v1 API routes for efficient Firestore-native pagination.
// Pushes filters to Firestore where possible, uses orderBy + startAfter for cursor.

export async function queryTasksPaginated(opts: {
  limit: number;
  cursor?: string | null;
  status?: string | null;
  teamId?: string | null;
  assignee?: string | null;
  priority?: string | null;
  dueBefore?: string | null;
  dueAfter?: string | null;
  deleted?: boolean;
}): Promise<PaginatedResult> {
  let q: FirebaseFirestore.Query = adminDb.collection('tasks')
    .where('orgId', '==', ORG);

  // Filter deleted at query level (default: exclude deleted)
  if (opts.deleted === true) {
    q = q.where('deleted', '==', true);
  } else {
    q = q.where('deleted', '!=', true);
  }

  if (opts.status) q = q.where('status', '==', opts.status);
  if (opts.teamId) q = q.where('teamId', '==', opts.teamId);
  if (opts.assignee) q = q.where('assignees', 'array-contains', opts.assignee);
  if (opts.priority) q = q.where('priority', '==', opts.priority);
  if (opts.dueBefore) q = q.where('dueDate', '<=', opts.dueBefore);
  if (opts.dueAfter) q = q.where('dueDate', '>=', opts.dueAfter);

  q = q.orderBy('createdAt', 'desc');

  if (opts.cursor) {
    const parsed = parseCursor(opts.cursor);
    if (parsed) {
      const ts = Timestamp.fromMillis(parsed.seconds * 1000);
      q = q.startAfter(ts, parsed.docId);
    }
  }

  const snap = await q.limit(opts.limit + 1).get();

  const hasMore = snap.docs.length > opts.limit;
  const resultDocs = hasMore ? snap.docs.slice(0, opts.limit) : snap.docs;
  const items = resultDocs.map(d => ({ id: d.id, ...d.data() }));

  const lastDoc = resultDocs[resultDocs.length - 1];
  const nextCursor = hasMore && lastDoc ? extractCursor(lastDoc) : null;

  return { items, nextCursor, hasMore };
}

export async function queryGoalsPaginated(opts: {
  limit: number;
  cursor?: string | null;
  status?: string | null;
  teamId?: string | null;
}): Promise<PaginatedResult> {
  let q: FirebaseFirestore.Query = adminDb.collection('goals')
    .where('orgId', '==', ORG);

  if (opts.status) q = q.where('status', '==', opts.status);
  if (opts.teamId) q = q.where('teamId', '==', opts.teamId);

  q = q.orderBy('createdAt', 'desc');

  if (opts.cursor) {
    const parsed = parseCursor(opts.cursor);
    if (parsed) {
      const ts = Timestamp.fromMillis(parsed.seconds * 1000);
      q = q.startAfter(ts, parsed.docId);
    }
  }

  const snap = await q.limit(opts.limit + 1).get();
  const hasMore = snap.docs.length > opts.limit;
  const resultDocs = hasMore ? snap.docs.slice(0, opts.limit) : snap.docs;
  const items = resultDocs.map(d => ({ id: d.id, ...d.data() }));

  const lastDoc = resultDocs[resultDocs.length - 1];
  const nextCursor = hasMore && lastDoc ? extractCursor(lastDoc) : null;

  return { items, nextCursor, hasMore };
}

export async function queryTimeEntriesPaginated(opts: {
  limit: number;
  cursor?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  userId?: string | null;
  teamId?: string | null;
}): Promise<PaginatedResult> {
  let q: FirebaseFirestore.Query = adminDb.collection('time-entries')
    .where('orgId', '==', ORG);

  if (opts.userId) q = q.where('userId', '==', opts.userId);

  // When date-bounded, order by date (bounded dataset, no cursor needed).
  // When unbounded, order by createdAt and use cursor pagination.
  const dateBounded = !!(opts.startDate || opts.endDate);

  if (dateBounded) {
    if (opts.startDate) q = q.where('date', '>=', opts.startDate);
    if (opts.endDate) q = q.where('date', '<=', opts.endDate);
    q = q.orderBy('date', 'desc');
  } else {
    q = q.orderBy('createdAt', 'desc');
    if (opts.cursor) {
      const parsed = parseCursor(opts.cursor);
      if (parsed) {
        const ts = Timestamp.fromMillis(parsed.seconds * 1000);
        q = q.startAfter(ts, parsed.docId);
      }
    }
  }

  const snap = await q.limit(opts.limit + 1).get();
  const hasMore = snap.docs.length > opts.limit;
  const resultDocs = hasMore ? snap.docs.slice(0, opts.limit) : snap.docs;
  const items = resultDocs.map(d => ({ id: d.id, ...d.data() }));

  const lastDoc = resultDocs[resultDocs.length - 1];
  const nextCursor = hasMore && lastDoc && !dateBounded ? extractCursor(lastDoc) : null;

  return { items, nextCursor, hasMore };
}
