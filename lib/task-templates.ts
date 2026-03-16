// ============================================================
// Task Templates — Reusable task blueprints with variable
// substitution, date offsets, and built-in templates.
// ============================================================

import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp, increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';

// ─── Types ──────────────────────────────────────────────

export interface TaskTemplateVariable {
  key: string;
  label: string;
  labelEs?: string;
  type: 'text' | 'date' | 'user' | 'select';
  required: boolean;
  options?: string[];
}

export interface TaskTemplateData {
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  tags: string[];
  subtasks: { title: string; done: boolean; assigneeId?: string }[];
  customFields: Record<string, any>;
  timeEstimate?: number;
  points?: number;
  /** Days from creation date to set as due date */
  dueDateOffsetDays?: number;
  /** Days from creation date to set as start date */
  startDateOffsetDays?: number;
  checklist: { text: string; completed: boolean }[];
}

export interface TaskTemplate {
  id: string;
  orgId: string;
  name: string;
  nameEs?: string;
  description: string;
  descriptionEs?: string;
  category: string;
  icon: string;
  templateData: TaskTemplateData;
  variables: TaskTemplateVariable[];
  isBuiltIn: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

// ─── Built-in Templates ─────────────────────────────────

export const BUILT_IN_TASK_TEMPLATES: Omit<TaskTemplate, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Bug Report',
    nameEs: 'Reporte de Error',
    description: 'Standard bug report with reproduction steps',
    descriptionEs: 'Reporte de error estándar con pasos de reproducción',
    category: 'engineering',
    icon: '🐛',
    isBuiltIn: true,
    usageCount: 0,
    createdBy: 'system',
    variables: [
      { key: 'component', label: 'Component', labelEs: 'Componente', type: 'text', required: true },
    ],
    templateData: {
      title: 'Bug: {{component}} - ',
      description: '## Steps to Reproduce\n1. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n- Browser:\n- OS:',
      status: 'todo',
      priority: 'high',
      type: 'bug',
      tags: ['bug'],
      subtasks: [
        { title: 'Reproduce the issue', done: false },
        { title: 'Identify root cause', done: false },
        { title: 'Write fix', done: false },
        { title: 'Test fix', done: false },
      ],
      customFields: {},
      checklist: [],
      dueDateOffsetDays: 3,
    },
  },
  {
    name: 'Feature Request',
    nameEs: 'Solicitud de Feature',
    description: 'New feature request with acceptance criteria',
    descriptionEs: 'Solicitud de nueva funcionalidad con criterios de aceptación',
    category: 'engineering',
    icon: '✨',
    isBuiltIn: true,
    usageCount: 0,
    createdBy: 'system',
    variables: [
      { key: 'featureName', label: 'Feature Name', labelEs: 'Nombre del Feature', type: 'text', required: true },
    ],
    templateData: {
      title: 'Feature: {{featureName}}',
      description: '## User Story\nAs a [user], I want [action] so that [benefit].\n\n## Acceptance Criteria\n- [ ] \n\n## Technical Notes\n',
      status: 'todo',
      priority: 'medium',
      type: 'feature',
      tags: ['feature'],
      subtasks: [
        { title: 'Design review', done: false },
        { title: 'Implementation', done: false },
        { title: 'Testing', done: false },
        { title: 'Documentation', done: false },
      ],
      customFields: {},
      checklist: [],
      dueDateOffsetDays: 14,
    },
  },
  {
    name: 'Sprint Task',
    nameEs: 'Tarea de Sprint',
    description: 'Standard sprint work item',
    descriptionEs: 'Elemento de trabajo estándar de sprint',
    category: 'pm',
    icon: '🏃',
    isBuiltIn: true,
    usageCount: 0,
    createdBy: 'system',
    variables: [],
    templateData: {
      title: '',
      description: '## Objective\n\n## Implementation Plan\n\n## Definition of Done\n- [ ] Code complete\n- [ ] Tests passing\n- [ ] Code review approved',
      status: 'todo',
      priority: 'medium',
      type: 'task',
      tags: ['sprint'],
      subtasks: [],
      customFields: {},
      checklist: [
        { text: 'Code complete', completed: false },
        { text: 'Tests passing', completed: false },
        { text: 'Review approved', completed: false },
      ],
      dueDateOffsetDays: 7,
    },
  },
  {
    name: 'Client Onboarding',
    nameEs: 'Onboarding de Cliente',
    description: 'Client onboarding checklist',
    descriptionEs: 'Lista de onboarding de cliente',
    category: 'general',
    icon: '🤝',
    isBuiltIn: true,
    usageCount: 0,
    createdBy: 'system',
    variables: [
      { key: 'clientName', label: 'Client Name', labelEs: 'Nombre del Cliente', type: 'text', required: true },
    ],
    templateData: {
      title: 'Onboarding: {{clientName}}',
      description: '## Client Onboarding for {{clientName}}\n\nFollow the steps below to complete onboarding.',
      status: 'todo',
      priority: 'high',
      type: 'task',
      tags: ['onboarding', 'client'],
      subtasks: [
        { title: 'Initial meeting', done: false },
        { title: 'Gather requirements', done: false },
        { title: 'Set up access', done: false },
        { title: 'Kickoff call', done: false },
        { title: 'First check-in', done: false },
      ],
      customFields: {},
      checklist: [],
      dueDateOffsetDays: 7,
    },
  },
  {
    name: 'Meeting Notes',
    nameEs: 'Notas de Reunión',
    description: 'Meeting notes with action items',
    descriptionEs: 'Notas de reunión con acciones pendientes',
    category: 'general',
    icon: '📝',
    isBuiltIn: true,
    usageCount: 0,
    createdBy: 'system',
    variables: [
      { key: 'meetingTitle', label: 'Meeting Title', labelEs: 'Título de Reunión', type: 'text', required: true },
    ],
    templateData: {
      title: 'Meeting: {{meetingTitle}}',
      description: '## Attendees\n- \n\n## Agenda\n1. \n\n## Notes\n\n## Action Items\n- [ ] ',
      status: 'todo',
      priority: 'low',
      type: 'task',
      tags: ['meeting'],
      subtasks: [],
      customFields: {},
      checklist: [],
    },
  },
];

