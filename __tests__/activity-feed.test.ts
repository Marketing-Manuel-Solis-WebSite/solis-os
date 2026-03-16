import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

import {
  groupByDate,
  groupByActor,
  summarizeActivity,
} from '@/lib/activity-feed';
import type { ActivityItem } from '@/lib/activity-feed';

// Helper to create mock activity items
function mockItem(overrides: Partial<ActivityItem> & { createdAt: any }): ActivityItem {
  return {
    id: Math.random().toString(36).slice(2),
    action: 'created',
    resource: 'task',
    resourceId: 'res-1',
    detail: 'Test activity',
    actorId: 'user-1',
    actorName: 'Alice',
    ...overrides,
  };
}

// ---- groupByDate ----

describe('groupByDate', () => {
  it('groups items into Today', () => {
    const items = [mockItem({ createdAt: new Date().toISOString() })];
    const groups = groupByDate(items);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].items).toHaveLength(1);
  });

  it('groups items into Yesterday', () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const items = [mockItem({ createdAt: yesterday.toISOString() })];
    const groups = groupByDate(items);
    expect(groups[0].label).toBe('Yesterday');
  });

  it('groups items into This Week', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const items = [mockItem({ createdAt: threeDaysAgo.toISOString() })];
    const groups = groupByDate(items);
    expect(groups[0].label).toBe('This Week');
  });

  it('groups items into Older', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000);
    const items = [mockItem({ createdAt: twoWeeksAgo.toISOString() })];
    const groups = groupByDate(items);
    expect(groups[0].label).toBe('Older');
  });

  it('handles multiple groups', () => {
    const items = [
      mockItem({ createdAt: new Date().toISOString() }),
      mockItem({ createdAt: new Date(Date.now() - 86_400_000).toISOString() }),
      mockItem({ createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString() }),
    ];
    const groups = groupByDate(items);
    expect(groups.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array for no items', () => {
    expect(groupByDate([])).toEqual([]);
  });

  it('handles null/missing timestamps', () => {
    const items = [mockItem({ createdAt: null })];
    const groups = groupByDate(items);
    expect(groups[0].label).toBe('Older');
  });
});

// ---- groupByActor ----

describe('groupByActor', () => {
  it('groups items by actor name', () => {
    const items = [
      mockItem({ actorName: 'Alice', createdAt: new Date().toISOString() }),
      mockItem({ actorName: 'Bob', createdAt: new Date().toISOString() }),
      mockItem({ actorName: 'Alice', createdAt: new Date().toISOString() }),
    ];
    const groups = groupByActor(items);
    expect(groups['Alice']).toHaveLength(2);
    expect(groups['Bob']).toHaveLength(1);
  });

  it('falls back to actorId when actorName is empty', () => {
    const items = [mockItem({ actorName: '', actorId: 'uid-123', createdAt: new Date().toISOString() })];
    const groups = groupByActor(items);
    expect(groups['uid-123']).toHaveLength(1);
  });

  it('returns empty object for no items', () => {
    expect(groupByActor([])).toEqual({});
  });
});

// ---- summarizeActivity ----

describe('summarizeActivity', () => {
  it('counts by resource.action key', () => {
    const items = [
      mockItem({ resource: 'task', action: 'created', createdAt: new Date().toISOString() }),
      mockItem({ resource: 'task', action: 'created', createdAt: new Date().toISOString() }),
      mockItem({ resource: 'doc', action: 'updated', createdAt: new Date().toISOString() }),
    ];
    const summary = summarizeActivity(items);
    expect(summary['task.created']).toBe(2);
    expect(summary['doc.updated']).toBe(1);
  });

  it('returns empty object for no items', () => {
    expect(summarizeActivity([])).toEqual({});
  });
});
