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

import { computeSLAMetrics, DEFAULT_SLA } from '../lib/analytics-sla';
import type { SLAMetrics } from '../lib/analytics-sla';

describe('Analytics — SLA Metrics', () => {
  it('returns 100% compliance for no tasks', async () => {
    mockDocs.mockReturnValue([]);
    const result: SLAMetrics = await computeSLAMetrics();

    expect(result.totalEvaluated).toBe(0);
    expect(result.responseTimeRate).toBe(100);
    expect(result.resolutionTimeRate).toBe(100);
    expect(result.overallComplianceRate).toBe(100);
    expect(result.avgCycleTimeHours).toBe(0);
    expect(result.medianCycleTimeHours).toBe(0);
    expect(result.currentlyBreaching).toEqual([]);
  });

  it('computes correct response time SLA', async () => {
    const created = new Date(2026, 2, 1, 10, 0);
    const assigned = new Date(2026, 2, 1, 12, 0); // 2 hours later — within 4h SLA

    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          status: 'in_progress',
          priority: 'high',
          createdAt: { toDate: () => created },
          updatedAt: { toDate: () => assigned },
          assignees: ['user1'],
        }),
      },
    ]);

    const result = await computeSLAMetrics();
    expect(result.responseTimeMet).toBe(1);
    expect(result.responseTimeBreached).toBe(0);
    expect(result.responseTimeRate).toBe(100);
  });

  it('detects response time breach', async () => {
    const created = new Date(2026, 2, 1, 10, 0);
    const assigned = new Date(2026, 2, 1, 20, 0); // 10 hours later — over 4h SLA

    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          status: 'in_progress',
          priority: 'medium',
          createdAt: { toDate: () => created },
          updatedAt: { toDate: () => assigned },
          assignees: ['user1'],
        }),
      },
    ]);

    const result = await computeSLAMetrics();
    expect(result.responseTimeBreached).toBe(1);
    expect(result.responseTimeRate).toBe(0);
  });

  it('computes resolution time for completed tasks', async () => {
    const created = new Date(2026, 2, 1, 10, 0);
    const completed = new Date(2026, 2, 2, 10, 0); // 24 hours — within medium SLA (72h)

    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center',
          status: 'done',
          priority: 'medium',
          createdAt: { toDate: () => created },
          completedAt: { toDate: () => completed },
          updatedAt: { toDate: () => completed },
          assignees: ['user1'],
        }),
      },
    ]);

    const result = await computeSLAMetrics();
    expect(result.resolutionTimeMet).toBe(1);
    expect(result.avgCycleTimeHours).toBe(24);
    expect(result.medianCycleTimeHours).toBe(24);
  });

  it('groups metrics by priority', async () => {
    const created = new Date(2026, 2, 1);
    const done = new Date(2026, 2, 2);

    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center', status: 'done', priority: 'urgent',
          createdAt: { toDate: () => created },
          completedAt: { toDate: () => done },
          updatedAt: { toDate: () => done },
          assignees: [],
        }),
      },
      {
        id: 't2',
        data: () => ({
          orgId: 'solis-center', status: 'done', priority: 'low',
          createdAt: { toDate: () => created },
          completedAt: { toDate: () => done },
          updatedAt: { toDate: () => done },
          assignees: [],
        }),
      },
    ]);

    const result = await computeSLAMetrics();
    expect(result.byPriority['urgent']).toBeDefined();
    expect(result.byPriority['low']).toBeDefined();
    expect(result.byPriority['urgent'].total).toBe(1);
    expect(result.byPriority['low'].total).toBe(1);
  });

  it('DEFAULT_SLA has expected structure', () => {
    expect(DEFAULT_SLA.responseTimeHours).toBe(4);
    expect(DEFAULT_SLA.resolutionTimeHours.urgent).toBe(8);
    expect(DEFAULT_SLA.resolutionTimeHours.high).toBe(24);
    expect(DEFAULT_SLA.resolutionTimeHours.medium).toBe(72);
    expect(DEFAULT_SLA.resolutionTimeHours.low).toBe(168);
  });

  it('respects teamId filter', async () => {
    const created = new Date(2026, 2, 1);
    mockDocs.mockReturnValue([
      {
        id: 't1',
        data: () => ({
          orgId: 'solis-center', status: 'todo', priority: 'medium',
          createdAt: { toDate: () => created }, teamId: 'team-A', assignees: [],
        }),
      },
      {
        id: 't2',
        data: () => ({
          orgId: 'solis-center', status: 'todo', priority: 'medium',
          createdAt: { toDate: () => created }, teamId: 'team-B', assignees: [],
        }),
      },
    ]);

    const result = await computeSLAMetrics({ teamId: 'team-A' });
    expect(result.totalEvaluated).toBe(1);
  });

  it('exports required functions and types', async () => {
    const mod = await import('../lib/analytics-sla');
    expect(typeof mod.computeSLAMetrics).toBe('function');
    expect(mod.DEFAULT_SLA).toBeDefined();
  });
});