// ─── Helpers ────────────────────────────────────────────

function templatesPath() {
  return `orgs/${getCurrentOrgId()}/taskTemplates`;
}

/** Replace {{variableName}} placeholders in text */
export function substituteVariables(text: string, values: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

/** Compute absolute date from day offset */
export function resolveDateOffset(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(23, 59, 59, 0);
  return d;
}

// ─── CRUD ───────────────────────────────────────────────

export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  const ref = collection(db, templatesPath());
  const q = query(ref, orderBy('name'));
  const snap = await getDocs(q);
  const userTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskTemplate));

  // Merge with built-in templates
  const builtIns: TaskTemplate[] = BUILT_IN_TASK_TEMPLATES.map((t, i) => ({
    ...t,
    id: `builtin_${i}`,
    orgId: getCurrentOrgId(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));

  return [...builtIns, ...userTemplates];
}

export async function getTaskTemplate(templateId: string): Promise<TaskTemplate | null> {
  // Check built-in first
  if (templateId.startsWith('builtin_')) {
    const idx = parseInt(templateId.replace('builtin_', ''), 10);
    const t = BUILT_IN_TASK_TEMPLATES[idx];
    if (!t) return null;
    return { ...t, id: templateId, orgId: getCurrentOrgId(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  }
  const ref = doc(db, templatesPath(), templateId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TaskTemplate;
}

export async function createTaskTemplate(
  data: Omit<TaskTemplate, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<string> {
  const ref = doc(collection(db, templatesPath()));
  await setDoc(ref, {
    ...data,
    orgId: getCurrentOrgId(),
    usageCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateTaskTemplate(
  templateId: string,
  data: Partial<TaskTemplate>,
): Promise<void> {
  const ref = doc(db, templatesPath(), templateId);
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteTaskTemplate(templateId: string): Promise<void> {
  const ref = doc(db, templatesPath(), templateId);
  await deleteDoc(ref);
}

/** Apply a template — creates a real task and returns its data object (caller creates via createTask) */
export async function applyTaskTemplate(
  templateId: string,
  overrides: {
    teamId: string;
    spaceId: string;
    listId: string;
    createdBy: string;
    variableValues?: Record<string, string>;
  },
): Promise<Record<string, any>> {
  const template = await getTaskTemplate(templateId);
  if (!template) throw new Error('Template not found');

  const { templateData, variables } = template;
  const vars = overrides.variableValues || {};

  // Validate required variables
  for (const v of variables) {
    if (v.required && !vars[v.key]) {
      throw new Error(`Required variable "${v.key}" is missing`);
    }
  }

  // Build task data
  const title = substituteVariables(templateData.title, vars);
  const description = substituteVariables(templateData.description || '', vars);

  const taskData: Record<string, any> = {
    title,
    description,
    status: templateData.status || 'todo',
    priority: templateData.priority || 'medium',
    type: templateData.type || 'task',
    visibility: 'team',
    tags: templateData.tags || [],
    assignees: [],
    subtasks: (templateData.subtasks || []).map((s, i) => ({
      id: `st_${Date.now()}_${i}`,
      title: substituteVariables(s.title, vars),
      done: s.done,
      assigneeId: s.assigneeId || null,
    })),
    checklist: templateData.checklist || [],
    customFields: templateData.customFields || {},
    timeEstimate: templateData.timeEstimate || null,
    points: templateData.points || null,
    dependencies: [],
    attachments: [],
    watchers: [],
    archived: false,
    teamId: overrides.teamId,
    spaceId: overrides.spaceId,
    listId: overrides.listId,
    createdBy: overrides.createdBy,
  };

  // Resolve date offsets
  if (templateData.dueDateOffsetDays != null) {
    taskData.dueDate = Timestamp.fromDate(resolveDateOffset(templateData.dueDateOffsetDays));
  }
  if (templateData.startDateOffsetDays != null) {
    taskData.startDate = Timestamp.fromDate(resolveDateOffset(templateData.startDateOffsetDays));
  }

  // Increment usage count (best-effort, don't block)
  if (!templateId.startsWith('builtin_')) {
    updateTaskTemplate(templateId, {}).catch(() => {});
    const ref = doc(db, templatesPath(), templateId);
    updateDoc(ref, { usageCount: increment(1) }).catch(() => {});
  }

  return taskData;
}
