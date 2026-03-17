// ============================================================
// Client-Side Task Side Effects — Unified Dispatcher
// ============================================================
//
// All UI pages (tasks, planner, etc.) MUST use these functions
// instead of manually triggering individual side effects.
//
// This guarantees every caller triggers the SAME set of effects,
// regardless of which page the operation originates from.
// ============================================================

import { logAction, addTaskActivity, syncGoalTargetsForTask, getMembers, autoUnblockDependents } from './db';
import { notifyMany } from './notifications';
import { handleTaskCompletion } from './recurrence-trigger';
import { propagateEntityName } from './relations';
import { getNewMentions, resolveMentionUserIds } from './mention-utils';
import type {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  TaskBulkUpdatedEvent,
  TaskBulkDeletedEvent,
  SideEffectResult,
  DispatchResult,
  EffectCriticality,
} from './event-types';
import { generateCorrelationId } from './event-types';
import { persistDispatchResult } from './event-log';

// ---- Internal helpers ----

async function runEffect(
  name: string,
  criticality: EffectCriticality,
  fn: () => Promise<unknown>,
): Promise<SideEffectResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, criticality, success: true, durationMs: Date.now() - start };
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    console.error(`[SideEffect:${name}] failed:`, msg);
    return { name, criticality, success: false, error: msg, durationMs: Date.now() - start };
  }
}

function buildResult(correlationId: string, event: string, effects: SideEffectResult[]): DispatchResult {
  return {
    correlationId,
    event,
    effects,
    hasFailures: effects.some(e => !e.success),
    criticalFailure: effects.some(e => !e.success && e.criticality === 'critical'),
  };
}

// ============================================================
// afterTaskCreated — call after createTask() succeeds
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] notifyAssignees (if any, excluding creator)

