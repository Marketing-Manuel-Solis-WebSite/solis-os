// ============================================================
// Automation Templates — Predefined automation recipes
// Provides seed data for common automation patterns that users
// can apply with one click via the template picker.
// ============================================================

// ---- Types ----

export interface AutomationTemplateCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface AutomationTemplateAction {
  id: string;
  type: string;
  config: Record<string, string>;
}

export type AutomationTemplateCategory =
  | 'assignment'
  | 'status'
  | 'notification'
  | 'organization'
  | 'review';

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: AutomationTemplateCategory;
  trigger: string;
  conditions: AutomationTemplateCondition[];
  actions: AutomationTemplateAction[];
}

// ---- Valid types (mirroring automation-engine.ts) ----

export const VALID_TRIGGER_TYPES = [
  'task_created',
  'task_status_changed',
  'task_assigned',
  'task_priority_changed',
  'task_due_date_changed',
  'task_custom_field_changed',
] as const;

export const VALID_ACTION_TYPES = [
  'change_status',
  'set_priority',
  'assign_user',
  'add_tag',
  'remove_tag',
  'post_comment',
  'send_notification',
  'call_webhook',
  'create_subtask',
  'archive_task',
  'duplicate_task',
  'move_to_list',
] as const;

export const VALID_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'starts_with',
  'ends_with',
] as const;

// ---- Predefined Templates ----

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // 1. Auto-assign on create
  {
    id: 'tmpl-auto-assign',
    name: 'Auto-assign on create',
    description: 'Automatically assign a default team member when a new task is created.',
    category: 'assignment',
    trigger: 'task_created',
    conditions: [],
    actions: [
      { id: 'a1', type: 'assign_user', config: { assigneeId: '' } },
    ],
  },

  // 2. Escalate overdue
  {
    id: 'tmpl-escalate-overdue',
    name: 'Escalate overdue tasks',
    description: 'Set priority to urgent and notify assignees when a task status changes to blocked.',
    category: 'status',
    trigger: 'task_status_changed',
    conditions: [
      { id: 'c1', field: 'status', operator: 'equals', value: 'blocked' },
    ],
    actions: [
      { id: 'a1', type: 'set_priority', config: { toPriority: 'urgent' } },
      { id: 'a2', type: 'send_notification', config: { message: 'Task is blocked and has been escalated to urgent priority.' } },
    ],
  },

  // 3. Close completed tasks
  {
    id: 'tmpl-close-completed',
    name: 'Close completed tasks',
    description: 'Archive tasks automatically when their status changes to done.',
    category: 'status',
    trigger: 'task_status_changed',
    conditions: [
      { id: 'c1', field: 'status', operator: 'equals', value: 'done' },
    ],
    actions: [
      { id: 'a1', type: 'archive_task', config: {} },
    ],
  },

  // 4. Welcome comment on create
  {
    id: 'tmpl-welcome-comment',
    name: 'Welcome comment on create',
    description: 'Post a welcome comment with guidelines when a new task is created.',
    category: 'notification',
    trigger: 'task_created',
    conditions: [],
    actions: [
      { id: 'a1', type: 'post_comment', config: { commentText: 'Welcome! Please add a description, set priority, and assign team members.' } },
    ],
  },

  // 5. Notify on high priority
  {
    id: 'tmpl-notify-high-priority',
    name: 'Notify on high priority',
    description: 'Send a notification to assignees when a task is set to high or urgent priority.',
    category: 'notification',
    trigger: 'task_priority_changed',
    conditions: [
      { id: 'c1', field: 'priority', operator: 'equals', value: 'high' },
    ],
    actions: [
      { id: 'a1', type: 'send_notification', config: { message: 'This task has been marked as high priority. Please review immediately.' } },
    ],
  },

  // 6. Move to list on status
  {
    id: 'tmpl-move-on-status',
    name: 'Move to list on status change',
    description: 'Move a task to a different list when its status changes to in_review.',
    category: 'organization',
    trigger: 'task_status_changed',
    conditions: [
      { id: 'c1', field: 'status', operator: 'equals', value: 'in_review' },
    ],
    actions: [
      { id: 'a1', type: 'move_to_list', config: { listId: '' } },
    ],
  },

  // 7. Tag on assignment
  {
    id: 'tmpl-tag-on-assign',
    name: 'Tag on assignment',
    description: 'Add an "assigned" tag when someone is assigned to a task.',
    category: 'assignment',
    trigger: 'task_assigned',
    conditions: [],
    actions: [
      { id: 'a1', type: 'add_tag', config: { tagName: 'assigned' } },
    ],
  },

  // 8. Duplicate for review
  {
    id: 'tmpl-duplicate-review',
    name: 'Duplicate for review',
    description: 'Create a copy of the task when it moves to in_review status for QA tracking.',
    category: 'review',
    trigger: 'task_status_changed',
    conditions: [
      { id: 'c1', field: 'status', operator: 'equals', value: 'in_review' },
    ],
    actions: [
      { id: 'a1', type: 'duplicate_task', config: {} },
      { id: 'a2', type: 'add_tag', config: { tagName: 'review-copy' } },
    ],
  },

  // 9. Unblock notification
  {
    id: 'tmpl-unblock-notify',
    name: 'Unblock notification',
    description: 'Notify team when a blocked task changes to in_progress, signaling it is unblocked.',
    category: 'notification',
    trigger: 'task_status_changed',
    conditions: [
      { id: 'c1', field: 'status', operator: 'equals', value: 'in_progress' },
    ],
    actions: [
      { id: 'a1', type: 'send_notification', config: { message: 'This task has been unblocked and is now in progress!' } },
      { id: 'a2', type: 'remove_tag', config: { tagName: 'blocked' } },
    ],
  },

  // 10. Weekly status reminder
  {
    id: 'tmpl-weekly-reminder',
    name: 'Weekly status reminder',
    description: 'Add a subtask reminder and post a comment when a task due date changes, prompting a status update.',
    category: 'organization',
    trigger: 'task_due_date_changed',
    conditions: [],
    actions: [
      { id: 'a1', type: 'create_subtask', config: { subtaskTitle: 'Update weekly status report' } },
      { id: 'a2', type: 'post_comment', config: { commentText: 'Reminder: Please update the status of this task before the end of the week.' } },
    ],
  },
];

/** Get all templates, optionally filtered by category */
export function getAutomationTemplates(category?: AutomationTemplateCategory): AutomationTemplate[] {
  if (!category) return AUTOMATION_TEMPLATES;
  return AUTOMATION_TEMPLATES.filter(t => t.category === category);
}

/** Get unique categories from all templates */
export function getTemplateCategories(): AutomationTemplateCategory[] {
  const cats = new Set(AUTOMATION_TEMPLATES.map(t => t.category));
  return Array.from(cats) as AutomationTemplateCategory[];
}
