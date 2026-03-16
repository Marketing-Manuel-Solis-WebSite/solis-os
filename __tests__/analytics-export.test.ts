import { describe, it, expect, vi } from 'vitest';

// Mock Firebase Admin
const mockDocs = vi.fn().mockReturnValue([]);
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => Promise.resolve({ docs: mockDocs() })),
    }),
  },
}));

import { exportData } from '../lib/analytics-export';
import type { ExportResult } from '../lib/analytics-export';

describe('Analytics — CSV Export', () => {
  it('exports empty tasks CSV with correct headers', async () => {
    mockDocs.mockReturnValue([]);
    const result: ExportResult = await exportData({ entity: 'tasks' });

    expect(result.entity).toBe('tasks');
    expect(result.rowCount).toBe(0);
    expect(result.csv).toContain('id,title,status,priority');
    expect(result.generatedAt).toBeTruthy();
  });

  it('exports tasks with data rows', async () => {
    const march1 = new Date(2026, 2, 1);
    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          title: 'Test Task',
          status: 'todo',
          priority: 'high',
          type: 'task',
          teamId: 'team-1',
          assignees: ['user1', 'user2'],
          tags: ['bug', 'urgent'],
          dueDate: '2026-03-15',
          createdBy: 'user1',
          createdAt: { toDate: () => march1 },
        }),
      },
    ]);

    const result = await exportData({ entity: 'tasks' });

    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('Test Task');
    expect(result.csv).toContain('user1; user2');
    expect(result.csv).toContain('bug; urgent');
  });

  it('escapes CSV special characters', async () => {
    const march1 = new Date(2026, 2, 1);
    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          title: 'Task with, comma and "quotes"',
          status: 'todo',
          priority: 'medium',
          createdAt: { toDate: () => march1 },
          assignees: [],
          tags: [],
        }),
      },
    ]);

    const result = await exportData({ entity: 'tasks' });
    // Commas and quotes should be properly escaped
    expect(result.csv).toContain('"Task with, comma and ""quotes"""');
  });

  it('exports time entries', async () => {
    mockDocs.mockReturnValue([
      {
        id: 'te1',
        data: () => ({
          userId: 'user1',
          taskId: 'task1',
          date: '2026-03-10',
          hours: 2,
          minutes: 30,
          description: 'Coding',
          billable: true,
          teamId: 'team-1',
          createdAt: { seconds: Date.now() / 1000 },
        }),
      },
    ]);

    const result = await exportData({ entity: 'time_entries' });
    expect(result.entity).toBe('time_entries');
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('Coding');
    expect(result.csv).toContain('Yes');
  });

  it('exports goals', async () => {
    mockDocs.mockReturnValue([
      {
        id: 'g1',
        data: () => ({
          title: 'Q1 Revenue',
          status: 'active',
          progress: 75,
          targetDate: '2026-03-31',
          owner: 'user1',
          teamId: 'team-1',
          createdAt: { toDate: () => new Date(2026, 0, 1) },
          updatedAt: { toDate: () => new Date(2026, 2, 1) },
        }),
      },
    ]);

    const result = await exportData({ entity: 'goals' });
    expect(result.entity).toBe('goals');
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('Q1 Revenue');
  });

  it('respects date range filter', async () => {
    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          title: 'Old Task',
          status: 'done',
          priority: 'low',
          createdAt: { toDate: () => new Date(2025, 0, 1) },
          assignees: [],
          tags: [],
        }),
      },
      {
        id: 't2',
        data: () => ({
          title: 'Recent Task',
          status: 'todo',
          priority: 'high',
          createdAt: { toDate: () => new Date(2026, 2, 10) },
          assignees: [],
          tags: [],
        }),
      },
    ]);

    const result = await exportData({
      entity: 'tasks',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('Recent Task');
    expect(result.csv).not.toContain('Old Task');
  });

  it('respects custom columns', async () => {
    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          title: 'Test',
          status: 'todo',
          priority: 'high',
          createdAt: { toDate: () => new Date() },
          assignees: [],
          tags: [],
        }),
      },
    ]);

    const result = await exportData({
      entity: 'tasks',
      columns: ['id', 'title', 'status'],
    });

    const lines = result.csv.split('\n');
    expect(lines[0]).toBe('id,title,status');
  });

  it('throws for unknown entity', async () => {
    await expect(exportData({ entity: 'unknown' as any })).rejects.toThrow('Unknown export entity');
  });
});
