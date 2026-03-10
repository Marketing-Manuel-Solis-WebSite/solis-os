// ============================================================
// Client-Side Goal Side Effects — Unified Dispatcher
// ============================================================

import { logAction } from './db';
import { notifyMany } from './notifications';
import { propagateEntityName } from './relations';
import type {
  GoalCreatedEvent,
  GoalUpdatedEvent,
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
// afterGoalCreated
// ============================================================
// Effects:
//   [critical]  logAction
//   [important] notifyOwner (if owner != creator)

export async function afterGoalCreated(event: Omit<GoalCreatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'created',
      resource: 'goal',
      detail: event.goal.name || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  if (event.goal.ownerId && event.goal.ownerId !== event.actor.actorId) {
    effects.push(await runEffect('notifyOwner', 'important', () =>
      notifyMany([event.goal.ownerId], {
        type: 'goal_assigned',
        title: `${event.actor.actorName} te asignó un objetivo`,
        message: event.goal.name || '',
        entityType: 'goal',
        entityId: event.goalId,
        entityUrl: '/app/goals',
        actorId: event.actor.actorId,
        actorName: event.actor.actorName,
      }).then(() => {}),
    ));
  }

  const result = buildResult(cid, 'goal.created', effects);
  persistDispatchResult(result, { entityType: 'goal', entityId: event.goalId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterGoalUpdated
// ============================================================
// Effects:
//   [critical]  logAction (for significant changes: status, name)
//   [important] propagateEntityName (when name changes)

export async function afterGoalUpdated(event: Omit<GoalUpdatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { goalId, field, to, actor } = event;

  // STATUS → COMPLETED: notify owner
  if (field === 'status' && to === 'completed' && event.goal.ownerId) {
    const ownerId = event.goal.ownerId;
    if (ownerId !== actor.actorId) {
      effects.push(await runEffect('notifyGoalCompleted', 'important', () =>
        notifyMany([ownerId], {
          type: 'goal_completed',
          title: `Objetivo completado: ${event.goal.name || ''}`,
          message: `El objetivo "${(event.goal.name || '').slice(0, 80)}" ha sido marcado como completado`,
          entityType: 'goal',
          entityId: goalId,
          entityUrl: '/app/goals',
          actorId: actor.actorId,
          actorName: actor.actorName,
        }).then(() => {}),
      ));
    }
  }

  // Log significant field changes
  const SIGNIFICANT_FIELDS = ['status', 'name', 'ownerId', 'dueDate'];
  if (SIGNIFICANT_FIELDS.includes(field)) {
    effects.push(await runEffect('logAction', 'critical', () =>
      logAction({
        action: 'updated',
        resource: 'goal',
        detail: `${field} → ${String(to).slice(0, 100)}`,
        actorId: actor.actorId,
        actorName: actor.actorName,
      }),
    ));
  }

  if (field === 'name' && typeof to === 'string') {
    effects.push(await runEffect('propagateEntityName', 'important', () =>
      propagateEntityName(goalId, to),
    ));
  }

  const result = buildResult(cid, 'goal.updated', effects);
  if (effects.length > 0) {
    persistDispatchResult(result, { entityType: 'goal', entityId: goalId, actorId: actor.actorId });
  }
  return result;
}

// ============================================================
// afterGoalDeleted
// ============================================================
// Effects:
//   [critical]  logAction
//
// Note: goal.completed is NOT a separate event. Goals use status
// field ('completed') tracked via afterGoalUpdated with field='status'.
// Cascade cleanup (targets, relations) happens inside deleteGoal() in db.ts.

export async function afterGoalDeleted(event: {
  goalId: string;
  goal: Record<string, any>;
  actor: { actorId: string; actorName: string };
}): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'deleted',
      resource: 'goal',
      detail: event.goal.name || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  const result = buildResult(cid, 'goal.deleted', effects);
  persistDispatchResult(result, { entityType: 'goal', entityId: event.goalId, actorId: event.actor.actorId });
  return result;
}
