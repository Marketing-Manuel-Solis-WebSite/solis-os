// ================================================================
// SOLIS CENTER — Data Repair & Integrity Utilities
// Admin-only tools for detecting and fixing orphaned/inconsistent data.
// ================================================================

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';



export interface RepairResult {
  action: string;
  found: number;
  fixed: number;
  details: string[];
}

// ────────────────────────────────────────────────────────────────
// 1. ORPHANED RELATIONS — relations pointing to deleted entities
// ────────────────────────────────────────────────────────────────

export async function findOrphanedRelations(): Promise<RepairResult> {
  const snap = await adminDb.collection('relations').where('orgId', '==', ORG).get();
  const orphaned: string[] = [];

  // Collect all unique entity IDs to batch-check
  const entityChecks = new Map<string, Set<string>>(); // collection -> ids
  for (const d of snap.docs) {
    const data = d.data();
    for (const [type, id] of [[data.sourceType, data.sourceId], [data.targetType, data.targetId]]) {
      const col = type === 'task' ? 'tasks' : type === 'doc' ? 'docs' : type === 'goal' ? 'goals' : null;
      if (col && id) {
        if (!entityChecks.has(col)) entityChecks.set(col, new Set());
        entityChecks.get(col)!.add(id);
      }
    }
  }

  // Batch check existence (10 concurrent)
  const existsSet = new Set<string>(); // "collection/id"
  for (const [col, ids] of entityChecks) {
    const idArr = Array.from(ids);
    for (let i = 0; i < idArr.length; i += 10) {
      const chunk = idArr.slice(i, i + 10);
      const snaps = await Promise.all(chunk.map(id => adminDb.doc(`${col}/${id}`).get()));
      for (const s of snaps) {
        if (s.exists && !s.data()?.deleted) existsSet.add(`${col}/${s.id}`);
      }
    }
  }

  // Check each relation against pre-computed set
  for (const d of snap.docs) {
    const data = d.data();
    const sourceCol = data.sourceType === 'task' ? 'tasks' : data.sourceType === 'doc' ? 'docs' : data.sourceType === 'goal' ? 'goals' : null;
    const targetCol = data.targetType === 'task' ? 'tasks' : data.targetType === 'doc' ? 'docs' : data.targetType === 'goal' ? 'goals' : null;
    const sourceExists = sourceCol ? existsSet.has(`${sourceCol}/${data.sourceId}`) : false;
    const targetExists = targetCol ? existsSet.has(`${targetCol}/${data.targetId}`) : false;
    if (!sourceExists || !targetExists) {
      orphaned.push(d.id);
    }
  }

  return {
    action: 'find_orphaned_relations',
    found: orphaned.length,
    fixed: 0,
    details: orphaned.map(id => `relation/${id}`),
  };
}

export async function cleanOrphanedRelations(): Promise<RepairResult> {
  const { details } = await findOrphanedRelations();
  let fixed = 0;
  const CHUNK = 450;

  for (let i = 0; i < details.length; i += CHUNK) {
    const batch = adminDb.batch();
    details.slice(i, i + CHUNK).forEach(path => {
      const id = path.replace('relation/', '');
      batch.delete(adminDb.doc(`relations/${id}`));
    });
    await batch.commit();
    fixed += Math.min(CHUNK, details.length - i);
  }

  return {
    action: 'clean_orphaned_relations',
    found: details.length,
    fixed,
    details: details.slice(0, 50),
  };
}

// ────────────────────────────────────────────────────────────────
// 2. BROKEN GOAL TARGET LINKS — targets referencing deleted tasks
// ────────────────────────────────────────────────────────────────

export async function findBrokenGoalTargetLinks(): Promise<RepairResult> {
  const goalsSnap = await adminDb.collection('goals').where('orgId', '==', ORG).get();
  const broken: string[] = [];

  // Phase 1: Collect all unique task IDs across all targets
  const allTaskIds = new Set<string>();
  const targetLinks: { goalId: string; targetId: string; linkedIds: string[] }[] = [];

  for (const goalDoc of goalsSnap.docs) {
    const targetsSnap = await adminDb.collection(`goals/${goalDoc.id}/targets`).get();
    for (const targetDoc of targetsSnap.docs) {
      const linkedIds: string[] = targetDoc.data().linkedTaskIds || [];
      if (linkedIds.length > 0) {
        targetLinks.push({ goalId: goalDoc.id, targetId: targetDoc.id, linkedIds });
        linkedIds.forEach(id => allTaskIds.add(id));
      }
    }
  }

  // Phase 2: Batch check existence (10 concurrent reads)
  const BATCH_SIZE = 10;
  const validTaskIds = new Set<string>();
  const ids = Array.from(allTaskIds);

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const snaps = await Promise.all(chunk.map(id => adminDb.doc(`tasks/${id}`).get()));
    for (const snap of snaps) {
      if (snap.exists && !snap.data()?.deleted) {
        validTaskIds.add(snap.id);
      }
    }
  }

  // Phase 3: Find broken links using pre-computed valid set
  for (const { goalId, targetId, linkedIds } of targetLinks) {
    for (const taskId of linkedIds) {
      if (!validTaskIds.has(taskId)) {
        broken.push(`goals/${goalId}/targets/${targetId} → task/${taskId}`);
      }
    }
  }

  return { action: 'find_broken_goal_target_links', found: broken.length, fixed: 0, details: broken.slice(0, 100) };
}

