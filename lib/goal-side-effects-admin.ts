// ============================================================
// Server-Side Goal Side Effects — Unified Dispatcher
// ============================================================

import { logActionAdmin } from './db-admin';
import { notifyUsersAdmin } from './notify-admin';
import { queueEvent } from './integrations-db-admin';
import type {
  GoalCreatedEvent,
  GoalUpdatedEvent,
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
// afterGoalCreatedAdmin
// ============================================================

export async function afterGoalCreatedAdmin(
  event: Omit<GoalCreatedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'created',
      resource: 'goal',
      detail: event.goal.name || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  if (event.goal.ownerId && event.goal.ownerId !== event.actor.actorId) {
    effects.push(await runEffect('notifyOwner', 'important', () =>
      notifyUsersAdmin([event.goal.ownerId], {
        eventType: 'goal_assigned',
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

  effects.push(await runEffect('queueEvent', 'important', () =>
    queueEvent({
      eventType: 'goal.created',
      entityId: event.goalId,
      entityType: 'goal',
      payload: { name: event.goal.name },
    }).then(() => {}),
  ));

  const result = buildResult(cid, 'goal.created', effects);
  persistDispatchResultAdmin(result, { entityType: 'goal', entityId: event.goalId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterGoalUpdatedAdmin
// ============================================================

export async function afterGoalUpdatedAdmin(
  event: Omit<GoalUpdatedEvent, 'type'>,
): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { goalId, field, from, to, actor } = event;

  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'updated',
      resource: 'goal',
      detail: `${field} → ${String(to).slice(0, 100)}`,
      actorId: actor.actorId,
      actorName: actor.actorName,
    }).then(() => {}),
  ));

  // STATUS → COMPLETED: notify owner
  if (field === 'status' && to === 'completed' && event.goal.ownerId) {
    const ownerId = event.goal.ownerId;
    if (ownerId !== actor.actorId) {
      effects.push(await runEffect('notifyGoalCompleted', 'important', () =>
        notifyUsersAdmin([ownerId], {
          eventType: 'goal_completed',
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

  const eventType = field === 'progress' ? 'goal.progress_changed' as const : 'goal.updated' as const;
  effects.push(await runEffect('queueEvent', 'important', () =>
    queueEvent({
      eventType,
      entityId: goalId,
      entityType: 'goal',
      payload: { changes: [field], ...(from !== undefined ? { from, to } : {}) },
    }).then(() => {}),
  ));

  const result = buildResult(cid, 'goal.updated', effects);
  persistDispatchResultAdmin(result, { entityType: 'goal', entityId: goalId, actorId: actor.actorId });
  return result;
}

// ============================================================
// afterGoalDeletedAdmin
// ============================================================

export async function afterGoalDeletedAdmin(event: {
  goalId: string;
  goal: Record<string, any>;
  actor: { actorId: string; actorName: string };
}): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logActionAdmin({
      action: 'deleted',
      resource: 'goal',
      detail: event.goal.name || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }).then(() => {}),
  ));

  const result = buildResult(cid, 'goal.deleted', effects);
  persistDispatchResultAdmin(result, { entityType: 'goal', entityId: event.goalId, actorId: event.actor.actorId });
  return result;
}
