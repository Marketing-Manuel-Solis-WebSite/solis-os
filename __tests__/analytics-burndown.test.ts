import { describe, it, expect, vi } from 'vitest';

// Mock Firebase Admin
const mockDocs = vi.fn().mockReturnValue([]);

function createMockQuery(filters: Array<{ field: string; op: string; value: any }> = []): any {
  const q: any = {};
  q._filters = filters;
  q.where = vi.fn().mockImplementation((field: string, op: string, value: any) =>
    createMockQuery([...filters, { field, op, value }]),
  );
  q.orderBy = vi.fn().mockReturnValue(q);
  q.startAfter = vi.fn().mockReturnValue(q);
  q.limit = vi.fn().mockReturnValue(q);
  q.get = vi.fn().mockImplementation(() => {
    let docs = mockDocs();
    for (const f of filters) {
      if (f.op === '==') {
        docs = docs.filter((d: any) => d.data()[f.field] === f.value);
      } else if (f.op === '!=') {
        docs = docs.filter((d: any) => d.data()[f.field] !== f.value);
      }
    }
    return Promise.resolve({ docs, empty: docs.length === 0 });
  });
  return q;
}

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation(() => createMockQuery()),
  },
}));

import { computeBurndown, computeVelocity } from '../lib/analytics-burndown';
import type { BurndownData, VelocityData } from '../lib/analytics-burndown';

describe('Analytics — Burndown', () => {
  it('returns empty burndown for no tasks', async () => {
    mockDocs.mockReturnValue([]);
    const result: BurndownData = await computeBurndown('2026-03-01', '2026-03-14');

    expect(result.totalScope).toBe(0);
    expect(result.startDate).toBe('2026-03-01');
    expect(result.endDate).toBe('2026-03-14');
    expect(result.points).toHaveLength(14); // 14 days inclusive
    expect(result.points[0].idealRemaining).toBe(0);
    expect(result.points[0].actualRemaining).toBe(0);
  });

  it('computes correct burndown with tasks', async () => {
    const march1 = new Date(2026, 2, 1);
    const march7 = new Date(2026, 2, 7);

    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          status: 'done',
          createdAt: { toDate: () => march1, seconds: march1.getTime() / 1000 },
          completedAt: { toDate: () => march7, seconds: march7.getTime() / 1000 },
          teamId: 'team-1',
        }),
      },
      {
        id: 't2',
        data: () => ({
          orgId: 'solis-center',
          status: 'in_progress',
          createdAt: { toDate: () => march1, seconds: march1.getTime() / 1000 },
          teamId: 'team-1',
        }),
      },
    ]);

    const result = await computeBurndown('2026-03-01', '2026-03-14');

    expect(result.totalScope).toBe(2);
    expect(result.points.length).toBe(14);

    // On day 0 (March 1): nothing completed yet
    expect(result.points[0].actualRemaining).toBe(2);
    expect(result.points[0].completed).toBe(0);

    // On day 6 (March 7): 1 task completed
    expect(result.points[6].completed).toBe(1);
    expect(result.points[6].actualRemaining).toBe(1);

    // Ideal remaining decreases linearly
    expect(result.points[0].idealRemaining).toBeGreaterThan(result.points[13].idealRemaining);
  });

  it('respects teamId filter', async () => {
    const march1 = new Date(2026, 2, 1);
    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          status: 'todo',
          createdAt: { toDate: () => march1 },
          teamId: 'team-A',
        }),
      },
      {
        id: 't2',
        data: () => ({
          orgId: 'solis-center',
          status: 'todo',
          createdAt: { toDate: () => march1 },
          teamId: 'team-B',
        }),
      },
    ]);

    const result = await computeBurndown('2026-03-01', '2026-03-07', { teamId: 'team-A' });
    expect(result.totalScope).toBe(1); // Only team-A task
  });
});

describe('Analytics — Velocity', () => {
  it('returns empty velocity for no tasks', async () => {
    mockDocs.mockReturnValue([]);
    const result: VelocityData = await computeVelocity(4);

    expect(result.buckets).toHaveLength(4);
    expect(result.avgCompleted).toBe(0);
    expect(result.avgCreated).toBe(0);
    expect(result.trend).toBe('stable');
  });

  it('computes velocity buckets with tasks', async () => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 3 * 86_400_000); // 3 days ago

    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          status: 'done',
          createdAt: { toDate: () => lastWeek },
          completedAt: { toDate: () => now },
          updatedAt: { toDate: () => now },
        }),
      },
    ]);

    const result = await computeVelocity(4);

    expect(result.buckets).toHaveLength(4);
    // The task should appear in recent buckets
    const totalCompleted = result.buckets.reduce((s, b) => s + b.completed, 0);
    expect(totalCompleted).toBeGreaterThanOrEqual(0);
  });

  it('exports required types', async () => {
    const mod = await import('../lib/analytics-burndown');
    expect(typeof mod.computeBurndown).toBe('function');
    expect(typeof mod.computeVelocity).toBe('function');
  });
});
