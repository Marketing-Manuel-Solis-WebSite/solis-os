'use client';

// ================================================================
// Space Features — Per-space feature toggles (ClickApps equivalent)
// ================================================================
// Each space can enable/disable specific features independently.
// Falls back to org-level feature flags when not explicitly set.
//
// Stored at: orgs/{orgId}/teams/{spaceId}/settings/features

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';

// ---- Types ----

export interface SpaceFeatures {
  /** Track time on tasks */
  timeTracking: boolean;
  /** Task dependencies (blocks / blocked by) */
  dependencies: boolean;
  /** Allow multiple assignees per task */
  multipleAssignees: boolean;
  /** Show priority field on tasks */
  priorities: boolean;
  /** Enable tags on tasks */
  tags: boolean;
  /** Show custom fields on tasks */
  customFields: boolean;
  /** Allow creating subtasks */
  subtasks: boolean;
  /** Show checklists on tasks */
  checklists: boolean;
  /** Allow recurring tasks */
  recurrence: boolean;
  /** Enable time estimates */
  timeEstimates: boolean;
  /** Allow task attachments */
  attachments: boolean;
  /** Enable start dates (not just due dates) */
  startDates: boolean;
  /** Show task type selector */
  taskTypes: boolean;
  /** Enable watchers on tasks */
  watchers: boolean;
}

/** All features enabled — used as default */
export const ALL_FEATURES: SpaceFeatures = {
  timeTracking: true,
  dependencies: true,
  multipleAssignees: true,
  priorities: true,
  tags: true,
  customFields: true,
  subtasks: true,
  checklists: true,
  recurrence: true,
  timeEstimates: true,
  attachments: true,
  startDates: true,
  taskTypes: true,
  watchers: true,
};

/** Minimal feature set — for simple spaces */
export const MINIMAL_FEATURES: SpaceFeatures = {
  timeTracking: false,
  dependencies: false,
  multipleAssignees: false,
  priorities: true,
  tags: true,
  customFields: false,
  subtasks: true,
  checklists: true,
  recurrence: false,
  timeEstimates: false,
  attachments: true,
  startDates: false,
  taskTypes: false,
  watchers: false,
};

/** Feature metadata for UI rendering */
export interface SpaceFeatureMeta {
  key: keyof SpaceFeatures;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  icon: string;
  category: 'tasks' | 'tracking' | 'collaboration';
}

export const FEATURE_CATALOG: SpaceFeatureMeta[] = [
  // Tasks category
  { key: 'priorities', name: 'Priorities', nameEs: 'Prioridades', description: 'Set urgency levels on tasks', descriptionEs: 'Asignar niveles de urgencia a tareas', icon: 'Flag', category: 'tasks' },
  { key: 'tags', name: 'Tags', nameEs: 'Etiquetas', description: 'Categorize tasks with labels', descriptionEs: 'Categorizar tareas con etiquetas', icon: 'Tag', category: 'tasks' },
  { key: 'customFields', name: 'Custom Fields', nameEs: 'Campos personalizados', description: 'Add custom data fields to tasks', descriptionEs: 'Agregar campos de datos personalizados', icon: 'Columns3', category: 'tasks' },
  { key: 'subtasks', name: 'Subtasks', nameEs: 'Subtareas', description: 'Break tasks into smaller pieces', descriptionEs: 'Dividir tareas en piezas mas pequenas', icon: 'ListTree', category: 'tasks' },
  { key: 'checklists', name: 'Checklists', nameEs: 'Checklists', description: 'Add checklist items to tasks', descriptionEs: 'Agregar items de checklist a tareas', icon: 'ListChecks', category: 'tasks' },
  { key: 'dependencies', name: 'Dependencies', nameEs: 'Dependencias', description: 'Link tasks that block each other', descriptionEs: 'Vincular tareas que se bloquean entre si', icon: 'Link2', category: 'tasks' },
  { key: 'taskTypes', name: 'Task Types', nameEs: 'Tipos de tarea', description: 'Differentiate bugs, features, improvements', descriptionEs: 'Diferenciar bugs, features, mejoras', icon: 'Shapes', category: 'tasks' },
  { key: 'recurrence', name: 'Recurrence', nameEs: 'Recurrencia', description: 'Auto-create repeating tasks', descriptionEs: 'Crear tareas repetitivas automaticamente', icon: 'Repeat', category: 'tasks' },
  { key: 'startDates', name: 'Start Dates', nameEs: 'Fechas de inicio', description: 'Track when work should begin', descriptionEs: 'Rastrear cuando debe comenzar el trabajo', icon: 'CalendarRange', category: 'tasks' },
  { key: 'attachments', name: 'Attachments', nameEs: 'Adjuntos', description: 'Upload files to tasks', descriptionEs: 'Subir archivos a tareas', icon: 'Paperclip', category: 'tasks' },
  // Tracking category
  { key: 'timeTracking', name: 'Time Tracking', nameEs: 'Control de tiempo', description: 'Track time spent on tasks', descriptionEs: 'Rastrear tiempo dedicado a tareas', icon: 'Clock', category: 'tracking' },
  { key: 'timeEstimates', name: 'Time Estimates', nameEs: 'Estimaciones de tiempo', description: 'Estimate hours for tasks', descriptionEs: 'Estimar horas para tareas', icon: 'Hourglass', category: 'tracking' },
  // Collaboration category
  { key: 'multipleAssignees', name: 'Multiple Assignees', nameEs: 'Asignacion multiple', description: 'Assign multiple people to a task', descriptionEs: 'Asignar multiples personas a una tarea', icon: 'Users', category: 'collaboration' },
  { key: 'watchers', name: 'Watchers', nameEs: 'Observadores', description: 'Let people follow task updates', descriptionEs: 'Permitir que personas sigan actualizaciones', icon: 'Eye', category: 'collaboration' },
];

// ---- Persistence ----

function featuresPath(spaceId: string): string {
  return `orgs/${ORG}/teams/${spaceId}/settings/features`;
}

/** Load space features. Falls back to all-enabled defaults. */
export async function getSpaceFeatures(spaceId: string): Promise<SpaceFeatures> {
  try {
    const snap = await getDoc(doc(db, featuresPath(spaceId)));
    if (snap.exists()) {
      return { ...ALL_FEATURES, ...snap.data() } as SpaceFeatures;
    }
  } catch (err) {
    console.error('[SpaceFeatures] Failed to load:', err);
  }
  return { ...ALL_FEATURES };
}

/** Save space features (merge). */
export async function saveSpaceFeatures(
  spaceId: string,
  features: Partial<SpaceFeatures>,
  userId: string,
): Promise<void> {
  await setDoc(doc(db, featuresPath(spaceId)), {
    ...features,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }, { merge: true });
}

/** Reset space features to all-enabled defaults. */
export async function resetSpaceFeatures(spaceId: string, userId: string): Promise<void> {
  await saveSpaceFeatures(spaceId, ALL_FEATURES, userId);
}

// ---- Hook-friendly checker ----

/**
 * Check if a specific feature is enabled for a space.
 * If features haven't been loaded yet, defaults to enabled.
 */
export function isSpaceFeatureEnabled(
  features: SpaceFeatures | null | undefined,
  feature: keyof SpaceFeatures,
): boolean {
  if (!features) return true; // Default: all enabled
  return features[feature] !== false;
}
