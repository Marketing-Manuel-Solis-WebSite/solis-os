// ================================================================
// SOLIS CENTER — Centralized Validation Schemas (Zod)
// Single source of truth for all domain enums and validation rules.
// Used by API routes, CSV import, and client-side enforcement.
// ================================================================

import { z } from 'zod';

// ─── Domain Enums ────────────────────────────────────────────────

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'blocked', 'open'] as const;
export const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export const TASK_TYPES = ['task', 'bug', 'feature', 'improvement', 'subtask', 'milestone', 'epic'] as const;
export const VISIBILITY_OPTIONS = ['team', 'private', 'public'] as const;
export const GOAL_STATUSES = ['on_track', 'at_risk', 'behind', 'completed', 'paused'] as const;
export const GOAL_TARGET_TYPES = ['number', 'currency', 'tasks', 'percentage', 'custom'] as const;
export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export const RELATION_TYPES = ['related_to', 'references', 'contributes_to', 'blocks', 'blocked_by', 'parent_of', 'child_of'] as const;
export const ENTITY_TYPES = ['task', 'doc', 'goal'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export type TaskType = typeof TASK_TYPES[number];
export type Visibility = typeof VISIBILITY_OPTIONS[number];

// ─── Reusable Primitives ─────────────────────────────────────────

const trimmedString = z.string().trim();
const nonEmptyString = trimmedString.min(1, 'Required');
const optionalString = trimmedString.optional().default('');
const optionalDate = z.any().optional().nullable().default(null); // Firestore Timestamps or Date strings
const stringArray = z.array(z.string()).optional().default([]);

// ─── Task Schemas ────────────────────────────────────────────────

export const TaskCreateSchema = z.object({
  title: nonEmptyString.max(500, 'Title too long'),
  description: optionalString,
  status: z.enum(TASK_STATUSES).optional().default('todo'),
  priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
  type: z.enum(TASK_TYPES).optional().default('task'),
  visibility: z.enum(VISIBILITY_OPTIONS).optional().default('team'),
  assignees: stringArray,
  tags: stringArray,
  teamId: optionalString,
  listId: z.string().nullable().optional().default(null),
  dueDate: optionalDate,
  startDate: optionalDate,
  timeEstimate: z.number().int().min(0).nullable().optional().default(null),
  points: z.number().int().min(0).nullable().optional().default(null),
  subtasks: z.array(z.object({
    id: z.string(),
    title: nonEmptyString.max(500),
    done: z.boolean().default(false),
  })).optional().default([]),
  checklist: z.array(z.object({
    id: z.string(),
    title: nonEmptyString.max(500),
    done: z.boolean().default(false),
  })).optional().default([]),
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
  watchers: stringArray,
  createdBy: optionalString,
  createdByName: optionalString,
  // Recurrence config (optional)
  recurrence: z.object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(365),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    monthOfYear: z.number().int().min(1).max(12).optional(),
    endDate: optionalDate,
    endAfter: z.number().int().min(1).optional(),
    occurrenceCount: z.number().int().min(0).optional().default(0),
  }).optional().nullable(),
}).strict();

// PATCH: all fields optional, only whitelisted fields accepted
const taskUpdatableFields = z.object({
  title: nonEmptyString.max(500),
  description: trimmedString,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  type: z.enum(TASK_TYPES),
  visibility: z.enum(VISIBILITY_OPTIONS),
  assignees: z.array(z.string()),
  tags: z.array(z.string()),
  teamId: z.string(),
  listId: z.string().nullable(),
  dueDate: z.any().nullable(),
  startDate: z.any().nullable(),
  completedAt: z.any().nullable(),
  timeEstimate: z.number().int().min(0).nullable(),
  timeSpent: z.number().min(0),
  points: z.number().int().min(0).nullable(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
  })),
  checklist: z.array(z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
  })),
  customFields: z.record(z.string(), z.unknown()),
  watchers: z.array(z.string()),
  archived: z.boolean(),
  recurrence: z.object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(365),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    monthOfYear: z.number().int().min(1).max(12).optional(),
    endDate: z.any().nullable().optional(),
    endAfter: z.number().int().min(1).optional(),
    occurrenceCount: z.number().int().min(0).optional(),
  }).nullable(),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.number(),
    uploadedBy: z.string().optional(),
    uploadedAt: z.any().optional(),
  })),
}).partial().strict();

