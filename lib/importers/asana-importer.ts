// ================================================================
// Asana Importer — Parse Asana CSV export into SOLIS OS tasks
// ================================================================

import type { ColumnMapping } from '../import-csv';

/** Asana CSV headers → SOLIS field mapping */
export const ASANA_MAPPING: ColumnMapping = {
  'Name': 'title',
  'Notes': 'description',
  'Section/Column': '_status',
  'Assignee': 'assignees',
  'Due Date': 'dueDate',
  'Start Date': 'startDate',
  'Tags': 'tags',
  'Created At': '_createdAt',
  'Completed At': '_completedAt',
  'Type': 'type',
};

/** Asana section/column → SOLIS status mapping */
export const ASANA_STATUS_MAP: Record<string, string> = {
  'to do': 'todo',
  'untitled section': 'todo',
  'recently assigned': 'todo',
  'in progress': 'in_progress',
  'doing': 'in_progress',
  'in review': 'in_review',
  'review': 'in_review',
  'done': 'done',
  'complete': 'done',
  'completed': 'done',
};

/**
 * Detect if a CSV is from Asana by checking headers.
 */
export function isAsanaExport(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  return normalized.includes('name') && normalized.includes('section/column');
}

/**
 * Get the auto-detected mapping for Asana CSV.
 */
export function getAsanaMapping(): ColumnMapping {
  return { ...ASANA_MAPPING };
}

/**
 * Transform Asana-specific field values to SOLIS equivalents.
 */
export function transformAsanaValues(field: string, value: string): string {
  if (field === '_status' || field === 'status') {
    return ASANA_STATUS_MAP[value.toLowerCase().trim()] || 'todo';
  }
  return value;
}
