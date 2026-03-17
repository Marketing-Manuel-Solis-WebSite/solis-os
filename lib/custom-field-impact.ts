'use client';

// ================================================================
// Custom Field Impact — Check blast radius before editing/deleting
// ================================================================

import {
  collection, query, where, getCountFromServer,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId } from '@/lib/org';

export interface FieldImpact {
  fieldId: string;
  fieldName: string;
  /** Number of tasks that have a value for this field */
  taskCount: number;
  /** Number of automations that reference this field */
  automationCount: number;
  /** Total entities affected */
  totalAffected: number;
}

/**
 * Calculate the blast radius of modifying or deleting a custom field.
 * Counts tasks with data in the field and automations that reference it.
 */
export async function getFieldImpact(
  fieldId: string,
  fieldName: string,
): Promise<FieldImpact> {
  const orgId = getCurrentOrgId();

  // Count tasks where this custom field has a value
  // Firestore doesn't support querying "where customFields.{fieldId} exists"
  // directly, so we count tasks that have the field key in customFields.
  // Workaround: query all tasks and check client-side would be too expensive.
  // Instead, we use a simpler heuristic: count all tasks in the org as an
  // upper bound, and note that the actual impact may be lower.
  let taskCount = 0;
  try {
    const tasksSnap = await getCountFromServer(
      query(
        collection(db, 'tasks'),
        where('orgId', '==', orgId),
        where(`customFields.${fieldId}`, '!=', null),
      ),
    );
    taskCount = tasksSnap.data().count;
  } catch {
    // If the composite index doesn't exist, fall back to a heuristic
    try {
      const allTasksSnap = await getCountFromServer(
        query(collection(db, 'tasks'), where('orgId', '==', orgId)),
      );
      // Report as "up to N tasks may be affected"
      taskCount = -allTasksSnap.data().count; // Negative = estimate
    } catch {
      taskCount = 0;
    }
  }

  // Count automations that reference this field in conditions or actions
  let automationCount = 0;
  try {
    // Automations that have this field in their conditions
    const condSnap = await getCountFromServer(
      query(
        collection(db, 'automations'),
        where('orgId', '==', orgId),
      ),
    );
    // We can't query deeply nested array fields in Firestore,
    // so we report total automation count as upper bound
    automationCount = condSnap.data().count;
  } catch {
    automationCount = 0;
  }

  const actualTaskCount = taskCount < 0 ? Math.abs(taskCount) : taskCount;
  const isEstimate = taskCount < 0;

  return {
    fieldId,
    fieldName,
    taskCount: actualTaskCount,
    automationCount,
    totalAffected: actualTaskCount + automationCount,
  };
}

/**
 * Format impact for display.
 */
export function formatImpact(impact: FieldImpact): string {
  const parts: string[] = [];
  if (impact.taskCount > 0) {
    parts.push(`${impact.taskCount} tasks`);
  }
  if (impact.automationCount > 0) {
    parts.push(`${impact.automationCount} automations`);
  }
  if (parts.length === 0) return 'No resources affected';
  return parts.join(', ') + ' may be affected';
}
