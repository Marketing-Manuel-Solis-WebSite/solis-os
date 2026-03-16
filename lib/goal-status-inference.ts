// ================================================================
// Goal Status Inference — Auto-detect at_risk / behind
// ================================================================
// Analyzes goal progress vs. due date to suggest status changes.
// Can be run as a periodic check or on-demand.

import type { GoalStatus, Goal } from '@/components/goals/constants';
import { getLatestCheckin } from './goal-checkins';

// ---- Types ----

export interface StatusInference {
  goalId: string;
  currentStatus: GoalStatus;
  suggestedStatus: GoalStatus;
  reason: string;
  confidence: number;        // 0-1, how confident we are in the suggestion
  shouldNotify: boolean;
  metrics: {
    progress: number;
    expectedProgress: number;
    daysRemaining: number;
    totalDays: number;
    velocityNeeded: number;  // progress points per day needed to finish on time
  };
}

// ---- Core Logic ----

/**
 * Infer what status a goal should have based on progress and timeline.
 */
export function inferGoalStatus(goal: {
  id: string;
  status: GoalStatus;
  progress: number;
  dueDate: string | null;
  createdAt: any;
}): StatusInference {
  const now = new Date();
  const progress = goal.progress || 0;
  const currentStatus = goal.status;

  // If already completed or cancelled, no inference needed
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return {
      goalId: goal.id,
      currentStatus,
      suggestedStatus: currentStatus,
      reason: 'Goal is already finalized',
      confidence: 1,
      shouldNotify: false,
      metrics: { progress, expectedProgress: 100, daysRemaining: 0, totalDays: 0, velocityNeeded: 0 },
    };
  }

  // If progress is 100%, suggest completed
  if (progress >= 100) {
    return {
      goalId: goal.id,
      currentStatus,
      suggestedStatus: 'completed',
      reason: 'All targets have been met (100% progress)',
      confidence: 0.95,
      shouldNotify: true, // currentStatus is not 'completed' here (already returned above)
      metrics: { progress, expectedProgress: 100, daysRemaining: 0, totalDays: 0, velocityNeeded: 0 },
    };
  }

  // No due date → can only infer from progress level
  if (!goal.dueDate) {
    if (progress >= 70) {
      return makeInference(goal.id, currentStatus, 'on_track', progress, 0, 0, 0,
        'Good progress (≥70%) with no deadline', 0.5);
    }
    return makeInference(goal.id, currentStatus, currentStatus, progress, 0, 0, 0,
      'No due date set — cannot infer timeline risk', 0.2);
  }

  // Parse dates
  const dueDate = new Date(goal.dueDate + 'T23:59:59');
  const createdAt = extractDate(goal.createdAt) || new Date(now.getTime() - 30 * 86_400_000);

  const totalDays = Math.max(daysBetween(createdAt, dueDate), 1);
  const elapsed = daysBetween(createdAt, now);
  const daysRemaining = Math.max(daysBetween(now, dueDate), 0);
  const elapsedFraction = Math.min(elapsed / totalDays, 1);

  // Expected progress based on linear timeline
  const expectedProgress = Math.round(elapsedFraction * 100);

  // Velocity needed to finish on time
  const remainingProgress = 100 - progress;
  const velocityNeeded = daysRemaining > 0 ? Math.round((remainingProgress / daysRemaining) * 10) / 10 : Infinity;

  // Past due date
  if (daysRemaining <= 0 && progress < 100) {
    return makeInference(goal.id, currentStatus, 'behind', progress, expectedProgress, daysRemaining, totalDays,
      `Past due date with ${progress}% progress`, 0.95, velocityNeeded);
  }

  // Progress gap analysis
  const gap = expectedProgress - progress;

  if (gap <= 5) {
    // On track or ahead
    return makeInference(goal.id, currentStatus, 'on_track', progress, expectedProgress, daysRemaining, totalDays,
      `Progress (${progress}%) matches or exceeds expected (${expectedProgress}%)`, 0.8, velocityNeeded);
  }

  if (gap <= 20) {
    // Slightly behind — at risk
    return makeInference(goal.id, currentStatus, 'at_risk', progress, expectedProgress, daysRemaining, totalDays,
      `Progress (${progress}%) is ${gap}pp behind expected (${expectedProgress}%)`, 0.75, velocityNeeded);
  }

  // Significantly behind
  return makeInference(goal.id, currentStatus, 'behind', progress, expectedProgress, daysRemaining, totalDays,
    `Progress (${progress}%) is ${gap}pp behind expected (${expectedProgress}%)`, 0.85, velocityNeeded);
}

