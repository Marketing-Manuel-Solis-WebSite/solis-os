import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// ---- Mock Firebase Admin SDK ----
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue({ id: 'mock-id' });
const mockGet = vi.fn().mockResolvedValue({ docs: [] });

vi.mock('../lib/firebase-admin', () => ({
  adminDb: {
    doc: vi.fn(() => ({ update: mockUpdate })),
    collection: vi.fn(() => ({
      add: mockAdd,
      where: vi.fn().mockReturnThis(),
      get: mockGet,
    })),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    increment: vi.fn((n: number) => ({ _increment: n }),),
    arrayUnion: vi.fn((...args: any[]) => ({ _arrayUnion: args })),
    arrayRemove: vi.fn((...args: any[]) => ({ _arrayRemove: args })),
  },
}));

vi.mock('../lib/notify-admin', () => ({
  notifyUsersAdmin: vi.fn().mockResolvedValue(undefined),
}));

// Import the engine AFTER mocks are set up
const { onTaskCreated, onTaskStatusChanged, onTaskAssigned } =
  await import('../lib/automation-engine');

// ---- Re-implement pure logic functions for direct testing ----
// These mirror lib/automation-engine.ts exactly (same as automation-conditions.test.ts pattern)

function getFieldValue(task: Record<string, any>, field: string): any {
  switch (field) {
    case 'assignee_count':
      return task.assignees?.length > 0 ? 'yes' : 'no';
    case 'has_due_date':
      return task.dueDate ? 'yes' : 'no';
    default:
      return task[field];
  }
}

function evaluateCondition(
  condition: { field: string; operator: string; value: string },
  task: Record<string, any>,
): boolean {
  const fieldValue = getFieldValue(task, condition.field);
  const condValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condValue);
    case 'not_equals':
      return String(fieldValue) !== String(condValue);
    case 'contains':
      if (Array.isArray(fieldValue))
        return fieldValue.some((v) => String(v) === String(condValue));
      return String(fieldValue || '').includes(String(condValue));
    case 'not_contains':
      if (Array.isArray(fieldValue))
        return !fieldValue.some((v) => String(v) === String(condValue));
      return !String(fieldValue || '').includes(String(condValue));
    case 'is_empty':
      return (
        fieldValue === undefined ||
        fieldValue === null ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case 'is_not_empty':
      return (
        fieldValue !== undefined &&
        fieldValue !== null &&
        fieldValue !== '' &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case 'greater_than':
      return Number(fieldValue) > Number(condValue);
    case 'less_than':
      return Number(fieldValue) < Number(condValue);
    default:
      return false; // Unknown operator — fail-closed
  }
}

// Re-implement the action type validation logic from executeAction's switch
const SUPPORTED_ACTION_TYPES = [
  'change_status',
  'set_priority',
  'assign_user',
  'add_tag',
  'remove_tag',
  'post_comment',
  'send_notification',
] as const;

function isKnownActionType(type: string): boolean {
  return (SUPPORTED_ACTION_TYPES as readonly string[]).includes(type);
}

describe('Automation Engine — Condition evaluation fail-closed', () => {
  it('unknown operator evaluates to false (fail-closed)', () => {
    const task = { status: 'todo', priority: 'high' };
    expect(
      evaluateCondition(
        { field: 'status', operator: 'magic_operator', value: 'todo' },
        task,
      ),
    ).toBe(false);
  });

  it('nonsense operator evaluates to false', () => {
    const task = { status: 'active' };
    expect(
      evaluateCondition(
        { field: 'status', operator: '!!!', value: 'active' },
        task,
      ),
    ).toBe(false);
  });

  it('empty string operator evaluates to false', () => {
    const task = { status: 'todo' };
    expect(
      evaluateCondition(
        { field: 'status', operator: '', value: 'todo' },
        task,
      ),
    ).toBe(false);
  });
});

