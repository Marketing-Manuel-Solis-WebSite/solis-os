import type { ComponentType } from 'react';
import type { Task, TaskGroup, Density, SubtaskDisplay, CalendarMode } from '@/components/tasks/constants';

// ============================================
// VIEW ADAPTER — interface that every view implements
// ============================================

/** Common props every view receives */
export interface ViewProps {
  groups: TaskGroup[];
  tasks: Task[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  canUpdate: boolean;
  onSelect: (task: Task) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onDelete: (task: Task) => void;
  onQuickCreate: (data: any) => void;
  // List view extras
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
  density?: Density;
  columns?: string[];
  subtaskDisplay?: SubtaskDisplay;
  // Calendar view extras
  calendarMode?: CalendarMode;
  onModeChange?: (mode: CalendarMode) => void;
  onDateChange?: (taskId: string, newDate: Date) => void;
}

/** Declares a view's capabilities */
export interface ViewCapabilities {
  groupBy: boolean;
  sort: boolean;
  filter: boolean;
  density: boolean;
  columns: boolean;
  bulkSelect: boolean;
  calendarMode: boolean;
}

/** Registration entry for a view */
export interface ViewEntry {
  id: string;
  name: string;
  nameEs: string;
  iconName: string;
  shortcut?: string;
  component: ComponentType<ViewProps>;
  capabilities: ViewCapabilities;
}

// ============================================
// REGISTRY — singleton map of registered views
// ============================================

const registry = new Map<string, ViewEntry>();

/** Register a view type */
export function registerView(entry: ViewEntry): void {
  registry.set(entry.id, entry);
}

/** Get a view by id */
export function getView(id: string): ViewEntry | undefined {
  return registry.get(id);
}

/** Get all registered views in insertion order */
export function getAllViews(): ViewEntry[] {
  return Array.from(registry.values());
}

/** Check if a view id exists */
export function hasView(id: string): boolean {
  return registry.has(id);
}
