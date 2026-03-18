import 'server-only';

import {
  adminDb, FieldValue, ORG, addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocsAdmin, cleanupEntityRelationsAdmin,
} from './helpers';

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
    titleLower: (data.name || '').toLowerCase(),
  });
}

export async function updateGoal(id: string, data: any) {
  const patch = data.name !== undefined ? { ...data, titleLower: data.name.toLowerCase() } : data;
  return updateAt(`goals/${id}`, patch);
}
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
