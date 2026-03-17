// ============================================================
// Server-Side Task Side Effects — Unified Dispatcher
// ============================================================
//
// All API routes MUST use these functions instead of manually
// triggering individual side effects with fire-and-forget .catch().
//
// This guarantees every API caller triggers the SAME set of effects
// and all errors are tracked, not silently swallowed.
// ============================================================

import {
  logActionAdmin,
  addTaskActivityAdmin,
  syncGoalTargetsForTaskAdmin,
} from './db-admin';
import { adminDb } from './firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { notifyUsersAdmin } from './notify-admin';
import { queueEvent } from './integrations-db-admin';
import { dispatchWebhookEvent } from './outbound-webhooks';
import {
  onTaskCreated, onTaskStatusChanged, onTaskAssigned,
  onTaskPriorityChanged, onTaskDueDateChanged, onTaskCustomFieldChanged,
  onDependencyUnblocked,
} from './automation-engine';
import type {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskDeletedEvent,
  SideEffectResult,
  DispatchResult,
  EffectCriticality,
} from './event-types';
import { generateCorrelationId } from './event-types';
import { persistDispatchResultAdmin } from './event-log-admin';

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
// afterTaskCreatedAdmin — call after createTask() in API routes
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] notifyAssignees
//   [important] queueEvent (webhook delivery)
//   [important] onTaskCreated (automation engine)

