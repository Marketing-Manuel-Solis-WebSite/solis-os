// ================================================================
// Analytics Snapshot computation — shared by API route and cron
// ================================================================

import { adminDb } from '@/lib/firebase-admin';

const ORG = 'solis-center';

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

export async function computeSnapshot(): Promise<AnalyticsSnapshot> {
  const now = new Date();
  const d7 = daysAgoDate(7);
  const d30 = daysAgoDate(30);
  const d7iso = daysAgoISO(7);
  const d30iso = daysAgoISO(30);

  // ---- TEAMS ----
  const teamsSnap = await adminDb.collection(`orgs/${ORG}/teams`).get();
  const teams = teamsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // ---- TASKS ----
  const tasksSnap = await adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true)
    .get();

  const tasks = tasksSnap.docs.map(d => d.data());
  const tasksByStatus: Record<string, number> = {};
  const tasksByPriority: Record<string, number> = {};
  let overdueTasks = 0;
  let completedTasks = 0;
  let completedLast7d = 0, createdLast7d = 0;
  let completedLast30d = 0, createdLast30d = 0;

  const deptTasks: Record<string, number> = {};
  const deptCompleted: Record<string, number> = {};

  for (const t of tasks) {
    const status = t.status || 'unknown';
    tasksByStatus[status] = (tasksByStatus[status] || 0) + 1;

    const priority = t.priority || 'medium';
    tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;

    const isDone = status === 'done' || status === 'completed';
    if (isDone) completedTasks++;

    if (!isDone && t.dueDate && t.dueDate < now.toISOString().split('T')[0]) {
      overdueTasks++;
    }

    const tid = t.teamId || '__unassigned';
    deptTasks[tid] = (deptTasks[tid] || 0) + 1;
    if (isDone) deptCompleted[tid] = (deptCompleted[tid] || 0) + 1;

    const createdAt = t.createdAt?.toDate?.() || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000) : null);
    const completedAt = t.completedAt?.toDate?.() || (t.completedAt?.seconds ? new Date(t.completedAt.seconds * 1000) : null);

    if (createdAt && createdAt >= d7) createdLast7d++;
    if (createdAt && createdAt >= d30) createdLast30d++;
    if (isDone && completedAt && completedAt >= d7) completedLast7d++;
    if (isDone && completedAt && completedAt >= d30) completedLast30d++;
  }

  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // ---- GOALS ----
  const goalsSnap = await adminDb.collection('goals')
    .where('orgId', '==', ORG)
    .get();

  const goals = goalsSnap.docs.map(d => d.data());
  const goalsByStatus: Record<string, number> = {};
  let goalsAtRisk = 0;
  let totalProgress = 0;

  for (const g of goals) {
    const status = g.status || 'active';
    goalsByStatus[status] = (goalsByStatus[status] || 0) + 1;
    if (status === 'at_risk' || status === 'behind') goalsAtRisk++;
    totalProgress += g.progress || 0;
  }

  // ---- TIME ENTRIES ----
  const teSnap = await adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .get();

  const timeEntries = teSnap.docs.map(d => d.data());
  let totalHoursLast7d = 0, totalHoursLast30d = 0;
  let billableHoursLast30d = 0, nonBillableHoursLast30d = 0;

  for (const te of timeEntries) {
    const mins = (te.hours || 0) * 60 + (te.minutes || 0);
    const date = te.date || '';
    if (date >= d7iso) totalHoursLast7d += mins;
    if (date >= d30iso) {
      totalHoursLast30d += mins;
      if (te.billable) billableHoursLast30d += mins;
      else nonBillableHoursLast30d += mins;
    }
  }

  // ---- DOCS ----
  const docsSnap = await adminDb.collection('documents')
    .where('orgId', '==', ORG)
    .get();

  const docs = docsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const totalWords = docs.reduce((s: number, d: any) => s + (d.wordCount || 0), 0);

  const docsByVisibility: Record<string, number> = {};
  docs.forEach(d => {
    const vis = d.visibility || 'team';
    docsByVisibility[vis] = (docsByVisibility[vis] || 0) + 1;
  });

  const topDocuments = [...docs]
    .sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))
    .slice(0, 10)
    .map(d => ({
      id: d.id,
      title: d.title || 'Untitled',
      wordCount: d.wordCount || 0,
      teamName: teamMap.get(d.teamId)?.name || 'Unassigned',
      visibility: d.visibility || 'team',
    }));

  const deptDocs: Record<string, number> = {};
  const deptWords: Record<string, number> = {};
  docs.forEach(d => {
    const tid = d.teamId || '__unassigned';
    deptDocs[tid] = (deptDocs[tid] || 0) + 1;
    deptWords[tid] = (deptWords[tid] || 0) + (d.wordCount || 0);
  });

  // ---- MEMBERS ----
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
    const tTotal = deptTasks[t.id] || 0;
    const tDone = deptCompleted[t.id] || 0;
    deptMetrics[t.id] = {
      tasks: tTotal,
      completed: tDone,
      rate: tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0,
      docs: deptDocs[t.id] || 0,
      members: deptMembers[t.id] || 0,
      words: deptWords[t.id] || 0,
    };
  }

  // ---- ACTIVITY (eventLogs) ----
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

  // ---- AI CONVERSATIONS ----
  let aiConversationsTotal = 0;
  try {
    const aiSnap = await adminDb.collection(`orgs/${ORG}/ai-conversations`).get();
    aiConversationsTotal = aiSnap.size;
  } catch {}

  // ---- CHANNELS (count only) ----
  let totalChannels = 0;
  try {
    const chSnap = await adminDb.collection('channels')
      .where('orgId', '==', ORG)
      .get();
    totalChannels = chSnap.size;
  } catch {}

  // ---- WEBHOOK STATS ----
  let webhookEventsProcessed = 0, webhookEventsFailed = 0;
  try {
    const whSnap = await adminDb.collection('webhookEvents')
      .where('orgId', '==', ORG)
      .where('processed', '==', true)
      .get();
    for (const d of whSnap.docs) {
      if (d.data().exhausted) webhookEventsFailed++;
      else webhookEventsProcessed++;
    }
  } catch {}

  // ---- AUTOMATIONS ----
  let automationRunsLast7d = 0, automationFailuresLast7d = 0;
  try {
    const autoSnap = await adminDb.collection('automations')
      .where('orgId', '==', ORG)
      .get();
    for (const autoDoc of autoSnap.docs) {
      try {
        const logsSnap = await adminDb.collection(`automations/${autoDoc.id}/logs`)
          .where('createdAt', '>=', d7)
          .limit(500)
          .get();
        for (const l of logsSnap.docs) {
          automationRunsLast7d++;
          if (l.data().status === 'error') automationFailuresLast7d++;
        }
      } catch {}
    }
  } catch {}

  return {
    totalTasks: tasks.length,
    completedTasks,
    completionRate,
    tasksByStatus,
    tasksByPriority,
    overdueTasks,
    completedLast7d,
    createdLast7d,
    completedLast30d,
    createdLast30d,
    totalGoals: goals.length,
    goalsByStatus,
    goalsAtRisk,
    avgGoalProgress: goals.length > 0 ? Math.round(totalProgress / goals.length) : 0,
    totalHoursLast7d: Math.round(totalHoursLast7d / 60 * 10) / 10,
    totalHoursLast30d: Math.round(totalHoursLast30d / 60 * 10) / 10,
    billableHoursLast30d: Math.round(billableHoursLast30d / 60 * 10) / 10,
    nonBillableHoursLast30d: Math.round(nonBillableHoursLast30d / 60 * 10) / 10,
    totalDocs: docs.length,
    totalWords,
    docsByVisibility,
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
