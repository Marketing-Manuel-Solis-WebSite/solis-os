// ============================================================
// Automation Engine MVP — evaluates rules and executes actions
// Supports task-based triggers with condition evaluation
// ============================================================

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyUsersAdmin } from './notify-admin';
import { ORG_ID as ORG } from '@/lib/org';



interface BranchBlock {
  id: string;
  conditions: { field: string; operator: string; value: string }[];
  thenActions: { id: string; type: string; config: Record<string, string> }[];
  elseActions: { id: string; type: string; config: Record<string, string> }[];
}

interface RuleDoc {
  id: string;
  name: string;
  trigger: string;
  triggerConfig?: Record<string, string>;
  conditions: { id: string; field: string; operator: string; value: string }[];
  actions: { id: string; type: string; config: Record<string, string>; order?: number }[];
  branches?: BranchBlock[];
  enabled: boolean;
  teamId?: string;
  spaceId?: string;
  folderId?: string;
  listId?: string;
  runCount: number;
  errorCount?: number;
  consecutiveErrors?: number;
  disabledAt?: any;
  disabledReason?: string;
}

interface TriggerContext {
  taskId: string;
  task: Record<string, any>;
  previousData?: Record<string, any>;
  actorId?: string;
  actorName?: string;
}

// Recursion guard — prevents automation actions from re-triggering the engine
const _activeTaskIds = new Set<string>();

// ---- Condition Evaluation ----

function evaluateCondition(condition: RuleDoc['conditions'][0], task: Record<string, any>): boolean {
  const fieldValue = getFieldValue(task, condition.field);
  const condValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condValue);
    case 'not_equals':
      return String(fieldValue) !== String(condValue);
    case 'contains':
      if (Array.isArray(fieldValue)) return fieldValue.some(v => String(v) === String(condValue));
      return String(fieldValue || '').includes(String(condValue));
    case 'not_contains':
      if (Array.isArray(fieldValue)) return !fieldValue.some(v => String(v) === String(condValue));
      return !String(fieldValue || '').includes(String(condValue));
    case 'is_empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'greater_than':
      return Number(fieldValue) > Number(condValue);
    case 'less_than':
      return Number(fieldValue) < Number(condValue);
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(condValue);
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(condValue);
    case 'starts_with':
      return String(fieldValue || '').startsWith(String(condValue));
    case 'ends_with':
      return String(fieldValue || '').endsWith(String(condValue));
    default:
      return false; // Unknown operator — fail-closed
  }
}

function getFieldValue(task: Record<string, any>, field: string): any {
  switch (field) {
    case 'assignee_count':
      return task.assignees?.length > 0 ? 'yes' : 'no';
    case 'has_due_date':
      return task.dueDate ? 'yes' : 'no';
    default:
      return task[field];
  }
}

function allConditionsPass(conditions: RuleDoc['conditions'], task: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, task));
}

// ---- Action Execution ----

