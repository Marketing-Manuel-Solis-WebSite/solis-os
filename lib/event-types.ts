// ============================================================
// SOLIS OS — Canonical Event Type System
// Phase 1: Event Model and Real Side Effects
// ============================================================
//
// This file defines every domain event in the system, its typed
// payload, and the side effects it triggers. All event dispatching
// MUST go through the corresponding side-effect modules:
//   - lib/task-side-effects.ts       (client-side, for UI pages)
//   - lib/task-side-effects-admin.ts  (server-side, for API routes)
//
// RULES:
// 1. Every new domain event MUST be added here first.
// 2. No caller should manually trigger side effects — use dispatchers.
// 3. Critical effects are awaited; important effects are best-effort
//    with structured error logging (NOT silent .catch()).
// ============================================================

// ---- Criticality Classification ----
// critical:  Must succeed. Awaited. Failure = user-visible error or data inconsistency.
// important: Should succeed. Awaited with error logging. Failure tracked but non-blocking.

export type EffectCriticality = 'critical' | 'important';

// ---- Correlation ID ----
// Every event dispatch gets a unique ID for traceability across side effects.

export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Side Effect Result ----

export interface SideEffectResult {
  name: string;
  criticality: EffectCriticality;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface DispatchResult {
  correlationId: string;
  event: string;
  effects: SideEffectResult[];
  hasFailures: boolean;
  criticalFailure: boolean; // true if any critical effect failed
}

// ---- Actor Context ----
// Passed by every caller to identify who triggered the event.

export interface ActorContext {
  actorId: string;
  actorName: string;
}

// ============================================================
// TASK EVENTS
// ============================================================

export interface TaskCreatedEvent {
  type: 'task.created';
  taskId: string;
  task: Record<string, any>;
  actor: ActorContext;
}

export interface TaskUpdatedEvent {
  type: 'task.updated';
  taskId: string;
  task: Record<string, any>; // current task state (from local cache or DB)
  field: string;
  from: any;
  to: any;
  actor: ActorContext;
}

export interface TaskDeletedEvent {
  type: 'task.deleted';
  taskId: string;
  task: Record<string, any>;
  actor: ActorContext;
}

export interface TaskBulkUpdatedEvent {
  type: 'task.bulk_updated';
  updates: Array<{ taskId: string; task: Record<string, any> }>;
  field: string;
  value: any;
  actor: ActorContext;
}

export interface TaskBulkDeletedEvent {
  type: 'task.bulk_deleted';
  tasks: Array<{ taskId: string; task: Record<string, any> }>;
  actor: ActorContext;
}

// ============================================================
// GOAL EVENTS
// ============================================================

export interface GoalCreatedEvent {
  type: 'goal.created';
  goalId: string;
  goal: Record<string, any>;
  actor: ActorContext;
}

export interface GoalUpdatedEvent {
  type: 'goal.updated';
  goalId: string;
  goal: Record<string, any>;
  field: string;
  from: any;
  to: any;
  actor: ActorContext;
}

// ============================================================
// DOC EVENTS
// ============================================================

export interface DocCreatedEvent {
  type: 'doc.created';
  docId: string;
  doc: Record<string, any>;
  actor: ActorContext;
}

export interface DocUpdatedEvent {
  type: 'doc.updated';
  docId: string;
  doc: Record<string, any>;
  field: string;
  from: any;
  to: any;
  actor: ActorContext;
}

export interface DocDeletedEvent {
  type: 'doc.deleted';
  docId: string;
  doc: Record<string, any>;
  actor: ActorContext;
}

// ============================================================
// FORM EVENTS
// ============================================================

export interface FormSubmittedEvent {
  type: 'form.submitted';
  formId: string;
  form: Record<string, any>;
  responseCount: number;
  actor: ActorContext;
}

// ============================================================
// MESSAGE EVENTS
// ============================================================

export interface MessageSentEvent {
  type: 'message.sent';
  channelId: string;
  messageId: string;
  message: Record<string, any>;
  actor: ActorContext;
}

// ============================================================
// UNION TYPE
// ============================================================

export type DomainEvent =
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskDeletedEvent
  | TaskBulkUpdatedEvent
  | TaskBulkDeletedEvent
  | GoalCreatedEvent
  | GoalUpdatedEvent
  | DocCreatedEvent
  | DocUpdatedEvent
  | DocDeletedEvent
  | FormSubmittedEvent
  | MessageSentEvent;

// ============================================================
// SIDE EFFECT CATALOG (documentation / reference)
// ============================================================
//
// TASK.CREATED
//   [critical]  logAction — audit log
//   [important] notifyAssignees — notify users assigned to the task
//   [important] queueEvent — webhook delivery queue (server-only)
//   [important] onTaskCreated — automation engine (server-only)
//
// TASK.UPDATED (field-dependent)
//   [critical]  addTaskActivity — activity timeline
//   [important] handleTaskCompletion — recurrence (when status → done)
//   [important] syncGoalTargetsForTask — goal progress (when status changes)
//   [important] propagateEntityName — relations (when title changes)
//   [important] notifyNewAssignees — (when assignees change)
//   [important] queueEvent — webhook delivery queue (server-only)
//   [important] onTaskStatusChanged — automation (when status changes, server-only)
//   [important] onTaskAssigned — automation (when assignees change, server-only)
//
// TASK.DELETED
//   [critical]  logAction — audit log
//   [important] queueEvent — webhook delivery queue (server-only)
//
// TASK.BULK_UPDATED
//   [important] logAction — one audit entry for the batch
//   [important] addTaskActivity — per task (when feasible)
//   [important] field-specific effects (same as TASK.UPDATED)
//
// TASK.BULK_DELETED
//   [important] logAction — one audit entry for the batch
//
// GOAL.CREATED
//   [critical]  logAction — audit log
//   [important] notifyOwner — if owner ≠ creator
//   [important] queueEvent — webhook delivery queue (server-only)
//
// GOAL.UPDATED
//   [critical]  logAction — for significant fields (status, name, owner, dueDate)
//   [important] propagateEntityName — when name changes (client-only)
//   [important] queueEvent — webhook delivery queue (server-only)
//
// GOAL.DELETED
//   [critical]  logAction — audit log
//   Note: cascade (targets, relations) handled by deleteGoal() in db.ts
//   Note: goal.completed is NOT a separate event; tracked via status='completed'
//
// DOC.CREATED
//   [critical]  logAction — audit log
//
// DOC.UPDATED
//   [important] propagateEntityName — when title changes (client-only)
//   Note: No logAction for updates — docs autosave continuously.
//   Note: No webhooks — doc events not in webhook catalog. Internal-only.
//   Note: No notifications — too noisy for collaborative editing.
//   Note: Version history (createRevision) serves as content audit trail.
//
// DOC.DELETED
//   [critical]  logAction — audit log
//   Note: cascade (revisions, relations) handled by deleteDocument() in db.ts
//
// DOC.RESTORED
//   [critical]  logAction — audit log (version restore)
//
// MESSAGE.SENT
//   [important] notifyChannelMembers — all members except sender (client-only)
//   [important] notifyMentionedUsers — @mentioned users except sender (client-only)
//   Note: No webhooks — chat events not in webhook catalog. Internal-only.
//   Note: Channel metadata (lastMessageAt/Preview/By) updated by sendMessage() in db.ts.
//   Note: Read state handled by markChannelRead() — not a side effect of sending.
//
// FORM.SUBMITTED
//   [important] queueEvent — webhook delivery queue (server-only)
//   [important] notifyCreator — form owner notification (server-only)
//   [important] autoLimitPause — pause form + notify if response limit reached (server-only)
//   Note: Auto-convert to task handled before dispatch, triggers afterTaskCreatedAdmin.
//   Note: Automation engine does not support form triggers (Phase 2 candidate).
//
// ============================================================
// UI vs API SIDE EFFECT CONTRACT
// ============================================================
//
// UNIVERSAL (both UI and API):
//   - logAction / logActionAdmin — audit logging
//   - notify* — notifications to affected users
//   - persistDispatchResult — event trace persistence
//
// SERVER-ONLY (API routes, webhooks, cron):
//   - queueEvent — webhook delivery queue (requires webhookEvents write via admin SDK)
//   - onTask* automations — automation engine (requires admin SDK rule queries)
//   - addTaskActivityAdmin — task activity via admin SDK
//   - autoLimitPause — form limit handling
//
// CLIENT-ONLY (UI pages):
//   - handleTaskCompletion — recurrence (uses client SDK Firestore transactions)
//   - propagateEntityName — relation name sync (uses client SDK queries)
//   - syncGoalTargetsForTask — goal target recalc (uses client SDK collectionGroup)
//
// WHY THIS SPLIT EXISTS (explicit design decision, not accidental):
//   1. Webhooks and automations require admin SDK to query global collections
//      (webhookEvents, automations). Client SDK Firestore rules don't grant access.
//   2. Recurrence, name propagation, and goal sync use client SDK because they
//      were built for the UI path first and use client-side Firestore transactions.
//      Porting to admin SDK would require duplicating complex logic for low-traffic
//      API paths (tasks are rarely created via API in this product).
//   3. A server-side bridge endpoint (/api/events/emit) could unify these, but
//      would add latency to every UI operation for marginal benefit. Deferred to
//      Phase 2 if webhook coverage from UI becomes a product requirement.
