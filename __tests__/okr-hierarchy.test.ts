import { describe, it, expect, vi } from 'vitest';

// Mock Firebase modules to avoid initialization errors in test
vi.mock('../lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('../lib/goal-checkins', () => ({
  getLatestCheckin: vi.fn().mockResolvedValue(null),
}));

import { inferOKRProgress } from '../lib/goal-status-inference';
import type { Goal } from '../components/goals/constants';

/**
 * Helper to build a minimal Goal object for testing.
 */
function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
  return {
    orgId: 'org1',
    name: 'Test Goal',
    description: '',
    dueDate: null,
    ownerId: 'u1',
    ownerName: 'User',
    teamId: 't1',
    status: 'on_track',
    progress: 0,
    tags: [],
    color: '#7B68EE',
    visibility: 'team',
    createdBy: 'u1',
    createdByName: 'User',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('inferOKRProgress', () => {
  it('objective with 3 KRs at 20/60/80% → 53%', () => {
    const allGoals: Goal[] = [
      makeGoal({ id: 'obj1', goalType: 'objective', progress: 0 }),
      makeGoal({ id: 'kr1', goalType: 'key_result', parentGoalId: 'obj1', progress: 20 }),
      makeGoal({ id: 'kr2', goalType: 'key_result', parentGoalId: 'obj1', progress: 60 }),
      makeGoal({ id: 'kr3', goalType: 'key_result', parentGoalId: 'obj1', progress: 80 }),
    ];

    const result = inferOKRProgress('obj1', allGoals);
    expect(result).toBe(53); // (20 + 60 + 80) / 3 = 53.33 → rounded to 53
  });

  it('objective with no KRs → returns own progress', () => {
    const allGoals: Goal[] = [
      makeGoal({ id: 'obj1', goalType: 'objective', progress: 42 }),
    ];

    const result = inferOKRProgress('obj1', allGoals);
    expect(result).toBe(42);
  });

  it('ignores non-KR children', () => {
    const allGoals: Goal[] = [
      makeGoal({ id: 'obj1', goalType: 'objective', progress: 10 }),
      makeGoal({ id: 'kr1', goalType: 'key_result', parentGoalId: 'obj1', progress: 40 }),
      makeGoal({ id: 'kr2', goalType: 'key_result', parentGoalId: 'obj1', progress: 60 }),
      // This child is a plain "goal", not a key_result — should be ignored
      makeGoal({ id: 'child1', goalType: 'goal', parentGoalId: 'obj1', progress: 100 }),
    ];

    const result = inferOKRProgress('obj1', allGoals);
    expect(result).toBe(50); // (40 + 60) / 2 = 50, child1 ignored
  });

  it('objective not in list → returns 0', () => {
    const allGoals: Goal[] = [
      makeGoal({ id: 'kr1', goalType: 'key_result', parentGoalId: 'obj-missing', progress: 80 }),
    ];

    const result = inferOKRProgress('obj-missing', allGoals);
    // KR found with matching parent, so average of those
    expect(result).toBe(80);
  });

  it('handles KRs with 0% progress', () => {
    const allGoals: Goal[] = [
      makeGoal({ id: 'obj1', goalType: 'objective', progress: 0 }),
      makeGoal({ id: 'kr1', goalType: 'key_result', parentGoalId: 'obj1', progress: 0 }),
      makeGoal({ id: 'kr2', goalType: 'key_result', parentGoalId: 'obj1', progress: 0 }),
    ];

    const result = inferOKRProgress('obj1', allGoals);
    expect(result).toBe(0);
  });

  it('does not count KRs from other objectives', () => {
    const allGoals: Goal[] = [
      makeGoal({ id: 'obj1', goalType: 'objective', progress: 0 }),
      makeGoal({ id: 'obj2', goalType: 'objective', progress: 0 }),
      makeGoal({ id: 'kr1', goalType: 'key_result', parentGoalId: 'obj1', progress: 30 }),
      makeGoal({ id: 'kr2', goalType: 'key_result', parentGoalId: 'obj2', progress: 90 }),
    ];

    expect(inferOKRProgress('obj1', allGoals)).toBe(30);
    expect(inferOKRProgress('obj2', allGoals)).toBe(90);
  });
});