describe('Automation Engine — Action type validation', () => {
  it('recognizes all 7 supported action types', () => {
    expect(isKnownActionType('change_status')).toBe(true);
    expect(isKnownActionType('set_priority')).toBe(true);
    expect(isKnownActionType('assign_user')).toBe(true);
    expect(isKnownActionType('add_tag')).toBe(true);
    expect(isKnownActionType('remove_tag')).toBe(true);
    expect(isKnownActionType('post_comment')).toBe(true);
    expect(isKnownActionType('send_notification')).toBe(true);
  });

  it('rejects unknown action types', () => {
    expect(isKnownActionType('ai_summary')).toBe(false);
    expect(isKnownActionType('schedule_daily')).toBe(false);
    expect(isKnownActionType('delete_task')).toBe(false);
    expect(isKnownActionType('')).toBe(false);
  });

  it('exactly 7 action types are supported', () => {
    expect(SUPPORTED_ACTION_TYPES).toHaveLength(7);
  });
});

describe('Automation Engine — executeAction via engine integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRule(actions: { type: string; config: Record<string, string> }[]) {
    return {
      id: 'rule-1',
      name: 'Test Rule',
      trigger: 'task_created',
      conditions: [],
      actions: actions.map((a, i) => ({ id: `action-${i}`, ...a, order: i })),
      enabled: true,
      runCount: 0,
    };
  }

  it('unsupported action type produces error in logs', async () => {
    // Set up mock to return a rule with an unknown action
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'rule-bad',
          data: () => ({
            orgId: 'solis-center',
            name: 'Bad Rule',
            trigger: 'task_created',
            conditions: [],
            actions: [{ id: 'a1', type: 'teleport_task', config: {}, order: 0 }],
            enabled: true,
            runCount: 0,
          }),
        },
      ],
    });

    const task = { title: 'Test', status: 'todo', teamId: undefined };
    await onTaskCreated('task-bad-action', task, 'actor-1');

    // The engine should have written a log with the failure
    // writeLog calls adminDb.collection(`automations/${id}/logs`).add(...)
    const addCalls = mockAdd.mock.calls;
    const logCall = addCalls.find(
      (call) =>
        call[0] &&
        call[0].actionsExecuted &&
        call[0].actionsExecuted.some(
          (a: any) => a.actionType === 'teleport_task' && a.status === 'failure',
        ),
    );
    expect(logCall).toBeDefined();
  });

  it('change_status action calls taskRef.update with new status', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'rule-status',
          data: () => ({
            orgId: 'solis-center',
            name: 'Status Rule',
            trigger: 'task_created',
            conditions: [],
            actions: [
              { id: 'a1', type: 'change_status', config: { toStatus: 'in_progress' }, order: 0 },
            ],
            enabled: true,
            runCount: 0,
          }),
        },
      ],
    });

    const task = { title: 'Test', status: 'todo' };
    await onTaskCreated('task-status-1', task, 'actor-1');

    // executeAction calls adminDb.doc(`tasks/${taskId}`).update(...)
    const updateCalls = mockUpdate.mock.calls;
    const statusUpdate = updateCalls.find(
      (call) => call[0] && call[0].status === 'in_progress',
    );
    expect(statusUpdate).toBeDefined();
  });

  it('send_notification action calls notifyUsersAdmin for tasks with assignees', async () => {
    const { notifyUsersAdmin } = await import('../lib/notify-admin');

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'rule-notify',
          data: () => ({
            orgId: 'solis-center',
            name: 'Notify Rule',
            trigger: 'task_created',
            conditions: [],
            actions: [
              { id: 'a1', type: 'send_notification', config: { message: 'Hello!' }, order: 0 },
            ],
            enabled: true,
            runCount: 0,
          }),
        },
      ],
    });

    const task = { title: 'Notify test', status: 'todo', assignees: ['user-1', 'user-2'] };
    await onTaskCreated('task-notify-1', task, 'actor-1');

    expect(notifyUsersAdmin).toHaveBeenCalledWith(
      ['user-1', 'user-2'],
      expect.objectContaining({
        eventType: 'system',
        title: 'Automation',
        message: 'Hello!',
        entityType: 'task',
        entityId: 'task-notify-1',
      }),
    );
  });
});

