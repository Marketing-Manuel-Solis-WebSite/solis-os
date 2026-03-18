// ================================================================
// Docs domain module — extracted from lib/db.ts
// ================================================================

import {
  addTo, updateAt, deleteAt, getByOrg, getByTeam,
  deleteSubcollectionDocs, cleanupEntityRelations,
  db, ORG,
  collection, getDocs, query, where, orderBy, limit,
} from './helpers';

// ===== DOCS =====
export async function getDocuments(teamId?: string, maxResults = 500, parentDocId?: string | null) {
  if (typeof parentDocId === 'string' || parentDocId === null) {
    // Filter by parentDocId: null = top-level docs, string = children of that doc
    const constraints: any[] = [where('orgId', '==', ORG)];
    if (teamId && teamId !== '__all__') constraints.push(where('teamId', '==', teamId));
    constraints.push(where('parentDocId', '==', parentDocId));
    constraints.push(limit(maxResults + 1));
    const q = query(collection(db, 'docs'), ...constraints);
    const s = await getDocs(q);
    const hasMore = s.docs.length > maxResults;
    const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
    const items = docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return { items, hasMore };
  }
  if (teamId) return getByTeam('docs', teamId, maxResults);
  return getByOrg('docs', maxResults);
}
export async function createDocument(data: any) { return addTo('docs', { ...data, orgId: ORG, content: data.content || '', teamId: data.teamId || '', spaceId: data.spaceId || null, folderId: data.folderId || null, parentDocId: data.parentDocId ?? null, titleLower: (data.title || '').toLowerCase() }); }

export async function getDocsBySpace(spaceId: string, maxResults = 200): Promise<{ items: any[]; hasMore: boolean }> {
  const q = query(
    collection(db, 'docs'),
    where('orgId', '==', ORG),
    where('teamId', '==', spaceId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults + 1),
  );
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}
export async function updateDocument(id: string, data: any) {
  const patch = data.title !== undefined ? { ...data, titleLower: data.title.toLowerCase() } : data;
  return updateAt(`docs/${id}`, patch);
}
export async function deleteDocument(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`docs/${id}`, 'revisions'),
    cleanupEntityRelations(id),
  ]);
  return deleteAt(`docs/${id}`);
}
