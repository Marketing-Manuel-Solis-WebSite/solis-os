// ============================================================
// Server-Side Event Log — Persistent Trace of Dispatched Events
// ============================================================
// Writes to orgs/{ORG}/eventLogs via Admin SDK.
// Best-effort: must NEVER block the main flow.

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { DispatchResult } from './event-types';
import { ORG_ID as ORG } from '@/lib/org';



export async function persistDispatchResultAdmin(
  result: DispatchResult,
  meta: { entityType: string; entityId: string; actorId: string },
): Promise<void> {
  try {
    await adminDb.collection(`orgs/${ORG}/eventLogs`).add({
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
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[EventLog] persist failed:', err);
  }
}
