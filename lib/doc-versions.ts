import {
  collection, doc, addDoc, getDocs, getDoc, query, where, orderBy, limit,
  serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const MAX_VERSIONS = 50;

export interface DocRevision {
  id: string;
  docId: string;
  content: string;
  contentHtml?: string;
  title: string;
  version: number;
  editedBy: string;
  editedByName: string;
  changeNote?: string;
  wordCount: number;
  createdAt: any;
}

// Create a new revision snapshot
export async function createRevision(
  docId: string,
  data: {
    content: string;
    contentHtml?: string;
    title: string;
    version: number;
    editedBy: string;
    editedByName: string;
    changeNote?: string;
  }
): Promise<string> {
  const wordCount = (data.content || '').split(/\s+/).filter(Boolean).length;
  const ref = await addDoc(collection(db, `docs/${docId}/revisions`), {
    docId,
    content: data.content,
    contentHtml: data.contentHtml || '',
    title: data.title,
    version: data.version,
    editedBy: data.editedBy,
    editedByName: data.editedByName,
    changeNote: data.changeNote || '',
    wordCount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Enforce max versions: delete oldest if over limit
  await pruneOldVersions(docId);

  return ref.id;
}

// Get all revisions for a doc, newest first
export async function getRevisions(docId: string, maxResults = 50): Promise<DocRevision[]> {
  const q = query(
    collection(db, `docs/${docId}/revisions`),
    orderBy('version', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocRevision));
}

// Get a single revision
export async function getRevision(docId: string, revisionId: string): Promise<DocRevision | null> {
  const snap = await getDoc(doc(db, `docs/${docId}/revisions/${revisionId}`));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DocRevision;
}

// Get the latest version number
export async function getLatestVersionNumber(docId: string): Promise<number> {
  const q = query(
    collection(db, `docs/${docId}/revisions`),
    orderBy('version', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  return (snap.docs[0].data().version as number) || 0;
}

// Count revisions
export async function getRevisionCount(docId: string): Promise<number> {
  const snap = await getDocs(collection(db, `docs/${docId}/revisions`));
  return snap.size;
}

// Delete oldest revisions when over MAX_VERSIONS
async function pruneOldVersions(docId: string) {
  const q = query(
    collection(db, `docs/${docId}/revisions`),
    orderBy('version', 'asc')
  );
  const snap = await getDocs(q);
  if (snap.size <= MAX_VERSIONS) return;

  const toDelete = snap.docs.slice(0, snap.size - MAX_VERSIONS);
  for (const d of toDelete) {
    await deleteDoc(d.ref);
  }
}
