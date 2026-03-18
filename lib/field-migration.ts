// ================================================================
// Field Migration — Move fields between scopes, merge duplicates
// ================================================================
// Handles batch data migration when moving custom fields between
// org/space/list scopes, and merging duplicate fields.
//
// All heavy writes go through server-side API to handle Firestore
// batch limits (500 writes per batch).

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';
import type { CustomFieldDef, FieldScope } from './custom-fields';

const BATCH_SIZE = 400; // Leave margin under Firestore's 500 limit

// ---- Types ----

export interface MigrationPreview {
  fieldId: string;
  fieldName: string;
  currentScope: FieldScope;
  newScope: FieldScope;
  newScopeId: string | null;
  tasksAffected: number;
  tasksOutOfScope: number;
  /** If moving to a narrower scope, these tasks will lose the field value */
  dataLossTaskCount: number;
}

export interface MergePreview {
  sourceFieldId: string;
  sourceFieldName: string;
  targetFieldId: string;
  targetFieldName: string;
  tasksWithSourceData: number;
  tasksWithTargetData: number;
  tasksWithConflict: number;
}

export interface MigrationResult {
  success: boolean;
  tasksUpdated: number;
  errors: string[];
  duration: number;
}

// ---- Preview functions (read-only) ----

/**
 * Preview the impact of moving a field to a different scope.
 * Returns counts of affected tasks and potential data loss.
 */
export async function previewFieldMove(
  fieldDef: CustomFieldDef,
  newScope: FieldScope,
  newScopeId: string | null,
): Promise<MigrationPreview> {
  const fieldId = fieldDef.id;

  // Count tasks that have this field set
  const tasksWithField = await adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where(`customFields.${fieldId}`, '!=', null)
    .limit(5000)
    .get();

  let tasksOutOfScope = 0;

  if (newScope === 'space' && newScopeId) {
    // Tasks NOT in the target space will lose the field
    for (const doc of tasksWithField.docs) {
      const data = doc.data();
      if (data.teamId !== newScopeId && data.spaceId !== newScopeId) {
        tasksOutOfScope++;
      }
    }
  } else if (newScope === 'list' && newScopeId) {
    // Tasks NOT in the target list will lose the field
    for (const doc of tasksWithField.docs) {
      const data = doc.data();
      if (data.listId !== newScopeId && !(data.listIds || []).includes(newScopeId)) {
        tasksOutOfScope++;
      }
    }
  }

  return {
    fieldId,
    fieldName: fieldDef.name,
    currentScope: fieldDef.scope || 'org',
    newScope,
    newScopeId,
    tasksAffected: tasksWithField.size,
    tasksOutOfScope,
    dataLossTaskCount: tasksOutOfScope,
  };
}

/**
 * Preview the impact of merging two fields.
 */
export async function previewFieldMerge(
  sourceField: CustomFieldDef,
  targetField: CustomFieldDef,
): Promise<MergePreview> {
  const [sourceSnap, targetSnap] = await Promise.all([
    adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where(`customFields.${sourceField.id}`, '!=', null)
      .limit(5000)
      .get(),
    adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where(`customFields.${targetField.id}`, '!=', null)
      .limit(5000)
      .get(),
  ]);

  // Find conflicts (tasks that have both fields set)
  const targetTaskIds = new Set(targetSnap.docs.map(d => d.id));
  let conflicts = 0;
  for (const doc of sourceSnap.docs) {
    if (targetTaskIds.has(doc.id)) conflicts++;
  }

  return {
    sourceFieldId: sourceField.id,
    sourceFieldName: sourceField.name,
    targetFieldId: targetField.id,
    targetFieldName: targetField.name,
    tasksWithSourceData: sourceSnap.size,
    tasksWithTargetData: targetSnap.size,
    tasksWithConflict: conflicts,
  };
}

// ---- Execution functions ----

/**
 * Move a field to a new scope. Optionally clears data from out-of-scope tasks.
 */
