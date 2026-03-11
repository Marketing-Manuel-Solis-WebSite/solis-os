// ============================================================
// SOLIS OS — Notification Matrix (Single Source of Truth)
// ============================================================
//
// Every notification type in the system is defined here with its
// full policy: channels, urgency, dedup, TTL, inbox behavior.
//
// Dispatchers reference this matrix to decide WHAT to do.
// The matrix is data-only — no logic, no side effects.
// ============================================================

export type NotificationEventType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_mentioned'
  | 'task_comment'
  | 'task_due_soon'
  | 'task_overdue'
  | 'goal_assigned'
  | 'goal_completed'
  | 'goal_overdue'
  | 'channel_message'
  | 'channel_mention'
  | 'doc_mentioned'
  | 'form_submission'
  | 'form_limit_reached'
  | 'webhook_delivery_failed'
  | 'system';

export interface NotificationPolicy {
  /** Show in bell / notifications collection */
  inApp: boolean;
  /** Send email via Resend */
  email: boolean;
  /** Create inbox item */
  inbox: boolean;
  /** Urgency for prioritization */
  urgency: 'low' | 'medium' | 'high' | 'critical';
  /** Dedup strategy: prevents duplicate unread notifications for same entity */
  dedupeStrategy: 'none' | 'by_entity_and_type' | 'by_actor_and_entity';
  /** Email subject prefix (type label) */
  emailSubjectPrefix: string;
  /** Effect criticality when dispatching */
  criticality: 'critical' | 'important' | 'best-effort';
  /** Inbox item type (maps to InboxItem.type for widget compatibility) */
  inboxType?: string;
}

export const NOTIFICATION_MATRIX: Record<NotificationEventType, NotificationPolicy> = {
  task_assigned: {
    inApp: true,
    email: true,
    inbox: false,
    urgency: 'medium',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Task Assignment',
    criticality: 'important',
  },
  task_completed: {
    inApp: true,
    email: false,
    inbox: false,
    urgency: 'low',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Task Completed',
    criticality: 'best-effort',
  },
  task_mentioned: {
    inApp: true,
    email: true,
    inbox: true,
    urgency: 'high',
    dedupeStrategy: 'by_actor_and_entity',
    emailSubjectPrefix: 'Mention',
    criticality: 'important',
    inboxType: 'mention',
  },
  task_comment: {
    inApp: true,
    email: false,
    inbox: false,
    urgency: 'low',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'New Comment',
    criticality: 'best-effort',
  },
  task_due_soon: {
    inApp: true,
    email: true,
    inbox: true,
    urgency: 'high',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Due Date Reminder',
    criticality: 'important',
    inboxType: 'deadline_tomorrow',
  },
  task_overdue: {
    inApp: true,
    email: true,
    inbox: true,
    urgency: 'critical',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Task Overdue',
    criticality: 'important',
    inboxType: 'overdue_task',
  },
  goal_assigned: {
    inApp: true,
    email: true,
    inbox: false,
    urgency: 'medium',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Goal Assignment',
    criticality: 'important',
  },
  goal_completed: {
    inApp: true,
    email: false,
    inbox: false,
    urgency: 'low',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Goal Completed',
    criticality: 'best-effort',
  },
  goal_overdue: {
    inApp: true,
    email: true,
    inbox: true,
    urgency: 'high',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Goal At Risk',
    criticality: 'important',
    inboxType: 'goal_at_risk',
  },
  channel_message: {
    inApp: true,
    email: false,
    inbox: false,
    urgency: 'low',
    dedupeStrategy: 'none',
    emailSubjectPrefix: 'New Message',
    criticality: 'best-effort',
  },
  channel_mention: {
    inApp: true,
    email: true,
    inbox: true,
    urgency: 'high',
    dedupeStrategy: 'by_actor_and_entity',
    emailSubjectPrefix: 'Chat Mention',
    criticality: 'important',
    inboxType: 'mention',
  },
  doc_mentioned: {
    inApp: true,
    email: true,
    inbox: true,
    urgency: 'high',
    dedupeStrategy: 'by_actor_and_entity',
    emailSubjectPrefix: 'Document Mention',
    criticality: 'important',
    inboxType: 'mention',
  },
  form_submission: {
    inApp: true,
    email: true,
    inbox: false,
    urgency: 'medium',
    dedupeStrategy: 'none',
    emailSubjectPrefix: 'New Submission',
    criticality: 'important',
  },
  form_limit_reached: {
    inApp: true,
    email: true,
    inbox: false,
    urgency: 'high',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Form Paused',
    criticality: 'important',
  },
  webhook_delivery_failed: {
    inApp: true,
    email: false,
    inbox: false,
    urgency: 'medium',
    dedupeStrategy: 'by_entity_and_type',
    emailSubjectPrefix: 'Webhook Failed',
    criticality: 'best-effort',
  },
  system: {
    inApp: true,
    email: false,
    inbox: false,
    urgency: 'low',
    dedupeStrategy: 'none',
    emailSubjectPrefix: 'System',
    criticality: 'best-effort',
  },
};

// Helper: build dedup key from strategy + params
export function buildDedupeKey(
  strategy: NotificationPolicy['dedupeStrategy'],
  eventType: string,
  entityId?: string,
  actorId?: string,
): string | null {
  if (strategy === 'none' || !entityId) return null;
  switch (strategy) {
    case 'by_entity_and_type':
      return `${eventType}:${entityId}`;
    case 'by_actor_and_entity':
      return `${eventType}:${actorId || 'system'}:${entityId}`;
    default:
      return null;
  }
}
