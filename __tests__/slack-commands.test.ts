import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockAdd, mockGet, mockGetDoc } = vi.hoisted(() => ({
  mockAdd: vi.fn().mockResolvedValue({ id: 'task-new-1' }),
  mockGet: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  mockGetDoc: vi.fn().mockResolvedValue({ exists: false }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      add: mockAdd,
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: mockGet,
    }),
    doc: vi.fn().mockReturnValue({
      get: mockGetDoc,
    }),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
    increment: vi.fn((n: number) => `INCREMENT_${n}`),
  },
}));

import {
  verifySlackSignature,
  parseCommand,
  handleCreateTask,
  handleListTasks,
  handleTaskStatus,
  handleHelp,
} from '../lib/connectors/slack-commands';

import { createHmac } from 'crypto';

describe('Slack Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ empty: true, docs: [] });
    mockGetDoc.mockResolvedValue({ exists: false });
  });

  // ---- Signature Verification ----

  describe('verifySlackSignature', () => {
    const secret = 'test-signing-secret';

    it('returns true for valid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = 'token=abc&command=/solis-task&text=create+Test';
      const baseString = `v0:${timestamp}:${body}`;
      const sig = 'v0=' + createHmac('sha256', secret).update(baseString).digest('hex');

      expect(verifySlackSignature(secret, timestamp, body, sig)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = 'token=abc';
      expect(verifySlackSignature(secret, timestamp, body, 'v0=invalid')).toBe(false);
    });

    it('rejects requests older than 5 minutes', () => {
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400);
      const body = 'token=abc';
      const baseString = `v0:${oldTimestamp}:${body}`;
      const sig = 'v0=' + createHmac('sha256', secret).update(baseString).digest('hex');

      expect(verifySlackSignature(secret, oldTimestamp, body, sig)).toBe(false);
    });
  });

  // ---- Command Parsing ----

  describe('parseCommand', () => {
    it('parses create command', () => {
      expect(parseCommand('create Fix the login bug')).toEqual({
        action: 'create',
        args: 'Fix the login bug',
      });
    });

    it('parses list command', () => {
      expect(parseCommand('list')).toEqual({ action: 'list', args: '' });
    });

    it('parses status command', () => {
      expect(parseCommand('status abc123')).toEqual({
        action: 'status',
        args: 'abc123',
      });
    });

    it('returns help for empty text', () => {
      expect(parseCommand('')).toEqual({ action: 'help', args: '' });
    });

    it('returns help for "help"', () => {
      expect(parseCommand('help')).toEqual({ action: 'help', args: '' });
    });

    it('returns unknown for unrecognized command', () => {
      expect(parseCommand('foobar something')).toEqual({
        action: 'unknown',
        args: 'foobar something',
      });
    });
  });

  // ---- Handler Responses ----

  describe('handleCreateTask', () => {
    it('creates task and returns Block Kit response', async () => {
      mockGet.mockResolvedValue({ empty: true, docs: [] });
      const result = await handleCreateTask('Fix login bug', 'U123');

      expect(result.response_type).toBe('in_channel');
      expect(result.text).toContain('Fix login bug');
      expect(result.blocks).toBeDefined();
      expect(result.blocks!.length).toBeGreaterThan(0);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Fix login bug', status: 'todo' }),
      );
    });

    it('returns error for empty title', async () => {
      const result = await handleCreateTask('', 'U123');
      expect(result.response_type).toBe('ephemeral');
      expect(result.text).toContain('provide a task title');
    });
  });

  describe('handleListTasks', () => {
    it('returns empty message when no tasks', async () => {
      mockGet.mockResolvedValue({ empty: true, docs: [] });
      const result = await handleListTasks('U123');
      expect(result.text).toContain('No tasks found');
    });

    it('returns task list when tasks exist', async () => {
      mockGet.mockResolvedValue({
        empty: false,
        docs: [
          { id: 'task-1', data: () => ({ title: 'Task 1', status: 'todo' }) },
          { id: 'task-2', data: () => ({ title: 'Task 2', status: 'in_progress' }) },
        ],
      });

      const result = await handleListTasks('U123');
      expect(result.text).toContain('recent tasks');
      expect(result.blocks!.length).toBeGreaterThan(0);
    });
  });

  describe('handleTaskStatus', () => {
    it('returns error for empty ID', async () => {
      const result = await handleTaskStatus('');
      expect(result.text).toContain('provide a task ID');
    });

    it('returns not found for missing task', async () => {
      mockGetDoc.mockResolvedValue({ exists: false });
      const result = await handleTaskStatus('nonexistent');
      expect(result.text).toContain('not found');
    });

    it('returns task details when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: true,
        data: () => ({ title: 'My Task', status: 'in_progress', priority: 'high', description: 'A description', assignees: ['u1'] }),
      });

      const result = await handleTaskStatus('task-1');
      expect(result.text).toContain('My Task');
      expect(result.blocks).toBeDefined();
    });
  });

  describe('handleHelp', () => {
    it('returns help blocks', () => {
      const result = handleHelp();
      expect(result.text).toContain('SOLIS Task Commands');
      expect(result.blocks!.length).toBeGreaterThan(0);
    });
  });
});