export async function executeFieldMove(
  fieldDef: CustomFieldDef,
  newScope: FieldScope,
  newScopeId: string | null,
  options: { clearOutOfScope: boolean; userId: string },
): Promise<MigrationResult> {
  const start = Date.now();
  const errors: string[] = [];
  let tasksUpdated = 0;

  try {
    // If clearing out-of-scope data
    if (options.clearOutOfScope && (newScope === 'space' || newScope === 'list')) {
      const tasksWithField = await adminDb.collection('tasks')
        .where('orgId', '==', ORG)
        .where(`customFields.${fieldDef.id}`, '!=', null)
        .limit(5000)
        .get();

      const docsToUpdate: string[] = [];

      for (const doc of tasksWithField.docs) {
        const data = doc.data();
        let isOutOfScope = false;

        if (newScope === 'space' && newScopeId) {
          isOutOfScope = data.teamId !== newScopeId && data.spaceId !== newScopeId;
        } else if (newScope === 'list' && newScopeId) {
          isOutOfScope = data.listId !== newScopeId && !(data.listIds || []).includes(newScopeId);
        }

        if (isOutOfScope) {
          docsToUpdate.push(doc.id);
        }
      }

      // Batch clear field from out-of-scope tasks
      for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);

        for (const taskId of chunk) {
          batch.update(adminDb.doc(`tasks/${taskId}`), {
            [`customFields.${fieldDef.id}`]: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          tasksUpdated++;
        }

        try {
          await batch.commit();
        } catch (err: any) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${err?.message}`);
        }
      }
    }

    // Log the migration
    await adminDb.collection(`orgs/${ORG}/fieldMigrationLogs`).add({
      type: 'move',
      fieldId: fieldDef.id,
      fieldName: fieldDef.name,
      fromScope: fieldDef.scope || 'org',
      fromScopeId: fieldDef.scopeId || null,
      toScope: newScope,
      toScopeId: newScopeId,
      tasksUpdated,
      errors,
      userId: options.userId,
      status: errors.length === 0 ? 'success' : 'partial',
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: errors.length === 0,
      tasksUpdated,
      errors,
      duration: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      tasksUpdated,
      errors: [...errors, err?.message || 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}

/**
 * Merge source field into target field. Copies values from source to target
 * (skipping tasks that already have target value if preserveExisting=true),
 * then archives the source field.
 */
export async function executeFieldMerge(
  sourceField: CustomFieldDef,
  targetField: CustomFieldDef,
  options: { preserveExisting: boolean; userId: string },
): Promise<MigrationResult> {
  const start = Date.now();
  const errors: string[] = [];
  let tasksUpdated = 0;

  try {
    // Get all tasks with source field data
    const sourceSnap = await adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where(`customFields.${sourceField.id}`, '!=', null)
      .limit(5000)
      .get();

    // If preserving existing, get tasks with target data
    const targetIds = new Set<string>();
    if (options.preserveExisting) {
      const targetSnap = await adminDb.collection('tasks')
        .where('orgId', '==', ORG)
        .where(`customFields.${targetField.id}`, '!=', null)
        .limit(5000)
        .get();
      targetSnap.docs.forEach(d => targetIds.add(d.id));
    }

    // Build update list
    const updates: { taskId: string; sourceValue: any }[] = [];
    for (const doc of sourceSnap.docs) {
      if (options.preserveExisting && targetIds.has(doc.id)) continue;
      const data = doc.data();
      const sourceValue = data.customFields?.[sourceField.id];
      if (sourceValue !== undefined && sourceValue !== null) {
        updates.push({ taskId: doc.id, sourceValue });
      }
    }

    // Batch update: copy source value to target field, remove source field
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = updates.slice(i, i + BATCH_SIZE);

      for (const { taskId, sourceValue } of chunk) {
        batch.update(adminDb.doc(`tasks/${taskId}`), {
          [`customFields.${targetField.id}`]: sourceValue,
          [`customFields.${sourceField.id}`]: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tasksUpdated++;
      }

      try {
        await batch.commit();
      } catch (err: any) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${err?.message}`);
      }
    }

    // Log the migration
    await adminDb.collection(`orgs/${ORG}/fieldMigrationLogs`).add({
      type: 'merge',
      sourceFieldId: sourceField.id,
      sourceFieldName: sourceField.name,
      targetFieldId: targetField.id,
      targetFieldName: targetField.name,
      tasksUpdated,
      errors,
      userId: options.userId,
      status: errors.length === 0 ? 'success' : 'partial',
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: errors.length === 0,
      tasksUpdated,
      errors,
      duration: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      tasksUpdated,
      errors: [...errors, err?.message || 'Unknown error'],
      duration: Date.now() - start,
    };
  }
}
