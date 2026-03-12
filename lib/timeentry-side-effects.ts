// ============================================================
// Client-Side Time Entry Side Effects — Unified Dispatcher
// ============================================================

import { logAction } from './db';
import type {
  TimeEntryCreatedEvent,
  TimeEntryUpdatedEvent,
  TimeEntryDeletedEvent,
  SideEffectResult,
  DispatchResult,
  EffectCriticality,
} from './event-types';
import { generateCorrelationId } from './event-types';
import { persistDispatchResult } from './event-log';

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
// afterTimeEntryCreated
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] syncTaskTimeSpent

export async function afterTimeEntryCreated(event: Omit<TimeEntryCreatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'created',
      resource: 'time_entry',
      detail: `${event.entry.hours || 0}h ${event.entry.minutes || 0}m → ${event.entry.taskTitle || ''}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  // Sync task.timeSpent if linked to a task
  if (event.entry.taskId) {
    const { syncTaskTimeSpent } = await import('./db');
    effects.push(await runEffect('syncTaskTimeSpent', 'important', () =>
      syncTaskTimeSpent(event.entry.taskId),
    ));
  }

  const result = buildResult(cid, 'time_entry.created', effects);
  persistDispatchResult(result, { entityType: 'time_entry', entityId: event.entryId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTimeEntryUpdated
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] syncTaskTimeSpent

export async function afterTimeEntryUpdated(event: Omit<TimeEntryUpdatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'updated',
      resource: 'time_entry',
      detail: `${event.field} → ${String(event.to).slice(0, 100)}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  // Sync task.timeSpent — covers both old and new task if taskId changed
  if (event.entry.taskId) {
    const { syncTaskTimeSpent } = await import('./db');
    effects.push(await runEffect('syncTaskTimeSpent', 'important', () =>
      syncTaskTimeSpent(event.entry.taskId),
    ));
  }
  // If taskId changed, also sync the OLD task
  if (event.field === 'taskId' && event.from && event.from !== event.entry.taskId) {
    const { syncTaskTimeSpent } = await import('./db');
    effects.push(await runEffect('syncTaskTimeSpent:old', 'important', () =>
      syncTaskTimeSpent(event.from),
    ));
  }

  const result = buildResult(cid, 'time_entry.updated', effects);
  persistDispatchResult(result, { entityType: 'time_entry', entityId: event.entryId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTimeEntryDeleted
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] syncTaskTimeSpent

export async function afterTimeEntryDeleted(event: Omit<TimeEntryDeletedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'deleted',
      resource: 'time_entry',
      detail: `${event.entry.hours || 0}h ${event.entry.minutes || 0}m — ${event.entry.taskTitle || ''}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  // Sync task.timeSpent after deletion
  if (event.entry.taskId) {
    const { syncTaskTimeSpent } = await import('./db');
    effects.push(await runEffect('syncTaskTimeSpent', 'important', () =>
      syncTaskTimeSpent(event.entry.taskId),
    ));
  }

  const result = buildResult(cid, 'time_entry.deleted', effects);
  persistDispatchResult(result, { entityType: 'time_entry', entityId: event.entryId, actorId: event.actor.actorId });
  return result;
}
