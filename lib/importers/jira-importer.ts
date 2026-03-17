// ================================================================
// Jira Importer — Parse Jira CSV export into SOLIS OS tasks
// ================================================================

import type { ColumnMapping } from '../import-csv';

/** Jira CSV headers → SOLIS field mapping */
export const JIRA_MAPPING: ColumnMapping = {
  'Summary': 'title',
  'Description': 'description',
  'Status': 'status',
  'Priority': 'priority',
  'Assignee': 'assignees',
  'Labels': 'tags',
  'Due date': 'dueDate',
  'Created': '_createdAt',
  'Issue Type': 'type',
  'Story Points': 'points',
  'Original Estimate': 'timeEstimate',
};

/** Jira status → SOLIS status mapping */
export const JIRA_STATUS_MAP: Record<string, string> = {
  'to do': 'todo',
  'open': 'todo',
  'backlog': 'todo',
  'in progress': 'in_progress',
  'in development': 'in_progress',
  'in review': 'in_review',
  'code review': 'in_review',
  'done': 'done',
  'closed': 'done',
  'resolved': 'done',
  'blocked': 'blocked',
  'impediment': 'blocked',
};

/** Jira priority → SOLIS priority mapping */
export const JIRA_PRIORITY_MAP: Record<string, string> = {
  'highest': 'urgent',
  'blocker': 'urgent',
  'critical': 'urgent',
  'high': 'high',
  'major': 'high',
  'medium': 'medium',
  'normal': 'medium',
  'low': 'low',
  'minor': 'low',
  'lowest': 'low',
  'trivial': 'low',
};

/** Jira issue type → SOLIS type mapping */
export const JIRA_TYPE_MAP: Record<string, string> = {
  'story': 'feature',
  'task': 'task',
  'bug': 'bug',
  'epic': 'epic',
  'sub-task': 'subtask',
  'improvement': 'improvement',
  'new feature': 'feature',
};

/**
 * Detect if a CSV is from Jira by checking headers.
 */
export function isJiraExport(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  return normalized.includes('summary') && (normalized.includes('issue type') || normalized.includes('issue key'));
}

/**
 * Get the auto-detected mapping for Jira CSV.
 */
export function getJiraMapping(): ColumnMapping {
  return { ...JIRA_MAPPING };
}

/**
 * Transform Jira-specific field values to SOLIS equivalents.
 */
export function transformJiraValues(field: string, value: string): string {
  if (field === 'status') {
    return JIRA_STATUS_MAP[value.toLowerCase().trim()] || 'todo';
  }
  if (field === 'priority') {
    return JIRA_PRIORITY_MAP[value.toLowerCase().trim()] || 'medium';
  }
  if (field === 'type') {
    return JIRA_TYPE_MAP[value.toLowerCase().trim()] || 'task';
  }
  // Jira time estimate is in seconds
  if (field === 'timeEstimate' && value) {
    const sec = parseInt(value, 10);
    if (!isNaN(sec)) return String(Math.round(sec / 60)); // → minutes
  }
  return value;
}