export async function repairBrokenGoalTargetLinks(): Promise<RepairResult> {
  const goalsSnap = await adminDb.collection('goals').where('orgId', '==', ORG).get();
  let found = 0;
  let fixed = 0;
  const goalIdsToRecalc = new Set<string>();

  // Phase 1: Collect all task IDs and batch-check existence
  const allTaskIds = new Set<string>();
  const targetData: { goalId: string; targetRef: FirebaseFirestore.DocumentReference; linkedIds: string[] }[] = [];

  for (const goalDoc of goalsSnap.docs) {
    const targetsSnap = await adminDb.collection(`goals/${goalDoc.id}/targets`).get();
    for (const targetDoc of targetsSnap.docs) {
      const linkedIds: string[] = targetDoc.data().linkedTaskIds || [];
      if (linkedIds.length > 0) {
        targetData.push({ goalId: goalDoc.id, targetRef: targetDoc.ref, linkedIds });
        linkedIds.forEach(id => allTaskIds.add(id));
      }
    }
  }

  // Phase 2: Batch check existence (10 concurrent reads)
  const BATCH_SIZE = 10;
  const validTaskIds = new Set<string>();
  const ids = Array.from(allTaskIds);

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const snaps = await Promise.all(chunk.map(id => adminDb.doc(`tasks/${id}`).get()));
    for (const snap of snaps) {
      if (snap.exists && !snap.data()?.deleted) {
        validTaskIds.add(snap.id);
      }
    }
  }

  // Phase 3: Repair using pre-computed valid set
  for (const { goalId, targetRef, linkedIds } of targetData) {
    const validIds = linkedIds.filter(id => validTaskIds.has(id));
    if (validIds.length < linkedIds.length) {
      found += linkedIds.length - validIds.length;
      await targetRef.update({ linkedTaskIds: validIds, updatedAt: FieldValue.serverTimestamp() });
      fixed++;
      goalIdsToRecalc.add(goalId);
    }
  }

  // Recalculate progress for affected goals
  for (const goalId of goalIdsToRecalc) {
    const targets = await adminDb.collection(`goals/${goalId}/targets`).get();
    if (targets.empty) {
      await adminDb.doc(`goals/${goalId}`).update({ progress: 0, updatedAt: FieldValue.serverTimestamp() });
      continue;
    }
    let totalProgress = 0;
    for (const t of targets.docs) {
      const data = t.data();
      const tv = data.targetValue || 1;
      const cv = Math.min(data.currentValue || 0, tv);
      totalProgress += (cv / tv) * 100;
    }
    const progress = Math.round(totalProgress / targets.size);
    await adminDb.doc(`goals/${goalId}`).update({ progress, updatedAt: FieldValue.serverTimestamp() });
  }

  return {
    action: 'repair_broken_goal_target_links',
    found,
    fixed,
    details: [`${goalIdsToRecalc.size} goals recalculated`],
  };
}

// ────────────────────────────────────────────────────────────────
// 3. ORPHANED SUBCOLLECTIONS — subcollections under deleted parents
// ────────────────────────────────────────────────────────────────

export async function findOrphanedTaskSubcollections(): Promise<RepairResult> {
  // Find comments/activity under tasks that no longer exist
  const orphaned: string[] = [];

  // Use collectionGroup to find all comments, then check if parent task exists
  const commentsSnap = await adminDb.collectionGroup('comments').get();
  for (const d of commentsSnap.docs) {
    const taskId = d.ref.parent.parent?.id;
    if (!taskId) continue;
    const taskSnap = await adminDb.doc(`tasks/${taskId}`).get();
    if (!taskSnap.exists) {
      orphaned.push(`tasks/${taskId}/comments/${d.id}`);
    }
  }

  const activitySnap = await adminDb.collectionGroup('activity').get();
  for (const d of activitySnap.docs) {
    const taskId = d.ref.parent.parent?.id;
    if (!taskId) continue;
    const taskSnap = await adminDb.doc(`tasks/${taskId}`).get();
    if (!taskSnap.exists) {
      orphaned.push(`tasks/${taskId}/activity/${d.id}`);
    }
  }

  return { action: 'find_orphaned_task_subcollections', found: orphaned.length, fixed: 0, details: orphaned.slice(0, 100) };
}

export async function cleanOrphanedTaskSubcollections(): Promise<RepairResult> {
  const { details } = await findOrphanedTaskSubcollections();
  let fixed = 0;
  const CHUNK = 450;

  for (let i = 0; i < details.length; i += CHUNK) {
    const batch = adminDb.batch();
    details.slice(i, i + CHUNK).forEach(path => batch.delete(adminDb.doc(path)));
    await batch.commit();
    fixed += Math.min(CHUNK, details.length - i);
  }

  return { action: 'clean_orphaned_task_subcollections', found: details.length, fixed, details: [`Deleted ${fixed} orphaned docs`] };
}

