// ================================================================
// Goal Templates — Quick goal creation from predefined patterns
// ================================================================
// Provides built-in and custom templates for common goal types
// (revenue, OKR, sprint, health metric, etc.)

import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { createGoal, createGoalTarget } from './db';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export interface GoalTemplate {
  id: string;
  orgId: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  color: string;
  defaultStatus: string;
  defaultTargets: TemplateTarget[];
  defaultTags: string[];
  isBuiltIn: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface TemplateTarget {
  name: string;
  type: 'number' | 'currency' | 'tasks' | 'percentage' | 'custom';
  targetValue: number;
  unit: string;
}

export type TemplateCategory =
  | 'revenue'
  | 'okr'
  | 'sprint'
  | 'health'
  | 'growth'
  | 'team'
  | 'custom';

// ---- Built-in Templates ----

export const BUILT_IN_TEMPLATES: Omit<GoalTemplate, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Revenue Target',
    description: 'Track monthly or quarterly revenue goals with currency-based targets.',
    category: 'revenue',
    icon: 'DollarSign',
    color: '#22C55E',
    defaultStatus: 'on_track',
    defaultTargets: [
      { name: 'Monthly Revenue', type: 'currency', targetValue: 10000, unit: 'USD' },
      { name: 'New Clients', type: 'number', targetValue: 5, unit: 'clients' },
    ],
    defaultTags: ['revenue', 'financial'],
    isBuiltIn: true,
  },
  {
    name: 'OKR — Objective & Key Results',
    description: 'Set an objective with measurable key results (3 recommended).',
    category: 'okr',
    icon: 'Target',
    color: '#3B82F6',
    defaultStatus: 'on_track',
    defaultTargets: [
      { name: 'Key Result 1', type: 'percentage', targetValue: 100, unit: '%' },
      { name: 'Key Result 2', type: 'percentage', targetValue: 100, unit: '%' },
      { name: 'Key Result 3', type: 'percentage', targetValue: 100, unit: '%' },
    ],
    defaultTags: ['okr'],
    isBuiltIn: true,
  },
  {
    name: 'Sprint Goal',
    description: 'Track task completion within a sprint or iteration.',
    category: 'sprint',
    icon: 'Zap',
    color: '#8B5CF6',
    defaultStatus: 'on_track',
    defaultTargets: [
      { name: 'Tasks Completed', type: 'tasks', targetValue: 20, unit: 'tasks' },
      { name: 'Story Points', type: 'number', targetValue: 40, unit: 'pts' },
    ],
    defaultTags: ['sprint'],
    isBuiltIn: true,
  },
  {
    name: 'Team Health',
    description: 'Monitor team performance and satisfaction metrics.',
    category: 'health',
    icon: 'Heart',
    color: '#EC4899',
    defaultStatus: 'on_track',
    defaultTargets: [
      { name: 'Team Satisfaction', type: 'percentage', targetValue: 100, unit: '%' },
      { name: 'Response Time (hrs)', type: 'number', targetValue: 4, unit: 'hours' },
    ],
    defaultTags: ['team-health'],
    isBuiltIn: true,
  },
  {
    name: 'Growth Metric',
    description: 'Track user/customer growth over a period.',
    category: 'growth',
    icon: 'TrendingUp',
    color: '#F59E0B',
    defaultStatus: 'on_track',
    defaultTargets: [
      { name: 'Active Users', type: 'number', targetValue: 1000, unit: 'users' },
      { name: 'Retention Rate', type: 'percentage', targetValue: 90, unit: '%' },
    ],
    defaultTags: ['growth'],
    isBuiltIn: true,
  },
];

// ---- CRUD ----

export async function getTemplates(): Promise<GoalTemplate[]> {
  const q = query(
    collection(db, 'goalTemplates'),
    where('orgId', '==', ORG),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  const custom = snap.docs.map(d => ({ id: d.id, ...d.data() } as GoalTemplate));

  // Merge built-in (with synthetic IDs) + custom
  const builtIn = BUILT_IN_TEMPLATES.map((t, i) => ({
    ...t,
    id: `builtin_${i}`,
    orgId: ORG,
    createdBy: 'system',
    createdAt: null,
    updatedAt: null,
  })) as GoalTemplate[];

  return [...builtIn, ...custom];
}

export async function createTemplate(data: {
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  color: string;
  defaultTargets: TemplateTarget[];
  defaultTags: string[];
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'goalTemplates'), {
    orgId: ORG,
    name: data.name,
    description: data.description,
    category: data.category,
    icon: data.icon,
    color: data.color,
    defaultStatus: 'on_track',
    defaultTargets: data.defaultTargets,
    defaultTags: data.defaultTags,
    isBuiltIn: false,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTemplate(
  id: string,
  data: Partial<Pick<GoalTemplate, 'name' | 'description' | 'category' | 'icon' | 'color' | 'defaultTargets' | 'defaultTags'>>,
): Promise<void> {
  await updateDoc(doc(db, 'goalTemplates', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, 'goalTemplates', id));
}

// ---- Instantiation ----

/**
 * Create a goal from a template with optional overrides.
 */
export async function createGoalFromTemplate(
  template: GoalTemplate | Omit<GoalTemplate, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  overrides: {
    name: string;
    description?: string;
    ownerId: string;
    ownerName: string;
    teamId?: string;
    dueDate?: string;
    createdBy: string;
    createdByName: string;
  },
): Promise<{ goalId: string; targetIds: string[] }> {
  const goalRef = await createGoal({
    name: overrides.name,
    description: overrides.description || template.description,
    ownerId: overrides.ownerId,
    ownerName: overrides.ownerName,
    teamId: overrides.teamId || '',
    dueDate: overrides.dueDate || null,
    status: template.defaultStatus || 'on_track',
    color: template.color,
    tags: [...(template.defaultTags || [])],
    visibility: 'team',
    createdBy: overrides.createdBy,
    createdByName: overrides.createdByName,
  });

  const goalId = goalRef.id;
  const targetIds: string[] = [];

  for (const t of template.defaultTargets || []) {
    const targetRef = await createGoalTarget(goalId, {
      name: t.name,
      type: t.type,
      currentValue: 0,
      targetValue: t.targetValue,
      unit: t.unit,
      linkedTaskIds: [],
      autoSync: t.type === 'tasks',
    });
    targetIds.push(targetRef.id);
  }

  return { goalId, targetIds };
}