async function executeAction(
  action: RuleDoc['actions'][0],
  ctx: TriggerContext,
  ruleRef?: { automationId: string; automationName: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const taskRef = adminDb.doc(`tasks/${ctx.taskId}`);

    switch (action.type) {
      case 'change_status': {
        const newStatus = action.config.toStatus;
        if (newStatus) await taskRef.update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case 'set_priority': {
        const newPriority = action.config.toPriority;
        if (newPriority) await taskRef.update({ priority: newPriority, updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case 'assign_user': {
        const assigneeId = action.config.assigneeId;
        if (assigneeId) await taskRef.update({ assignees: FieldValue.arrayUnion(assigneeId), updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case 'add_tag': {
        const tag = action.config.tagName;
        if (tag) await taskRef.update({ tags: FieldValue.arrayUnion(tag), updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case 'remove_tag': {
        const tag = action.config.tagName;
        if (tag) await taskRef.update({ tags: FieldValue.arrayRemove(tag), updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case 'post_comment': {
        const text = action.config.commentText;
        if (text) {
          await adminDb.collection(`tasks/${ctx.taskId}/comments`).add({
            text,
            authorId: 'automation',
            authorName: ruleRef ? `Automation: ${ruleRef.automationName}` : 'Automation',
            automationId: ruleRef?.automationId || null,
            automationName: ruleRef?.automationName || null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }
      case 'send_notification': {
        const message = action.config.message || `Automation triggered on "${ctx.task.title}"`;
        const assignees: string[] = ctx.task.assignees || [];
        if (assignees.length > 0) {
          await notifyUsersAdmin(assignees, {
            eventType: 'system',
            title: 'Automation',
            message,
            entityType: 'task',
            entityId: ctx.taskId,
            entityUrl: '/app/tasks',
          });
        }
        break;
      }
      case 'call_webhook': {
        const url = action.config.webhookUrl;
        const method = (action.config.method || 'POST') as string;
        if (url) {
          const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'automation_triggered',
              taskId: ctx.taskId,
              task: { title: ctx.task.title, status: ctx.task.status, priority: ctx.task.priority },
              actorId: ctx.actorId,
              timestamp: new Date().toISOString(),
            }),
          });
          if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`);
        }
        break;
      }
      case 'create_subtask': {
        const subtaskTitle = action.config.subtaskTitle;
        if (subtaskTitle) {
          const taskSnap = await adminDb.doc(`tasks/${ctx.taskId}`).get();
          const currentSubtasks = taskSnap.data()?.subtasks || [];
          await taskRef.update({
            subtasks: [...currentSubtasks, { id: Date.now().toString(36), title: subtaskTitle, done: false }],
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }
      case 'archive_task': {
        await taskRef.update({ archived: true, updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case 'duplicate_task': {
        const snap = await taskRef.get();
        if (snap.exists) {
          const data = snap.data()!;
          await adminDb.collection('tasks').add({
            ...data,
            title: `${data.title || 'Task'} (copy)`,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: 'automation',
            archived: false,
            deleted: false,
          });
        }
        break;
      }
      case 'move_to_list': {
        const listId = action.config.listId;
        if (listId) {
          await taskRef.update({ listId, updatedAt: FieldValue.serverTimestamp() });
        }
        break;
      }
      default:
        return { success: false, error: `Unsupported action type: ${action.type}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

// ---- Main Engine ----

interface ScopeContext {
  teamId?: string;
  spaceId?: string;
  folderId?: string;
  listId?: string;
}

function matchesScope(rule: RuleDoc, scope: ScopeContext): boolean {
  // A rule with no scope fields set is org-wide — matches everything
  if (rule.teamId && rule.teamId !== '' && rule.teamId !== scope.teamId) return false;
  if (rule.spaceId && rule.spaceId !== '' && rule.spaceId !== scope.spaceId) return false;
  if (rule.folderId && rule.folderId !== '' && rule.folderId !== scope.folderId) return false;
  if (rule.listId && rule.listId !== '' && rule.listId !== scope.listId) return false;
  return true;
}

async function getMatchingRules(triggerType: string, scope?: ScopeContext): Promise<RuleDoc[]> {
  const snap = await adminDb.collection('automations')
    .where('orgId', '==', ORG)
    .where('enabled', '==', true)
    .where('trigger', '==', triggerType)
    .get();

  const rules = snap.docs.map(d => ({ id: d.id, ...d.data() } as any as RuleDoc));

  if (scope) {
    return rules.filter(r => matchesScope(r, scope));
  }
  return rules;
}

const AUTO_DISABLE_THRESHOLD = 5;

async function executeRule(rule: RuleDoc, ctx: TriggerContext): Promise<void> {
  const start = Date.now();
  const logEntries: { actionType: string; status: string; error?: string }[] = [];
  const ruleRef = { automationId: rule.id, automationName: rule.name };

  try {
    // Check conditions
    if (!allConditionsPass(rule.conditions, ctx.task)) {
      // Log as skipped
      await writeLog(rule.id, 'skipped', [], Date.now() - start, ctx);
      return;
    }

    // Sort actions by order and execute sequentially
    const sorted = [...rule.actions].sort((a, b) => (a.order || 0) - (b.order || 0));

    let allSuccess = true;
    for (const action of sorted) {
      const result = await executeAction(action, ctx, ruleRef);
      logEntries.push({ actionType: action.type, status: result.success ? 'success' : 'failure', error: result.error });
      if (!result.success) allSuccess = false;
    }

    // Execute branch blocks (if/then/else)
    if (rule.branches && rule.branches.length > 0) {
      for (const branch of rule.branches) {
        const branchConditions = (branch.conditions || []).map(c => ({ id: '', ...c }));
        const conditionsMet = allConditionsPass(branchConditions, ctx.task);
        const branchActions = conditionsMet ? branch.thenActions : branch.elseActions;
        const branchLabel = conditionsMet ? 'branch_then' : 'branch_else';

        for (const action of branchActions || []) {
          const result = await executeAction(action, ctx, ruleRef);
          logEntries.push({ actionType: `${branchLabel}:${action.type}`, status: result.success ? 'success' : 'failure', error: result.error });
          if (!result.success) allSuccess = false;
        }
      }
    }

    // Write automation tracing to task activity
    await adminDb.collection(`tasks/${ctx.taskId}/activity`).add({
      type: 'automation',
      automationId: rule.id,
      automationName: rule.name,
      actionsExecuted: logEntries.map(e => e.actionType),
      status: allSuccess ? 'success' : 'partial_failure',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => { /* best-effort tracing */ });

    // Update rule stats
    const updateData: Record<string, any> = {
      runCount: FieldValue.increment(1),
      lastRunAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (allSuccess) {
      // Reset consecutive errors on success
      updateData.consecutiveErrors = 0;
    } else {
      updateData.errorCount = FieldValue.increment(1);
      updateData.consecutiveErrors = FieldValue.increment(1);
    }
    await adminDb.doc(`automations/${rule.id}`).update(updateData);

    // Auto-disable if consecutive errors hit threshold
    if (!allSuccess) {
      const freshSnap = await adminDb.doc(`automations/${rule.id}`).get();
      const freshData = freshSnap.data();
      if (freshData && (freshData.consecutiveErrors || 0) >= AUTO_DISABLE_THRESHOLD) {
        await adminDb.doc(`automations/${rule.id}`).update({
          enabled: false,
          disabledAt: FieldValue.serverTimestamp(),
          disabledReason: `Auto-disabled after ${AUTO_DISABLE_THRESHOLD} consecutive errors`,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.warn(`[AutomationEngine] Rule ${rule.id} (${rule.name}) auto-disabled after ${AUTO_DISABLE_THRESHOLD} consecutive errors`);
      }
    }

    await writeLog(rule.id, allSuccess ? 'success' : 'failure', logEntries, Date.now() - start, ctx);
  } catch (err: any) {
    console.error(`[AutomationEngine] Rule ${rule.id} (${rule.name}) failed:`, err);

    // Increment error counts
    await adminDb.doc(`automations/${rule.id}`).update({
      errorCount: FieldValue.increment(1),
      consecutiveErrors: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(e => console.error('[AutomationEngine] Failed to update rule stats:', e?.message));

    // Auto-disable check after catastrophic failure
    try {
      const freshSnap = await adminDb.doc(`automations/${rule.id}`).get();
      const freshData = freshSnap.data();
      if (freshData && (freshData.consecutiveErrors || 0) >= AUTO_DISABLE_THRESHOLD) {
        await adminDb.doc(`automations/${rule.id}`).update({
          enabled: false,
          disabledAt: FieldValue.serverTimestamp(),
          disabledReason: `Auto-disabled after ${AUTO_DISABLE_THRESHOLD} consecutive errors: ${err?.message || 'Unknown error'}`,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.warn(`[AutomationEngine] Rule ${rule.id} (${rule.name}) auto-disabled after ${AUTO_DISABLE_THRESHOLD} consecutive errors`);
      }
    } catch { /* best-effort */ }

    await writeLog(rule.id, 'failure', logEntries, Date.now() - start, ctx, err?.message);
  }
}

async function writeLog(
  automationId: string,
  status: string,
  actions: { actionType: string; status: string; error?: string }[],
  duration: number,
  ctx: TriggerContext,
  error?: string,
): Promise<void> {
  try {
    await adminDb.collection(`automations/${automationId}/logs`).add({
      status,
      actionsExecuted: actions,
      duration,
      triggerData: { taskId: ctx.taskId, taskTitle: ctx.task.title || '' },
      actorId: ctx.actorId || null,
      error: error || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (logErr) {
    console.error('[AutomationEngine] Failed to write log:', logErr);
  }
}

// ---- Public API: trigger entry points ----

function buildScope(task: Record<string, any>): ScopeContext {
  return {
    teamId: task.teamId,
    spaceId: task.spaceId,
    folderId: task.folderId,
    listId: task.listId,
  };
}

export async function onTaskCreated(taskId: string, task: Record<string, any>, actorId?: string): Promise<void> {
  if (_activeTaskIds.has(taskId)) return; // recursion guard
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_created', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}

export async function onTaskStatusChanged(
  taskId: string,
  task: Record<string, any>,
  previousStatus: string,
  actorId?: string,
): Promise<void> {
  if (_activeTaskIds.has(taskId)) return; // recursion guard
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_status_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { status: previousStatus }, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}

export async function onTaskAssigned(
  taskId: string,
  task: Record<string, any>,
  actorId?: string,
): Promise<void> {
  if (_activeTaskIds.has(taskId)) return; // recursion guard
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_assigned', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}

export async function onTaskPriorityChanged(
  taskId: string,
  task: Record<string, any>,
  previousPriority: string,
  actorId?: string,
): Promise<void> {
  if (_activeTaskIds.has(taskId)) return;
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_priority_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { priority: previousPriority }, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}

export async function onTaskDueDateChanged(
  taskId: string,
  task: Record<string, any>,
  actorId?: string,
): Promise<void> {
  if (_activeTaskIds.has(taskId)) return;
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_due_date_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}

export async function onTaskCustomFieldChanged(
  taskId: string,
  task: Record<string, any>,
  fieldName: string,
  actorId?: string,
): Promise<void> {
  if (_activeTaskIds.has(taskId)) return;
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_custom_field_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { changedField: fieldName }, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}
