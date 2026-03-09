// ================================================================
// SOLIS CENTER — Data Repair & Integrity Utilities
// Admin-only tools for detecting and fixing orphaned/inconsistent data.
// ================================================================

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const ORG = 'solis-center';

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

  for (const d of snap.docs) {
    const data = d.data();
    const sourceExists = await entityExists(data.sourceType, data.sourceId);
    const targetExists = await entityExists(data.targetType, data.targetId);
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

  for (const goalDoc of goalsSnap.docs) {
    const targetsSnap = await adminDb.collection(`goals/${goalDoc.id}/targets`).get();
    for (const targetDoc of targetsSnap.docs) {
      const linkedIds: string[] = targetDoc.data().linkedTaskIds || [];
      for (const taskId of linkedIds) {
        const taskSnap = await adminDb.doc(`tasks/${taskId}`).get();
        if (!taskSnap.exists || taskSnap.data()?.deleted) {
          broken.push(`goals/${goalDoc.id}/targets/${targetDoc.id} → task/${taskId}`);
        }
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

  for (const goalDoc of goalsSnap.docs) {
    const targetsSnap = await adminDb.collection(`goals/${goalDoc.id}/targets`).get();
    for (const targetDoc of targetsSnap.docs) {
      const linkedIds: string[] = targetDoc.data().linkedTaskIds || [];
      const validIds: string[] = [];
      let hasbroken = false;

      for (const taskId of linkedIds) {
        const taskSnap = await adminDb.doc(`tasks/${taskId}`).get();
        if (taskSnap.exists && !taskSnap.data()?.deleted) {
          validIds.push(taskId);
        } else {
          hasbroken = true;
          found++;
        }
      }

      if (hasbroken) {
        await targetDoc.ref.update({ linkedTaskIds: validIds, updatedAt: FieldValue.serverTimestamp() });
        fixed++;
        goalIdsToRecalc.add(goalDoc.id);
      }
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
// 5. FULL INTEGRITY REPORT — run all checks (non-destructive)
// ────────────────────────────────────────────────────────────────

export async function runIntegrityReport(): Promise<RepairResult[]> {
  const results = await Promise.all([
    findOrphanedRelations(),
    findBrokenGoalTargetLinks(),
    findOrphanedTaskSubcollections(),
  ]);
  return results;
}

// ────────────────────────────────────────────────────────────────
// 6. FULL REPAIR — run all fixes
// ────────────────────────────────────────────────────────────────

export async function runFullRepair(): Promise<RepairResult[]> {
  const results = await Promise.all([
    cleanOrphanedRelations(),
    repairBrokenGoalTargetLinks(),
    cleanOrphanedTaskSubcollections(),
    cleanStalePresence(),
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
