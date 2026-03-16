// ================================================================
// Analytics Snapshot computation — shared by API route and cron
// ================================================================
// Scalability: Uses streamBatches() to process collections in chunks
// of 1,000 docs. Uses .count().get() for pure-count collections.
// Never loads more than 1,000 docs into memory at once.
// ================================================================

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import { streamBatches, countQuery } from '@/lib/firestore-batch-stream';



export interface AnalyticsSnapshot {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  overdueTasks: number;
  completedLast7d: number;
  createdLast7d: number;
  completedLast30d: number;
  createdLast30d: number;
  totalGoals: number;
  goalsByStatus: Record<string, number>;
  goalsAtRisk: number;
  avgGoalProgress: number;
  totalHoursLast7d: number;
  totalHoursLast30d: number;
  billableHoursLast30d: number;
  nonBillableHoursLast30d: number;
  totalDocs: number;
  totalWords: number;
  docsByVisibility: Record<string, number>;
  topDocuments: { id: string; title: string; wordCount: number; teamName: string; visibility: string }[];
  totalMembers: number;
  activeMembers: number;
  membersByRole: Record<string, number>;
  actionsLast7d: number;
  actionsLast30d: number;
  activityByDay: Record<string, number>;
  activityByAction: Record<string, number>;
  recentLogs: { id: string; actorName: string; action: string; resource: string; detail: string }[];
  aiConversationsTotal: number;
  webhookEventsProcessed: number;
  webhookEventsFailed: number;
  automationRunsLast7d: number;
  automationFailuresLast7d: number;
  departments: { id: string; name: string; icon: string; color: string }[];
  deptMetrics: Record<string, { tasks: number; completed: number; rate: number; docs: number; members: number; words: number }>;
  totalChannels: number;
  computedAt: string;
}

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgoISO(days: number): string {
  return daysAgoDate(days).toISOString().split('T')[0];
}

// ---- Task accumulator ----
interface TaskAcc {
  total: number;
  completedTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  overdueTasks: number;
  completedLast7d: number;
  createdLast7d: number;
  completedLast30d: number;
  createdLast30d: number;
  deptTasks: Record<string, number>;
  deptCompleted: Record<string, number>;
}

// ---- Goal accumulator ----
interface GoalAcc {
  total: number;
  goalsByStatus: Record<string, number>;
  goalsAtRisk: number;
  totalProgress: number;
}

// ---- Time entry accumulator ----
interface TimeAcc {
  totalHoursLast7d: number;
  totalHoursLast30d: number;
  billableHoursLast30d: number;
  nonBillableHoursLast30d: number;
}

// ---- Doc accumulator ----
interface DocAcc {
  total: number;
  totalWords: number;
  docsByVisibility: Record<string, number>;
  topDocs: { id: string; title: string; wordCount: number; teamId: string; visibility: string }[];
  deptDocs: Record<string, number>;
  deptWords: Record<string, number>;
}

function extractDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export async function computeSnapshot(): Promise<AnalyticsSnapshot> {
  const now = new Date();
  const d7 = daysAgoDate(7);
  const d30 = daysAgoDate(30);
  const d7iso = daysAgoISO(7);
  const d30iso = daysAgoISO(30);
  const todayStr = now.toISOString().split('T')[0];

  // ---- TEAMS (small collection, always fits in memory) ----
  const teamsSnap = await adminDb.collection(`orgs/${ORG}/teams`).get();
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // ---- TASKS (streamed in batches) ----
  const tasksQuery = adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true);

  const taskAcc = await streamBatches<TaskAcc>(
    tasksQuery,
    {
      total: 0, completedTasks: 0,
      tasksByStatus: {}, tasksByPriority: {},
      overdueTasks: 0,
      completedLast7d: 0, createdLast7d: 0,
      completedLast30d: 0, createdLast30d: 0,
      deptTasks: {}, deptCompleted: {},
    },
    (acc, t) => {
      acc.total++;
      const status = t.status || 'unknown';
      acc.tasksByStatus[status] = (acc.tasksByStatus[status] || 0) + 1;

      const priority = t.priority || 'medium';
      acc.tasksByPriority[priority] = (acc.tasksByPriority[priority] || 0) + 1;

      const isDone = status === 'done' || status === 'completed';
      if (isDone) acc.completedTasks++;

      if (!isDone && t.dueDate && t.dueDate < todayStr) {
        acc.overdueTasks++;
      }

      const tid = t.teamId || '__unassigned';
      acc.deptTasks[tid] = (acc.deptTasks[tid] || 0) + 1;
      if (isDone) acc.deptCompleted[tid] = (acc.deptCompleted[tid] || 0) + 1;

      const createdAt = extractDate(t.createdAt);
      const completedAt = extractDate(t.completedAt);

      if (createdAt && createdAt >= d7) acc.createdLast7d++;
      if (createdAt && createdAt >= d30) acc.createdLast30d++;
      if (isDone && completedAt && completedAt >= d7) acc.completedLast7d++;
      if (isDone && completedAt && completedAt >= d30) acc.completedLast30d++;

      return acc;
    },
  );

  const completionRate = taskAcc.total > 0 ? Math.round((taskAcc.completedTasks / taskAcc.total) * 100) : 0;

  // ---- GOALS (streamed in batches) ----
  const goalsQuery = adminDb.collection('goals').where('orgId', '==', ORG);

  const goalAcc = await streamBatches<GoalAcc>(
    goalsQuery,
    { total: 0, goalsByStatus: {}, goalsAtRisk: 0, totalProgress: 0 },
    (acc, g) => {
      acc.total++;
      const status = g.status || 'active';
      acc.goalsByStatus[status] = (acc.goalsByStatus[status] || 0) + 1;
      if (status === 'at_risk' || status === 'behind') acc.goalsAtRisk++;
      acc.totalProgress += g.progress || 0;
      return acc;
    },
  );

  // ---- TIME ENTRIES (streamed, filtered by date at query level) ----
  const teQuery = adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .where('date', '>=', d30iso);

  const timeAcc = await streamBatches<TimeAcc>(
    teQuery,
    { totalHoursLast7d: 0, totalHoursLast30d: 0, billableHoursLast30d: 0, nonBillableHoursLast30d: 0 },
    (acc, te) => {
      const mins = (te.hours || 0) * 60 + (te.minutes || 0);
      const date = te.date || '';
      if (date >= d7iso) acc.totalHoursLast7d += mins;
      acc.totalHoursLast30d += mins;
      if (te.billable) acc.billableHoursLast30d += mins;
      else acc.nonBillableHoursLast30d += mins;
      return acc;
    },
  );

  // ---- DOCS (streamed in batches) ----
  const docsQuery = adminDb.collection('documents').where('orgId', '==', ORG);

  const docAcc = await streamBatches<DocAcc>(
    docsQuery,
    { total: 0, totalWords: 0, docsByVisibility: {}, topDocs: [], deptDocs: {}, deptWords: {} },
    (acc, d, docId) => {
      acc.total++;
      acc.totalWords += d.wordCount || 0;

      const vis = d.visibility || 'team';
      acc.docsByVisibility[vis] = (acc.docsByVisibility[vis] || 0) + 1;

      const tid = d.teamId || '__unassigned';
      acc.deptDocs[tid] = (acc.deptDocs[tid] || 0) + 1;
      acc.deptWords[tid] = (acc.deptWords[tid] || 0) + (d.wordCount || 0);

      // Maintain top 10 docs by word count (insertion sort on small array)
      const wc = d.wordCount || 0;
      if (acc.topDocs.length < 10 || wc > (acc.topDocs[acc.topDocs.length - 1]?.wordCount || 0)) {
        acc.topDocs.push({ id: docId, title: d.title || 'Untitled', wordCount: wc, teamId: d.teamId || '', visibility: vis });
        acc.topDocs.sort((a, b) => b.wordCount - a.wordCount);
        if (acc.topDocs.length > 10) acc.topDocs.pop();
      }

      return acc;
    },
  );

  const topDocuments = docAcc.topDocs.map(d => ({
    ...d,
    teamName: teamMap.get(d.teamId)?.name || 'Unassigned',
  }));

  // ---- MEMBERS (small collection, always fits) ----
  const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).get();
  const membersData = membersSnap.docs.map(d => d.data());
  const activeMembers = membersData.filter(d => d.active !== false).length;

  const membersByRole: Record<string, number> = {};
  membersData.forEach(m => {
    const r = m.role || 'member';
    membersByRole[r] = (membersByRole[r] || 0) + 1;
  });

  const deptMembers: Record<string, number> = {};
  membersData.forEach(m => {
    const tid = m.teamId || '__unassigned';
    deptMembers[tid] = (deptMembers[tid] || 0) + 1;
  });

  // ---- BUILD DEPARTMENT METRICS ----
  const departments = teams.map(t => ({ id: t.id, name: t.name || t.id, icon: t.icon || '', color: t.color || '#6B7280' }));
  const deptMetrics: Record<string, { tasks: number; completed: number; rate: number; docs: number; members: number; words: number }> = {};
  for (const t of teams) {
    const tTotal = taskAcc.deptTasks[t.id] || 0;
    const tDone = taskAcc.deptCompleted[t.id] || 0;
    deptMetrics[t.id] = {
      tasks: tTotal,
      completed: tDone,
      rate: tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0,
      docs: docAcc.deptDocs[t.id] || 0,
      members: deptMembers[t.id] || 0,
      words: docAcc.deptWords[t.id] || 0,
    };
  }

  // ---- ACTIVITY (eventLogs — already capped at 500, OK to load) ----
  let actionsLast7d = 0, actionsLast30d = 0;
  const activityByDay: Record<string, number> = {};
  const activityByAction: Record<string, number> = {};
  const recentLogs: { id: string; actorName: string; action: string; resource: string; detail: string }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toLocaleDateString('en-US', { weekday: 'short' });
    activityByDay[key] = 0;
  }

  try {
    const logsSnap = await adminDb.collection(`orgs/${ORG}/eventLogs`)
      .where('createdAt', '>=', d30)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    for (const l of logsSnap.docs) {
      const data = l.data();
      actionsLast30d++;
      const ts = data.createdAt?.toDate?.();
      if (ts && ts >= d7) {
        actionsLast7d++;
        const key = ts.toLocaleDateString('en-US', { weekday: 'short' });
        if (activityByDay[key] !== undefined) activityByDay[key]++;
      }
      const action = data.action || 'unknown';
      if (ts && ts >= d7) {
        activityByAction[action] = (activityByAction[action] || 0) + 1;
      }
      if (recentLogs.length < 20) {
        recentLogs.push({
          id: l.id,
          actorName: data.actorName || '',
          action: data.action || '',
          resource: data.resource || '',
          detail: data.detail || '',
        });
      }
    }
  } catch { /* eventLogs may not have index */ }

  // ---- AI CONVERSATIONS (count only — no docs loaded) ----
  let aiConversationsTotal = 0;
  try {
    aiConversationsTotal = await countQuery(
      adminDb.collection(`orgs/${ORG}/ai-conversations`)
    );
  } catch {}

  // ---- CHANNELS (count only — no docs loaded) ----
  let totalChannels = 0;
  try {
    totalChannels = await countQuery(
      adminDb.collection('channels').where('orgId', '==', ORG)
    );
  } catch {}

  // ---- WEBHOOK STATS (count queries) ----
  let webhookEventsProcessed = 0, webhookEventsFailed = 0;
  try {
    const [processedCount, exhaustedCount] = await Promise.all([
      countQuery(
        adminDb.collection('webhookEvents')
          .where('orgId', '==', ORG)
          .where('processed', '==', true)
          .where('exhausted', '!=', true)
      ),
      countQuery(
        adminDb.collection('webhookEvents')
          .where('orgId', '==', ORG)
          .where('exhausted', '==', true)
      ),
    ]);
    webhookEventsProcessed = processedCount;
    webhookEventsFailed = exhaustedCount;
  } catch {}

  // ---- AUTOMATIONS (collectionGroup for logs — avoids N+1) ----
  let automationRunsLast7d = 0, automationFailuresLast7d = 0;
  try {
    // Get automation IDs for this org first (small set)
    const autoSnap = await adminDb.collection('automations')
      .where('orgId', '==', ORG)
      .select()  // only IDs, no field data
      .get();
    const autoIds = new Set(autoSnap.docs.map(d => d.id));

    if (autoIds.size > 0) {
      // Single collectionGroup query across all automation logs
      const logsSnap = await adminDb.collectionGroup('logs')
        .where('createdAt', '>=', d7)
        .limit(5000)
        .get();

      for (const l of logsSnap.docs) {
        const parentId = l.ref.parent.parent?.id;
        if (!parentId || !autoIds.has(parentId)) continue;
        automationRunsLast7d++;
        if (l.data().status === 'error') automationFailuresLast7d++;
      }
    }
  } catch {}

  return {
    totalTasks: taskAcc.total,
    completedTasks: taskAcc.completedTasks,
    completionRate,
    tasksByStatus: taskAcc.tasksByStatus,
    tasksByPriority: taskAcc.tasksByPriority,
    overdueTasks: taskAcc.overdueTasks,
    completedLast7d: taskAcc.completedLast7d,
    createdLast7d: taskAcc.createdLast7d,
    completedLast30d: taskAcc.completedLast30d,
    createdLast30d: taskAcc.createdLast30d,
    totalGoals: goalAcc.total,
    goalsByStatus: goalAcc.goalsByStatus,
    goalsAtRisk: goalAcc.goalsAtRisk,
    avgGoalProgress: goalAcc.total > 0 ? Math.round(goalAcc.totalProgress / goalAcc.total) : 0,
    totalHoursLast7d: Math.round(timeAcc.totalHoursLast7d / 60 * 10) / 10,
    totalHoursLast30d: Math.round(timeAcc.totalHoursLast30d / 60 * 10) / 10,
    billableHoursLast30d: Math.round(timeAcc.billableHoursLast30d / 60 * 10) / 10,
    nonBillableHoursLast30d: Math.round(timeAcc.nonBillableHoursLast30d / 60 * 10) / 10,
    totalDocs: docAcc.total,
    totalWords: docAcc.totalWords,
    docsByVisibility: docAcc.docsByVisibility,
    topDocuments,
    totalMembers: membersSnap.size,
    activeMembers,
    membersByRole,
    actionsLast7d,
    actionsLast30d,
    activityByDay,
    activityByAction,
    recentLogs,
    aiConversationsTotal,
    totalChannels,
    webhookEventsProcessed,
    webhookEventsFailed,
    automationRunsLast7d,
    automationFailuresLast7d,
    departments,
    deptMetrics,
    computedAt: now.toISOString(),
  };
}
