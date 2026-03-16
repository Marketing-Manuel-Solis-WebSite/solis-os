// ================================================================
// Analytics — Burndown & Velocity computation
// ================================================================
// Scalability: Pushes teamId/listId/date filters to Firestore.
// Uses streamBatches() for memory-safe iteration.
// Burndown uses pre-sorted completion dates + binary search
// instead of O(tasks × days).
// ================================================================

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { streamBatches } from '@/lib/firestore-batch-stream';



// ---- Types ----

export interface BurndownPoint {
  date: string;            // YYYY-MM-DD
  idealRemaining: number;  // linearly decreasing from total
  actualRemaining: number; // tasks not yet completed at that date
  completed: number;       // cumulative completed by that date
}

export interface BurndownData {
  sprintName: string;
  startDate: string;
  endDate: string;
  totalScope: number;
  points: BurndownPoint[];
}

export interface VelocityBucket {
  label: string;           // e.g. "Week 10" or "Sprint 3"
  startDate: string;
  endDate: string;
  completed: number;       // tasks completed in this bucket
  created: number;         // tasks created in this bucket
  netThroughput: number;   // completed - created (negative = scope creep)
}

export interface VelocityData {
  buckets: VelocityBucket[];
  avgCompleted: number;
  avgCreated: number;
  avgNetThroughput: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ---- Helpers ----

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function extractDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

/**
 * Binary search: find how many dates in a sorted array are <= target.
 */
function countLessOrEqual(sortedDates: string[], target: string): number {
  let lo = 0;
  let hi = sortedDates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedDates[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---- Burndown ----

interface BurndownAcc {
  totalScope: number;
  completionDates: string[]; // sorted array of completion date strings
}

/**
 * Compute burndown chart data for a date range.
 * Pushes teamId/listId filters to Firestore query.
 * Uses binary search over pre-sorted completion dates instead of O(tasks × days).
 */
export async function computeBurndown(
  startDate: string,
  endDate: string,
  options: { teamId?: string; listId?: string; sprintName?: string } = {},
): Promise<BurndownData> {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const totalDays = daysBetween(start, end);

  // Build query with server-side filters
  let q: FirebaseFirestore.Query = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true);

  if (options.teamId) q = q.where('teamId', '==', options.teamId);
  if (options.listId) q = q.where('listId', '==', options.listId);

  // Stream tasks, accumulate scope count and completion dates
  const acc = await streamBatches<BurndownAcc>(
    q,
    { totalScope: 0, completionDates: [] },
    (acc, t) => {
      const created = extractDate(t.createdAt);
      if (!created || created > end) return acc; // exclude tasks created after sprint end

      acc.totalScope++;

      const isDone = t.status === 'done' || t.status === 'completed';
      if (isDone) {
        const completedAt = extractDate(t.completedAt) || extractDate(t.updatedAt);
        if (completedAt) {
          acc.completionDates.push(toDateStr(completedAt));
        }
      }

      return acc;
    },
  );

  // Sort completion dates for binary search
  acc.completionDates.sort();

  const { totalScope } = acc;

  // Build points using binary search — O(days × log(completions)) instead of O(days × tasks)
  const points: BurndownPoint[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const day = addDays(start, i);
    const dayStr = toDateStr(day);

    const idealRemaining = totalScope > 0
      ? Math.round(totalScope * (1 - i / totalDays) * 10) / 10
      : 0;

    const completedByDay = countLessOrEqual(acc.completionDates, dayStr);

    points.push({
      date: dayStr,
      idealRemaining: Math.max(0, idealRemaining),
      actualRemaining: totalScope - completedByDay,
      completed: completedByDay,
    });
  }

  return {
    sprintName: options.sprintName || `Sprint ${startDate}`,
    startDate,
    endDate,
    totalScope,
    points,
  };
}

// ---- Velocity ----

interface VelocityAcc {
  // Map bucket index -> { created, completed }
  bucketCounts: Map<number, { created: number; completed: number }>;
}

/**
 * Compute weekly velocity over the last N weeks.
 * Pushes date range filter to Firestore.
 * Single-pass bucket assignment using date comparison.
 */
export async function computeVelocity(
  weeks: number = 8,
  options: { teamId?: string } = {},
): Promise<VelocityData> {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  // Build week boundaries (most recent first, then reverse)
  const buckets: VelocityBucket[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = addDays(now, -w * 7);
    const weekStart = addDays(weekEnd, -6);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    const weekNum = getISOWeek(weekStart);
    buckets.push({
      label: `W${weekNum}`,
      startDate: toDateStr(weekStart),
      endDate: toDateStr(weekEnd),
      completed: 0,
      created: 0,
      netThroughput: 0,
    });
  }

  // Build query with date range filter — only fetch tasks created/completed in range
  const rangeStart = parseDate(buckets[0].startDate);
  let q: FirebaseFirestore.Query = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true)
    .where('createdAt', '>=', rangeStart);

  if (options.teamId) q = q.where('teamId', '==', options.teamId);

  // Pre-compute bucket boundaries for fast lookup
  const bucketStarts = buckets.map(b => parseDate(b.startDate).getTime());
  const bucketEnds = buckets.map(b => {
    const d = parseDate(b.endDate);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  });

  // Find which bucket a timestamp belongs to (linear scan on small array)
  function findBucket(ts: number): number {
    for (let i = 0; i < buckets.length; i++) {
      if (ts >= bucketStarts[i] && ts <= bucketEnds[i]) return i;
    }
    return -1;
  }

  // Stream tasks and assign to buckets in single pass
  const velocityAcc = await streamBatches<VelocityAcc>(
    q,
    { bucketCounts: new Map() },
    (acc, t) => {
      const created = extractDate(t.createdAt);
      const isDone = t.status === 'done' || t.status === 'completed';
      const completed = isDone ? (extractDate(t.completedAt) || extractDate(t.updatedAt)) : null;

      if (created) {
        const bi = findBucket(created.getTime());
        if (bi >= 0) {
          const entry = acc.bucketCounts.get(bi) || { created: 0, completed: 0 };
          entry.created++;
          acc.bucketCounts.set(bi, entry);
        }
      }

      if (completed) {
        const bi = findBucket(completed.getTime());
        if (bi >= 0) {
          const entry = acc.bucketCounts.get(bi) || { created: 0, completed: 0 };
          entry.completed++;
          acc.bucketCounts.set(bi, entry);
        }
      }

      return acc;
    },
  );

  // Also query tasks completed in range but created before range
  // (they wouldn't be caught by createdAt >= rangeStart)
  try {
    const completedQuery = adminDb.collection('tasks')
      .where('orgId', '==', ORG)
      .where('deleted', '!=', true)
      .where('completedAt', '>=', rangeStart);

    await streamBatches(
      completedQuery,
      velocityAcc,
      (acc, t) => {
        const created = extractDate(t.createdAt);
        // Skip if created in range (already counted above)
        if (created && created >= rangeStart) return acc;

        const isDone = t.status === 'done' || t.status === 'completed';
        const completed = isDone ? (extractDate(t.completedAt) || extractDate(t.updatedAt)) : null;
        if (completed) {
          const bi = findBucket(completed.getTime());
          if (bi >= 0) {
            const entry = acc.bucketCounts.get(bi) || { created: 0, completed: 0 };
            entry.completed++;
            acc.bucketCounts.set(bi, entry);
          }
        }
        return acc;
      },
    );
  } catch {
    // completedAt field may not exist on all tasks — gracefully ignore
  }

  // Apply accumulated counts to buckets
  for (const [idx, counts] of velocityAcc.bucketCounts) {
    buckets[idx].created += counts.created;
    buckets[idx].completed += counts.completed;
  }

  // Compute net throughput
  for (const b of buckets) {
    b.netThroughput = b.completed - b.created;
  }

  // Aggregates
  const total = buckets.length || 1;
  const avgCompleted = Math.round(buckets.reduce((s, b) => s + b.completed, 0) / total * 10) / 10;
  const avgCreated = Math.round(buckets.reduce((s, b) => s + b.created, 0) / total * 10) / 10;
  const avgNetThroughput = Math.round(buckets.reduce((s, b) => s + b.netThroughput, 0) / total * 10) / 10;

  // Trend: compare last 3 weeks vs first 3 weeks
  const trend = computeTrend(buckets);

  return { buckets, avgCompleted, avgCreated, avgNetThroughput, trend };
}

function computeTrend(buckets: VelocityBucket[]): 'improving' | 'stable' | 'declining' {
  if (buckets.length < 4) return 'stable';
  const half = Math.floor(buckets.length / 2);
  const firstHalf = buckets.slice(0, half);
  const secondHalf = buckets.slice(half);

  const avgFirst = firstHalf.reduce((s, b) => s + b.completed, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, b) => s + b.completed, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  const threshold = Math.max(avgFirst * 0.15, 1); // 15% change threshold

  if (diff > threshold) return 'improving';
  if (diff < -threshold) return 'declining';
  return 'stable';
}

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
