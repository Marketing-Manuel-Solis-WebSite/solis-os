// ================================================================
// ClickUp Importer — Parse ClickUp CSV export into SOLIS OS tasks
// ================================================================

import type { ColumnMapping } from '../import-csv';

/** ClickUp CSV headers → SOLIS field mapping */
export const CLICKUP_MAPPING: ColumnMapping = {
  'Task Name': 'title',
  'Task Content': 'description',
  'Status': 'status',
  'Priority': 'priority',
  'Assignees': 'assignees',
  'Tags': 'tags',
  'Due Date': 'dueDate',
  'Start Date': 'startDate',
  'Time Estimate': 'timeEstimate',
  'Date Created': '_createdAt',
  'Task Type': 'type',
};

/** Map ClickUp statuses to SOLIS statuses */
export const CLICKUP_STATUS_MAP: Record<string, string> = {
  'to do': 'todo',
  'open': 'todo',
  'in progress': 'in_progress',
  'review': 'in_review',
  'in review': 'in_review',
  'complete': 'done',
  'closed': 'done',
  'done': 'done',
  'blocked': 'blocked',
};

/** Map ClickUp priorities to SOLIS priorities */
export const CLICKUP_PRIORITY_MAP: Record<string, string> = {
  'urgent': 'urgent',
  'high': 'high',
  'normal': 'medium',
  'low': 'low',
  'no priority': 'medium',
};

/**
 * Detect if a CSV is from ClickUp by checking headers.
 */
export function isClickUpExport(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  return normalized.includes('task name') && normalized.includes('status');
}

/**
 * Get the auto-detected mapping for ClickUp CSV.
 */
export function getClickUpMapping(): ColumnMapping {
  return { ...CLICKUP_MAPPING };
}

/**
 * Transform ClickUp-specific field values to SOLIS equivalents.
 */
export function transformClickUpValues(field: string, value: string): string {
  if (field === 'status') {
    return CLICKUP_STATUS_MAP[value.toLowerCase().trim()] || 'todo';
  }
  if (field === 'priority') {
    return CLICKUP_PRIORITY_MAP[value.toLowerCase().trim()] || 'medium';
  }
  // ClickUp time estimates are in milliseconds
  if (field === 'timeEstimate' && value) {
    const ms = parseInt(value, 10);
    if (!isNaN(ms)) return String(Math.round(ms / 60000)); // → minutes
  }
  return value;
}
