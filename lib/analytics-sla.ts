// ================================================================
// Analytics — SLA & Response Time Metrics
// ================================================================
// Computes SLA compliance, response times, and cycle times
// for tasks across the organization.

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export interface SLAConfig {
  /** Max hours from creation to first assignment */
  responseTimeHours: number;
  /** Max hours from creation to completion by priority */
  resolutionTimeHours: Record<string, number>;
}

export const DEFAULT_SLA: SLAConfig = {
  responseTimeHours: 4,
  resolutionTimeHours: {
    urgent: 8,
    high: 24,
    medium: 72,
    low: 168, // 7 days
  },
};

export interface SLAMetrics {
  /** Total tasks evaluated */
  totalEvaluated: number;
  /** Tasks that met response time SLA */
  responseTimeMet: number;
  responseTimeBreached: number;
  responseTimeRate: number;
  /** Tasks that met resolution time SLA */
  resolutionTimeMet: number;
  resolutionTimeBreached: number;
  resolutionTimeRate: number;
  /** Overall SLA compliance rate (both met) */
  overallComplianceRate: number;
  /** Average cycle time in hours (creation → completion) */
  avgCycleTimeHours: number;
  /** Median cycle time in hours */
  medianCycleTimeHours: number;
  /** Average response time in hours (creation → first assignment) */
  avgResponseTimeHours: number;
  /** Breakdown by priority */
  byPriority: Record<string, {
    total: number;
    resolutionMet: number;
    resolutionBreached: number;
    avgCycleHours: number;
  }>;
  /** Tasks currently breaching SLA (overdue on resolution) */
  currentlyBreaching: { id: string; title: string; priority: string; hoursOverdue: number }[];
}

// ---- Helpers ----

function extractDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 10) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

// ---- Main Computation ----

/**
 * Compute SLA metrics for a given date range.
 */
export async function computeSLAMetrics(
  options: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    slaConfig?: SLAConfig;
  } = {},
): Promise<SLAMetrics> {
  const sla = options.slaConfig || DEFAULT_SLA;
  const now = new Date();

  const snap = await adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true)
    .get();

  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(t => {
    if (options.teamId && t.teamId !== options.teamId) return false;
    const created = extractDate(t.createdAt);
    if (!created) return false;
    if (options.startDate && created < new Date(options.startDate)) return false;
    if (options.endDate && created > new Date(options.endDate + 'T23:59:59')) return false;
    return true;
  });

  let responseTimeMet = 0;
  let responseTimeBreached = 0;
  let resolutionTimeMet = 0;
  let resolutionTimeBreached = 0;
  const cycleTimes: number[] = [];
  const responseTimes: number[] = [];
  const byPriority: Record<string, { total: number; resolutionMet: number; resolutionBreached: number; cycleTimes: number[] }> = {};
  const currentlyBreaching: SLAMetrics['currentlyBreaching'] = [];

  for (const t of tasks) {
    const created = extractDate(t.createdAt)!;
    const priority = t.priority || 'medium';
    const isDone = t.status === 'done' || t.status === 'completed';
    const completed = isDone ? (extractDate(t.completedAt) || extractDate(t.updatedAt)) : null;

    // Initialize priority bucket
    if (!byPriority[priority]) {
      byPriority[priority] = { total: 0, resolutionMet: 0, resolutionBreached: 0, cycleTimes: [] };
    }
    byPriority[priority].total++;

    // Response time: creation → first assignment
    const hasAssignee = t.assignees?.length > 0;
    if (hasAssignee) {
      // Use assignedAt if available, else estimate via updatedAt
      const assignedAt = extractDate(t.assignedAt) || extractDate(t.updatedAt) || created;
      const responseHours = hoursBetween(created, assignedAt);
      responseTimes.push(responseHours);

      if (responseHours <= sla.responseTimeHours) {
        responseTimeMet++;
      } else {
        responseTimeBreached++;
      }
    }

    // Resolution time
    const maxResolutionHours = sla.resolutionTimeHours[priority] || sla.resolutionTimeHours['medium'] || 72;

    if (completed) {
      const cycleHours = hoursBetween(created, completed);
      cycleTimes.push(cycleHours);
      byPriority[priority].cycleTimes.push(cycleHours);

      if (cycleHours <= maxResolutionHours) {
        resolutionTimeMet++;
        byPriority[priority].resolutionMet++;
      } else {
        resolutionTimeBreached++;
        byPriority[priority].resolutionBreached++;
      }
    } else {
      // Check if currently breaching
      const elapsedHours = hoursBetween(created, now);
      if (elapsedHours > maxResolutionHours) {
        resolutionTimeBreached++;
        byPriority[priority].resolutionBreached++;
        if (currentlyBreaching.length < 20) {
          currentlyBreaching.push({
            id: t.id,
            title: t.title || 'Untitled',
            priority,
            hoursOverdue: Math.round((elapsedHours - maxResolutionHours) * 10) / 10,
          });
        }
      }
    }
  }

  const totalEvaluated = tasks.length;
  const totalWithResponse = responseTimeMet + responseTimeBreached;
  const totalWithResolution = resolutionTimeMet + resolutionTimeBreached;

  // Build priority summary
  const byPrioritySummary: SLAMetrics['byPriority'] = {};
  for (const [p, data] of Object.entries(byPriority)) {
    byPrioritySummary[p] = {
      total: data.total,
      resolutionMet: data.resolutionMet,
      resolutionBreached: data.resolutionBreached,
      avgCycleHours: data.cycleTimes.length > 0
        ? Math.round(data.cycleTimes.reduce((s, v) => s + v, 0) / data.cycleTimes.length * 10) / 10
        : 0,
    };
  }

  // Sort breaching by hours overdue (worst first)
  currentlyBreaching.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

  return {
    totalEvaluated,
    responseTimeMet,
    responseTimeBreached,
    responseTimeRate: totalWithResponse > 0 ? Math.round((responseTimeMet / totalWithResponse) * 100) : 100,
    resolutionTimeMet,
    resolutionTimeBreached,
    resolutionTimeRate: totalWithResolution > 0 ? Math.round((resolutionTimeMet / totalWithResolution) * 100) : 100,
    overallComplianceRate: totalEvaluated > 0
      ? Math.round(((responseTimeMet + resolutionTimeMet) / (totalWithResponse + totalWithResolution || 1)) * 100)
      : 100,
    avgCycleTimeHours: cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((s, v) => s + v, 0) / cycleTimes.length * 10) / 10
      : 0,
    medianCycleTimeHours: median(cycleTimes),
    avgResponseTimeHours: responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length * 10) / 10
      : 0,
    byPriority: byPrioritySummary,
    currentlyBreaching,
  };
}
