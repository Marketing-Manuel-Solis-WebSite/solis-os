// ================================================================
// Goals domain module — extracted from lib/db.ts
// ================================================================

import {
  addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocs, cleanupEntityRelations,
  db, ORG, serverTimestamp,
  collection, doc, getDocs, query, where, orderBy,
  collectionGroup, runTransaction,
} from './helpers';

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
    collection(db, 'goals'),
    where('orgId', '==', ORG),
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
