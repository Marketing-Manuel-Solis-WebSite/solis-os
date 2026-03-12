import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_MATRIX,
  buildDedupeKey,
  type NotificationEventType,
  type NotificationPolicy,
} from '../lib/notification-matrix';

// All event types defined in the matrix
const ALL_EVENT_TYPES: NotificationEventType[] = [
  'task_assigned',
  'task_completed',
  'task_mentioned',
  'task_comment',
  'task_due_soon',
  'task_overdue',
  'goal_assigned',
  'goal_completed',
  'goal_overdue',
  'channel_message',
  'channel_mention',
  'doc_mentioned',
  'form_submission',
  'form_limit_reached',
  'webhook_delivery_failed',
  'system',
];

describe('NOTIFICATION_MATRIX structure', () => {
  it('contains all expected event types', () => {
    const matrixKeys = Object.keys(NOTIFICATION_MATRIX).sort();
    expect(matrixKeys).toEqual([...ALL_EVENT_TYPES].sort());
  });

  it('every event type has required fields (inApp, email, inbox, urgency)', () => {
    for (const eventType of ALL_EVENT_TYPES) {
      const policy = NOTIFICATION_MATRIX[eventType];
      expect(policy).toBeDefined();
      expect(typeof policy.inApp).toBe('boolean');
      expect(typeof policy.email).toBe('boolean');
      expect(typeof policy.inbox).toBe('boolean');
      expect(typeof policy.urgency).toBe('string');
    }
  });

  it('every event type has a valid urgency value', () => {
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    for (const eventType of ALL_EVENT_TYPES) {
      const policy = NOTIFICATION_MATRIX[eventType];
      expect(validUrgencies).toContain(policy.urgency);
    }
  });

  it('every event type has a valid dedup strategy', () => {
    const validStrategies = ['none', 'by_entity_and_type', 'by_actor_and_entity'];
    for (const eventType of ALL_EVENT_TYPES) {
      const policy = NOTIFICATION_MATRIX[eventType];
      expect(validStrategies).toContain(policy.dedupeStrategy);
    }
  });

  it('every event type has a non-empty emailSubjectPrefix', () => {
    for (const eventType of ALL_EVENT_TYPES) {
      const policy = NOTIFICATION_MATRIX[eventType];
      expect(typeof policy.emailSubjectPrefix).toBe('string');
      expect(policy.emailSubjectPrefix.length).toBeGreaterThan(0);
    }
  });

  it('every event type has a valid criticality', () => {
    const validCriticalities = ['critical', 'important', 'best-effort'];
    for (const eventType of ALL_EVENT_TYPES) {
      const policy = NOTIFICATION_MATRIX[eventType];
      expect(validCriticalities).toContain(policy.criticality);
    }
  });
});

describe('NOTIFICATION_MATRIX urgency assignments', () => {
  it('task_overdue has critical urgency', () => {
    expect(NOTIFICATION_MATRIX.task_overdue.urgency).toBe('critical');
  });

  it('task_overdue is the only critical urgency event', () => {
    const criticalEvents = ALL_EVENT_TYPES.filter(
      (t) => NOTIFICATION_MATRIX[t].urgency === 'critical',
    );
    expect(criticalEvents).toEqual(['task_overdue']);
  });

  it('high urgency events are the expected set', () => {
    const highEvents = ALL_EVENT_TYPES.filter(
      (t) => NOTIFICATION_MATRIX[t].urgency === 'high',
    ).sort();
    expect(highEvents).toEqual([
      'channel_mention',
      'doc_mentioned',
      'form_limit_reached',
      'goal_overdue',
      'task_due_soon',
      'task_mentioned',
    ]);
  });
});

describe('NOTIFICATION_MATRIX email-enabled events', () => {
  it('email-enabled events are exactly the expected set', () => {
    const emailEvents = ALL_EVENT_TYPES.filter(
      (t) => NOTIFICATION_MATRIX[t].email === true,
    ).sort();
    expect(emailEvents).toEqual([
      'channel_mention',
      'doc_mentioned',
      'form_limit_reached',
      'form_submission',
      'goal_assigned',
      'goal_overdue',
      'task_assigned',
      'task_due_soon',
      'task_mentioned',
      'task_overdue',
    ]);
  });

  it('email-disabled events do not send email', () => {
    const noEmailEvents = ALL_EVENT_TYPES.filter(
      (t) => NOTIFICATION_MATRIX[t].email === false,
    ).sort();
    expect(noEmailEvents).toEqual([
      'channel_message',
      'goal_completed',
      'system',
      'task_comment',
      'task_completed',
      'webhook_delivery_failed',
    ]);
  });
});

describe('NOTIFICATION_MATRIX inbox-enabled events', () => {
  it('inbox-enabled events are exactly the expected set', () => {
    const inboxEvents = ALL_EVENT_TYPES.filter(
      (t) => NOTIFICATION_MATRIX[t].inbox === true,
    ).sort();
    expect(inboxEvents).toEqual([
      'channel_mention',
      'doc_mentioned',
      'goal_overdue',
      'task_due_soon',
      'task_mentioned',
      'task_overdue',
    ]);
  });

  it('all inbox-enabled events have an inboxType defined', () => {
    const inboxEvents = ALL_EVENT_TYPES.filter(
      (t) => NOTIFICATION_MATRIX[t].inbox === true,
    );
    for (const eventType of inboxEvents) {
      expect(NOTIFICATION_MATRIX[eventType].inboxType).toBeDefined();
      expect(typeof NOTIFICATION_MATRIX[eventType].inboxType).toBe('string');
    }
  });
});

describe('buildDedupeKey', () => {
  it('returns null for "none" strategy', () => {
    const key = buildDedupeKey('none', 'channel_message', 'entity-1', 'actor-1');
    expect(key).toBeNull();
  });

  it('returns null when entityId is missing', () => {
    const key = buildDedupeKey('by_entity_and_type', 'task_assigned');
    expect(key).toBeNull();
  });

  it('returns correct format for by_entity_and_type', () => {
    const key = buildDedupeKey('by_entity_and_type', 'task_assigned', 'task-123');
    expect(key).toBe('task_assigned:task-123');
  });

  it('returns correct format for by_actor_and_entity', () => {
    const key = buildDedupeKey('by_actor_and_entity', 'channel_mention', 'channel-1', 'user-42');
    expect(key).toBe('channel_mention:user-42:channel-1');
  });

  it('uses "system" as fallback actorId for by_actor_and_entity', () => {
    const key = buildDedupeKey('by_actor_and_entity', 'task_mentioned', 'task-5');
    expect(key).toBe('task_mentioned:system:task-5');
  });

  it('returns null for unknown strategy', () => {
    // Cast to bypass TypeScript — testing runtime safety
    const key = buildDedupeKey('unknown_strategy' as any, 'task_assigned', 'entity-1');
    expect(key).toBeNull();
  });
});
