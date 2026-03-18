// ===== TEAMS / DEPARTMENTS, FOLDERS, LISTS =====

import {
  collection, doc, getDocs, getCountFromServer, query, where, orderBy,
  writeBatch, arrayRemove, updateDoc,
  addTo, setAt, updateAt, deleteAt, getByOrg, getByTeam,
  db, ORG, serverTimestamp,
} from './helpers';

// Collections that reference teamId
const TEAM_RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'] as const;

// ===== TEAMS / DEPARTMENTS =====
export async function getTeams() {
  const s = await getDocs(collection(db, `orgs/${ORG}/teams`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getActiveTeams() {
  const all = await getTeams();
  return all.filter((t: any) => t.status !== 'archived');
}
export async function createTeam(data: any) {
  const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const result = await setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name, color: data.color || '#6B7280', icon: data.icon || '📁', description: data.description || '',
    status: 'active',
  });
  // Auto-create required 'list' view for every new space
  try {
    const { createView } = await import('@/lib/views/view-db');
    await createView({
      orgId: ORG,
      scopeType: 'space',
      scopeId: id,
      name: 'Lista',
      viewType: 'list',
      visibility: 'required',
      isDefault: true,
      isPinned: false,
      position: 0,
      config: {},
      sharedWith: [],
      createdBy: data.createdBy || 'system',
    });
  } catch (err) {
    console.error('[createTeam] Auto-create required list view failed:', err);
  }
  // Auto-create contextual channel for this space (non-blocking)
  try {
    const { ensureSpaceChannel } = await import('@/lib/contextual-channels');
    await ensureSpaceChannel(id, data.name, data.createdBy || 'system');
  } catch (err) {
    console.error('[createTeam] Auto-create space channel failed:', err);
  }
  return result;
}
export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }
export async function deleteTeam(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }
export async function archiveTeam(id: string) { return updateAt(`orgs/${ORG}/teams/${id}`, { status: 'archived' }); }
export async function unarchiveTeam(id: string) { return updateAt(`orgs/${ORG}/teams/${id}`, { status: 'active' }); }

// Dry-run: count all resources and members that would be affected by deleting a department
export async function getDepartmentImpact(teamId: string) {
  const counts: Record<string, number> = {};
  // Use Firestore count aggregation — no full doc loads needed
  const countPromises = TEAM_RESOURCE_COLLECTIONS.map(async (col) => {
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', teamId));
    const snap = await getCountFromServer(q_);
    counts[col] = snap.data().count;
  });
  await Promise.all(countPromises);
  // Members: count by primary team (requires reading members — small collection)
  const primaryQ = query(collection(db, `orgs/${ORG}/members`), where('teamId', '==', teamId));
  const primarySnap = await getCountFromServer(primaryQ);
  counts['primaryMembers'] = primarySnap.data().count;
  // Secondary members: teamIds array-contains (those where teamId is not primary)
  const secondaryQ = query(collection(db, `orgs/${ORG}/members`), where('teamIds', 'array-contains', teamId));
  const secondarySnap = await getCountFromServer(secondaryQ);
  counts['secondaryMembers'] = Math.max(0, secondarySnap.data().count - counts['primaryMembers']);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}

// Reassign all resources from one team to another (batched writes for consistency)
export async function reassignTeamResources(fromTeamId: string, toTeamId: string, toTeamName: string) {
  let moved = 0;
  const CHUNK = 450;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', fromTeamId));
    const snap = await getDocs(q_);
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      const chunk = snap.docs.slice(i, i + CHUNK);
      for (const d of chunk) {
        batch.update(doc(db, `${col}/${d.id}`), { teamId: toTeamId, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      moved += chunk.length;
    }
  }
  // Reassign members: primary and secondary
  const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
  const primaryMembers = membersSnap.docs.filter(d => d.data().teamId === fromTeamId);
  for (let i = 0; i < primaryMembers.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = primaryMembers.slice(i, i + CHUNK);
    for (const d of chunk) {
      const data = d.data();
      const newTeamIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newTeamIds.includes(toTeamId)) newTeamIds.push(toTeamId);
      batch.update(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamId: toTeamId, teamIds: newTeamIds, department: toTeamName, updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    moved += chunk.length;
  }
  const secondaryMembers = membersSnap.docs.filter(d => {
    const data = d.data();
    return data.teamId !== fromTeamId && (data.teamIds || []).includes(fromTeamId);
  });
  for (let i = 0; i < secondaryMembers.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = secondaryMembers.slice(i, i + CHUNK);
    for (const d of chunk) {
      const data = d.data();
      const newTeamIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newTeamIds.includes(toTeamId)) newTeamIds.push(toTeamId);
      batch.update(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamIds: newTeamIds, updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    moved += chunk.length;
  }
  return moved;
}

// Purge: delete all resources belonging to a team
export async function purgeTeamResources(teamId: string) {
  let deleted = 0;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', teamId));
    const snap = await getDocs(q_);
    for (const d of snap.docs) {
      // Use cascade delete for entities with subcollections
      switch (col) {
        case 'tasks': { const { deleteTask } = await import('./tasks'); await deleteTask(d.id); break; }
        case 'goals': { const { deleteGoal } = await import('./goals'); await deleteGoal(d.id); break; }
        case 'docs': { const { deleteDocument } = await import('./docs'); await deleteDocument(d.id); break; }
        case 'channels': { const { deleteChannel } = await import('./chat'); await deleteChannel(d.id); break; }
        case 'forms': { const { deleteForm } = await import('./forms'); await deleteForm(d.id); break; }
        case 'whiteboards': { const { deleteWhiteboard } = await import('./whiteboards'); await deleteWhiteboard(d.id); break; }
        default: await deleteAt(`${col}/${d.id}`); break;
      }
      deleted++;
    }
  }
  // Unassign members from this team (don't delete members, just clear the teamId)
  const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
  for (const d of membersSnap.docs) {
    const data = d.data();
    if (data.teamId === teamId) {
      await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamId: '', teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), department: '', updatedAt: serverTimestamp(),
      });
    } else if ((data.teamIds || []).includes(teamId)) {
      await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), updatedAt: serverTimestamp(),
      });
    }
  }
  return deleted;
}