export const TaskUpdateSchema = taskUpdatableFields.refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

// ─── Goal Schemas ────────────────────────────────────────────────

export const GoalCreateSchema = z.object({
  name: nonEmptyString.max(300, 'Name too long'),
  description: optionalString,
  dueDate: optionalDate,
  ownerId: optionalString,
  ownerName: optionalString,
  teamId: optionalString,
  status: z.enum(GOAL_STATUSES).optional().default('on_track'),
  tags: stringArray,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color').optional().default('#7B68EE'),
  visibility: z.enum(VISIBILITY_OPTIONS).optional().default('team'),
  createdBy: optionalString,
  createdByName: optionalString,
}).strict();

export const GoalUpdateSchema = z.object({
  name: nonEmptyString.max(300),
  description: trimmedString,
  dueDate: z.any().nullable(),
  ownerId: z.string(),
  ownerName: z.string(),
  teamId: z.string(),
  status: z.enum(GOAL_STATUSES),
  progress: z.number().int().min(0).max(100),
  tags: z.array(z.string()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  visibility: z.enum(VISIBILITY_OPTIONS),
}).partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

// ─── Time Entry Schemas ──────────────────────────────────────────

export const TimeEntryCreateSchema = z.object({
  userId: nonEmptyString,
  userName: optionalString,
  taskId: optionalString,
  taskTitle: optionalString,
  date: nonEmptyString,
  hours: z.number().int().min(0).max(24).default(0),
  minutes: z.number().int().min(0).max(59).default(0),
  notes: optionalString,
  billable: z.boolean().optional().default(false),
  teamId: optionalString,
  createdBy: optionalString,
}).strict();

export const TimeEntryUpdateSchema = z.object({
  taskId: z.string(),
  taskTitle: z.string(),
  date: z.string(),
  hours: z.number().int().min(0).max(24),
  minutes: z.number().int().min(0).max(59),
  notes: z.string(),
  billable: z.boolean(),
}).partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

// ─── Team / Department Schemas ───────────────────────────────────

export const TeamCreateSchema = z.object({
  id: trimmedString.optional(),
  name: nonEmptyString.max(200, 'Name too long'),
  description: optionalString,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color').optional().default('#6B7280'),
  icon: trimmedString.optional().default('📁'),
  leadId: optionalString,
  leadName: optionalString,
  memberIds: stringArray,
  createdBy: optionalString,
  createdByName: optionalString,
}).strict();

export const TeamUpdateSchema = z.object({
  name: nonEmptyString.max(200),
  description: trimmedString,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: trimmedString,
  leadId: z.string(),
  leadName: z.string(),
  memberIds: z.array(z.string()),
  status: z.enum(['active', 'archived']),
  archived: z.boolean(),
}).partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

// ─── Relation Schema ─────────────────────────────────────────────

export const RelationCreateSchema = z.object({
  sourceType: z.enum(ENTITY_TYPES),
  sourceId: nonEmptyString,
  sourceName: nonEmptyString,
  targetType: z.enum(ENTITY_TYPES),
  targetId: nonEmptyString,
  targetName: nonEmptyString,
  relationType: z.enum(RELATION_TYPES),
  createdBy: nonEmptyString,
  createdByName: nonEmptyString,
}).strict();

// ─── Form Submission Validation ──────────────────────────────────

// Validates submission values against form field definitions at runtime
export function validateFormSubmission(
  values: Record<string, any>,
  fields: any[],
): { valid: boolean; errors: { fieldId: string; message: string }[] } {
  const errors: { fieldId: string; message: string }[] = [];

  for (const field of fields) {
    const value = values[field.id];

    // Check conditional visibility: skip if field should be hidden
    if (field.conditionalOn) {
      const condField = field.conditionalOn.fieldId;
      const condValue = field.conditionalOn.value;
      const condOp = field.conditionalOn.operator || 'equals';
      const actualCondValue = values[condField];
      let visible = false;
      if (condOp === 'equals') visible = actualCondValue === condValue;
      else if (condOp === 'not_equals') visible = actualCondValue !== condValue;
      else if (condOp === 'contains') visible = String(actualCondValue || '').includes(String(condValue));
      if (!visible) continue; // skip validation for hidden fields
    }

    // Required check
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push({ fieldId: field.id, message: `${field.label || field.id} is required` });
        continue;
      }
    }

    // Skip further validation if no value
    if (value === undefined || value === null || value === '') continue;

    const v = field.validations || {};
    const strVal = String(value);

    // String length validations
    if (v.minLength && strVal.length < v.minLength) {
      errors.push({ fieldId: field.id, message: `Minimum ${v.minLength} characters` });
    }
    if (v.maxLength && strVal.length > v.maxLength) {
      errors.push({ fieldId: field.id, message: `Maximum ${v.maxLength} characters` });
    }

    // Numeric validations
    if (field.type === 'number' || field.type === 'currency' || field.type === 'rating') {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({ fieldId: field.id, message: 'Must be a number' });
      } else {
        if (v.min !== undefined && num < v.min) errors.push({ fieldId: field.id, message: `Minimum value is ${v.min}` });
        if (v.max !== undefined && num > v.max) errors.push({ fieldId: field.id, message: `Maximum value is ${v.max}` });
      }
    }

    // Pattern validation (with ReDoS protection)
    if (v.pattern) {
      try {
        // Limit pattern complexity: reject patterns longer than 200 chars
        if (v.pattern.length <= 200) {
          const regex = new RegExp(v.pattern);
          if (!regex.test(strVal)) {
            errors.push({ fieldId: field.id, message: 'Invalid format' });
          }
        }
      } catch { /* Invalid regex in definition — skip */ }
    }

    // Email validation
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      errors.push({ fieldId: field.id, message: 'Invalid email' });
    }

    // URL validation
    if (field.type === 'url') {
      try { new URL(strVal); } catch {
        errors.push({ fieldId: field.id, message: 'Invalid URL' });
      }
    }

    // Phone validation (basic)
    if (field.type === 'phone' && !/^[+\d\s\-().]{7,20}$/.test(strVal)) {
      errors.push({ fieldId: field.id, message: 'Invalid phone number' });
    }

    // Select validation — check value is in options
    if (field.type === 'select' && field.options?.length) {
      const validOptionIds = field.options.map((o: any) => o.id || o.value || o.label);
      if (!validOptionIds.includes(value)) {
        errors.push({ fieldId: field.id, message: 'Invalid selection' });
      }
    }

    // Multi-select validation
    if (field.type === 'multi_select' && field.options?.length && Array.isArray(value)) {
      const validOptionIds = field.options.map((o: any) => o.id || o.value || o.label);
      for (const v2 of value) {
        if (!validOptionIds.includes(v2)) {
          errors.push({ fieldId: field.id, message: `Invalid option: ${v2}` });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Custom Field Value Validation ───────────────────────────────

// Validates custom field values against their definitions
export function validateCustomFieldValues(
  values: Record<string, any>,
  definitions: any[],
): { valid: boolean; errors: string[]; sanitized: Record<string, any> } {
  const errors: string[] = [];
  const sanitized: Record<string, any> = {};
  const defMap = new Map(definitions.filter(d => !d.archived).map(d => [d.id, d]));

  for (const [fieldId, value] of Object.entries(values)) {
    const def = defMap.get(fieldId);
    if (!def) continue; // Skip unknown fields (don't fail, just ignore)

    // Type coercion & validation
    switch (def.type) {
      case 'text':
      case 'textarea':
      case 'email':
      case 'phone':
      case 'url':
        sanitized[fieldId] = String(value ?? '');
        break;
      case 'number':
      case 'currency':
      case 'percentage': {
        const num = Number(value);
        if (value !== '' && value !== null && value !== undefined && !isNaN(num)) {
          sanitized[fieldId] = num;
        } else if (value === '' || value === null || value === undefined) {
          sanitized[fieldId] = null;
        } else {
          errors.push(`${def.name}: expected number, got "${value}"`);
        }
        break;
      }
      case 'boolean':
        sanitized[fieldId] = Boolean(value);
        break;
      case 'date':
      case 'datetime':
        sanitized[fieldId] = value; // Pass through (Firestore Timestamp or string)
        break;
      case 'single_select':
        if (def.options?.length && value) {
          const validIds = def.options.map((o: any) => o.id);
          if (validIds.includes(value)) {
            sanitized[fieldId] = value;
          } else {
            errors.push(`${def.name}: invalid option "${value}"`);
          }
        } else {
          sanitized[fieldId] = value ?? null;
        }
        break;
      case 'multi_select':
        if (Array.isArray(value) && def.options?.length) {
          const validIds = def.options.map((o: any) => o.id);
          sanitized[fieldId] = value.filter((v: any) => validIds.includes(v));
        } else {
          sanitized[fieldId] = Array.isArray(value) ? value : [];
        }
        break;
      case 'user':
        sanitized[fieldId] = typeof value === 'string' ? value : '';
        break;
      case 'rating':
        const rating = Number(value);
        sanitized[fieldId] = (!isNaN(rating) && rating >= 0 && rating <= 5) ? rating : null;
        break;
      default:
        sanitized[fieldId] = value; // Pass through unknown types
    }
  }

  return { valid: errors.length === 0, errors, sanitized };
}

// ─── Form Field Definition Validation ────────────────────────────

// Validates form field definitions for consistency (e.g., min ≤ max)
export function validateFieldDefinition(field: {
  type: string;
  label?: string;
  validations?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string };
  options?: { label: string; value: string }[];
  ratingMax?: number;
}): string[] {
  const errors: string[] = [];
  const v = field.validations;

  if (v) {
    if (v.minLength !== undefined && v.maxLength !== undefined && v.minLength > v.maxLength) {
      errors.push('minLength must be ≤ maxLength');
    }
    if (v.min !== undefined && v.max !== undefined && v.min > v.max) {
      errors.push('min must be ≤ max');
    }
    if (v.minLength !== undefined && v.minLength < 0) {
      errors.push('minLength must be ≥ 0');
    }
    if (v.maxLength !== undefined && v.maxLength < 1) {
      errors.push('maxLength must be ≥ 1');
    }
    if (v.pattern) {
      try { new RegExp(v.pattern); } catch {
        errors.push('Invalid regex pattern');
      }
    }
  }

  if (field.ratingMax !== undefined && (field.ratingMax < 1 || field.ratingMax > 10)) {
    errors.push('ratingMax must be between 1 and 10');
  }

  if (['dropdown', 'radio', 'multi_select', 'single_select'].includes(field.type)) {
    if (!field.options?.length) {
      errors.push('Selection fields must have at least one option');
    }
    if (field.options?.some(o => !o.label?.trim())) {
      errors.push('All options must have a non-empty label');
    }
  }

  return errors;
}

// ─── Integration Schemas ─────────────────────────────────────────

export const API_KEY_SCOPES = [
  'tasks:read', 'tasks:write',
  'goals:read', 'goals:write',
  'timeentries:read', 'timeentries:write',
  'forms:read', 'members:read',
] as const;

export const WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.deleted', 'task.status_changed',
  'goal.created', 'goal.updated', 'goal.progress_changed',
  'form.submitted',
  'member.added', 'member.updated',
] as const;

export const INCOMING_ACTION_TYPES = ['create_task', 'create_notification', 'trigger_automation'] as const;

export const ApiKeyCreateSchema = z.object({
  name: nonEmptyString.max(200, 'Name too long'),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'At least one scope required'),
  expiresAt: z.number().nullable().optional().default(null),
}).strict();

export const WebhookCreateSchema = z.object({
  name: nonEmptyString.max(200, 'Name too long'),
  url: nonEmptyString.max(2000, 'URL too long').url('Invalid URL'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'At least one event required'),
}).strict();

export const WebhookUpdateSchema = z.object({
  name: nonEmptyString.max(200),
  url: nonEmptyString.max(2000).url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  active: z.boolean(),
}).partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export const IncomingWebhookCreateSchema = z.object({
  name: nonEmptyString.max(200, 'Name too long'),
  provider: trimmedString.max(100).optional().default('custom'),
  actionType: z.enum(INCOMING_ACTION_TYPES).optional().default('create_task'),
  actionConfig: z.record(z.string(), z.unknown()).optional().default({}),
}).strict();

export const IntegrationConnectSchema = z.object({
  provider: nonEmptyString.max(100),
  apiKey: nonEmptyString.max(5000, 'API key too long'),
}).strict();

// ─── API Error Formatter ─────────────────────────────────────────

export function formatZodError(error: z.ZodError<any>): { field: string; message: string }[] {
  return error.issues.map((e: z.ZodIssue) => ({
    field: e.path.join('.') || 'body',
    message: e.message,
  }));
}
