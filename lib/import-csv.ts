// ================================================================
// SOLIS CENTER — CSV Import: Parse, Validate, Map
// ================================================================

import Papa from 'papaparse';
import { writeBatch, doc, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ORG } from './db';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES, VISIBILITY_OPTIONS } from './validation';

// ─── Types ────────────────────────────────────────────────────

export interface ColumnMapping {
  [csvHeader: string]: string; // maps CSV header → task field
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
}

export interface ImportLog {
  orgId: string;
  entityType: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
  columnMapping: ColumnMapping;
  importedBy: string;
  importedByName: string;
  teamId: string;
  dryRun: boolean;
}

// ─── Task field definitions for mapping ─────────────────────────

export const MAPPABLE_FIELDS = [
  { id: 'title', label: 'Título / Title', required: true },
  { id: 'description', label: 'Descripción / Description', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'priority', label: 'Prioridad / Priority', required: false },
  { id: 'type', label: 'Tipo / Type', required: false },
  { id: 'assignees', label: 'Asignados / Assignees', required: false },
  { id: 'tags', label: 'Etiquetas / Tags', required: false },
  { id: 'dueDate', label: 'Fecha límite / Due Date', required: false },
  { id: 'startDate', label: 'Fecha inicio / Start Date', required: false },
  { id: 'timeEstimate', label: 'Estimación (min)', required: false },
  { id: 'points', label: 'Puntos / Points', required: false },
  { id: 'visibility', label: 'Visibilidad / Visibility', required: false },
] as const;

// ─── Auto-detect column mapping ────────────────────────────────

const HEADER_ALIASES: Record<string, string[]> = {
  title: ['title', 'titulo', 'título', 'nombre', 'name', 'task', 'tarea'],
  description: ['description', 'descripcion', 'descripción', 'desc', 'detalle', 'details'],
  status: ['status', 'estado', 'state'],
  priority: ['priority', 'prioridad', 'urgencia'],
  type: ['type', 'tipo', 'kind'],
  assignees: ['assignees', 'asignados', 'assigned', 'responsable', 'assignee'],
  tags: ['tags', 'etiquetas', 'labels', 'categorias'],
  dueDate: ['duedate', 'due_date', 'due date', 'fecha_limite', 'fecha limite', 'fecha límite', 'vencimiento', 'deadline'],
  startDate: ['startdate', 'start_date', 'start date', 'fecha_inicio', 'fecha inicio', 'inicio'],
  timeEstimate: ['timeestimate', 'time_estimate', 'estimacion', 'estimate', 'hours', 'minutes', 'horas', 'minutos'],
  points: ['points', 'puntos', 'story_points', 'sp'],
  visibility: ['visibility', 'visibilidad'],
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim().replace(/[_\-]/g, '');
    for (const [fieldId, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(a => a.replace(/[_\-\s]/g, '') === normalized)) {
        mapping[header] = fieldId;
        break;
      }
    }
  }
  return mapping;
}

// ─── Parse CSV ─────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 5000;

