// ================================================================
// Analytics — Burndown & Velocity computation
// ================================================================
// Computes sprint burndown data (ideal vs actual remaining work)
// and rolling velocity metrics for team performance tracking.

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';



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

// ---- Burndown ----

/**
 * Compute burndown chart data for a date range.
 * Uses tasks filtered by teamId (optional) within the date range.
 */
export async function computeBurndown(
  startDate: string,
  endDate: string,
  options: { teamId?: string; listId?: string; sprintName?: string } = {},
): Promise<BurndownData> {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const totalDays = daysBetween(start, end);

  // Fetch tasks in scope — created before or during the sprint
  let q = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true);

  const snap = await q.get();

  // Filter in memory for flexibility (teamId, listId, date range)
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(t => {
    if (options.teamId && t.teamId !== options.teamId) return false;
    if (options.listId && t.listId !== options.listId) return false;
    const created = extractDate(t.createdAt);
    if (!created || created > end) return false; // exclude tasks created after sprint end
    return true;
  });

  const totalScope = tasks.length;

  // For each day in range, compute remaining and completed
  const points: BurndownPoint[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const day = addDays(start, i);
    const dayStr = toDateStr(day);

    // Ideal: linear from totalScope to 0
    const idealRemaining = totalScope > 0
      ? Math.round(totalScope * (1 - i / totalDays) * 10) / 10
      : 0;

    // Actual: count tasks NOT completed by this date
    let completedByDay = 0;
    for (const t of tasks) {
      const isDone = t.status === 'done' || t.status === 'completed';
      if (!isDone) continue;
      const completedAt = extractDate(t.completedAt) || extractDate(t.updatedAt);
      if (completedAt && toDateStr(completedAt) <= dayStr) {
        completedByDay++;
      }
    }

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

/**
 * Compute weekly velocity over the last N weeks.
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

  // Fetch all tasks
  const rangeStart = parseDate(buckets[0].startDate);
  let q = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true);

  const snap = await q.get();
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(t => {
    if (options.teamId && t.teamId !== options.teamId) return false;
    return true;
  });

  // Assign tasks to buckets
  for (const t of tasks) {
    const created = extractDate(t.createdAt);
    const isDone = t.status === 'done' || t.status === 'completed';
    const completed = isDone ? (extractDate(t.completedAt) || extractDate(t.updatedAt)) : null;

    for (const b of buckets) {
      const bStart = parseDate(b.startDate);
      const bEnd = parseDate(b.endDate);
      bEnd.setHours(23, 59, 59, 999);

      if (created && created >= bStart && created <= bEnd) {
        b.created++;
      }
      if (completed && completed >= bStart && completed <= bEnd) {
        b.completed++;
      }
    }
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
