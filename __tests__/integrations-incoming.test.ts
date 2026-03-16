import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available when vi.mock factory runs
const { mockAdd, mockBatchSet, mockBatchCommit, mockUpdate, mockGetDocs } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue({ id: 'new-doc-1' }),
  mockBatchSet: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockGetDocs: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      add: mockAdd,
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: mockGetDocs,
      doc: vi.fn().mockReturnValue({ id: 'auto-1' }),
    }),
    batch: vi.fn().mockReturnValue({
      set: mockBatchSet,
      commit: mockBatchCommit,
    }),
    doc: vi.fn().mockReturnValue({
      update: mockUpdate,
    }),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
    increment: vi.fn((n: number) => `INCREMENT_${n}`),
  },
}));

import { processIncomingWebhook } from '../lib/integrations-incoming-processor';

describe('Incoming Webhook Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  });

  it('creates a task from webhook payload', async () => {
    const result = await processIncomingWebhook(
      { actionType: 'create_task', actionConfig: { teamId: 'team-1', defaultStatus: 'todo' } },
      { title: 'Bug Report', description: 'Something broke' },
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_task');
    expect(result.entityId).toBe('new-doc-1');
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Bug Report',
      description: 'Something broke',
      status: 'todo',
      teamId: 'team-1',
    }));
  });

  it('truncates long title and description', async () => {
    const longTitle = 'A'.repeat(1000);
    const longDesc = 'B'.repeat(10000);

    await processIncomingWebhook(
      { actionType: 'create_task', actionConfig: {} },
      { title: longTitle, description: longDesc },
    );

    const call = mockAdd.mock.calls[0][0];
    expect(call.title.length).toBeLessThanOrEqual(500);
    expect(call.description.length).toBeLessThanOrEqual(5000);
  });

  it('uses fallback fields from payload', async () => {
    await processIncomingWebhook(
      { actionType: 'create_task', actionConfig: { defaultTitle: 'Default' } },
      { summary: 'From summary', body: 'From body' },
    );

    const call = mockAdd.mock.calls[0][0];
    expect(call.title).toBe('From summary');
    expect(call.description).toBe('From body');
  });

  it('creates notifications for specified users', async () => {
    const result = await processIncomingWebhook(
      { actionType: 'create_notification', actionConfig: { notifyUserIds: ['user-1', 'user-2'] } },
      { title: 'Alert', message: 'System warning' },
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('create_notification');
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('fails notification when no users configured', async () => {
    const result = await processIncomingWebhook(
      { actionType: 'create_notification', actionConfig: {} },
      { title: 'Alert' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('No users configured');
  });

  it('triggers automation by name', async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'auto-1', data: () => ({ name: 'Deploy Pipeline', enabled: true }) }],
    });

    const result = await processIncomingWebhook(
      { actionType: 'trigger_automation', actionConfig: { automationName: 'Deploy Pipeline' } },
      { trigger: 'manual' },
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('trigger_automation');
    expect(result.entityId).toBe('auto-1');
  });

  it('fails when automation not found', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    const result = await processIncomingWebhook(
      { actionType: 'trigger_automation', actionConfig: { automationName: 'NonExistent' } },
      {},
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for unknown action type', async () => {
    const result = await processIncomingWebhook(
      { actionType: 'unknown_action' as any, actionConfig: {} },
      {},
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });

  it('catches and returns errors gracefully', async () => {
    mockAdd.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const result = await processIncomingWebhook(
      { actionType: 'create_task', actionConfig: {} },
      { title: 'Test' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Firestore unavailable');
  });
});
