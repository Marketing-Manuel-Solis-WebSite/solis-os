// ===========================================================
// WHITEBOARDS
// ===========================================================

import {
  addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocs,
  db, ORG,
  collection, getDocs, query, where, orderBy, limit, onSnapshot,
} from './helpers';

export async function getWhiteboards(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('whiteboards', teamId, maxResults);
  return getByOrg('whiteboards', maxResults);
}

export async function getWhiteboard(id: string) { return getOne(`whiteboards/${id}`); }

export async function createWhiteboard(data: any) {
  return addTo('whiteboards', {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    teamId: data.teamId || '',
    spaceId: data.spaceId || null,
    folderId: data.folderId || null,
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    members: data.members || [],
    thumbnail: '',
    visibility: data.visibility || 'team',
  });
}

export async function getWhiteboardsBySpace(spaceId: string, maxResults = 200): Promise<{ items: any[]; hasMore: boolean }> {
  const q = query(
    collection(db, 'whiteboards'),
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

export async function updateWhiteboard(id: string, data: any) { return updateAt(`whiteboards/${id}`, data); }
export async function deleteWhiteboard(id: string) {
  await deleteSubcollectionDocs(`whiteboards/${id}`, 'elements').catch((err) => console.error('[DB] delete whiteboard elements failed:', err));
  return deleteAt(`whiteboards/${id}`);
}

// Whiteboard Elements (subcollection)
export async function getWhiteboardElements(boardId: string) {
  const q = query(collection(db, `whiteboards/${boardId}/elements`), orderBy('zIndex', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createWhiteboardElement(boardId: string, data: any) {
  return addTo(`whiteboards/${boardId}/elements`, {
    type: data.type || 'sticky',
    x: data.x || 0,
    y: data.y || 0,
    width: data.width || 200,
    height: data.height || 150,
    content: data.content || '',
    color: data.color || '#FBBF24',
    style: data.style || {},
    linkedTaskId: data.linkedTaskId || '',
    createdBy: data.createdBy || '',
    zIndex: data.zIndex || 0,
  });
}

export async function updateWhiteboardElement(boardId: string, elementId: string, data: any) {
  return updateAt(`whiteboards/${boardId}/elements/${elementId}`, data);
}

export async function deleteWhiteboardElement(boardId: string, elementId: string) {
  return deleteAt(`whiteboards/${boardId}/elements/${elementId}`);
}

// Real-time listener for whiteboard elements (collaboration) — capped at 500
export function onWhiteboardElementsSnapshot(boardId: string, callback: (elements: any[]) => void) {
  const q = query(collection(db, `whiteboards/${boardId}/elements`), orderBy('zIndex', 'asc'), limit(500));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}