/**
 * Batch inference for multiple goals.
 */
export function inferMultipleGoalStatuses(
  goals: Array<{ id: string; status: GoalStatus; progress: number; dueDate: string | null; createdAt: any }>,
): StatusInference[] {
  return goals.map(g => inferGoalStatus(g));
}

/**
 * Filter inferences to only those suggesting a change.
 */
export function getActionableInferences(inferences: StatusInference[]): StatusInference[] {
  return inferences.filter(i =>
    i.suggestedStatus !== i.currentStatus && i.confidence >= 0.5,
  );
}

/**
 * Enhanced inference that also considers latest check-in confidence.
 * Async — fetches check-in data from Firestore.
 */
export async function inferGoalStatusEnhanced(goal: {
  id: string;
  status: GoalStatus;
  progress: number;
  dueDate: string | null;
  createdAt: any;
}): Promise<StatusInference> {
  // Start with timeline-based inference
  const base = inferGoalStatus(goal);

  // Don't override finalized statuses
  if (goal.status === 'completed' || goal.status === 'cancelled') return base;

  // Fetch latest check-in for confidence signal
  try {
    const latestCheckin = await getLatestCheckin(goal.id);
    if (!latestCheckin) return base;

    // Check if recent (within 2 weeks)
    const checkinTime = latestCheckin.createdAt?.toDate?.()?.getTime()
      || (latestCheckin.createdAt?.seconds ? latestCheckin.createdAt.seconds * 1000 : 0);
    const age = Date.now() - checkinTime;
    if (age > 14 * 86_400_000) return base; // Stale check-in, ignore

    // Map confidence to status adjustment
    const confMap: Record<string, GoalStatus> = {
      on_track: 'on_track',
      at_risk: 'at_risk',
      off_track: 'behind',
    };
    const checkinSuggestion = confMap[latestCheckin.confidence];
    if (!checkinSuggestion) return base;

    // If check-in and timeline agree, boost confidence
    if (checkinSuggestion === base.suggestedStatus) {
      return { ...base, confidence: Math.min(base.confidence + 0.1, 0.98) };
    }

    // If check-in disagrees, blend — check-in is weighted 40% (human signal)
    // Only override if check-in is "worse" (more pessimistic) than timeline
    const severity: Record<GoalStatus, number> = { on_track: 0, at_risk: 1, behind: 2, completed: -1, cancelled: -1 };
    const baseSeverity = severity[base.suggestedStatus] ?? 0;
    const checkinSeverity = severity[checkinSuggestion] ?? 0;

    if (checkinSeverity > baseSeverity) {
      // Check-in is more pessimistic — trust human signal
      return {
        ...base,
        suggestedStatus: checkinSuggestion,
        reason: `${base.reason}. Latest check-in: ${latestCheckin.confidence}`,
        confidence: Math.min(base.confidence + 0.05, 0.95),
        shouldNotify: checkinSuggestion !== goal.status,
      };
    }

    return base;
  } catch {
    return base;
  }
}

// ---- OKR Roll-up ----

/**
 * Compute the rolled-up progress of an objective from its key results.
 *
 * Finds all goals where `parentGoalId === objectiveId` and `goalType === 'key_result'`,
 * then averages their progress. If no KRs exist, returns the objective's own progress.
 *
 * @param objectiveId - The ID of the objective goal
 * @param allGoals    - Full list of goals (must include potential KR children)
 * @returns Rounded average progress (0-100)
 */
export function inferOKRProgress(objectiveId: string, allGoals: Goal[]): number {
  const objective = allGoals.find(g => g.id === objectiveId);
  const keyResults = allGoals.filter(
    g => g.parentGoalId === objectiveId && g.goalType === 'key_result',
  );

  if (keyResults.length === 0) {
    // No key results — return the objective's own progress
    return objective?.progress ?? 0;
  }

  const total = keyResults.reduce((sum, kr) => sum + (kr.progress || 0), 0);
  return Math.round(total / keyResults.length);
}

// ---- Helpers ----

function extractDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function makeInference(
  goalId: string,
  currentStatus: GoalStatus,
  suggestedStatus: GoalStatus,
  progress: number,
  expectedProgress: number,
  daysRemaining: number,
  totalDays: number,
  reason: string,
  confidence: number,
  velocityNeeded: number = 0,
): StatusInference {
  return {
    goalId,
    currentStatus,
    suggestedStatus,
    reason,
    confidence,
    shouldNotify: suggestedStatus !== currentStatus,
    metrics: { progress, expectedProgress, daysRemaining, totalDays, velocityNeeded },
  };
}
