import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// Hoisted mocks
const { mockAdd, mockGet, mockUpdate } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue({ id: 'new-task-1' }),
  mockGet: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  mockUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      add: mockAdd,
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: mockGet,
    }),
    batch: vi.fn().mockReturnValue({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
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

describe('Zapier / Make Webhook Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ empty: true, docs: [] });
  });

  describe('Zapier webhook routing', () => {
    it('creates a task from Zapier payload', async () => {
      const result = await processIncomingWebhook(
        { actionType: 'create_task', actionConfig: { defaultStatus: 'todo' } },
        { title: 'Task from Zapier', description: 'Created via Zap' },
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('create_task');
      expect(result.entityId).toBe('new-task-1');
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task from Zapier' }),
      );
    });

    it('creates a notification from Zapier payload', async () => {
      // The notification handler uses adminDb.collection().doc() and batch
      // Ensure the collection mock returns an object with doc() method
      const { adminDb } = await import('@/lib/firebase-admin');
      vi.mocked(adminDb.collection).mockReturnValue({
        add: mockAdd,
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: mockGet,
        doc: vi.fn().mockReturnValue({ id: 'notif-1' }),
      } as any);

      const result = await processIncomingWebhook(
        { actionType: 'create_notification', actionConfig: { notifyUserIds: ['user-1'] } },
        { title: 'Alert from Zapier', message: 'Test notification' },
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('create_notification');
    });
  });

  describe('Make webhook routing', () => {
    it('creates a task from Make payload', async () => {
      const result = await processIncomingWebhook(
        { actionType: 'create_task', actionConfig: { teamId: 'team-eng' } },
        { title: 'Task from Make', description: 'Automated' },
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('create_task');
    });

    it('triggers automation from Make payload', async () => {
      mockGet.mockResolvedValue({
        empty: false,
        docs: [{ id: 'auto-1', data: () => ({ name: 'Deploy', enabled: true }) }],
      });

      const result = await processIncomingWebhook(
        { actionType: 'trigger_automation', actionConfig: { automationName: 'Deploy' } },
        { trigger: 'make' },
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('trigger_automation');
    });
  });

  describe('Secret verification', () => {
    it('timing-safe comparison works for matching secrets', () => {
      const { timingSafeEqual } = require('crypto');
      const secret = 'my-webhook-secret-12345';
      const a = Buffer.from(secret);
      const b = Buffer.from(secret);
      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it('timing-safe comparison fails for different secrets of same length', () => {
      const { timingSafeEqual } = require('crypto');
      const a = Buffer.from('correct-secret-12345');
      const b = Buffer.from('wrong---secret-12345');
      expect(timingSafeEqual(a, b)).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('returns error for unknown action type', async () => {
      const result = await processIncomingWebhook(
        { actionType: 'invalid_action' as any, actionConfig: {} },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('handles Firestore errors gracefully', async () => {
      mockAdd.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await processIncomingWebhook(
        { actionType: 'create_task', actionConfig: {} },
        { title: 'Will fail' },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });
});
