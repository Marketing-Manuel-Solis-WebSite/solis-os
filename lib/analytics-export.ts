// ================================================================
// Analytics — CSV Export helpers
// ================================================================
// Server-side CSV generation for analytics data export.
// Supports: tasks, time entries, goals, activity logs.

import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export type ExportFormat = 'csv';

export type ExportEntity = 'tasks' | 'time_entries' | 'goals' | 'activity_logs';

export interface ExportOptions {
  entity: ExportEntity;
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  teamId?: string;
  columns?: string[];  // optional subset of columns
}

export interface ExportResult {
  csv: string;
  rowCount: number;
  entity: ExportEntity;
  generatedAt: string;
}

// ---- CSV Utilities ----

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: Record<string, any>[]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escapeCSV(row[h])).join(','),
  );
  return [headerLine, ...dataLines].join('\n');
}

function extractDateStr(ts: any): string {
  if (!ts) return '';
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
  if (typeof ts === 'string') return ts;
  return '';
}

function inRange(dateStr: string, start?: string, end?: string): boolean {
  if (!dateStr) return !start; // include if no date and no filter
  const d = dateStr.split('T')[0];
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

// ---- Export Functions ----

export async function exportData(options: ExportOptions): Promise<ExportResult> {
  switch (options.entity) {
    case 'tasks':
      return exportTasks(options);
    case 'time_entries':
      return exportTimeEntries(options);
    case 'goals':
      return exportGoals(options);
    case 'activity_logs':
      return exportActivityLogs(options);
    default:
      throw new Error(`Unknown export entity: ${options.entity}`);
  }
}

// ---- Tasks Export ----

const TASK_HEADERS = [
  'id', 'title', 'status', 'priority', 'type', 'teamId',
  'assignees', 'tags', 'dueDate', 'createdBy', 'createdAt', 'completedAt',
];

async function exportTasks(options: ExportOptions): Promise<ExportResult> {
  const snap = await adminDb.collection('tasks')
    .where('orgId', '==', ORG)
    .where('deleted', '!=', true)
    .get();

  const headers = options.columns?.length ? options.columns : TASK_HEADERS;
  const rows: Record<string, any>[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const createdAt = extractDateStr(data.createdAt);
    if (!inRange(createdAt, options.startDate, options.endDate)) continue;
    if (options.teamId && data.teamId !== options.teamId) continue;

    rows.push({
      id: d.id,
      title: data.title || '',
      status: data.status || '',
      priority: data.priority || '',
      type: data.type || '',
      teamId: data.teamId || '',
      assignees: (data.assignees || []).join('; '),
      tags: (data.tags || []).join('; '),
      dueDate: data.dueDate || '',
      createdBy: data.createdBy || '',
      createdAt,
      completedAt: extractDateStr(data.completedAt),
    });
  }

  return {
    csv: toCSV(headers, rows),
    rowCount: rows.length,
    entity: 'tasks',
    generatedAt: new Date().toISOString(),
  };
}

// ---- Time Entries Export ----

const TIME_HEADERS = [
  'id', 'userId', 'taskId', 'date', 'hours', 'minutes',
  'description', 'billable', 'billableAmount', 'teamId', 'createdAt',
];

async function exportTimeEntries(options: ExportOptions): Promise<ExportResult> {
  const snap = await adminDb.collection('time-entries')
    .where('orgId', '==', ORG)
    .get();

  const headers = options.columns?.length ? options.columns : TIME_HEADERS;
  const rows: Record<string, any>[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const date = data.date || '';
    if (!inRange(date, options.startDate, options.endDate)) continue;
    if (options.teamId && data.teamId !== options.teamId) continue;

    const hours = data.hours || 0;
    const minutes = data.minutes || 0;
    const totalHours = hours + minutes / 60;
    const billableAmount = data.billable && data.billableRate
      ? (totalHours * data.billableRate).toFixed(2)
      : '';

    rows.push({
      id: d.id,
      userId: data.userId || '',
      taskId: data.taskId || '',
      date,
      hours,
      minutes,
      description: data.description || '',
      billable: data.billable ? 'Yes' : 'No',
      billableAmount,
      teamId: data.teamId || '',
      createdAt: extractDateStr(data.createdAt),
    });
  }

  return {
    csv: toCSV(headers, rows),
    rowCount: rows.length,
    entity: 'time_entries',
    generatedAt: new Date().toISOString(),
  };
}

// ---- Goals Export ----

const GOAL_HEADERS = [
  'id', 'title', 'status', 'progress', 'targetDate',
  'owner', 'teamId', 'createdAt', 'updatedAt',
];

async function exportGoals(options: ExportOptions): Promise<ExportResult> {
  const snap = await adminDb.collection('goals')
    .where('orgId', '==', ORG)
    .get();

  const headers = options.columns?.length ? options.columns : GOAL_HEADERS;
  const rows: Record<string, any>[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const createdAt = extractDateStr(data.createdAt);
    if (!inRange(createdAt, options.startDate, options.endDate)) continue;
    if (options.teamId && data.teamId !== options.teamId) continue;

    rows.push({
      id: d.id,
      title: data.title || '',
      status: data.status || '',
      progress: data.progress || 0,
      targetDate: data.targetDate || '',
      owner: data.owner || '',
      teamId: data.teamId || '',
      createdAt,
      updatedAt: extractDateStr(data.updatedAt),
    });
  }

  return {
    csv: toCSV(headers, rows),
    rowCount: rows.length,
    entity: 'goals',
    generatedAt: new Date().toISOString(),
  };
}

// ---- Activity Logs Export ----

const LOG_HEADERS = [
  'id', 'actorId', 'actorName', 'action', 'resource',
  'resourceId', 'detail', 'createdAt',
];

async function exportActivityLogs(options: ExportOptions): Promise<ExportResult> {
  let q = adminDb.collection(`orgs/${ORG}/eventLogs`)
    .orderBy('createdAt', 'desc')
    .limit(5000);

  const snap = await q.get();
  const headers = options.columns?.length ? options.columns : LOG_HEADERS;
  const rows: Record<string, any>[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const createdAt = extractDateStr(data.createdAt);
    if (!inRange(createdAt, options.startDate, options.endDate)) continue;

    rows.push({
      id: d.id,
      actorId: data.actorId || '',
      actorName: data.actorName || '',
      action: data.action || '',
      resource: data.resource || '',
      resourceId: data.resourceId || '',
      detail: data.detail || '',
      createdAt,
    });
  }

  return {
    csv: toCSV(headers, rows),
    rowCount: rows.length,
    entity: 'activity_logs',
    generatedAt: new Date().toISOString(),
  };
}
