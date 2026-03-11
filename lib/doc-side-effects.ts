// ============================================================
// Client-Side Doc Side Effects — Unified Dispatcher
// ============================================================
//
// DESIGN DECISIONS:
// - Activity log: NO — docs don't have activity subcollections, and autosave
//   would generate excessive writes. Version history serves this purpose.
// - Notifications: NO for edits (too noisy). doc_mentioned defined in matrix but
//   not yet wired — requires mention detection in content. Phase 7 candidate.
// - Webhooks: NO — doc events are not in the webhook event catalog
//   (WebhookEvent type). Docs are internal-only.
// - Automations: NO — automation engine is task-trigger only.
// - Relations cleanup: YES — handled inside deleteDocument() cascade.
// - Version side effects: YES — handled by caller (createRevision in page).
//
// What this dispatcher covers:
// - logAction for create/delete/restore (audit)
// - propagateEntityName for title changes (relation consistency)
// - Persistent trace via eventLog

import { logAction } from './db';
import { propagateEntityName } from './relations';
import type {
  DocCreatedEvent,
  DocUpdatedEvent,
  DocDeletedEvent,
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
// afterDocCreated
// ============================================================
// Effects:
//   [critical] logAction

export async function afterDocCreated(event: Omit<DocCreatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'created',
      resource: 'doc',
      detail: event.doc.title || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  const result = buildResult(cid, 'doc.created', effects);
  persistDispatchResult(result, { entityType: 'doc', entityId: event.docId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterDocUpdated
// ============================================================
// Effects:
//   [important] propagateEntityName (title changes only)
//
// Note: No logAction for updates — docs autosave continuously.
// Version history (createRevision) serves as the audit trail for content changes.

export async function afterDocUpdated(event: Omit<DocUpdatedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  if (event.field === 'title' && typeof event.to === 'string') {
    effects.push(await runEffect('propagateEntityName', 'important', () =>
      propagateEntityName(event.docId, event.to),
    ));
  }

  if (effects.length > 0) {
    const result = buildResult(cid, 'doc.updated', effects);
    persistDispatchResult(result, { entityType: 'doc', entityId: event.docId, actorId: event.actor.actorId });
    return result;
  }
  return buildResult(cid, 'doc.updated', effects);
}

// ============================================================
// afterDocDeleted
// ============================================================
// Effects:
//   [critical] logAction
//
// Note: Cascade cleanup (revisions, relations) happens inside deleteDocument() in db.ts.

export async function afterDocDeleted(event: Omit<DocDeletedEvent, 'type'>): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'deleted',
      resource: 'doc',
      detail: event.doc.title || '',
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  const result = buildResult(cid, 'doc.deleted', effects);
  persistDispatchResult(result, { entityType: 'doc', entityId: event.docId, actorId: event.actor.actorId });
  return result;
}

// ============================================================
// afterDocRestored — for version restores
// ============================================================
// Effects:
//   [critical] logAction

export async function afterDocRestored(event: {
  docId: string;
  doc: Record<string, any>;
  version: number;
  actor: { actorId: string; actorName: string };
}): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];

  effects.push(await runEffect('logAction', 'critical', () =>
    logAction({
      action: 'restored_version',
      resource: 'doc',
      detail: `${event.doc.title || ''} → v${event.version}`,
      actorId: event.actor.actorId,
      actorName: event.actor.actorName,
    }),
  ));

  const result = buildResult(cid, 'doc.restored', effects);
  persistDispatchResult(result, { entityType: 'doc', entityId: event.docId, actorId: event.actor.actorId });
  return result;
}
