// ================================================================
// Tasks domain module — extracted from lib/db.ts
// ================================================================

import {
  addTo, setAt, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocs, cleanupEntityRelations,
  db, ORG, serverTimestamp,
  collection, doc, getDocs, query, where, orderBy, limit,
  collectionGroup, updateDoc, arrayUnion, arrayRemove, startAfter,
} from './helpers';
import type { QueryDocumentSnapshot } from './helpers';
import { validateCustomFieldValues, loadFieldDefs } from '../custom-fields';
import { recalculateGoalProgress } from './goals';

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

/** Multi-list query: returns tasks where listIds array-contains the given listId */
export async function getTasksByListMulti(listId: string, maxResults = 500): Promise<{ items: any[]; hasMore: boolean }> {
  const q = query(
    collection(db, 'tasks'),
    where('orgId', '==', ORG),
    where('listIds', 'array-contains', listId),
    orderBy('createdAt', 'desc'),
    limit(maxResults + 1),
  );
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  const items = docs.map(d => ({ id: d.id, ...d.data() }));
  return { items, hasMore };
}

/** Add a task to an additional list (keeps listId/home list unchanged) */
export async function addTaskToList(taskId: string, listId: string) {
  return updateAt(`tasks/${taskId}`, {
    listIds: arrayUnion(listId),
  });
}

/** Remove a task from a list. If removing the home list, reassign to next available. */
export async function removeTaskFromList(taskId: string, listId: string) {
  const task = await getOne(`tasks/${taskId}`);
  if (!task) return;
  const updates: any = { listIds: arrayRemove(listId) };
  if ((task as any).listId === listId) {
    const remaining = ((task as any).listIds || []).filter((id: string) => id !== listId);
    updates.listId = remaining.length > 0 ? remaining[0] : null;
  }
  return updateAt(`tasks/${taskId}`, updates);
}

/** Change the home list (primary list that determines statuses/custom fields) */
export async function setHomeList(taskId: string, listId: string) {
  return updateAt(`tasks/${taskId}`, { listId });
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
    listIds: data.listId ? [data.listId] : [],
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
  const patch = data.title !== undefined ? { ...data, titleLower: data.title.toLowerCase() } : { ...data };
  // When changing home list, ensure it's in listIds too
  if (data.listId !== undefined && data.listId !== null) {
    patch.listIds = arrayUnion(data.listId);
  }
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

/**
 * Auto-unblock tasks that depend on the completed task.
 * When a task is marked done, find all tasks that have it as a `blocked_by`
 * dependency. If ALL their blockers are now done, change status from `blocked` → `todo`.
 */
export async function autoUnblockDependents(completedTaskId: string): Promise<string[]> {
  // Find tasks that reference this task in their dependencies as blocked_by
  const allTasksSnap = await getDocs(
    query(collection(db, 'tasks'), where('orgId', '==', ORG), where('status', '==', 'blocked'), limit(200))
  );
  const unblockedIds: string[] = [];
  for (const taskDoc of allTasksSnap.docs) {
    const task = taskDoc.data();
    const deps: any[] = task.dependencies || [];
    // Check if this task has a blocked_by dependency on the completed task
    const hasBlocker = deps.some((d: any) =>
      (typeof d === 'string' && d === completedTaskId) ||
      (d.taskId === completedTaskId && (d.type === 'blocked_by' || !d.type))
    );
    if (!hasBlocker) continue;
    // Check if ALL blocked_by dependencies are now done
    const blockerIds = deps
      .filter((d: any) => typeof d === 'string' || d.type === 'blocked_by' || !d.type)
      .map((d: any) => typeof d === 'string' ? d : d.taskId);
    let allDone = true;
    for (const bid of blockerIds) {
      if (bid === completedTaskId) continue; // already done
      const blockerDoc = await getOne(`tasks/${bid}`);
      if (!blockerDoc || (blockerDoc as any).status !== 'done') {
        allDone = false;
        break;
      }
    }
    if (allDone) {
      await updateAt(`tasks/${taskDoc.id}`, { status: 'todo' });
      unblockedIds.push(taskDoc.id);
    }
  }
  return unblockedIds;
}
