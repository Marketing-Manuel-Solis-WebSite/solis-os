// ============================================================
// Server-Side Time Entry Side Effects — Unified Dispatcher
// ============================================================

import { logActionAdmin, syncTaskTimeSpentAdmin } from './db-admin';
import type {
  TimeEntryCreatedEvent,
  TimeEntryUpdatedEvent,
  TimeEntryDeletedEvent,
  SideEffectResult,
  DispatchResult,
  EffectCriticality,
} from './event-types';
import { generateCorrelationId } from './event-types';
import { persistDispatchResultAdmin } from './event-log-admin';

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
// afterTimeEntryCreatedAdmin
// ============================================================

export async function afterTimeEntryCreatedAdmin(
  event: Omit<TimeEntryCreatedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'created',
      resource: 'time_entry',
      detail: `${event.entry.hours || 0}h ${event.entry.minutes || 0}m → ${event.entry.taskTitle || ''}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  if (event.entry.taskId) {
    effects.push(await runEffect('syncTaskTimeSpent', 'important', () =>
      syncTaskTimeSpentAdmin(event.entry.taskId),
    ));
  }

  const result = buildResult(cid, 'time_entry.created', effects);
  persistDispatchResultAdmin(result, { entityType: 'time_entry', entityId: event.entryId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTimeEntryUpdatedAdmin
// ============================================================

export async function afterTimeEntryUpdatedAdmin(
  event: Omit<TimeEntryUpdatedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'updated',
      resource: 'time_entry',
      detail: `${event.field} → ${String(event.to).slice(0, 100)}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  if (event.entry.taskId) {
    effects.push(await runEffect('syncTaskTimeSpent', 'important', () =>
      syncTaskTimeSpentAdmin(event.entry.taskId),
    ));
  }
  if (event.field === 'taskId' && event.from && event.from !== event.entry.taskId) {
    effects.push(await runEffect('syncTaskTimeSpent:old', 'important', () =>
      syncTaskTimeSpentAdmin(event.from),
    ));
  }

  const result = buildResult(cid, 'time_entry.updated', effects);
  persistDispatchResultAdmin(result, { entityType: 'time_entry', entityId: event.entryId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterTimeEntryDeletedAdmin
// ============================================================

export async function afterTimeEntryDeletedAdmin(
  event: Omit<TimeEntryDeletedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'deleted',
      resource: 'time_entry',
      detail: `${event.entry.hours || 0}h ${event.entry.minutes || 0}m — ${event.entry.taskTitle || ''}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  if (event.entry.taskId) {
    effects.push(await runEffect('syncTaskTimeSpent', 'important', () =>
      syncTaskTimeSpentAdmin(event.entry.taskId),
    ));
  }

  const result = buildResult(cid, 'time_entry.deleted', effects);
  persistDispatchResultAdmin(result, { entityType: 'time_entry', entityId: event.entryId, actorId: event.actor.actorId });
  return result;
}