export function parseCSV(file: File): Promise<{ headers: string[]; rows: Record<string, string>[]; rowCount: number }> {
  if (file.size > MAX_FILE_SIZE) {
    return Promise.reject(new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`));
  }
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, string>[];
        if (rows.length > MAX_ROWS) {
          reject(new Error(`Too many rows (${rows.length}). Max ${MAX_ROWS} rows per import.`));
          return;
        }
        resolve({ headers, rows, rowCount: rows.length });
      },
      error: (err) => reject(err),
    });
  });
}

// ─── Validate + Transform rows ─────────────────────────────────

const VALID_STATUSES: readonly string[] = TASK_STATUSES;
const VALID_PRIORITIES: readonly string[] = TASK_PRIORITIES;
const VALID_TYPES: readonly string[] = TASK_TYPES;
const VALID_VISIBILITY: readonly string[] = VISIBILITY_OPTIONS;

function resolveAssignees(value: string, members: any[]): string[] {
  if (!value) return [];
  const names = value.split(/[,;]/).map(n => n.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    const member = members.find((m: any) =>
      m.displayName?.toLowerCase() === lower ||
      m.email?.toLowerCase() === lower
    );
    if (member) ids.push(member.id);
  }
  return ids;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  // Reject unreasonable dates (before 2000 or more than 10 years ahead)
  const year = d.getFullYear();
  if (year < 2000 || year > new Date().getFullYear() + 10) return null;
  return d;
}

export function validateAndTransform(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  members: any[],
  defaults: { teamId: string; createdBy: string },
): { tasks: any[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const tasks: any[] = [];
  const reverseMap: Record<string, string> = {};

  for (const [csvHeader, fieldId] of Object.entries(mapping)) {
    reverseMap[fieldId] = csvHeader;
  }

  const seenTitles = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for header row + 1-indexed

    const getValue = (fieldId: string): string => {
      const csvHeader = reverseMap[fieldId];
      return csvHeader ? (row[csvHeader] || '').trim() : '';
    };

    const title = getValue('title');
    if (!title || !title.trim()) {
      errors.push({ row: rowNum, field: 'title', value: title || '', message: 'Title is required' });
      continue;
    }
    if (title.length > 500) {
      errors.push({ row: rowNum, field: 'title', value: title.slice(0, 50) + '...', message: 'Title too long (max 500)' });
      continue;
    }

    const titleKey = title.toLowerCase().trim();
    if (seenTitles.has(titleKey)) {
      errors.push({ row: rowNum, field: 'title', value: title, message: 'Duplicate title in CSV' });
      continue;
    }
    seenTitles.add(titleKey);

    const statusRaw = getValue('status').toLowerCase();
    const status = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'todo';
    if (statusRaw && !VALID_STATUSES.includes(statusRaw)) {
      errors.push({ row: rowNum, field: 'status', value: statusRaw, message: `Invalid status: "${statusRaw}"` });
    }

    const priorityRaw = getValue('priority').toLowerCase();
    const priority = VALID_PRIORITIES.includes(priorityRaw) ? priorityRaw : 'medium';
    if (priorityRaw && !VALID_PRIORITIES.includes(priorityRaw)) {
      errors.push({ row: rowNum, field: 'priority', value: priorityRaw, message: `Invalid priority: "${priorityRaw}"` });
    }

    const typeRaw = getValue('type').toLowerCase();
    const type = VALID_TYPES.includes(typeRaw) ? typeRaw : 'task';

    const visRaw = getValue('visibility').toLowerCase();
    const visibility = VALID_VISIBILITY.includes(visRaw) ? visRaw : 'team';

    const assigneeRaw = getValue('assignees');
    const assignees = resolveAssignees(assigneeRaw, members);
    if (assigneeRaw && assignees.length === 0) {
      errors.push({ row: rowNum, field: 'assignees', value: assigneeRaw, message: 'No matching members found' });
    } else if (assigneeRaw) {
      const requestedCount = assigneeRaw.split(/[,;]/).filter(n => n.trim()).length;
      if (assignees.length < requestedCount) {
        errors.push({ row: rowNum, field: 'assignees', value: assigneeRaw, message: `${requestedCount - assignees.length} assignee(s) not resolved` });
      }
    }
    const tags = getValue('tags') ? getValue('tags').split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

    const dueDateRaw = getValue('dueDate');
    const dueDate = parseDate(dueDateRaw);
    if (dueDateRaw && !dueDate) {
      errors.push({ row: rowNum, field: 'dueDate', value: dueDateRaw, message: 'Invalid date format' });
    }

    const startDateRaw = getValue('startDate');
    const startDate = parseDate(startDateRaw);
    if (startDateRaw && !startDate) {
      errors.push({ row: rowNum, field: 'startDate', value: startDateRaw, message: 'Invalid date format' });
    }

    const timeEstRaw = getValue('timeEstimate');
    let timeEstimate: number | null = timeEstRaw ? parseInt(timeEstRaw, 10) : null;
    if (timeEstimate !== null && (isNaN(timeEstimate) || timeEstimate < 0 || timeEstimate > 525600)) {
      errors.push({ row: rowNum, field: 'timeEstimate', value: timeEstRaw, message: 'Invalid time estimate (0-525600 min)' });
      timeEstimate = null;
    }

    const pointsRaw = getValue('points');
    let points: number | null = pointsRaw ? parseInt(pointsRaw, 10) : null;
    if (points !== null && (isNaN(points) || points < 0 || points > 10000)) {
      errors.push({ row: rowNum, field: 'points', value: pointsRaw, message: 'Invalid points (0-10000)' });
      points = null;
    }

    const description = getValue('description').slice(0, 10000); // Cap at 10K chars

    tasks.push({
      title,
      description,
      status,
      priority,
      type,
      visibility,
      assignees,
      tags,
      dueDate: dueDate || null,
      startDate: startDate || null,
      timeEstimate,
      points,
      teamId: defaults.teamId,
      createdBy: defaults.createdBy,
      orgId: ORG,
      subtasks: [],
      checklist: [],
      attachments: [],
      customFields: {},
      dependencies: [],
      watchers: [],
      archived: false,
    });
  }

  return { tasks, errors };
}

// ─── Batch import ──────────────────────────────────────────────

const BATCH_SIZE = 450;

export async function batchImportTasks(
  tasks: any[],
  onProgress?: (imported: number, total: number) => void,
): Promise<number> {
  let imported = 0;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const chunk = tasks.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const task of chunk) {
      const ref = doc(collection(db, 'tasks'));
      batch.set(ref, {
        ...task,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    imported += chunk.length;
    onProgress?.(imported, tasks.length);
  }

  return imported;
}

// ─── Import log ────────────────────────────────────────────────

export async function createImportLog(log: ImportLog) {
  return addDoc(collection(db, 'importLogs'), {
    ...log,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
