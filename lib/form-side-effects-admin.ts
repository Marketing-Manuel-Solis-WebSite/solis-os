// ============================================================
// Server-Side Form Side Effects — Unified Dispatcher
// ============================================================
//
// Canonicalizes form.submitted as a first-class domain event.
// Called from app/api/forms/submit/route.ts AFTER the submission
// is persisted and response count is incremented.
//
// DESIGN DECISIONS:
// - Automations: NO — engine is task-trigger only. Form trigger would be
//   a new feature (Phase 2).
// - Auto-convert to task: Handled by caller before calling this dispatcher,
//   because it requires reading mapping docs and complex logic that is
//   tightly coupled to the submit route. The task creation itself triggers
//   afterTaskCreatedAdmin which handles task-level effects.
// - Webhook event: YES — form.submitted is in WebhookEvent catalog.
// - Creator notification: YES — form owner should know about submissions.
// - Limit-reached handling: YES — auto-pause + notify creator.

import { updateForm } from './db-admin';
import { notifyUsersAdmin } from './notify-admin';
import { queueEvent } from './integrations-db-admin';
import type { SideEffectResult, DispatchResult, EffectCriticality } from './event-types';
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
// afterFormSubmittedAdmin
// ============================================================
// Effects:
//   [important] queueEvent (webhook delivery)
//   [important] notifyCreator
//   [important] checkLimitReached (auto-pause + notify)

export async function afterFormSubmittedAdmin(event: {
  formId: string;
  form: Record<string, any>;
  responseCount: number;
  actor: { actorId: string; actorName: string };
}): Promise<DispatchResult> {
  const cid = generateCorrelationId();
  const effects: SideEffectResult[] = [];
  const { formId, form, responseCount } = event;

  // Webhook event
  effects.push(await runEffect('queueEvent', 'important', () =>
    queueEvent({
      eventType: 'form.submitted',
      entityId: formId,
      entityType: 'form',
      payload: { formTitle: form.title, responseCount },
    }).then(() => {}),
  ));

  // Notify form creator — with email + dedup
  if (form.createdBy) {
    effects.push(await runEffect('notifyCreator', 'important', () =>
      notifyUsersAdmin([form.createdBy], {
        eventType: 'form_submission',
        title: `Nueva respuesta: ${form.title}`,
        message: `Se recibió una nueva respuesta en el formulario "${form.title}"`,
        entityType: 'form',
        entityId: formId,
        entityUrl: '/app/forms',
      }).then(() => {}),
    ));
  }

  // Check if response limit is reached → auto-pause
  if (form.responseLimit && responseCount >= form.responseLimit) {
    effects.push(await runEffect('autoLimitPause', 'important', async () => {
      await updateForm(formId, { status: 'paused' });
      if (form.createdBy) {
        await notifyUsersAdmin([form.createdBy], {
          eventType: 'form_limit_reached',
          title: `Formulario pausado: ${form.title}`,
          message: `El formulario alcanzó el límite de ${form.responseLimit} respuestas y fue pausado automáticamente.`,
          entityType: 'form',
          entityId: formId,
          entityUrl: '/app/forms',
        });
      }
    }));
  }

  const result = buildResult(cid, 'form.submitted', effects);
  persistDispatchResultAdmin(result, { entityType: 'form', entityId: formId, actorId: event.actor.actorId });
  return result;
}