export async function afterTaskCreatedAdmin(
  event: Omit<TaskCreatedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  // Critical: audit log
  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'created',
      resource: 'task',
      detail: event.task.title || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  // Important: notify assignees (excluding creator) — with email + dedup
  const assigneeIds = (event.task.assignees || []).filter(
    (id: string) => id !== event.actor.actorId,
  );
  if (assigneeIds.length > 0) {
    effects.push(await runEffect('notifyAssignees', 'important', () =>
      notifyUsersAdmin(assigneeIds, {
        eventType: 'task_assigned',
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

  // Important: webhook event queue
  effects.push(await runEffect('queueEvent', 'important', () =>
    queueEvent({
      eventType: 'task.created',
      entityId: event.taskId,
      entityType: 'task',
      payload: { title: event.task.title, status: event.task.status },
    }).then(() => {}),
  ));

  // Important: outbound webhook dispatch
  effects.push(await runEffect('dispatchWebhook', 'important', () =>
    dispatchWebhookEvent('task.created', {
      taskId: event.taskId,
      title: event.task.title,
      status: event.task.status,
      assignees: event.task.assignees || [],
      actor: event.actor,
    }).then(() => {}),
  ));

  // Important: automation engine
  effects.push(await runEffect('onTaskCreated', 'important', () =>
    onTaskCreated(event.taskId, event.task, event.actor.actorId),
  ));

  const result = buildResult(cid, 'task.created', effects);
  persistDispatchResultAdmin(result, { entityType: 'task', entityId: event.taskId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTaskUpdatedAdmin — call after updateTask() in API routes
// ============================================================
// Effects:
//   [critical]  addTaskActivity
//   [important] syncGoalTargetsForTask (status changed)
//   [important] notifyNewAssignees (assignees changed)
//   [important] queueEvent (webhook delivery)
//   [important] onTaskStatusChanged / onTaskAssigned (automation engine)

export async function afterTaskUpdatedAdmin(
  event: Omit<TaskUpdatedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { taskId, task, field, from, to, actor } = event;

  // Critical: activity log
  effects.push(await runEffect('addTaskActivity', 'critical', () =>
    addTaskActivityAdmin(taskId, {
      action: 'updated',
      field,
      from: String(from ?? ''),
      to: String(to ?? ''),
      actorId: actor.actorId,
      actorName: actor.actorName,
    }).then(() => {}),
  ));

  const statusChanged = field === 'status' && to !== from;

  // STATUS changed: sync goal targets
  if (statusChanged) {
    effects.push(await runEffect('syncGoalTargetsForTask', 'important', () =>
      syncGoalTargetsForTaskAdmin(taskId),
    ));
  }

  // STATUS → DONE: notify creator + other assignees
  if (statusChanged && to === 'done') {
    const completionRecipients = [
      ...(task.createdBy ? [task.createdBy] : []),
      ...(task.assignees || []),
    ].filter((uid: string, i: number, arr: string[]) =>
      uid !== actor.actorId && arr.indexOf(uid) === i,
    );
    if (completionRecipients.length > 0) {
      effects.push(await runEffect('notifyTaskCompleted', 'important', () =>
        notifyUsersAdmin(completionRecipients, {
          eventType: 'task_completed',
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

  // ASSIGNEES changed: notify new assignees — with email + dedup
  if (field === 'assignees' && Array.isArray(to) && Array.isArray(from)) {
    const newAssignees = to.filter(
      (uid: string) => !from.includes(uid) && uid !== actor.actorId,
    );
    if (newAssignees.length > 0) {
      effects.push(await runEffect('notifyNewAssignees', 'important', () =>
        notifyUsersAdmin(newAssignees, {
          eventType: 'task_assigned',
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

  // Webhook event
  const eventType = statusChanged ? 'task.status_changed' : 'task.updated';
  effects.push(await runEffect('queueEvent', 'important', () =>
    queueEvent({
      eventType,
      entityId: taskId,
      entityType: 'task',
      payload: {
        changes: [field],
        ...(statusChanged ? { newStatus: to, oldStatus: from } : {}),
      },
    }).then(() => {}),
  ));

  // Outbound webhook dispatch
  effects.push(await runEffect('dispatchWebhook', 'important', () =>
    dispatchWebhookEvent(eventType, {
      taskId,
      title: task.title,
      field,
      from,
      to,
      ...(statusChanged ? { newStatus: to, oldStatus: from } : {}),
      actor,
    }).then(() => {}),
  ));

  // Automation engine
  const updatedTask = { ...task, [field]: to };
  if (statusChanged) {
    effects.push(await runEffect('onTaskStatusChanged', 'important', () =>
      onTaskStatusChanged(taskId, updatedTask, String(from), actor.actorId),
    ));
  }
  if (field === 'assignees' && JSON.stringify(to) !== JSON.stringify(from)) {
    effects.push(await runEffect('onTaskAssigned', 'important', () =>
      onTaskAssigned(taskId, updatedTask, actor.actorId),
    ));
  }
  if (field === 'priority' && to !== from) {
    effects.push(await runEffect('onTaskPriorityChanged', 'important', () =>
      onTaskPriorityChanged(taskId, updatedTask, String(from), actor.actorId),
    ));
  }
  if (field === 'dueDate' && String(to) !== String(from)) {
    effects.push(await runEffect('onTaskDueDateChanged', 'important', () =>
      onTaskDueDateChanged(taskId, updatedTask, actor.actorId),
    ));
  }
  if (field === 'customFields' || field.startsWith('customFields.')) {
    const cfName = field.startsWith('customFields.') ? field.replace('customFields.', '') : field;
    effects.push(await runEffect('onTaskCustomFieldChanged', 'important', () =>
      onTaskCustomFieldChanged(taskId, updatedTask, cfName, actor.actorId),
    ));
  }

  // Dependency unblocked: when a task is completed, fire trigger for all tasks that depend on it
  if (statusChanged && (to === 'done' || to === 'completed')) {
    effects.push(await runEffect('onDependencyUnblocked', 'important', async () => {
      const depSnap = await adminDb.collection('tasks')
        .where('orgId', '==', ORG)
        .where('dependencies', 'array-contains', taskId)
        .get();
      for (const depDoc of depSnap.docs) {
        const depTask = { id: depDoc.id, ...depDoc.data() };
        await onDependencyUnblocked(depDoc.id, depTask, actor.actorId);
      }
    }));
  }

  const result = buildResult(cid, 'task.updated', effects);
  persistDispatchResultAdmin(result, { entityType: 'task', entityId: taskId, actorId: actor.actorId });
  return result;
}

// ============================================================
// afterTaskDeletedAdmin — call after deleteTask() in API routes
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] queueEvent (webhook delivery)

export async function afterTaskDeletedAdmin(
  event: Omit<TaskDeletedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  // Critical: audit log
  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'deleted',
      resource: 'task',
      detail: event.task.title || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  // Important: webhook event
  effects.push(await runEffect('queueEvent', 'important', () =>
    queueEvent({
      eventType: 'task.deleted',
      entityId: event.taskId,
      entityType: 'task',
      payload: { title: event.task.title },
    }).then(() => {}),
  ));

  // Important: outbound webhook dispatch
  effects.push(await runEffect('dispatchWebhook', 'important', () =>
    dispatchWebhookEvent('task.deleted', {
      taskId: event.taskId,
      title: event.task.title,
      actor: event.actor,
    }).then(() => {}),
  ));

  const result = buildResult(cid, 'task.deleted', effects);
  persistDispatchResultAdmin(result, { entityType: 'task', entityId: event.taskId, actorId: event.actor.actorId });
  return result;
}
