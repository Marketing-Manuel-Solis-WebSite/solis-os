// ============================================================
// Automation Engine MVP — evaluates rules and executes actions
// Supports task-based triggers with condition evaluation
// ============================================================

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyUsersAdmin } from './notify-admin';

const ORG = 'solis-center';

interface RuleDoc {
  id: string;
  name: string;
  trigger: string;
  triggerConfig?: Record<string, string>;
  conditions: { id: string; field: string; operator: string; value: string }[];
  actions: { id: string; type: string; config: Record<string, string>; order?: number }[];
  enabled: boolean;
  teamId?: string;
  runCount: number;
  errorCount?: number;
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
            authorName: 'Automation',
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
      default:
        return { success: false, error: `Unsupported action type: ${action.type}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

// ---- Main Engine ----

async function getMatchingRules(triggerType: string, teamId?: string): Promise<RuleDoc[]> {
  let snap = await adminDb.collection('automations')
    .where('orgId', '==', ORG)
    .where('enabled', '==', true)
    .where('trigger', '==', triggerType)
    .get();

  const rules = snap.docs.map(d => ({ id: d.id, ...d.data() } as any as RuleDoc));

  // Filter by team scope if applicable
  if (teamId) {
    return rules.filter(r => !r.teamId || r.teamId === '' || r.teamId === teamId);
  }
  return rules;
}

async function executeRule(rule: RuleDoc, ctx: TriggerContext): Promise<void> {
  const start = Date.now();
  const logEntries: { actionType: string; status: string; error?: string }[] = [];

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
      const result = await executeAction(action, ctx);
      logEntries.push({ actionType: action.type, status: result.success ? 'success' : 'failure', error: result.error });
      if (!result.success) allSuccess = false;
    }

    // Update rule stats
    const updateData: Record<string, any> = {
      runCount: FieldValue.increment(1),
      lastRunAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!allSuccess) updateData.errorCount = FieldValue.increment(1);
    await adminDb.doc(`automations/${rule.id}`).update(updateData);

    await writeLog(rule.id, allSuccess ? 'success' : 'failure', logEntries, Date.now() - start, ctx);
  } catch (err: any) {
    console.error(`[AutomationEngine] Rule ${rule.id} (${rule.name}) failed:`, err);
    await adminDb.doc(`automations/${rule.id}`).update({
      errorCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('[AutomationEngine] Failed to update rule stats:', err?.message));
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

export async function onTaskCreated(taskId: string, task: Record<string, any>, actorId?: string): Promise<void> {
  if (_activeTaskIds.has(taskId)) return; // recursion guard
  _activeTaskIds.add(taskId);
  try {
    const rules = await getMatchingRules('task_created', task.teamId);
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
    const rules = await getMatchingRules('task_status_changed', task.teamId);
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
    const rules = await getMatchingRules('task_assigned', task.teamId);
    const ctx: TriggerContext = { taskId, task, actorId };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
  }
}
