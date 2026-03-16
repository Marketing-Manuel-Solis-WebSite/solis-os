import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (k: string) => k, lang: 'en' }),
}));

vi.mock('@/lib/workload-utils', () => ({
  DEFAULT_CAPACITY: 40,
}));

import { calculateCapacity } from '../components/tasks/task-team-view';

const mockTask = (timeEstimate: number | null = null) => ({
  id: `t${Math.random()}`,
  title: 'Test Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  type: 'task',
  visibility: 'team',
  assignees: ['u1'],
  tags: [],
  teamId: 'team1',
  createdBy: 'u1',
  timeEstimate,
  subtasks: [],
  checklist: [],
  attachments: [],
  dependencies: [],
  customFields: {},
  watchers: [],
  archived: false,
});

describe('calculateCapacity', () => {
  it('returns underload with 0 tasks', () => {
    const result = calculateCapacity([], 40);
    expect(result.totalEstimateMinutes).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.status).toBe('underload');
  });

  it('returns optimal for 80% capacity (32h of 40h)', () => {
    const tasks = [mockTask(32 * 60)]; // 32 hours in minutes
    const result = calculateCapacity(tasks, 40);
    expect(result.totalEstimateMinutes).toBe(1920);
    expect(result.percentage).toBe(80);
    expect(result.status).toBe('optimal');
  });

  it('returns overload for >100% capacity (48h of 40h)', () => {
    const tasks = [mockTask(48 * 60)]; // 48 hours in minutes
    const result = calculateCapacity(tasks, 40);
    expect(result.totalEstimateMinutes).toBe(2880);
    expect(result.percentage).toBe(120);
    expect(result.status).toBe('overload');
  });

  it('treats null timeEstimate as 0', () => {
    const tasks = [mockTask(null), mockTask(null)];
    const result = calculateCapacity(tasks, 40);
    expect(result.totalEstimateMinutes).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.status).toBe('underload');
  });

  it('sums multiple tasks', () => {
    const tasks = [mockTask(600), mockTask(600), mockTask(600)]; // 10h each = 30h total
    const result = calculateCapacity(tasks, 40);
    expect(result.totalEstimateMinutes).toBe(1800);
    expect(result.percentage).toBe(75);
    expect(result.status).toBe('optimal');
  });
});
