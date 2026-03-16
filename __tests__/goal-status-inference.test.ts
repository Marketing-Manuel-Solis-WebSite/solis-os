import { describe, it, expect } from 'vitest';
import {
  inferGoalStatus,
  inferMultipleGoalStatuses,
  getActionableInferences,
} from '../lib/goal-status-inference';

describe('Goal Status Inference', () => {
  it('returns completed status for finalized goal', () => {
    const result = inferGoalStatus({
      id: 'g1', status: 'completed', progress: 100,
      dueDate: '2026-03-01', createdAt: { seconds: Date.now() / 1000 },
    });
    expect(result.suggestedStatus).toBe('completed');
    expect(result.shouldNotify).toBe(false);
    expect(result.confidence).toBe(1);
  });

  it('suggests completed when progress is 100%', () => {
    const result = inferGoalStatus({
      id: 'g1', status: 'on_track', progress: 100,
      dueDate: '2026-06-01', createdAt: { seconds: Date.now() / 1000 },
    });
    expect(result.suggestedStatus).toBe('completed');
    expect(result.shouldNotify).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('suggests behind when past due date', () => {
    const result = inferGoalStatus({
      id: 'g1', status: 'on_track', progress: 50,
      dueDate: '2020-01-01',
      createdAt: { seconds: new Date(2019, 6, 1).getTime() / 1000 },
    });
    expect(result.suggestedStatus).toBe('behind');
    expect(result.shouldNotify).toBe(true);
    expect(result.metrics.daysRemaining).toBe(0);
  });

  it('suggests on_track when progress matches timeline', () => {
    // Goal: created 30 days ago, due 30 days from now, 50% done
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86_400_000);
    const dueDate = thirtyDaysFromNow.toISOString().split('T')[0];

    const result = inferGoalStatus({
      id: 'g1', status: 'on_track', progress: 50,
      dueDate,
      createdAt: { toDate: () => thirtyDaysAgo },
    });
    expect(result.suggestedStatus).toBe('on_track');
  });

  it('suggests at_risk when slightly behind', () => {
    // Goal: created 30 days ago, due 10 days from now, only 30% done
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const tenDaysFromNow = new Date(Date.now() + 10 * 86_400_000);
    const dueDate = tenDaysFromNow.toISOString().split('T')[0];

    const result = inferGoalStatus({
      id: 'g1', status: 'on_track', progress: 30,
      dueDate,
      createdAt: { toDate: () => thirtyDaysAgo },
    });
    // Expected progress ~75%, actual 30%, gap ~45% → behind
    expect(['at_risk', 'behind']).toContain(result.suggestedStatus);
    expect(result.shouldNotify).toBe(true);
  });

  it('handles no due date gracefully', () => {
    const result = inferGoalStatus({
      id: 'g1', status: 'on_track', progress: 80,
      dueDate: null, createdAt: { seconds: Date.now() / 1000 },
    });
    expect(result.suggestedStatus).toBe('on_track');
    expect(result.confidence).toBeLessThan(1);
  });

  it('provides velocity metrics', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86_400_000);

    const result = inferGoalStatus({
      id: 'g1', status: 'on_track', progress: 40,
      dueDate: thirtyDaysFromNow.toISOString().split('T')[0],
      createdAt: { toDate: () => sixtyDaysAgo },
    });

    expect(result.metrics.progress).toBe(40);
    expect(result.metrics.daysRemaining).toBeGreaterThan(0);
    expect(result.metrics.velocityNeeded).toBeGreaterThan(0);
  });
});

describe('Goal Status Inference — batch', () => {
  it('infers multiple goals', () => {
    const goals = [
      { id: 'g1', status: 'on_track' as const, progress: 100, dueDate: null, createdAt: null },
      { id: 'g2', status: 'on_track' as const, progress: 10, dueDate: '2020-01-01', createdAt: { seconds: new Date(2019, 0, 1).getTime() / 1000 } },
    ];

    const results = inferMultipleGoalStatuses(goals);
    expect(results).toHaveLength(2);
    expect(results[0].suggestedStatus).toBe('completed');
    expect(results[1].suggestedStatus).toBe('behind');
  });

  it('getActionableInferences filters to changes only', () => {
    const inferences = [
      { goalId: 'g1', currentStatus: 'completed' as const, suggestedStatus: 'completed' as const, reason: '', confidence: 1, shouldNotify: false, metrics: {} as any },
      { goalId: 'g2', currentStatus: 'on_track' as const, suggestedStatus: 'behind' as const, reason: '', confidence: 0.9, shouldNotify: true, metrics: {} as any },
      { goalId: 'g3', currentStatus: 'on_track' as const, suggestedStatus: 'at_risk' as const, reason: '', confidence: 0.3, shouldNotify: true, metrics: {} as any },
    ];

    const actionable = getActionableInferences(inferences);
    expect(actionable).toHaveLength(1); // Only g2 (g1 no change, g3 low confidence)
    expect(actionable[0].goalId).toBe('g2');
  });
});