// ────────────────────────────────────────────────────────────────
// 4. STALE PRESENCE — presence docs for inactive/deleted members
// ────────────────────────────────────────────────────────────────

export async function cleanStalePresence(): Promise<RepairResult> {
  const presenceSnap = await adminDb.collection(`orgs/${ORG}/presence`).get();
  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  const activeMemberIds = new Set(membersSnap.docs.filter(d => d.data().active !== false).map(d => d.id));

  let fixed = 0;
  for (const d of presenceSnap.docs) {
    if (!activeMemberIds.has(d.id)) {
      await d.ref.delete();
      fixed++;
    }
  }

  return { action: 'clean_stale_presence', found: presenceSnap.size, fixed, details: [`Removed ${fixed} stale presence entries`] };
}

// ────────────────────────────────────────────────────────────────
// 5. ORPHANED TIME ENTRIES — time entries referencing deleted tasks
// ────────────────────────────────────────────────────────────────

export async function findOrphanedTimeEntries(): Promise<RepairResult> {
  const snap = await adminDb.collection('time-entries').where('orgId', '==', ORG).get();
  const orphaned: string[] = [];

  for (const d of snap.docs) {
    const taskId = d.data().taskId;
    if (!taskId || taskId === '') continue; // Already cleaned or no task
    const taskSnap = await adminDb.doc(`tasks/${taskId}`).get();
    if (!taskSnap.exists || taskSnap.data()?.deleted) {
      orphaned.push(d.id);
    }
  }

  return { action: 'find_orphaned_time_entries', found: orphaned.length, fixed: 0, details: orphaned.slice(0, 100).map(id => `time-entries/${id}`) };
}

export async function cleanOrphanedTimeEntries(): Promise<RepairResult> {
  const { details } = await findOrphanedTimeEntries();
  let fixed = 0;

  for (const path of details) {
    const id = path.replace('time-entries/', '');
    await adminDb.doc(`time-entries/${id}`).update({
      taskId: '',
      taskTitle: '(deleted task)',
      updatedAt: FieldValue.serverTimestamp(),
    });
    fixed++;
  }

  return { action: 'clean_orphaned_time_entries', found: details.length, fixed, details: [`Cleaned ${fixed} time entries`] };
}

// ────────────────────────────────────────────────────────────────
// 6. STALE WHITEBOARD LINKED TASK REFS
// ────────────────────────────────────────────────────────────────

export async function findStaleWhiteboardTaskRefs(): Promise<RepairResult> {
  const snap = await adminDb.collectionGroup('elements').get();
  const stale: string[] = [];

  for (const d of snap.docs) {
    const linkedTaskId = d.data().linkedTaskId;
    if (!linkedTaskId || linkedTaskId === '') continue;
    const taskSnap = await adminDb.doc(`tasks/${linkedTaskId}`).get();
    if (!taskSnap.exists || taskSnap.data()?.deleted) {
      stale.push(d.ref.path);
    }
  }

  return { action: 'find_stale_whiteboard_task_refs', found: stale.length, fixed: 0, details: stale.slice(0, 100) };
}

export async function cleanStaleWhiteboardTaskRefs(): Promise<RepairResult> {
  const { details, found } = await findStaleWhiteboardTaskRefs();
  let fixed = 0;

  for (const path of details) {
    await adminDb.doc(path).update({ linkedTaskId: '', updatedAt: FieldValue.serverTimestamp() });
    fixed++;
  }

  return { action: 'clean_stale_whiteboard_task_refs', found, fixed, details: [`Cleaned ${fixed} whiteboard elements`] };
}

// ────────────────────────────────────────────────────────────────
// 7. FULL INTEGRITY REPORT — run all checks (non-destructive)
// ────────────────────────────────────────────────────────────────

export async function runIntegrityReport(): Promise<RepairResult[]> {
  const results = await Promise.all([
    findOrphanedRelations(),
    findBrokenGoalTargetLinks(),
    findOrphanedTaskSubcollections(),
    findOrphanedTimeEntries(),
    findStaleWhiteboardTaskRefs(),
  ]);
  return results;
}

// ────────────────────────────────────────────────────────────────
// 8. FULL REPAIR — run all fixes
// ────────────────────────────────────────────────────────────────

export async function runFullRepair(): Promise<RepairResult[]> {
  const results = await Promise.all([
    cleanOrphanedRelations(),
    repairBrokenGoalTargetLinks(),
    cleanOrphanedTaskSubcollections(),
    cleanStalePresence(),
    cleanOrphanedTimeEntries(),
    cleanStaleWhiteboardTaskRefs(),
  ]);
  return results;
}

// ── Helpers ──

async function entityExists(type: string, id: string): Promise<boolean> {
  const collectionName = type === 'task' ? 'tasks' : type === 'doc' ? 'docs' : type === 'goal' ? 'goals' : null;
  if (!collectionName) return false;
  const snap = await adminDb.doc(`${collectionName}/${id}`).get();
  return snap.exists && !snap.data()?.deleted;
}