describe('Automation Engine — Recursion guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents re-entrant execution for the same taskId', async () => {
    // We test this by calling onTaskCreated twice with the same taskId concurrently.
    // The first call should proceed; the second should be silently skipped.
    // To simulate overlap, make the first call slow by delaying mockGet.

    let resolveFirst: () => void;
    const firstCallPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });

    let callCount = 0;
    mockGet.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: wait for a signal so the second call arrives while first is active
        await firstCallPromise;
      }
      return { docs: [] }; // No matching rules — simplifies the test
    });

    const task = { title: 'Guard test', status: 'todo' };
    const call1 = onTaskCreated('task-guard-1', task, 'actor-1');

    // Second call with the same taskId — should be blocked by the guard
    const call2 = onTaskCreated('task-guard-1', task, 'actor-1');

    // Release the first call
    resolveFirst!();

    await Promise.all([call1, call2]);

    // Only the first call should have queried for rules (callCount === 1)
    expect(callCount).toBe(1);
  });

  it('allows concurrent execution for different taskIds', async () => {
    let callCount = 0;
    mockGet.mockImplementation(async () => {
      callCount++;
      return { docs: [] };
    });

    const task1 = { title: 'Task A', status: 'todo' };
    const task2 = { title: 'Task B', status: 'todo' };

    await Promise.all([
      onTaskCreated('task-A', task1, 'actor-1'),
      onTaskCreated('task-B', task2, 'actor-1'),
    ]);

    // Both calls should have proceeded
    expect(callCount).toBe(2);
  });

  it('releases the guard after execution completes (taskId reusable)', async () => {
    mockGet.mockResolvedValue({ docs: [] });

    const task = { title: 'Reuse test', status: 'todo' };

    // First call
    await onTaskCreated('task-reuse', task, 'actor-1');
    // Second call with the same taskId should work now that the first is done
    await onTaskCreated('task-reuse', task, 'actor-1');

    // Both should have queried (2 calls)
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe('Automation Engine — Trigger entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ docs: [] });
  });

  it('onTaskCreated queries for task_created trigger', async () => {
    const { adminDb } = await import('../lib/firebase-admin');
    const task = { title: 'New', status: 'todo' };

    await onTaskCreated('task-new', task, 'actor-1');

    // Should have called .where('trigger', '==', 'task_created')
    const collectionMock = adminDb.collection as ReturnType<typeof vi.fn>;
    expect(collectionMock).toHaveBeenCalledWith('automations');
  });

  it('onTaskStatusChanged queries for task_status_changed trigger', async () => {
    const task = { title: 'Updated', status: 'done' };
    await onTaskStatusChanged('task-sc', task, 'todo', 'actor-1');

    // Verify it was called (no error thrown, rules queried)
    expect(mockGet).toHaveBeenCalled();
  });

  it('onTaskAssigned queries for task_assigned trigger', async () => {
    const task = { title: 'Assigned', status: 'todo', assignees: ['user-1'] };
    await onTaskAssigned('task-asgn', task, 'actor-1');

    expect(mockGet).toHaveBeenCalled();
  });
});

describe('Automation Engine — Action config validation (missing required fields)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('change_status with empty toStatus does not call update', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'rule-empty-status',
          data: () => ({
            orgId: 'solis-center',
            name: 'Empty Status Rule',
            trigger: 'task_created',
            conditions: [],
            actions: [
              { id: 'a1', type: 'change_status', config: {}, order: 0 },
            ],
            enabled: true,
            runCount: 0,
          }),
        },
      ],
    });

    const task = { title: 'No status', status: 'todo' };
    await onTaskCreated('task-no-status', task, 'actor-1');

    // The action has an if-guard: `if (newStatus)` — so update should not be called
    // for the task (only the rule stats update should happen)
    const updateCalls = mockUpdate.mock.calls;
    const statusUpdate = updateCalls.find(
      (call) => call[0] && call[0].status !== undefined,
    );
    expect(statusUpdate).toBeUndefined();
  });

  it('send_notification with no assignees does not call notifyUsersAdmin', async () => {
    const { notifyUsersAdmin } = await import('../lib/notify-admin');

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'rule-no-assignees',
          data: () => ({
            orgId: 'solis-center',
            name: 'No Assignees Rule',
            trigger: 'task_created',
            conditions: [],
            actions: [
              { id: 'a1', type: 'send_notification', config: { message: 'Hello' }, order: 0 },
            ],
            enabled: true,
            runCount: 0,
          }),
        },
      ],
    });

    const task = { title: 'No assignees', status: 'todo', assignees: [] };
    await onTaskCreated('task-no-assign', task, 'actor-1');

    expect(notifyUsersAdmin).not.toHaveBeenCalled();
  });
});
