import 'server-only';
// ================================================================
// Server-side generic Firestore helpers — Firebase Admin SDK
// ================================================================

import { adminDb } from '../firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';
import { TTLCache } from '@/lib/cache';

export { adminDb, FieldValue, Timestamp, ORG };

// Server-side caches for frequently-read, rarely-changed data
export const membersCache = new TTLCache<any[]>(5 * 60 * 1000);
export const teamsCache = new TTLCache<any[]>(10 * 60 * 1000);

export async function addTo(path: string, data: any) {
  const ref = await adminDb.collection(path).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref;
}

export async function setAt(path: string, data: any) {
  await adminDb.doc(path).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function updateAt(path: string, data: any) {
  await adminDb.doc(path).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteAt(path: string) {
  await adminDb.doc(path).delete();
}

export async function getOne(path: string) {
  const snap = await adminDb.doc(path).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function getByOrg(col: string, maxResults = 500) {
  const snap = await adminDb
    .collection(col)
    .where('orgId', '==', ORG)
    .limit(maxResults)
    .get();
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return results.sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || a.createdAt?._seconds || 0;
    const tb = b.createdAt?.seconds || b.createdAt?._seconds || 0;
    return tb - ta;
  });
}

export async function getByTeam(col: string, teamId: string, maxResults = 500) {
  if (teamId === '__all__') return getByOrg(col, maxResults);
  const snap = await adminDb
    .collection(col)
    .where('orgId', '==', ORG)
    .where('teamId', '==', teamId)
    .orderBy('createdAt', 'desc')
    .limit(maxResults)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteSubcollectionDocsAdmin(parentPath: string, subcollectionName: string): Promise<number> {
  const snap = await adminDb.collection(`${parentPath}/${subcollectionName}`).get();
  if (snap.empty) return 0;
  let deleted = 0;
  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = adminDb.batch();
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(CHUNK, snap.docs.length - i);
  }
  return deleted;
}

export async function cleanupEntityRelationsAdmin(entityId: string): Promise<number> {
  const [asSource, asTarget] = await Promise.all([
    adminDb.collection('relations').where('orgId', '==', ORG).where('sourceId', '==', entityId).get(),
    adminDb.collection('relations').where('orgId', '==', ORG).where('targetId', '==', entityId).get(),
  ]);
  const toDelete = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const snap of [asSource, asTarget]) {
    for (const d of snap.docs) toDelete.set(d.id, d.ref);
  }
  if (toDelete.size === 0) return 0;
  const refs = Array.from(toDelete.values());
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = adminDb.batch();
    refs.slice(i, i + CHUNK).forEach(r => batch.delete(r));
    await batch.commit();
  }
  return toDelete.size;
}

export async function removeTaskFromGoalTargetsAdmin(taskId: string): Promise<void> {
  const snap = await adminDb.collectionGroup('targets')
    .where('linkedTaskIds', 'array-contains', taskId)
    .get();
  if (snap.empty) return;
  const goalIdsToRecalc = new Set<string>();
  for (const d of snap.docs) {
    await d.ref.update({
      linkedTaskIds: FieldValue.arrayRemove(taskId),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const goalId = d.ref.parent.parent?.id;
    if (goalId) goalIdsToRecalc.add(goalId);
  }
  for (const goalId of goalIdsToRecalc) {
    const targets = await adminDb.collection(`goals/${goalId}/targets`).get();
    if (targets.empty) {
      await adminDb.doc(`goals/${goalId}`).update({ progress: 0, updatedAt: FieldValue.serverTimestamp() });
      continue;
    }
    let totalProgress = 0;
    for (const t of targets.docs) {
      const data = t.data();
      const tv = Math.max(data.targetValue || 1, 1);
      const cv = Math.min(data.currentValue || 0, tv);
      totalProgress += (cv / tv) * 100;
    }
    const progress = Math.round(totalProgress / targets.size);
    await adminDb.doc(`goals/${goalId}`).update({ progress, updatedAt: FieldValue.serverTimestamp() });
  }
}

export async function cleanupOrphanedTimeEntriesAdmin(taskId: string): Promise<number> {
  try {
    const snap = await adminDb.collection('time-entries')
      .where('orgId', '==', ORG)
      .where('taskId', '==', taskId)
      .get();
    if (snap.empty) return 0;
    for (const d of snap.docs) {
      await d.ref.update({ taskId: '', taskTitle: '(deleted task)', updatedAt: FieldValue.serverTimestamp() });
    }
    return snap.size;
  } catch (err) { console.error('[DB-Admin] cleanup time entry refs failed:', err); return 0; }
}

export async function cleanupWhiteboardLinkedTaskRefsAdmin(taskId: string): Promise<number> {
  try {
    const snap = await adminDb.collectionGroup('elements')
      .where('linkedTaskId', '==', taskId)
      .get();
    if (snap.empty) return 0;
    for (const d of snap.docs) {
      await d.ref.update({ linkedTaskId: '', updatedAt: FieldValue.serverTimestamp() });
    }
    return snap.size;
  } catch (err) { console.error('[DB-Admin] cleanup whiteboard linked task refs failed:', err); return 0; }
}

// Cursor pagination utilities
interface PaginatedResult {
  items: any[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type { PaginatedResult };

export function extractCursor(doc: FirebaseFirestore.QueryDocumentSnapshot): string {
  const ts = doc.data().createdAt;
  const seconds = ts?.seconds || ts?._seconds || 0;
  return `${seconds}_${doc.id}`;
}

export function parseCursor(cursor: string): { seconds: number; docId: string } | null {
  const parts = cursor.split('_');
  if (parts.length < 2) return null;
  const seconds = parseInt(parts[0], 10);
  const docId = parts.slice(1).join('_');
  if (isNaN(seconds)) return null;
  return { seconds, docId };
}