export async function afterTaskCreated(event: Omit<TaskCreatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  // Critical: audit log
  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'created',
      resource: 'task',
      detail: event.task.title || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  // Important: notify assignees (excluding creator)
  const assigneeIds = (event.task.assignees || []).filter(
    (id: string) => id !== event.actor.actorId,
  );
  if (assigneeIds.length > 0) {
    effects.push(await runEffect('notifyAssignees', 'important', () =>
      notifyMany(assigneeIds, {
        type: 'task_assigned',
        title: `${event.actor.actorName} te asignó una tarea`,
        message: event.task.title || 'Nueva tarea',
        entityType: 'task',
        entityId: event.taskId,
        entityUrl: '/app/tasks',
        actorId: event.actor.actorId,
        actorName: event.actor.actorName,
      }).then(() => {}),
    ));
  }

  const result = buildResult(cid, 'task.created', effects);
  persistDispatchResult(result, { entityType: 'task', entityId: event.taskId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTaskUpdated — call after updateTask() succeeds
// ============================================================
// Effects:
//   [critical]  addTaskActivity
//   [important] handleTaskCompletion (status → done + recurrence)
//   [important] syncGoalTargetsForTask (status changed)
//   [important] propagateEntityName (title changed)
//   [important] notifyNewAssignees (assignees changed)

export async function afterTaskUpdated(event: Omit<TaskUpdatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { taskId, task, field, from, to, actor } = event;

  // Critical: activity log
  effects.push(await runEffect('addTaskActivity', 'critical', () =>
    addTaskActivity(taskId, {
      action: 'updated',
      field,
      from: String(from ?? ''),
      to: String(to ?? ''),
      actorId: actor.actorId,
      actorName: actor.actorName,
    }).then(() => {}),
  ));

  // Conditional effects based on which field changed

  // STATUS → DONE: recurrence + notify
  if (field === 'status' && to === 'done') {
    if (task.recurrence) {
      effects.push(await runEffect('handleTaskCompletion', 'important', () =>
        handleTaskCompletion(task).then(() => {}),
      ));
    }
    // Notify creator + other assignees about completion
    const completionRecipients = [
      ...(task.createdBy ? [task.createdBy] : []),
      ...(task.assignees || []),
    ].filter((uid: string, i: number, arr: string[]) =>
      uid !== actor.actorId && arr.indexOf(uid) === i,
    );
    if (completionRecipients.length > 0) {
      effects.push(await runEffect('notifyTaskCompleted', 'important', () =>
        notifyMany(completionRecipients, {
          type: 'task_completed',
          title: `${actor.actorName} completó una tarea`,
          message: task.title || 'Tarea completada',
          entityType: 'task',
          entityId: taskId,
          entityUrl: '/app/tasks',
          actorId: actor.actorId,
          actorName: actor.actorName,
        }).then(() => {}),
      ));
    }
  }

  // STATUS → DONE: auto-unblock dependent tasks
  if (field === 'status' && to === 'done') {
    effects.push(await runEffect('autoUnblockDependents', 'important', () =>
      autoUnblockDependents(taskId).then(() => {}),
    ));
  }

  // STATUS changed: sync goal targets
  if (field === 'status') {
    effects.push(await runEffect('syncGoalTargetsForTask', 'important', () =>
      syncGoalTargetsForTask(taskId),
    ));
  }

  // TITLE changed: propagate to relations
  if (field === 'title' && typeof to === 'string') {
    effects.push(await runEffect('propagateEntityName', 'important', () =>
      propagateEntityName(taskId, to),
    ));
  }

  // STATUS changed FROM blocked: dependency auto-unblock notification
  if (field === 'status' && from === 'blocked' && to !== 'blocked') {
    const unblockedRecipients = [
      ...(task.assignees || []),
      ...(task.createdBy ? [task.createdBy] : []),
    ].filter((uid: string, i: number, arr: string[]) => uid !== actor.actorId && arr.indexOf(uid) === i);
    if (unblockedRecipients.length > 0) {
      effects.push(await runEffect('notifyTaskUnblocked', 'important', () =>
        notifyMany(unblockedRecipients, {
          type: 'system',
          title: `Task unblocked`,
          message: `"${task.title || 'Task'}" is no longer blocked`,
          entityType: 'task',
          entityId: taskId,
          entityUrl: '/app/tasks',
          actorId: actor.actorId,
          actorName: actor.actorName,
        }).then(() => {}),
      ));
    }
  }

  // ASSIGNEES changed: notify new assignees
  if (field === 'assignees' && Array.isArray(to) && Array.isArray(from)) {
    const newAssignees = to.filter(
      (uid: string) => !from.includes(uid) && uid !== actor.actorId,
    );
    if (newAssignees.length > 0) {
      effects.push(await runEffect('notifyNewAssignees', 'important', () =>
        notifyMany(newAssignees, {
          type: 'task_assigned',
          title: `${actor.actorName} te asignó una tarea`,
          message: task.title || 'Tarea actualizada',
          entityType: 'task',
          entityId: taskId,
          entityUrl: '/app/tasks',
          actorId: actor.actorId,
          actorName: actor.actorName,
        }).then(() => {}),
      ));
    }
  }

  // DESCRIPTION changed: detect new @mentions and notify
  if (field === 'description' && typeof to === 'string') {
    const oldText = typeof from === 'string' ? from : '';
    const newNames = getNewMentions(oldText, to);
    if (newNames.length > 0) {
      effects.push(await runEffect('notifyTaskMentioned', 'important', async () => {
        const members = await getMembers();
        const mentionedIds = resolveMentionUserIds(newNames, members)
          .filter(uid => uid !== actor.actorId);
        if (mentionedIds.length > 0) {
          await notifyMany(mentionedIds, {
            type: 'task_mentioned',
            title: `${actor.actorName} te mencionó en una tarea`,
            message: task.title || 'Tarea',
            entityType: 'task',
            entityId: taskId,
            entityUrl: '/app/tasks',
            actorId: actor.actorId,
            actorName: actor.actorName,
          });
        }
      }));
    }
  }

  const result = buildResult(cid, 'task.updated', effects);
  persistDispatchResult(result, { entityType: 'task', entityId: taskId, actorId: actor.actorId });
  return result;
}

// ============================================================
// afterTaskDeleted — call after softDeleteTask() succeeds
// ============================================================
// Effects:
//   [critical]  logAction

export async function afterTaskDeleted(event: Omit<TaskDeletedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'deleted',
      resource: 'task',
      detail: event.task.title || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  const result = buildResult(cid, 'task.deleted', effects);
  persistDispatchResult(result, { entityType: 'task', entityId: event.taskId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTaskBulkUpdated — call after bulk updateTask() succeeds
// ============================================================
// Effects:
//   [important] logAction (one entry for the batch)
//   [important] per-task field-specific effects

export async function afterTaskBulkUpdated(event: Omit<TaskBulkUpdatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { updates, field, value, actor } = event;

  // Audit log for the batch
  effects.push(await runEffect('logAction:batch', 'important', () =>
    logAction({
      action: 'bulk_updated',
      resource: 'task',
      detail: `${updates.length} tasks — ${field} → ${String(value).slice(0, 100)}`,
      actorId: actor.actorId,
      actorName: actor.actorName,
    }),
  ));

  // Per-task effects (capped to avoid overwhelming Firestore)
  const MAX_INDIVIDUAL = 20;
  const toProcess = updates.slice(0, MAX_INDIVIDUAL);

  for (const { taskId, task } of toProcess) {
    // Activity log per task
    effects.push(await runEffect(`addTaskActivity:${taskId.slice(0, 8)}`, 'important', () =>
      addTaskActivity(taskId, {
        action: 'updated',
        field,
        from: '',
        to: String(value ?? ''),
        actorId: actor.actorId,
        actorName: actor.actorName,
      }).then(() => {}),
    ));

    // Status-specific effects
    if (field === 'status') {
      if (value === 'done' && task.recurrence) {
        effects.push(await runEffect(`handleTaskCompletion:${taskId.slice(0, 8)}`, 'important', () =>
          handleTaskCompletion(task).then(() => {}),
        ));
      }
      effects.push(await runEffect(`syncGoalTargetsForTask:${taskId.slice(0, 8)}`, 'important', () =>
        syncGoalTargetsForTask(taskId),
      ));
    }
  }

  const result = buildResult(cid, 'task.bulk_updated', effects);
  persistDispatchResult(result, { entityType: 'task', entityId: updates[0]?.taskId || '', actorId: actor.actorId });
  return result;
}

// ============================================================
// afterTaskBulkDeleted — call after bulk softDeleteTask() succeeds
// ============================================================
// Effects:
//   [important] logAction (one entry for the batch)

export async function afterTaskBulkDeleted(event: Omit<TaskBulkDeletedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction:batch', 'important', () =>
    logAction({
      action: 'bulk_deleted',
      resource: 'task',
      detail: `${event.tasks.length} tasks deleted`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  const result = buildResult(cid, 'task.bulk_deleted', effects);
  persistDispatchResult(result, { entityType: 'task', entityId: event.tasks[0]?.taskId || '', actorId: event.actor.actorId });
  return result;
}
