import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, deleteField,
  getDocs, getDoc, getCountFromServer, query, where, orderBy, limit, writeBatch, collectionGroup,
  serverTimestamp, onSnapshot, DocumentData, arrayUnion, arrayRemove, runTransaction,
  startAfter, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { validateCustomFieldValues, loadFieldDefs } from './custom-fields';
import { getCurrentOrgId, ORG_ID as ORG } from '@/lib/org';



// ===== GENERIC HELPERS =====

async function addTo(path: string, data: any) {
  return addDoc(collection(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

async function setAt(path: string, data: any) {
  return setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

async function updateAt(path: string, data: any) {
  return updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
}

async function deleteAt(path: string) { return deleteDoc(doc(db, path)); }

async function getOne(path: string) {
  const s = await getDoc(doc(db, path));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

async function getByOrg(col: string, maxResults = 500): Promise<{ items: any[]; hasMore: boolean }> {
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

// ===== CASCADE DELETE HELPERS =====

// Delete all documents in a subcollection (batched, max 450 per batch)
async function deleteSubcollectionDocs(parentPath: string, subcollectionName: string): Promise<number> {
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
async function cleanupEntityRelations(entityId: string): Promise<number> {
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

// Remove a task from all goal targets that reference it, then recalculate progress.
// Propagates errors — callers decide whether to gate on failure.
async function removeTaskFromGoalTargets(taskId: string): Promise<void> {
  const snap = await getDocs(query(
    collectionGroup(db, 'targets'),
    where('linkedTaskIds', 'array-contains', taskId),
  ));
  if (snap.empty) return;
  const goalIdsToRecalc = new Set<string>();
  for (const d of snap.docs) {
    await updateDoc(d.ref, { linkedTaskIds: arrayRemove(taskId), updatedAt: serverTimestamp() });
    const goalId = d.ref.parent.parent?.id;
    if (goalId) goalIdsToRecalc.add(goalId);
  }
  for (const goalId of goalIdsToRecalc) {
    await recalculateGoalProgress(goalId);
  }
}

// Clean up time-entries referencing a deleted task
async function cleanupOrphanedTimeEntries(taskId: string): Promise<number> {
  try {
    const snap = await getDocs(query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('taskId', '==', taskId),
    ));
    if (snap.empty) return 0;
    // Clear taskId reference (don't delete the time entry itself — the hours were worked)
    const updates: Promise<void>[] = [];
    for (const d of snap.docs) {
      updates.push(updateDoc(d.ref, { taskId: '', taskTitle: '(deleted task)', updatedAt: serverTimestamp() }));
    }
    await Promise.allSettled(updates);
    return snap.size;
  } catch (err) { console.error('[DB] cleanup time entry refs failed:', err); return 0; }
}

// Clear linkedTaskId from whiteboard elements referencing a deleted task
async function cleanupWhiteboardLinkedTaskRefs(taskId: string): Promise<number> {
  try {
    const snap = await getDocs(query(
      collectionGroup(db, 'elements'),
      where('linkedTaskId', '==', taskId),
    ));
    if (snap.empty) return 0;
    const updates: Promise<void>[] = [];
    for (const d of snap.docs) {
      updates.push(updateDoc(d.ref, { linkedTaskId: '', updatedAt: serverTimestamp() }));
    }
    await Promise.allSettled(updates);
    return snap.size;
  } catch (err) { console.error('[DB] cleanup whiteboard linked task refs failed:', err); return 0; }
}

// ===== MEMBERS =====
export async function getMembers() {
  const s = await getDocs(collection(db, `orgs/${ORG}/members`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }
export async function updateMember(uid: string, data: any) { return updateAt(`orgs/${ORG}/members/${uid}`, data); }
export async function createMember(uid: string, data: any) {
  return setAt(`orgs/${ORG}/members/${uid}`, {
    userId: uid, orgId: ORG,
    role: data.role || 'member',
    teamId: data.teamId || '',
    teamIds: data.teamId ? [data.teamId] : [],
    displayName: data.displayName || '',
    email: data.email || '',
    title: data.title || '',
    department: data.department || '',
    managerId: data.managerId || '',
    hierarchyLevel: data.hierarchyLevel || 'member',
    photoURL: data.photoURL || '',
    active: true,
  });
}
export async function softDeleteMember(uid: string) { return updateAt(`orgs/${ORG}/members/${uid}`, { active: false }); }

// Dry-run: count resources assigned to a member that would become orphaned on deactivation
export async function getMemberImpact(uid: string) {
  const counts: Record<string, number> = {};
  const cols = ['tasks', 'goals', 'docs', 'time-entries'] as const;
  const promises = cols.map(async (col) => {
    const field = col === 'time-entries' ? 'userId' : 'assignees';
    const op = field === 'assignees' ? 'array-contains' : '==';
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where(field, op, uid));
    const snap = await getCountFromServer(q_);
    counts[col] = snap.data().count;
  });
  await Promise.all(promises);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}
export async function reactivateMember(uid: string) { return updateAt(`orgs/${ORG}/members/${uid}`, { active: true }); }

// ===== ORG =====
export async function getOrg() { return getOne(`orgs/${ORG}`); }
export async function updateOrg(data: any) { return setAt(`orgs/${ORG}`, data); }

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
  return setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name, color: data.color || '#6B7280', icon: data.icon || '📁', description: data.description || '',
    status: 'active',
  });
}
export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }
export async function deleteTeam(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }
export async function archiveTeam(id: string) { return updateAt(`orgs/${ORG}/teams/${id}`, { status: 'archived' }); }
export async function unarchiveTeam(id: string) { return updateAt(`orgs/${ORG}/teams/${id}`, { status: 'active' }); }

// Collections that reference teamId
const TEAM_RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'] as const;

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
        case 'tasks': await deleteTask(d.id); break;
        case 'goals': await deleteGoal(d.id); break;
        case 'docs': await deleteDocument(d.id); break;
        case 'channels': await deleteChannel(d.id); break;
        case 'forms': await deleteForm(d.id); break;
        case 'whiteboards': await deleteWhiteboard(d.id); break;
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

// ===== TEAM-FILTERED GETTER =====
async function getByTeam(col: string, teamId: string, maxResults = 500): Promise<{ items: any[]; hasMore: boolean }> {
  if (teamId === '__all__') return getByOrg(col, maxResults);
  // Compound query: filter at Firestore level instead of loading entire org
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

// ===== FOLDERS =====
export interface FolderData {
  id?: string;
  orgId?: string;
  spaceId: string;
  name: string;
  position: number;
  color?: string;
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
  return addTo('folders', { ...data, orgId: ORG });
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
  return addTo('lists', { ...data, orgId: ORG });
}

export async function updateList(id: string, data: Partial<ListData>) {
  return updateAt(`lists/${id}`, data);
}

export async function deleteList(id: string) {
  // Move tasks in this list to no list (clear listId)
  const q = query(collection(db, 'tasks'), where('orgId', '==', ORG), where('listId', '==', id));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const CHUNK = 450;
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + CHUNK).forEach(d => batch.update(d.ref, { listId: null, updatedAt: serverTimestamp() }));
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

// ===== TASKS =====
export async function getTasks(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('tasks', teamId, maxResults);
  return getByOrg('tasks', maxResults);
}

export async function getTasksByList(listId: string, maxResults = 500): Promise<{ items: any[]; hasMore: boolean }> {
  const q = query(
    collection(db, 'tasks'),
    where('orgId', '==', ORG),
    where('listId', '==', listId),
    orderBy('createdAt', 'desc'),
    limit(maxResults + 1),
  );
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  const items = docs.map(d => ({ id: d.id, ...d.data() }));
  return { items, hasMore };
}

export async function getTasksPaginated({
  teamId,
  pageSize = 50,
  lastDoc: lastDocSnap,
  status,
  priority,
  dueBefore,
  dueAfter,
  sortBy = 'createdAt',
}: {
  teamId?: string;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot | null;
  status?: string;
  priority?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: string;
}): Promise<{ items: any[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [where('orgId', '==', ORG)];
  if (teamId && teamId !== '__all__') constraints.push(where('teamId', '==', teamId));
  if (status) constraints.push(where('status', '==', status));
  if (priority) constraints.push(where('priority', '==', priority));
  if (dueBefore) constraints.push(where('dueDate', '<=', dueBefore));
  if (dueAfter) constraints.push(where('dueDate', '>=', dueAfter));
  constraints.push(orderBy(sortBy, 'desc'));
  if (lastDocSnap) constraints.push(startAfter(lastDocSnap));
  constraints.push(limit(pageSize + 1));

  const q = query(collection(db, 'tasks'), ...constraints);
  const snap = await getDocs(q);
  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  const items = docs.map(d => ({ id: d.id, ...d.data() }));
  const newLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
  return { items, lastDoc: newLastDoc, hasMore };
}

export async function createTask(data: any) {
  // Validate custom fields if present
  if (data.customFields && Object.keys(data.customFields).length > 0) {
    const settings = await loadFieldDefs();
    const errors = validateCustomFieldValues(data.customFields, settings.fields);
    if (Object.keys(errors).length > 0) {
      throw new Error(`Custom field validation failed: ${Object.values(errors).join(', ')}`);
    }
  }
  const title = data.title || '';
  return addTo('tasks', {
    ...data, orgId: ORG, status: data.status || 'todo', priority: data.priority || 'medium',
    assignees: data.assignees || [], tags: data.tags || [], teamId: data.teamId || '',
    listId: data.listId || null,
    visibility: data.visibility || 'team',
    description: data.description || '', dueDate: data.dueDate || null, startDate: data.startDate || null,
    timeEstimate: data.timeEstimate || null, timeSpent: data.timeSpent || 0,
    subtasks: data.subtasks || [], checklist: data.checklist || [], attachments: data.attachments || [],
    customFields: data.customFields || {}, type: data.type || 'task', points: data.points || null,
    dependencies: data.dependencies || [], watchers: data.watchers || [], archived: false,
    createdBy: data.createdBy || '',
    titleLower: title.toLowerCase(),
  });
}
export async function updateTask(id: string, data: any) {
  // Validate custom fields if being updated
  if (data.customFields && Object.keys(data.customFields).length > 0) {
    const settings = await loadFieldDefs();
    const errors = validateCustomFieldValues(data.customFields, settings.fields);
    if (Object.keys(errors).length > 0) {
      throw new Error(`Custom field validation failed: ${Object.values(errors).join(', ')}`);
    }
  }
  // Keep titleLower in sync for server-side search
  const patch = data.title !== undefined ? { ...data, titleLower: data.title.toLowerCase() } : data;
  return updateAt(`tasks/${id}`, patch);
}
export async function deleteTask(id: string) {
  // Critical: detach from goal targets (affects goal progress integrity)
  // Must succeed before parent delete — throws on failure
  await removeTaskFromGoalTargets(id);

  // Best-effort: orphan cleanup (logged, non-blocking)
  const bestEffort = [
    { name: 'comments', fn: () => deleteSubcollectionDocs(`tasks/${id}`, 'comments') },
    { name: 'activity', fn: () => deleteSubcollectionDocs(`tasks/${id}`, 'activity') },
    { name: 'relations', fn: () => cleanupEntityRelations(id) },
    { name: 'timeEntries', fn: () => cleanupOrphanedTimeEntries(id) },
    { name: 'whiteboardRefs', fn: () => cleanupWhiteboardLinkedTaskRefs(id) },
  ];
  const results = await Promise.allSettled(bestEffort.map(op => op.fn()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[deleteTask] cascade ${bestEffort[i].name} failed for ${id}:`, r.reason);
  });
  return deleteAt(`tasks/${id}`);
}
export async function softDeleteTask(id: string) {
  // Critical: detach from goal targets — must succeed before soft-delete
  await removeTaskFromGoalTargets(id);

  // Best-effort: relation cleanup
  await cleanupEntityRelations(id).catch(err =>
    console.error(`[softDeleteTask] relations cleanup failed for ${id}:`, err));

  return updateAt(`tasks/${id}`, { deleted: true, deletedAt: serverTimestamp() });
}
export async function restoreTask(id: string) { return updateAt(`tasks/${id}`, { deleted: false, deletedAt: null }); }

export async function getTaskComments(taskId: string, maxResults = 200) {
  const q = query(collection(db, `tasks/${taskId}/comments`), orderBy('createdAt', 'asc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}
export async function addTaskComment(taskId: string, data: { text: string; authorId: string; authorName: string; mentions?: string[]; attachments?: any[] }) {
  return addTo(`tasks/${taskId}/comments`, { ...data, mentions: data.mentions || [], attachments: data.attachments || [] });
}
// ===== DOC COMMENTS =====
export async function getDocComments(docId: string, maxResults = 200) {
  const q = query(collection(db, `docs/${docId}/comments`), orderBy('createdAt', 'asc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}
export async function addDocComment(docId: string, data: { text: string; authorId: string; authorName: string; mentions?: string[] }) {
  return addTo(`docs/${docId}/comments`, { ...data, mentions: data.mentions || [] });
}
export async function deleteDocComment(docId: string, commentId: string) {
  return deleteAt(`docs/${docId}/comments/${commentId}`);
}

export async function getCustomFieldDefs() {
  const data = await getOne(`orgs/${ORG}/settings/customFields`);
  return (data as any)?.fields || [];
}
export async function saveCustomFieldDefs(fields: any[]) {
  return setAt(`orgs/${ORG}/settings/customFields`, { fields });
}
export async function getTaskActivity(taskId: string, maxResults = 500) {
  const q = query(collection(db, `tasks/${taskId}/activity`), orderBy('createdAt', 'asc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}
export async function addTaskActivity(taskId: string, data: { action: string; field?: string; from?: string; to?: string; actorId: string; actorName: string }) {
  return addTo(`tasks/${taskId}/activity`, data);
}

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

// ===========================================================
// CHANNELS & MESSAGING — Complete System
// ===========================================================

export interface ChannelData {
  name: string;
  description: string;
  type: 'public' | 'private' | 'dm';
  teamId: string;
  createdBy: string;
  createdByName: string;
  members: string[];         // User IDs who can access
  admins: string[];          // User IDs who can manage
  pinnedMessages: string[];  // Message IDs
  archived: boolean;
  icon: string;
  color: string;
  lastMessageAt: any;
  lastMessagePreview: string;
  lastMessageBy: string;
}

export interface MessageData {
  content: string;
  userId: string;
  displayName: string;
  photoURL: string;
  type: 'text' | 'system' | 'file';
  replyTo: string | null;      // Message ID being replied to
  replyPreview: string | null;  // Preview text of replied message
  replyAuthor: string | null;
  reactions: Record<string, string[]>;  // emoji → [userId]
  pinned: boolean;
  edited: boolean;
  deleted: boolean;
  mentions: string[];          // User IDs mentioned
  attachments: any[];
  readBy: string[];            // User IDs who have read
}

// --- Channels ---
export async function getChannels(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('channels', teamId, maxResults);
  return getByOrg('channels', maxResults);
}

export async function getAllUserChannels(userId: string): Promise<{ items: any[]; hasMore: boolean }> {
  // Two targeted queries: channels where user is member + public channels
  const [memberSnap, publicSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'channels'),
      where('orgId', '==', ORG),
      where('members', 'array-contains', userId),
      limit(200),
    )),
    getDocs(query(
      collection(db, 'channels'),
      where('orgId', '==', ORG),
      where('type', '==', 'public'),
      limit(100),
    )),
  ]);
  const seen = new Set<string>();
  const items: any[] = [];
  for (const snap of [memberSnap, publicSnap]) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const ch = { id: d.id, ...d.data() } as any;
      if (!ch.archived) items.push(ch);
    }
  }
  items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return { items, hasMore: false };
}

export async function createChannel(data: Partial<ChannelData>) {
  return addTo('channels', {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    type: data.type || 'public',
    teamId: data.teamId || '',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    members: data.members || [],
    admins: data.admins || [],
    pinnedMessages: [],
    archived: false,
    icon: data.icon || '',
    color: data.color || '',
    lastMessageAt: null,
    lastMessagePreview: '',
    lastMessageBy: '',
  });
}

export async function updateChannel(id: string, data: Partial<ChannelData>) {
  return updateAt(`channels/${id}`, data);
}

export async function deleteChannel(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`channels/${id}`, 'messages'),
    deleteSubcollectionDocs(`channels/${id}`, 'meta'),
  ]);
  return deleteAt(`channels/${id}`);
}

export async function archiveChannel(id: string) {
  return updateAt(`channels/${id}`, { archived: true });
}

// Channel member management
export async function addChannelMember(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    members: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeChannelMember(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    members: arrayRemove(userId),
    admins: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function addChannelAdmin(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    admins: arrayUnion(userId),
    members: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeChannelAdmin(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    admins: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
}

// --- Messages ---
export async function getMessages(channelId: string, maxResults = 200) {
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}

export async function sendMessage(channelId: string, data: Partial<MessageData>) {
  const msg = await addTo(`channels/${channelId}/messages`, {
    content: data.content || '',
    userId: data.userId || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    type: data.type || 'text',
    replyTo: data.replyTo || null,
    replyPreview: data.replyPreview || null,
    replyAuthor: data.replyAuthor || null,
    reactions: {},
    pinned: false,
    edited: false,
    deleted: false,
    mentions: data.mentions || [],
    attachments: data.attachments || [],
    readBy: [data.userId],
  });

  // Update channel last message
  const preview = (data.content || '').slice(0, 60);
  await updateAt(`channels/${channelId}`, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: preview,
    lastMessageBy: data.displayName || '',
  });

  return msg;
}

export async function editMessage(channelId: string, messageId: string, content: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    content,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMessage(channelId: string, messageId: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    deleted: true,
    content: 'This message was deleted',
    updatedAt: serverTimestamp(),
  });
}

// Pin / Unpin messages
export async function pinMessage(channelId: string, messageId: string) {
  await updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), { pinned: true });
  return updateDoc(doc(db, `channels/${channelId}`), {
    pinnedMessages: arrayUnion(messageId),
    updatedAt: serverTimestamp(),
  });
}

export async function unpinMessage(channelId: string, messageId: string) {
  await updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), { pinned: false });
  return updateDoc(doc(db, `channels/${channelId}`), {
    pinnedMessages: arrayRemove(messageId),
    updatedAt: serverTimestamp(),
  });
}

// Reactions — use transaction to prevent race conditions
export async function addReaction(channelId: string, messageId: string, emoji: string, userId: string) {
  const msgRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  return runTransaction(db, async (transaction) => {
    const msgSnap = await transaction.get(msgRef);
    if (!msgSnap.exists()) return;
    const reactions = { ...(msgSnap.data().reactions || {}) };
    if (!reactions[emoji]) reactions[emoji] = [];
    if (!reactions[emoji].includes(userId)) reactions[emoji] = [...reactions[emoji], userId];
    transaction.update(msgRef, { reactions });
  });
}

export async function removeReaction(channelId: string, messageId: string, emoji: string, userId: string) {
  const msgRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  return runTransaction(db, async (transaction) => {
    const msgSnap = await transaction.get(msgRef);
    if (!msgSnap.exists()) return;
    const reactions = { ...(msgSnap.data().reactions || {}) };
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    }
    transaction.update(msgRef, { reactions });
  });
}

// Mark as read
export async function markAsRead(channelId: string, messageId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    readBy: arrayUnion(userId),
  });
}

// Real-time listener for messages
export function onMessagesSnapshot(channelId: string, callback: (msgs: any[], hasMore: boolean) => void, maxResults = 100) {
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'desc'), limit(maxResults + 1));
  return onSnapshot(q, (snap) => {
    const hasMore = snap.docs.length > maxResults;
    const docs = hasMore ? snap.docs.slice(0, maxResults) : snap.docs;
    const msgs = docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs.reverse(), hasMore);
  });
}

// DM channel helpers
export async function findOrCreateDM(userId1: string, user1Name: string, userId2: string, user2Name: string) {
  // Targeted query: only fetch DM channels where current user is a member
  const q = query(
    collection(db, 'channels'),
    where('orgId', '==', ORG),
    where('type', '==', 'dm'),
    where('members', 'array-contains', userId1),
    limit(50),
  );
  const snap = await getDocs(q);
  const existingDM = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .find((ch: any) => ch.members?.length === 2 && ch.members?.includes(userId2));
  if (existingDM) return existingDM;

  // Create new DM
  const dmDoc = await createChannel({
    name: `${user1Name}, ${user2Name}`,
    description: 'Direct message',
    type: 'dm',
    createdBy: userId1,
    createdByName: user1Name,
    members: [userId1, userId2],
    admins: [userId1, userId2],
  });
  return { id: dmDoc.id, name: `${user1Name}, ${user2Name}`, type: 'dm', members: [userId1, userId2] };
}

// System message helper
export async function sendSystemMessage(channelId: string, content: string) {
  return addTo(`channels/${channelId}/messages`, {
    content,
    userId: 'system',
    displayName: 'System',
    photoURL: '',
    type: 'system',
    replyTo: null, replyPreview: null, replyAuthor: null,
    reactions: {}, pinned: false, edited: false, deleted: false,
    mentions: [], attachments: [], readBy: [],
  });
}

// ===========================================================
// AUTOMATIONS
// ===========================================================
export async function getAutomations(teamId?: string, maxResults = 500) { if (teamId) return getByTeam('automations', teamId, maxResults); return getByOrg('automations', maxResults); }
export async function createAutomation(data: any) { return addTo('automations', { ...data, orgId: ORG, enabled: true, teamId: data.teamId || '' }); }
export async function updateAutomation(id: string, data: any) { return updateAt(`automations/${id}`, data); }
export async function deleteAutomation(id: string) {
  await deleteSubcollectionDocs(`automations/${id}`, 'logs').catch(err => console.error('[DB] Failed to delete automation logs:', err?.message));
  return deleteAt(`automations/${id}`);
}
export async function getAutomationLogs(automationId: string, limitCount = 20) {
  const q = query(collection(db, `automations/${automationId}/logs`), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d: DocumentData) => ({ id: d.id, ...d.data() }));
}

// ===== AUDIT LOG =====
export async function getAuditLogs() { return getByOrg('auditLogs'); }
export async function logAction(data: { action: string; resource: string; detail: string; actorId: string; actorName: string }) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== SETTINGS =====
export async function getSettings(key: string) { return getOne(`orgs/${ORG}/settings/${key}`); }
export async function saveSettings(key: string, data: any) { return setAt(`orgs/${ORG}/settings/${key}`, data); }

// ===== SHARED SPACE VIEWS =====
export async function getSharedSpaceViews(spaceId: string) {
  return getOne(`orgs/${ORG}/spaceSharedViews/${spaceId}`);
}
export async function saveSharedSpaceViews(spaceId: string, data: any) {
  return setAt(`orgs/${ORG}/spaceSharedViews/${spaceId}`, data);
}

// ===== USER PREFERENCES =====
export async function getUserPreferences(userId: string, key: string) {
  return getOne(`orgs/${ORG}/members/${userId}/preferences/${key}`);
}
export async function saveUserPreferences(userId: string, key: string, data: any) {
  return setAt(`orgs/${ORG}/members/${userId}/preferences/${key}`, data);
}

// ===== WORKSPACES =====
export async function getWorkspaces() { return getByOrg('workspaces'); }
export async function createWorkspace(data: any) { return addTo('workspaces', { ...data, orgId: ORG }); }
export async function deleteWorkspace(id: string) { return deleteAt(`workspaces/${id}`); }

// ===== TEMPLATES =====
export async function getTemplates() { return getByOrg('templates'); }
export async function createTemplate(data: any) { return addTo('templates', { ...data, orgId: ORG }); }
export async function deleteTemplate(id: string) { return deleteAt(`templates/${id}`); }

// ===== TYPING INDICATORS =====
export async function setTyping(channelId: string, userId: string, displayName: string) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return setDoc(ref, { [`users.${userId}`]: { name: displayName, at: serverTimestamp() } }, { merge: true });
}

export async function clearTyping(channelId: string, userId: string) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return updateDoc(ref, { [`users.${userId}`]: deleteField() }).catch((err) => console.error('[DB] clearTyping failed:', err));
}

export function onTypingSnapshot(channelId: string, callback: (users: { id: string; name: string }[]) => void) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    const now = Date.now() / 1000;
    const active: { id: string; name: string }[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (!key.startsWith('users.')) continue;
      const uid = key.replace('users.', '');
      const v = val as any;
      if (v?.at?.seconds && (now - v.at.seconds) < 5) {
        active.push({ id: uid, name: v.name || '' });
      }
    }
    callback(active);
  }, () => callback([]));
}

// ===== PRESENCE =====
export function setPresence(userId: string, online: boolean) {
  return setDoc(doc(db, `orgs/${ORG}/presence/${userId}`), { online, lastSeen: serverTimestamp() }, { merge: true });
}

// Polling-based presence — replaces O(n²) listener with O(n) periodic fetch
/** @deprecated Use getPresenceForUsers() for contextual presence. Kept for backward compat. */
export async function getPresenceMap(): Promise<Record<string, boolean>> {
  const snap = await getDocs(query(collection(db, `orgs/${ORG}/presence`), limit(500)));
  const map: Record<string, boolean> = {};
  const now = Date.now() / 1000;
  snap.docs.forEach(d => {
    const data = d.data();
    const lastSeen = data.lastSeen?.seconds || 0;
    map[d.id] = data.online && (now - lastSeen) < 120;
  });
  return map;
}

// Contextual presence — fetch only for specific users (Phase 7)
// Reads O(userIds.length) docs instead of O(org_size).
// Used to scope presence to DM partners + active channel members.
export async function getPresenceForUsers(userIds: string[]): Promise<Record<string, boolean>> {
  if (userIds.length === 0) return {};
  const now = Date.now() / 1000;
  const map: Record<string, boolean> = {};
  const reads = userIds.map(uid =>
    getDoc(doc(db, `orgs/${ORG}/presence/${uid}`))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          map[uid] = !!(data.online && (now - (data.lastSeen?.seconds || 0)) < 120);
        } else {
          map[uid] = false;
        }
      })
      .catch(() => { map[uid] = false; })
  );
  await Promise.all(reads);
  return map;
}

/** @deprecated Use getPresenceMap() with polling instead. Kept for backward compat. */
export function onPresenceSnapshot(callback: (presence: Record<string, boolean>) => void) {
  // Immediately fetch once, then return a no-op unsubscribe
  getPresenceMap().then(callback).catch(() => callback({}));
  return () => {};
}

// ===== READ CURSORS =====
export async function markChannelRead(userId: string, channelId: string) {
  return setDoc(doc(db, `orgs/${ORG}/readCursors/${userId}`), { [`channels.${channelId}`]: serverTimestamp() }, { merge: true });
}

export function onReadCursorsSnapshot(userId: string, callback: (cursors: Record<string, any>) => void) {
  return onSnapshot(doc(db, `orgs/${ORG}/readCursors/${userId}`), (snap) => {
    const data = snap.data() || {};
    // Flatten "channels.xxx" dot-notation keys
    const cursors: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('channels.')) {
        cursors[key.replace('channels.', '')] = val;
      }
    }
    callback(cursors);
  }, () => callback({}));
}

// ===========================================================
// GOALS
// ===========================================================
export async function getGoals(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('goals', teamId, maxResults);
  return getByOrg('goals', maxResults);
}

export async function getGoal(id: string) { return getOne(`goals/${id}`); }

export async function createGoal(data: any) {
  return addTo('goals', {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    dueDate: data.dueDate || null,
    ownerId: data.ownerId || '',
    ownerName: data.ownerName || '',
    teamId: data.teamId || '',
    status: data.status || 'on_track',
    progress: 0,
    tags: data.tags || [],
    color: data.color || '#7B68EE',
    visibility: data.visibility || 'team',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    parentGoalId: data.parentGoalId || null,
    titleLower: (data.name || '').toLowerCase(),
  });
}

export async function updateGoal(id: string, data: any) {
  const patch = data.name !== undefined ? { ...data, titleLower: data.name.toLowerCase() } : data;
  return updateAt(`goals/${id}`, patch);
}
export async function deleteGoal(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`goals/${id}`, 'targets'),
    cleanupEntityRelations(id),
  ]);
  return deleteAt(`goals/${id}`);
}

// Goal Targets (subcollection)
export async function getGoalTargets(goalId: string) {
  const q = query(collection(db, `goals/${goalId}/targets`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createGoalTarget(goalId: string, data: any) {
  return addTo(`goals/${goalId}/targets`, {
    name: data.name || '',
    type: data.type || 'number',
    currentValue: data.currentValue || 0,
    targetValue: data.targetValue || 100,
    unit: data.unit || '',
    linkedTaskIds: data.linkedTaskIds || [],
    autoSync: data.autoSync ?? true,
  });
}

export async function updateGoalTarget(goalId: string, targetId: string, data: any) {
  return updateAt(`goals/${goalId}/targets/${targetId}`, data);
}

export async function deleteGoalTarget(goalId: string, targetId: string) {
  await deleteAt(`goals/${goalId}/targets/${targetId}`);
  // Auto-recalculate parent goal progress after removing a target
  await recalculateGoalProgress(goalId);
}

// Recalculate goal progress from targets + child goals
export async function recalculateGoalProgress(goalId: string) {
  const targets = await getGoalTargets(goalId);
  const children = await getChildGoals(goalId);

  // Collect progress sources: own targets + child goals
  const sources: number[] = [];

  for (const t of targets) {
    const target = t as any;
    const tv = Math.max(target.targetValue || 1, 1);
    const cv = Math.min(Math.max(target.currentValue || 0, 0), tv);
    sources.push((cv / tv) * 100);
  }

  for (const child of children) {
    sources.push((child as any).progress ?? 0);
  }

  if (sources.length === 0) {
    await updateAt(`goals/${goalId}`, { progress: 0 });
    return 0;
  }

  const progress = Math.round(sources.reduce((a, b) => a + b, 0) / sources.length);
  await updateAt(`goals/${goalId}`, { progress });

  return progress;
}

/** Get all child goals of a parent goal. */
export async function getChildGoals(parentGoalId: string) {
  const q = query(
    collection(db, `orgs/${ORG}/goals`),
    where('parentGoalId', '==', parentGoalId),
    orderBy('createdAt', 'asc'),
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Cascade progress recalculation from a child goal up to its ancestors.
 * Max depth = 10 to prevent infinite loops from circular references.
 */
export async function cascadeProgressToParent(goalId: string, _depth = 0) {
  if (_depth >= 10) return; // safety guard
  const goal = await getOne(`goals/${goalId}`);
  if (!goal || !(goal as any).parentGoalId) return;
  const parentId = (goal as any).parentGoalId;

  // Recalculate the parent's progress from its targets + children
  const targets = await getGoalTargets(parentId);
  const children = await getChildGoals(parentId);
  const sources: number[] = [];
  for (const t of targets) {
    const target = t as any;
    const tv = Math.max(target.targetValue || 1, 1);
    const cv = Math.min(Math.max(target.currentValue || 0, 0), tv);
    sources.push((cv / tv) * 100);
  }
  for (const child of children) {
    sources.push((child as any).progress ?? 0);
  }
  const progress = sources.length ? Math.round(sources.reduce((a, b) => a + b, 0) / sources.length) : 0;
  await updateAt(`goals/${parentId}`, { progress });

  // Continue cascading upward
  await cascadeProgressToParent(parentId, _depth + 1);
}

// Sync goal targets when a task status changes
// Uses collectionGroup query to find only targets that reference this task (O(1) lookup)
export async function syncGoalTargetsForTask(taskId: string) {
  try {
    const snap = await getDocs(query(
      collectionGroup(db, 'targets'),
      where('linkedTaskIds', 'array-contains', taskId),
    ));
    if (snap.empty) return;

    const goalIdsToRecalc = new Set<string>();

    for (const targetDoc of snap.docs) {
      const t = targetDoc.data();
      if (t.type !== 'tasks' || !t.autoSync) continue;

      // Transaction: read fresh target + all linked tasks → compute → write atomically.
      // Prevents stale-write race when concurrent task completions update the same target.
      const linkedIds: string[] = t.linkedTaskIds || [];
      const taskRefs = linkedIds.map(tid => doc(db, `tasks/${tid}`));

      const updated = await runTransaction(db, async (transaction) => {
        const freshTarget = await transaction.get(targetDoc.ref);
        const freshData = freshTarget.data();
        if (!freshData) return false;

        const taskSnaps = await Promise.all(taskRefs.map(ref => transaction.get(ref)));
        let completed = 0;
        for (const taskSnap of taskSnaps) {
          if (taskSnap.exists() && taskSnap.data()?.status === 'done' && !taskSnap.data()?.deleted) completed++;
        }

        if (completed !== freshData.currentValue) {
          transaction.update(targetDoc.ref, { currentValue: completed, updatedAt: serverTimestamp() });
          return true;
        }
        return false;
      });

      if (updated) {
        const goalId = targetDoc.ref.parent.parent?.id;
        if (goalId) goalIdsToRecalc.add(goalId);
      }
    }

    for (const goalId of goalIdsToRecalc) {
      await recalculateGoalProgress(goalId);
    }
  } catch (err) {
    console.error('[syncGoalTargetsForTask] Error:', err);
  }
}

// ===========================================================
// TIME ENTRIES (Timesheets)
// ===========================================================
export async function getTimeEntries(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('time-entries', teamId, maxResults);
  return getByOrg('time-entries', maxResults);
}

export async function getTimeEntriesByDateRange(startDate: string, endDate: string, userId?: string) {
  let q;
  if (userId) {
    q = query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('userId', '==', userId)
    );
  } else {
    q = query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
  }
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTimeEntriesByTask(taskId: string) {
  const q = query(
    collection(db, 'time-entries'),
    where('orgId', '==', ORG),
    where('taskId', '==', taskId)
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createTimeEntry(data: any) {
  return addTo('time-entries', {
    orgId: ORG,
    userId: data.userId || '',
    userName: data.userName || '',
    taskId: data.taskId || '',
    taskTitle: data.taskTitle || '',
    date: data.date || '',
    hours: data.hours || 0,
    minutes: data.minutes || 0,
    notes: data.notes || '',
    billable: data.billable ?? false,
    teamId: data.teamId || '',
    createdBy: data.createdBy || '',
  });
}

export async function updateTimeEntry(id: string, data: any) { return updateAt(`time-entries/${id}`, data); }
export async function deleteTimeEntry(id: string) { return deleteAt(`time-entries/${id}`); }

// Recalculate task.timeSpent from all time entries (idempotent)
export async function syncTaskTimeSpent(taskId: string) {
  if (!taskId) return;
  const entries = await getTimeEntriesByTask(taskId);
  const totalMinutes = entries.reduce((sum: number, e: any) => sum + ((e.hours || 0) * 60 + (e.minutes || 0)), 0);
  await updateAt(`tasks/${taskId}`, { timeSpent: totalMinutes });
}

// ===========================================================
// WHITEBOARDS
// ===========================================================
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

// ===========================================================
// FORMS
// ===========================================================
export async function getForms(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('forms', teamId, maxResults);
  return getByOrg('forms', maxResults);
}

export async function getForm(id: string) { return getOne(`forms/${id}`); }

export async function getFormByToken(token: string) {
  const q = query(collection(db, 'forms'), where('publicToken', '==', token), limit(1));
  const s = await getDocs(q);
  if (s.empty) return null;
  return { id: s.docs[0].id, ...s.docs[0].data() };
}

export async function createForm(data: any) {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  return addTo('forms', {
    orgId: ORG,
    title: data.title || '',
    description: data.description || '',
    status: 'draft',
    publicToken: token,
    responseLimit: null,
    responseCount: 0,
    openAt: null,
    closeAt: null,
    logoUrl: '',
    layout: '1col',
    successMessage: data.successMessage || '',
    redirectUrl: '',
    fields: data.fields || [],
    captchaEnabled: false,
    rateLimitPerMinute: 5,
    collectIp: true,
    collectUserAgent: true,
    privacyNotice: '',
    consentRequired: false,
    retentionDays: null,
    defaultMappingId: '',
    autoConvert: false,
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    teamId: data.teamId || '',
  });
}

export async function updateForm(formId: string, data: any) { return updateAt(`forms/${formId}`, data); }
export async function deleteForm(formId: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`forms/${formId}`, 'submissions'),
    deleteSubcollectionDocs(`forms/${formId}`, 'mappings'),
  ]);
  return deleteAt(`forms/${formId}`);
}

export async function regenerateFormToken(formId: string): Promise<string> {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  await updateAt(`forms/${formId}`, { publicToken: token });
  return token;
}

// Form Submissions (subcollection)
export async function getFormSubmissions(formId: string, maxResults = 500) {
  const q = query(collection(db, `forms/${formId}/submissions`), orderBy('createdAt', 'desc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}

export async function getFormSubmission(formId: string, submissionId: string) {
  return getOne(`forms/${formId}/submissions/${submissionId}`);
}

export async function createFormSubmission(formId: string, data: any) {
  return addTo(`forms/${formId}/submissions`, {
    values: data.values || {},
    ip: data.ip || null,
    userAgent: data.userAgent || null,
    utmSource: data.utmSource || '',
    utmMedium: data.utmMedium || '',
    utmCampaign: data.utmCampaign || '',
    referrer: data.referrer || '',
    attachments: data.attachments || [],
    status: 'new',
    reviewedBy: '',
    reviewedAt: null,
    notes: '',
    assignedTo: '',
    convertedToType: null,
    convertedToId: null,
    convertedAt: null,
    convertedBy: null,
    consentGiven: data.consentGiven ?? false,
  });
}

export async function updateFormSubmission(formId: string, submissionId: string, data: any) {
  return updateAt(`forms/${formId}/submissions/${submissionId}`, data);
}

export function onFormSubmissionsSnapshot(formId: string, callback: (subs: any[], hasMore: boolean) => void, maxResults = 100) {
  const q = query(collection(db, `forms/${formId}/submissions`), orderBy('createdAt', 'desc'), limit(maxResults + 1));
  return onSnapshot(q, (snap) => {
    const hasMore = snap.docs.length > maxResults;
    const docs = hasMore ? snap.docs.slice(0, maxResults) : snap.docs;
    callback(docs.map(d => ({ id: d.id, ...d.data() })), hasMore);
  }, () => callback([], false));
}

// Form Mappings (subcollection)
export async function getFormMappings(formId: string) {
  const q = query(collection(db, `forms/${formId}/mappings`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFormMapping(formId: string, data: any) {
  return addTo(`forms/${formId}/mappings`, {
    name: data.name || '',
    entityType: data.entityType || 'task',
    targetTeamId: data.targetTeamId || '',
    defaultStatus: data.defaultStatus || 'todo',
    defaultPriority: data.defaultPriority || 'medium',
    defaultAssignees: data.defaultAssignees || [],
    defaultTags: data.defaultTags || [],
    fieldMap: data.fieldMap || {},
    autoSubtasks: data.autoSubtasks || [],
    autoChecklist: data.autoChecklist || [],
    createdBy: data.createdBy || '',
  });
}

export async function updateFormMapping(formId: string, mappingId: string, data: any) {
  return updateAt(`forms/${formId}/mappings/${mappingId}`, data);
}

export async function deleteFormMapping(formId: string, mappingId: string) {
  return deleteAt(`forms/${formId}/mappings/${mappingId}`);
}

// ===========================================================
// CHAT THREADS
// ===========================================================
// Thread replies are stored as regular messages with a `threadId`
// field pointing to the parent message ID. The parent message
// tracks replyCount and lastReplyAt for UI display.

export async function sendThreadReply(
  channelId: string,
  parentMessageId: string,
  data: Partial<MessageData>,
) {
  // Create the reply message with threadId
  const msg = await addTo(`channels/${channelId}/messages`, {
    content: data.content || '',
    userId: data.userId || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    type: data.type || 'text',
    threadId: parentMessageId,
    replyTo: null,
    replyPreview: null,
    replyAuthor: null,
    reactions: {},
    pinned: false,
    edited: false,
    deleted: false,
    mentions: data.mentions || [],
    attachments: data.attachments || [],
    readBy: [data.userId],
  });

  // Update parent message with thread metadata
  const parentRef = doc(db, `channels/${channelId}/messages/${parentMessageId}`);
  await runTransaction(db, async (transaction) => {
    const parentSnap = await transaction.get(parentRef);
    if (!parentSnap.exists()) return;
    const parentData = parentSnap.data();
    transaction.update(parentRef, {
      replyCount: (parentData.replyCount || 0) + 1,
      lastReplyAt: serverTimestamp(),
      lastReplyBy: data.displayName || '',
    });
  });

  // Update channel last message
  const preview = (data.content || '').slice(0, 60);
  await updateAt(`channels/${channelId}`, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: `🧵 ${preview}`,
    lastMessageBy: data.displayName || '',
  });

  return msg;
}

export function getThreadReplies(channelId: string, parentMessageId: string, maxResults = 100) {
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    where('threadId', '==', parentMessageId),
    orderBy('createdAt', 'asc'),
    limit(maxResults),
  );
  return getDocs(q).then(snap =>
    snap.docs.map(d => ({ id: d.id, ...d.data() })),
  );
}

export function onThreadRepliesSnapshot(
  channelId: string,
  parentMessageId: string,
  callback: (replies: any[]) => void,
  maxResults = 100,
) {
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    where('threadId', '==', parentMessageId),
    orderBy('createdAt', 'asc'),
    limit(maxResults),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// ===========================================================
// CHAT UNREAD HELPERS
// ===========================================================

/**
 * Compute which channels have unread messages.
 * Pure function — works with data already fetched by the chat page.
 *
 * @param channels — array of { id, lastMessageAt } channel docs
 * @param readCursors — Record<channelId, Timestamp> from onReadCursorsSnapshot
 * @param currentUserId — exclude channels created solely by the current user
 * @returns Record<channelId, boolean> — true if channel has unread messages
 */
export function computeUnreadChannels(
  channels: { id: string; lastMessageAt?: any; lastMessageBy?: string }[],
  readCursors: Record<string, any>,
  currentUserId?: string,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const ch of channels) {
    const lastMsg = ch.lastMessageAt?.seconds || ch.lastMessageAt?.toMillis?.() || 0;
    const cursor = readCursors[ch.id]?.seconds || readCursors[ch.id]?.toMillis?.() || 0;
    if (!lastMsg) { result[ch.id] = false; continue; }
    // If the last message was by the current user, it's "read"
    if (currentUserId && ch.lastMessageBy === currentUserId) {
      result[ch.id] = false;
      continue;
    }
    result[ch.id] = lastMsg > cursor;
  }
  return result;
}

// ===========================================================
// CHAT BOOKMARKS
// ===========================================================

export async function bookmarkMessage(
  userId: string,
  channelId: string,
  messageId: string,
  preview: string,
  channelName: string,
) {
  return addDoc(collection(db, `orgs/${ORG}/members/${userId}/bookmarks`), {
    channelId,
    messageId,
    preview: preview.slice(0, 200),
    channelName,
    createdAt: serverTimestamp(),
  });
}

export async function getBookmarks(userId: string, maxResults = 100) {
  const q = query(
    collection(db, `orgs/${ORG}/members/${userId}/bookmarks`),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function removeBookmark(userId: string, bookmarkId: string) {
  return deleteAt(`orgs/${ORG}/members/${userId}/bookmarks/${bookmarkId}`);
}

export function onBookmarksSnapshot(
  userId: string,
  callback: (bookmarks: any[]) => void,
  maxResults = 100,
) {
  const q = query(
    collection(db, `orgs/${ORG}/members/${userId}/bookmarks`),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// ===========================================================
// CHAT MESSAGE SEARCH
// ===========================================================
// Firestore has no native full-text search. This function
// loads recent messages from a channel and filters client-side.
// For production, consider Algolia/Typesense for server-side search.

export async function searchMessagesInChannel(
  channelId: string,
  searchText: string,
  maxResults = 50,
): Promise<any[]> {
  if (!searchText.trim()) return [];
  const lower = searchText.toLowerCase();
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(500), // Scan last 500 messages
  );
  const snap = await getDocs(q);
  const matches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((m: any) =>
      m.content?.toLowerCase().includes(lower) ||
      m.displayName?.toLowerCase().includes(lower),
    )
    .slice(0, maxResults);
  return matches;
}

export { ORG, serverTimestamp };