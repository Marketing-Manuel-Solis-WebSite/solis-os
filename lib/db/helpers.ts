// ================================================================
// Generic Firestore CRUD helpers — shared by all domain modules
// ================================================================

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ORG_ID as ORG } from '@/lib/org';

export { db, ORG, serverTimestamp };

// Re-export Firebase utilities that domain modules need
export {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, deleteField,
  getDocs, getDoc, getCountFromServer, query, where, orderBy, limit,
  writeBatch, collectionGroup, onSnapshot, arrayUnion, arrayRemove,
  runTransaction, startAfter,
} from 'firebase/firestore';
export type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

export async function addTo(path: string, data: any) {
  return addDoc(collection(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function setAt(path: string, data: any) {
  return setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateAt(path: string, data: any) {
  return updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteAt(path: string) { return deleteDoc(doc(db, path)); }

export async function getOne(path: string) {
  const s = await getDoc(doc(db, path));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function getByOrg(col: string, maxResults = 500): Promise<{ items: any[]; hasMore: boolean }> {
  const q = query(collection(db, col), where('orgId', '==', ORG), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  const items = docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
  return { items, hasMore };
}

export async function getByTeam(col: string, teamId: string, maxResults = 500): Promise<{ items: any[]; hasMore: boolean }> {
  if (teamId === '__all__') return getByOrg(col, maxResults);
  const q = query(
    collection(db, col),
    where('orgId', '==', ORG),
    where('teamId', '==', teamId),
    orderBy('createdAt', 'desc'),
    limit(maxResults + 1),
  );
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  const items = docs.map(d => ({ id: d.id, ...d.data() }));
  return { items, hasMore };
}

// Delete all documents in a subcollection (batched, max 450 per batch)
export async function deleteSubcollectionDocs(parentPath: string, subcollectionName: string): Promise<number> {
  const ref = collection(db, `${parentPath}/${subcollectionName}`);
  const snap = await getDocs(ref);
  if (snap.empty) return 0;
  let deleted = 0;
  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(CHUNK, snap.docs.length - i);
  }
  return deleted;
}

// Delete all relations where entity is source or target
export async function cleanupEntityRelations(entityId: string): Promise<number> {
  const [asSource, asTarget] = await Promise.all([
    getDocs(query(collection(db, 'relations'), where('orgId', '==', ORG), where('sourceId', '==', entityId))),
    getDocs(query(collection(db, 'relations'), where('orgId', '==', ORG), where('targetId', '==', entityId))),
  ]);
  const toDelete = new Map<string, any>();
  for (const snap of [asSource, asTarget]) {
    for (const d of snap.docs) toDelete.set(d.id, d.ref);
  }
  if (toDelete.size === 0) return 0;
  const refs = Array.from(toDelete.values());
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((r: any) => batch.delete(r));
    await batch.commit();
  }
  return toDelete.size;
}
