import 'server-only';
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
  /** Distributed depth counter — survives across serverless invocations */
  automationDepth?: number;
}

// In-memory recursion guard — prevents re-entrant calls within same invocation
const _activeTaskIds = new Set<string>();

// Distributed depth guard — authoritative depth travels in TriggerContext.automationDepth
// In-memory counter kept as belt-and-suspenders fallback for same-invocation chains
const MAX_AUTOMATION_DEPTH = 5;
let _automationDepth = 0;

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
          // SECURITY: Validate URL to prevent SSRF
          const { validateWebhookUrl } = await import('@/lib/security/url-validator');
          const urlCheck = await validateWebhookUrl(url);
          if (!urlCheck.valid) throw new Error(`Webhook URL blocked: ${urlCheck.error}`);
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
            _automationDepth: (ctx.automationDepth || 0) + 1,
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
      case 'apply_template': {
        const templateId = action.config.templateId;
        if (templateId) {
          const { applyTaskTemplate } = await import('./task-templates');
          const taskData = await applyTaskTemplate(templateId, {
            teamId: ctx.task.teamId || '',
            spaceId: ctx.task.spaceId || '',
            listId: ctx.task.listId || '',
            createdBy: 'automation',
          });
          await adminDb.collection('tasks').add({
            ...taskData,
            orgId: ORG,
            parentTaskId: ctx.taskId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            _automationDepth: (ctx.automationDepth || 0) + 1,
          });
        }
        break;
      }
      case 'create_task': {
        const taskTitle = action.config.taskTitle || action.config.title || `Task from automation`;
        const currentDepth = ctx.automationDepth || 0;
        const newTask: Record<string, any> = {
          orgId: ORG,
          title: taskTitle,
          titleLower: taskTitle.toLowerCase(),
          status: action.config.status || 'todo',
          priority: action.config.priority || 'medium',
          type: action.config.type || 'task',
          teamId: ctx.task.teamId || '',
          listId: action.config.listId || ctx.task.listId || null,
          listIds: action.config.listId ? [action.config.listId] : (ctx.task.listId ? [ctx.task.listId] : []),
          assignees: action.config.assignees || [],
          tags: action.config.tags || [],
          description: action.config.description || '',
          createdBy: 'automation',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          archived: false,
          deleted: false,
          dependencies: [],
          customFields: {},
          watchers: [],
          subtasks: [],
          checklist: [],
          attachments: [],
          // Propagate automation depth so downstream triggers know their position in the chain
          _automationDepth: currentDepth + 1,
        };
        // Apply field mappings from rule (source task → new task)
        const mappings: { sourceField: string; targetField: string }[] = (ruleRef as any).fieldMappings || action.config.fieldMappings || [];
        for (const m of mappings) {
          if (m.sourceField && m.targetField) {
            const sourceVal = m.sourceField.startsWith('customFields.')
              ? ctx.task.customFields?.[m.sourceField.replace('customFields.', '')]
              : ctx.task[m.sourceField];
            if (sourceVal !== undefined) {
              if (m.targetField.startsWith('customFields.')) {
                newTask.customFields[m.targetField.replace('customFields.', '')] = sourceVal;
              } else {
                newTask[m.targetField] = sourceVal;
              }
            }
          }
        }
        if (newTask.title) newTask.titleLower = newTask.title.toLowerCase();
        await adminDb.collection('tasks').add(newTask);
        break;
      }
      // ---- AI Actions ----
      case 'ai_assign': {
        const { aiAssign } = await import('./ai-automation-actions');
        const result = await aiAssign(
          { taskId: ctx.taskId, task: ctx.task, orgId: ORG },
          { teamId: action.config.teamId, maxCandidates: Number(action.config.maxCandidates) || 20 },
        );
        if (!result.success) return { success: false, error: result.error };
        break;
      }
      case 'ai_prioritize': {
        const { aiPrioritize } = await import('./ai-automation-actions');
        const result = await aiPrioritize({ taskId: ctx.taskId, task: ctx.task, orgId: ORG });
        if (!result.success) return { success: false, error: result.error };
        break;
      }
      case 'ai_summarize': {
        const { aiSummarize } = await import('./ai-automation-actions');
        const result = await aiSummarize({ taskId: ctx.taskId, task: ctx.task, orgId: ORG });
        if (!result.success) return { success: false, error: result.error };
        break;
      }
      case 'ai_create_subtasks': {
        const { aiCreateSubtasks } = await import('./ai-automation-actions');
        const result = await aiCreateSubtasks(
          { taskId: ctx.taskId, task: ctx.task, orgId: ORG },
          { maxSubtasks: Number(action.config.maxSubtasks) || 5 },
        );
        if (!result.success) return { success: false, error: result.error };
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
  const ruleRef = { automationId: rule.id, automationName: rule.name, fieldMappings: (rule as any).fieldMappings || [] };

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
  // Distributed depth: read from task document (survives across serverless invocations)
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max (${MAX_AUTOMATION_DEPTH}) — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return; // in-memory recursion guard (same invocation)
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth (${MAX_AUTOMATION_DEPTH}) reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_created', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onTaskStatusChanged(
  taskId: string,
  task: Record<string, any>,
  previousStatus: string,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_status_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { status: previousStatus }, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onTaskAssigned(
  taskId: string,
  task: Record<string, any>,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_assigned', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onTaskPriorityChanged(
  taskId: string,
  task: Record<string, any>,
  previousPriority: string,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_priority_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { priority: previousPriority }, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onTaskDueDateChanged(
  taskId: string,
  task: Record<string, any>,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_due_date_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onTaskCustomFieldChanged(
  taskId: string,
  task: Record<string, any>,
  fieldName: string,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_custom_field_changed', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { changedField: fieldName }, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

// ---- NEW TRIGGERS: time_tracked, button_field_click, dependency_unblocked ----

export async function onTimeTracked(
  taskId: string,
  task: Record<string, any>,
  entry: { hours: number; minutes: number; userId: string },
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('time_tracked', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { timeEntry: entry }, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onButtonFieldClick(
  taskId: string,
  task: Record<string, any>,
  buttonFieldId: string,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('button_field_click', buildScope(task));
    const ctx: TriggerContext = { taskId, task, previousData: { buttonFieldId }, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onDependencyUnblocked(
  taskId: string,
  task: Record<string, any>,
  actorId?: string,
): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('dependency_unblocked', buildScope(task));
    const ctx: TriggerContext = { taskId, task, actorId, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

// ---- DEADLINE TRIGGERS: task_overdue, task_due_approaching (cron-driven, no actorId) ----

export async function onTaskOverdue(taskId: string, task: Record<string, any>): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_overdue', buildScope(task));
    const ctx: TriggerContext = { taskId, task, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

export async function onTaskDueApproaching(taskId: string, task: Record<string, any>): Promise<void> {
  const distributedDepth = task._automationDepth || 0;
  if (distributedDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] Distributed depth (${distributedDepth}) >= max — skipping ${taskId}`); return; }
  if (_activeTaskIds.has(taskId)) return;
  if (_automationDepth >= MAX_AUTOMATION_DEPTH) { console.warn(`[AutomationEngine] In-memory depth reached — skipping ${taskId}`); return; }
  _activeTaskIds.add(taskId);
  _automationDepth++;
  try {
    const rules = await getMatchingRules('task_due_approaching', buildScope(task));
    const ctx: TriggerContext = { taskId, task, automationDepth: distributedDepth };
    for (const rule of rules) {
      await executeRule(rule, ctx);
    }
  } finally {
    _activeTaskIds.delete(taskId);
    _automationDepth--;
  }
}

/**
 * Chat message received trigger — dispatches automations scoped to the channel's space.
 * Uses a synthetic task context since automations operate on tasks.
 */
export async function onChatMessageReceived(
  channelId: string,
  message: { text: string; authorId: string; authorName: string },
  scope: { teamId?: string; spaceId?: string },
): Promise<void> {
  const scopeCtx = { orgId: ORG, teamId: scope.teamId, spaceId: scope.spaceId };
  const rules = await getMatchingRules('chat_message_received', scopeCtx);
  // Chat triggers use a synthetic task context with the message data
  const ctx: TriggerContext = {
    taskId: channelId,
    task: {
      title: message.text.slice(0, 100),
      description: message.text,
      teamId: scope.teamId || '',
      spaceId: scope.spaceId || '',
      assignees: [message.authorId],
      status: 'todo',
      priority: 'medium',
      channelId,
      authorId: message.authorId,
      authorName: message.authorName,
    },
  };
  for (const rule of rules) {
    await executeRule(rule, ctx);
  }
}
