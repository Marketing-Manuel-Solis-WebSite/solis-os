// ================================================================
// Analytics — SLA & Response Time Metrics
// ================================================================
// Scalability: Pushes teamId/date filters to Firestore queries.
// Uses streamBatches() for memory-safe iteration.
// ================================================================

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { streamBatches } from '@/lib/firestore-batch-stream';



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

// ---- SLA accumulator ----
interface SLAAcc {
  totalEvaluated: number;
  responseTimeMet: number;
  responseTimeBreached: number;
  resolutionTimeMet: number;
  resolutionTimeBreached: number;
  cycleTimes: number[];
  responseTimes: number[];
  byPriority: Record<string, { total: number; resolutionMet: number; resolutionBreached: number; cycleTimes: number[] }>;
  currentlyBreaching: { id: string; title: string; priority: string; hoursOverdue: number }[];
}

// ---- Main Computation ----

/**
 * Compute SLA metrics for a given date range.
 * Pushes teamId and date filters to Firestore queries.
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

  // Build query with server-side filters
  let q: FirebaseFirestore.Query = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true);

  if (options.teamId) q = q.where('teamId', '==', options.teamId);
  if (options.startDate) q = q.where('createdAt', '>=', new Date(options.startDate));
  if (options.endDate) q = q.where('createdAt', '<=', new Date(options.endDate + 'T23:59:59'));

  const acc = await streamBatches<SLAAcc>(
    q,
    {
      totalEvaluated: 0,
      responseTimeMet: 0,
      responseTimeBreached: 0,
      resolutionTimeMet: 0,
      resolutionTimeBreached: 0,
      cycleTimes: [],
      responseTimes: [],
      byPriority: {},
      currentlyBreaching: [],
    },
    (acc, t, docId) => {
      const created = extractDate(t.createdAt);
      if (!created) return acc;

      acc.totalEvaluated++;
      const priority = t.priority || 'medium';
      const isDone = t.status === 'done' || t.status === 'completed';
      const completed = isDone ? (extractDate(t.completedAt) || extractDate(t.updatedAt)) : null;

      // Initialize priority bucket
      if (!acc.byPriority[priority]) {
        acc.byPriority[priority] = { total: 0, resolutionMet: 0, resolutionBreached: 0, cycleTimes: [] };
      }
      acc.byPriority[priority].total++;

      // Response time: creation → first assignment
      const hasAssignee = t.assignees?.length > 0;
      if (hasAssignee) {
        const assignedAt = extractDate(t.assignedAt) || extractDate(t.updatedAt) || created;
        const responseHours = hoursBetween(created, assignedAt);
        acc.responseTimes.push(responseHours);

        if (responseHours <= sla.responseTimeHours) {
          acc.responseTimeMet++;
        } else {
          acc.responseTimeBreached++;
        }
      }

      // Resolution time
      const maxResolutionHours = sla.resolutionTimeHours[priority] || sla.resolutionTimeHours['medium'] || 72;

      if (completed) {
        const cycleHours = hoursBetween(created, completed);
        acc.cycleTimes.push(cycleHours);
        acc.byPriority[priority].cycleTimes.push(cycleHours);

        if (cycleHours <= maxResolutionHours) {
          acc.resolutionTimeMet++;
          acc.byPriority[priority].resolutionMet++;
        } else {
          acc.resolutionTimeBreached++;
          acc.byPriority[priority].resolutionBreached++;
        }
      } else {
        // Check if currently breaching
        const elapsedHours = hoursBetween(created, now);
        if (elapsedHours > maxResolutionHours) {
          acc.resolutionTimeBreached++;
          acc.byPriority[priority].resolutionBreached++;
          if (acc.currentlyBreaching.length < 20) {
            acc.currentlyBreaching.push({
              id: docId,
              title: t.title || 'Untitled',
              priority,
              hoursOverdue: Math.round((elapsedHours - maxResolutionHours) * 10) / 10,
            });
          }
        }
      }

      return acc;
    },
  );

  const totalWithResponse = acc.responseTimeMet + acc.responseTimeBreached;
  const totalWithResolution = acc.resolutionTimeMet + acc.resolutionTimeBreached;

  // Build priority summary
  const byPrioritySummary: SLAMetrics['byPriority'] = {};
  for (const [p, data] of Object.entries(acc.byPriority)) {
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
  acc.currentlyBreaching.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

  return {
    totalEvaluated: acc.totalEvaluated,
    responseTimeMet: acc.responseTimeMet,
    responseTimeBreached: acc.responseTimeBreached,
    responseTimeRate: totalWithResponse > 0 ? Math.round((acc.responseTimeMet / totalWithResponse) * 100) : 100,
    resolutionTimeMet: acc.resolutionTimeMet,
    resolutionTimeBreached: acc.resolutionTimeBreached,
    resolutionTimeRate: totalWithResolution > 0 ? Math.round((acc.resolutionTimeMet / totalWithResolution) * 100) : 100,
    overallComplianceRate: acc.totalEvaluated > 0
      ? Math.round(((acc.responseTimeMet + acc.resolutionTimeMet) / (totalWithResponse + totalWithResolution || 1)) * 100)
      : 100,
    avgCycleTimeHours: acc.cycleTimes.length > 0
      ? Math.round(acc.cycleTimes.reduce((s, v) => s + v, 0) / acc.cycleTimes.length * 10) / 10
      : 0,
    medianCycleTimeHours: median(acc.cycleTimes),
    avgResponseTimeHours: acc.responseTimes.length > 0
      ? Math.round(acc.responseTimes.reduce((s, v) => s + v, 0) / acc.responseTimes.length * 10) / 10
      : 0,
    byPriority: byPrioritySummary,
    currentlyBreaching: acc.currentlyBreaching,
  };
}