// ===== FOLDERS =====
export interface FolderData {
  id?: string;
  orgId?: string;
  spaceId: string;
  name: string;
  position: number;
  color?: string;
  parentFolderId?: string | null;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function getFolders(spaceId: string): Promise<FolderData[]> {
  const q = query(
    collection(db, 'folders'),
    where('orgId', '==', ORG),
    where('spaceId', '==', spaceId),
    orderBy('position', 'asc'),
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() } as FolderData));
}

export async function createFolder(data: Omit<FolderData, 'id' | 'orgId'>) {
  const ref = await addTo('folders', { ...data, parentFolderId: data.parentFolderId || null, orgId: ORG });
  // Auto-create contextual channel for this folder (non-blocking)
  try {
    const { ensureFolderChannel } = await import('@/lib/contextual-channels');
    await ensureFolderChannel(ref.id, data.name, data.spaceId, data.createdBy || 'system');
  } catch (err) {
    console.error('[createFolder] Auto-create folder channel failed:', err);
  }
  return ref;
}

export async function updateFolder(id: string, data: Partial<FolderData>) {
  return updateAt(`folders/${id}`, data);
}

export async function deleteFolder(id: string) {
  // Move lists, docs, and whiteboards in this folder to root (folderId cleared)
  const cols = ['lists', 'docs', 'whiteboards'];
  await Promise.all(cols.map(async (col) => {
    const q = query(collection(db, col), where('orgId', '==', ORG), where('folderId', '==', id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { folderId: null, updatedAt: serverTimestamp() }));
      await batch.commit();
    }
  }));
  // Move subfolders to root (parentFolderId cleared)
  const subQ = query(collection(db, 'folders'), where('orgId', '==', ORG), where('parentFolderId', '==', id));
  const subSnap = await getDocs(subQ);
  if (!subSnap.empty) {
    const batch = writeBatch(db);
    subSnap.docs.forEach(d => batch.update(d.ref, { parentFolderId: null, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
  return deleteAt(`folders/${id}`);
}

// ===== LISTS =====
export interface ListData {
  id?: string;
  orgId?: string;
  spaceId: string;
  folderId: string | null;
  name: string;
  position: number;
  defaultStatus?: string;
  visibility?: 'inherited' | 'private';
  members?: string[];
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export async function getLists(spaceId: string): Promise<ListData[]> {
  const q = query(
    collection(db, 'lists'),
    where('orgId', '==', ORG),
    where('spaceId', '==', spaceId),
    orderBy('position', 'asc'),
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() } as ListData));
}

export async function getListsByFolder(folderId: string): Promise<ListData[]> {
  const q = query(
    collection(db, 'lists'),
    where('orgId', '==', ORG),
    where('folderId', '==', folderId),
    orderBy('position', 'asc'),
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() } as ListData));
}

export async function createList(data: Omit<ListData, 'id' | 'orgId'>) {
  const ref = await addTo('lists', { ...data, orgId: ORG });
  // Auto-create contextual channel for this list (non-blocking)
  try {
    const { ensureListChannel } = await import('@/lib/contextual-channels');
    await ensureListChannel(ref.id, data.name, data.spaceId, data.createdBy || 'system');
  } catch (err) {
    console.error('[createList] Auto-create list channel failed:', err);
  }
  return ref;
}

export async function updateList(id: string, data: Partial<ListData>) {
  return updateAt(`lists/${id}`, data);
}

export async function deleteList(id: string) {
  // Move tasks whose home list is this list to no list (clear listId)
  const q = query(collection(db, 'tasks'), where('orgId', '==', ORG), where('listId', '==', id));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const CHUNK = 450;
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { listId: null, listIds: arrayRemove(id), updatedAt: serverTimestamp() }));
      await batch.commit();
    }
  }
  // Also remove from listIds for tasks that have this list as a secondary list (not home)
  const q2 = query(collection(db, 'tasks'), where('orgId', '==', ORG), where('listIds', 'array-contains', id));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    const CHUNK = 450;
    for (let i = 0; i < snap2.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap2.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { listIds: arrayRemove(id), updatedAt: serverTimestamp() }));
      await batch.commit();
    }
  }
  return deleteAt(`lists/${id}`);
}

// Ensure a space has at least one list (the default "General" list)
export async function ensureDefaultList(spaceId: string, createdBy: string): Promise<ListData> {
  const existing = await getLists(spaceId);
  if (existing.length > 0) return existing[0];
  const ref = await createList({ spaceId, folderId: null, name: 'General', position: 0, createdBy });
  return { id: ref.id, spaceId, folderId: null, name: 'General', position: 0, createdBy };
}
