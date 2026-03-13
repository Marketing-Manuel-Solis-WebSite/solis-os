// ================================================================
// Server-side DB helpers using Firebase Admin SDK
// Mirrors functions from lib/db.ts used by API routes only.
// Client components continue using lib/db.ts (client SDK).
// ================================================================

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const ORG = 'solis-center';

// ===== GENERIC HELPERS =====

async function addTo(path: string, data: any) {
  const ref = await adminDb.collection(path).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref;
}

async function setAt(path: string, data: any) {
  await adminDb.doc(path).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

async function updateAt(path: string, data: any) {
  await adminDb.doc(path).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

async function deleteAt(path: string) {
  await adminDb.doc(path).delete();
}

async function getOne(path: string) {
  const snap = await adminDb.doc(path).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getByOrg(col: string, maxResults = 500) {
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

async function getByTeam(col: string, teamId: string, maxResults = 500) {
  if (teamId === '__all__') return getByOrg(col, maxResults);
  // Compound query: filter at Firestore level instead of loading entire org
  const snap = await adminDb
    .collection(col)
    .where('orgId', '==', ORG)
    .where('teamId', '==', teamId)
    .orderBy('createdAt', 'desc')
    .limit(maxResults)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ===== CASCADE DELETE HELPERS (admin SDK) =====

async function deleteSubcollectionDocsAdmin(parentPath: string, subcollectionName: string): Promise<number> {
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

async function cleanupEntityRelationsAdmin(entityId: string): Promise<number> {
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

// Propagates errors — callers decide whether to gate on failure.
async function removeTaskFromGoalTargetsAdmin(taskId: string): Promise<void> {
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

// Clean up time-entries referencing a deleted task (admin SDK)
async function cleanupOrphanedTimeEntriesAdmin(taskId: string): Promise<number> {
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

// Clear linkedTaskId from whiteboard elements referencing a deleted task (admin SDK)
async function cleanupWhiteboardLinkedTaskRefsAdmin(taskId: string): Promise<number> {
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

// ===== CUSTOM FIELD DEFINITIONS (admin SDK) =====
export async function getCustomFieldDefs(): Promise<any[]> {
  const snap = await adminDb.doc(`orgs/${ORG}/settings/customFields`).get();
  if (!snap.exists) return [];
  return (snap.data() as any)?.fields || [];
}

// ===== MEMBERS =====
export async function getMembers() {
  const snap = await adminDb.collection(`orgs/${ORG}/members`).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }

// ===== TEAMS / DEPARTMENTS =====
export async function getTeams() {
  const snap = await adminDb.collection(`orgs/${ORG}/teams`).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTeam(id: string) { return getOne(`orgs/${ORG}/teams/${id}`); }

export async function createTeam(data: any) {
  const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  await setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name,
    color: data.color || '#6B7280',
    icon: data.icon || '📁',
    description: data.description || '',
    status: 'active',
  });
  return id;
}

export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }

export async function deleteTeamAdmin(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }

const TEAM_RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'] as const;

export async function reassignTeamResourcesAdmin(fromTeamId: string, toTeamId: string, toTeamName: string) {
  let moved = 0;
  const BATCH_LIMIT = 500;

  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const snap = await adminDb.collection(col)
      .where('orgId', '==', ORG)
      .where('teamId', '==', fromTeamId)
      .get();
    if (snap.empty) continue;

    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
      for (const d of chunk) {
        batch.update(adminDb.doc(`${col}/${d.id}`), { teamId: toTeamId, updatedAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
      moved += chunk.length;
    }
  }

  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  // Primary members: teamId matches
  const primaryMembers = membersSnap.docs.filter(d => d.data().teamId === fromTeamId);
  for (let i = 0; i < primaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = primaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      const newIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newIds.includes(toTeamId)) newIds.push(toTeamId);
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamId: toTeamId, teamIds: newIds, department: toTeamName, updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    moved += chunk.length;
  }
  // Secondary members: teamIds array contains fromTeamId but teamId is different
  const secondaryMembers = membersSnap.docs.filter(d => {
    const data = d.data();
    return data.teamId !== fromTeamId && (data.teamIds || []).includes(fromTeamId);
  });
  for (let i = 0; i < secondaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = secondaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      const newIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newIds.includes(toTeamId)) newIds.push(toTeamId);
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamIds: newIds, updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    moved += chunk.length;
  }
  return moved;
}

export async function purgeTeamResourcesAdmin(teamId: string) {
  let deleted = 0;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const snap = await adminDb.collection(col)
      .where('orgId', '==', ORG)
      .where('teamId', '==', teamId)
      .get();
    if (snap.empty) continue;

    // Tasks and goals require cascade delete (subcollections), so they
    // must be deleted individually. All other collections use batch writes.
    if (col === 'tasks') {
      for (const d of snap.docs) { await deleteTask(d.id); deleted++; }
    } else if (col === 'goals') {
      for (const d of snap.docs) { await deleteGoal(d.id); deleted++; }
    } else {
      // Firestore batches support up to 500 operations
      const BATCH_LIMIT = 500;
      for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
        const batch = adminDb.batch();
        const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
        for (const d of chunk) {
          batch.delete(adminDb.doc(`${col}/${d.id}`));
        }
        await batch.commit();
        deleted += chunk.length;
      }
    }
  }

  // Batch-update members to detach from deleted team
  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  const BATCH_LIMIT = 500;
  // Primary members: teamId matches — clear teamId, department, filter teamIds
  const primaryMembers = membersSnap.docs.filter(d => d.data().teamId === teamId);
  for (let i = 0; i < primaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = primaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamId: '', teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), department: '', updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  // Secondary members: teamIds contains teamId but teamId is different — just filter teamIds
  const secondaryMembers = membersSnap.docs.filter(d => {
    const data = d.data();
    return data.teamId !== teamId && (data.teamIds || []).includes(teamId);
  });
  for (let i = 0; i < secondaryMembers.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = secondaryMembers.slice(i, i + BATCH_LIMIT);
    for (const d of chunk) {
      const data = d.data();
      batch.update(adminDb.doc(`orgs/${ORG}/members/${d.id}`), {
        teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return deleted;
}

// ===== TASKS =====
export async function getTasks(teamId?: string) {
  if (teamId) return getByTeam('tasks', teamId);
  return getByOrg('tasks');
}

// ===== LISTS =====
export async function getList(id: string) { return getOne(`lists/${id}`); }

// ===== TASKS =====
export async function getTask(id: string) { return getOne(`tasks/${id}`); }

export async function createTask(data: any) {
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
  });
}

export async function updateTask(id: string, data: any) { return updateAt(`tasks/${id}`, data); }
export async function deleteTask(id: string) {
  // Critical: detach from goal targets (affects goal progress integrity)
  // Must succeed before parent delete — throws on failure
  await removeTaskFromGoalTargetsAdmin(id);

  // Best-effort: orphan cleanup (logged, non-blocking)
  const bestEffort = [
    { name: 'comments', fn: () => deleteSubcollectionDocsAdmin(`tasks/${id}`, 'comments') },
    { name: 'activity', fn: () => deleteSubcollectionDocsAdmin(`tasks/${id}`, 'activity') },
    { name: 'relations', fn: () => cleanupEntityRelationsAdmin(id) },
    { name: 'timeEntries', fn: () => cleanupOrphanedTimeEntriesAdmin(id) },
    { name: 'whiteboardRefs', fn: () => cleanupWhiteboardLinkedTaskRefsAdmin(id) },
  ];
  const results = await Promise.allSettled(bestEffort.map(op => op.fn()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[deleteTask-admin] cascade ${bestEffort[i].name} failed for ${id}:`, r.reason);
  });
  return deleteAt(`tasks/${id}`);
}

// ===== GOALS =====
export async function getGoals(teamId?: string) {
  if (teamId) return getByTeam('goals', teamId);
  return getByOrg('goals');
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
  });
}

export async function updateGoal(id: string, data: any) { return updateAt(`goals/${id}`, data); }
export async function deleteGoal(id: string) {
  const cascadeOps = [
    { name: 'targets', fn: () => deleteSubcollectionDocsAdmin(`goals/${id}`, 'targets') },
    { name: 'relations', fn: () => cleanupEntityRelationsAdmin(id) },
  ];
  const results = await Promise.allSettled(cascadeOps.map(op => op.fn()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[deleteGoal-admin] cascade ${cascadeOps[i].name} failed for ${id}:`, r.reason);
  });
  return deleteAt(`goals/${id}`);
}

// Sync goal targets when a task status changes (server-side)
export async function syncGoalTargetsForTaskAdmin(taskId: string) {
  try {
    const snap = await adminDb.collectionGroup('targets')
      .where('linkedTaskIds', 'array-contains', taskId)
      .get();
    if (snap.empty) return;

    const goalIdsToRecalc = new Set<string>();

    for (const targetDoc of snap.docs) {
      const t = targetDoc.data();
      if (t.type !== 'tasks' || !t.autoSync) continue;

      // Transaction: read fresh target + all linked tasks → compute → write atomically.
      // Prevents stale-write race when concurrent task completions update the same target.
      const linkedIds: string[] = t.linkedTaskIds || [];
      const taskRefs = linkedIds.map(tid => adminDb.doc(`tasks/${tid}`));

      const updated = await adminDb.runTransaction(async (txn) => {
        const freshTarget = await txn.get(targetDoc.ref);
        const freshData = freshTarget.data();
        if (!freshData) return false;

        const taskSnaps = taskRefs.length > 0 ? await txn.getAll(...taskRefs) : [];
        let completed = 0;
        for (const taskSnap of taskSnaps) {
          if (taskSnap.exists && taskSnap.data()?.status === 'done' && !taskSnap.data()?.deleted) completed++;
        }

        if (completed !== freshData.currentValue) {
          txn.update(targetDoc.ref, { currentValue: completed, updatedAt: FieldValue.serverTimestamp() });
          return true;
        }
        return false;
      });

      if (updated) {
        const goalId = targetDoc.ref.parent.parent?.id;
        if (goalId) goalIdsToRecalc.add(goalId);
      }
    }

    // Goal progress recalculation — transactional to prevent stale reads
    for (const goalId of goalIdsToRecalc) {
      await adminDb.runTransaction(async (txn) => {
        const targetsSnap = await txn.get(adminDb.collection(`goals/${goalId}/targets`));
        if (targetsSnap.empty) {
          txn.update(adminDb.doc(`goals/${goalId}`), { progress: 0, updatedAt: FieldValue.serverTimestamp() });
          return;
        }
        let totalProgress = 0;
        for (const t of targetsSnap.docs) {
          const data = t.data();
          const tv = Math.max(data.targetValue || 1, 1);
          const cv = Math.min(Math.max(data.currentValue || 0, 0), tv);
          totalProgress += (cv / tv) * 100;
        }
        const progress = Math.round(totalProgress / targetsSnap.size);
        txn.update(adminDb.doc(`goals/${goalId}`), { progress, updatedAt: FieldValue.serverTimestamp() });
      });
    }
  } catch (err) {
    console.error('[syncGoalTargetsForTaskAdmin] Error:', err);
  }
}

// ===== TIME ENTRIES =====
export async function getTimeEntries(teamId?: string) {
  if (teamId) return getByTeam('time-entries', teamId);
  return getByOrg('time-entries');
}

export async function getTimeEntriesByDateRange(startDate: string, endDate: string, userId?: string) {
  let q = adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate);
  if (userId) {
    q = q.where('userId', '==', userId);
  }
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTimeEntry(id: string) { return getOne(`time-entries/${id}`); }

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

// Recalculate task.timeSpent from all time entries (idempotent, admin SDK)
export async function syncTaskTimeSpentAdmin(taskId: string) {
  if (!taskId) return;
  const snap = await adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .where('taskId', '==', taskId)
    .get();
  const totalMinutes = snap.docs.reduce((sum, d) => {
    const e = d.data();
    return sum + ((e.hours || 0) * 60 + (e.minutes || 0));
  }, 0);
  await updateAt(`tasks/${taskId}`, { timeSpent: totalMinutes });
}

// ===== FORMS =====
export async function getForm(id: string) { return getOne(`forms/${id}`); }

export async function getFormByToken(token: string) {
  const snap = await adminDb.collection('forms')
    .where('publicToken', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function updateForm(formId: string, data: any) { return updateAt(`forms/${formId}`, data); }

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

export async function getFormSubmissions(formId: string, maxResults = 500) {
  const snap = await adminDb.collection(`forms/${formId}/submissions`)
    .orderBy('createdAt', 'desc')
    .limit(maxResults + 1)
    .get();
  const hasMore = snap.docs.length > maxResults;
  const docs = hasMore ? snap.docs.slice(0, maxResults) : snap.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}

/** Accurate document count for an org-scoped collection (uses Firestore count aggregation). */
export async function countByOrg(col: string): Promise<number> {
  const snap = await adminDb.collection(col)
    .where('orgId', '==', ORG)
    .count()
    .get();
  return snap.data().count;
}

/** Accurate document count for a subcollection. */
export async function countSubcollection(parentPath: string, subcollectionName: string): Promise<number> {
  const snap = await adminDb.collection(`${parentPath}/${subcollectionName}`)
    .count()
    .get();
  return snap.data().count;
}

// ===== CURSOR-BASED PAGINATED QUERIES =====
// Used by v1 API routes for efficient Firestore-native pagination.
// Pushes filters to Firestore where possible, uses orderBy + startAfter for cursor.

interface PaginatedResult {
  items: any[];
  nextCursor: string | null;
  hasMore: boolean;
}

function extractCursor(doc: FirebaseFirestore.QueryDocumentSnapshot): string {
  const ts = doc.data().createdAt;
  const seconds = ts?.seconds || ts?._seconds || 0;
  return `${seconds}_${doc.id}`;
}

function parseCursor(cursor: string): { seconds: number; docId: string } | null {
  const parts = cursor.split('_');
  if (parts.length < 2) return null;
  const seconds = parseInt(parts[0], 10);
  const docId = parts.slice(1).join('_');
  if (isNaN(seconds)) return null;
  return { seconds, docId };
}

export async function queryTasksPaginated(opts: {
  limit: number;
  cursor?: string | null;
  status?: string | null;
  teamId?: string | null;
  assignee?: string | null;
}): Promise<PaginatedResult> {
  let q: FirebaseFirestore.Query = adminDb.collection('tasks')
    .where('orgId', '==', ORG);

  if (opts.status) q = q.where('status', '==', opts.status);
  if (opts.teamId) q = q.where('teamId', '==', opts.teamId);
  if (opts.assignee) q = q.where('assignees', 'array-contains', opts.assignee);

  q = q.orderBy('createdAt', 'desc');

  if (opts.cursor) {
    const parsed = parseCursor(opts.cursor);
    if (parsed) {
      const ts = Timestamp.fromMillis(parsed.seconds * 1000);
      q = q.startAfter(ts, parsed.docId);
    }
  }

  // Fetch extra to filter deleted + detect hasMore
  const fetchLimit = opts.limit + 20;
  const snap = await q.limit(fetchLimit).get();

  const filtered = snap.docs.filter(d => !d.data().deleted);
  const hasMore = filtered.length > opts.limit;
  const resultDocs = filtered.slice(0, opts.limit);
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

// ===== NOTIFICATIONS (server-side) =====

export async function createNotificationAdmin(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityUrl?: string;
  actorId?: string;
  actorName?: string;
}) {
  return adminDb.collection(`orgs/${ORG}/notifications`).add({
    ...data,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function notifyManyAdmin(
  userIds: string[],
  data: Omit<Parameters<typeof createNotificationAdmin>[0], 'userId'>,
) {
  return Promise.all(userIds.map(userId => createNotificationAdmin({ ...data, userId })));
}

// ===== AUDIT LOG (server-side) =====

export async function logActionAdmin(data: {
  action: string;
  resource: string;
  detail: string;
  actorId: string;
  actorName: string;
}) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== TASK ACTIVITY (server-side) =====

export async function addTaskActivityAdmin(taskId: string, data: {
  action: string;
  field?: string;
  from?: string;
  to?: string;
  actorId: string;
  actorName: string;
}) {
  return addTo(`tasks/${taskId}/activity`, data);
}

export { ORG };
