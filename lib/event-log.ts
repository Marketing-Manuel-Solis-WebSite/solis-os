// ============================================================
// Client-Side Event Log — Persistent Trace of Dispatched Events
// ============================================================
// Writes to orgs/{ORG}/eventLogs for traceability.
// Best-effort: must NEVER block the main flow.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { DispatchResult } from './event-types';

const ORG = 'solis-center';

export async function persistDispatchResult(
  result: DispatchResult,
  meta: { entityType: string; entityId: string; actorId: string },
): Promise<void> {
  try {
    await addDoc(collection(db, `orgs/${ORG}/eventLogs`), {
      correlationId: result.correlationId,
      event: result.event,
      entityType: meta.entityType,
      entityId: meta.entityId,
      actorId: meta.actorId,
      orgId: ORG,
      effects: result.effects.map(e => ({
        name: e.name,
        criticality: e.criticality,
        success: e.success,
        error: e.error || null,
        durationMs: e.durationMs,
      })),
      effectCount: result.effects.length,
      hasFailures: result.hasFailures,
      criticalFailure: result.criticalFailure,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[EventLog] persist failed:', err);
  }
}
