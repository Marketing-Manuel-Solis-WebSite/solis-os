import {
  Circle, Loader2, Eye, CheckCircle2, AlertCircle,
  CheckSquare, Bug, Zap, Milestone, Target,
  Users, Globe, Lock,
  LayoutList, LayoutGrid, Calendar as CalendarIcon,
  CalendarDays, CalendarRange,
} from 'lucide-react';

// =============================================
// TASK INTERFACE
// =============================================
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  visibility: string;
  assignees: string[];
  tags: string[];
  teamId: string;
  listId?: string | null;
  createdBy: string;
  dueDate?: any;
  startDate?: any;
  createdAt?: any;
  updatedAt?: any;
  timeEstimate?: number | null;
  timeSpent?: number;
  points?: number | null;
  subtasks: { id: string; title: string; done: boolean }[];
  checklist: any[];
  attachments: any[];
  dependencies: string[];
  customFields: Record<string, any>;
  watchers: string[];
  archived: boolean;
  deleted?: boolean;
  deletedAt?: any;
  recurrence?: any;
  isRecurrenceTemplate?: boolean;
  recurrenceTemplateId?: string;
  recurrenceInstanceDate?: any;
}

// =============================================
// VIEW TYPES
// =============================================
export type ViewType = 'list' | 'board' | 'calendar';
export type CalendarMode = 'month' | 'week' | 'day';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type SubtaskDisplay = 'hidden' | 'count' | 'progress' | 'expanded';

export const VIEWS = [
  { id: 'list' as ViewType, Icon: LayoutList, shortcut: '1' },
  { id: 'board' as ViewType, Icon: LayoutGrid, shortcut: '2' },
  { id: 'calendar' as ViewType, Icon: CalendarIcon, shortcut: '3' },
] as const;

export const CALENDAR_MODES = [
  { id: 'month' as CalendarMode, Icon: CalendarIcon },
  { id: 'week' as CalendarMode, Icon: CalendarDays },
  { id: 'day' as CalendarMode, Icon: CalendarRange },
] as const;

export const DENSITIES: { id: Density; rowHeight: number }[] = [
  { id: 'compact', rowHeight: 36 },
  { id: 'comfortable', rowHeight: 48 },
  { id: 'spacious', rowHeight: 56 },
];

// =============================================
// VIEW PRESETS (built-in tabs)
// =============================================
export interface ViewPreset {
  id: string;
  icon?: string;
  isBuiltIn: boolean;
  filterFn?: (task: Task, userId: string) => boolean;
  filters?: Partial<FilterState>;
}

export const BUILT_IN_PRESETS: ViewPreset[] = [
  { id: 'all', isBuiltIn: true },
  { id: 'my_tasks', isBuiltIn: true, filterFn: (t, uid) => t.assignees?.includes(uid) },
  { id: 'today', isBuiltIn: true, filterFn: (t) => {
    const d = t.dueDate?.toDate?.();
    if (!d) return false;
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }},
  { id: 'upcoming', isBuiltIn: true, filterFn: (t) => {
    const d = t.dueDate?.toDate?.();
    if (!d) return false;
    const now = new Date(); now.setHours(0,0,0,0);
    const week = new Date(now); week.setDate(week.getDate() + 7);
    return d >= now && d <= week;
  }},
  { id: 'overdue', isBuiltIn: true, filterFn: (t) => {
    const d = t.dueDate?.toDate?.();
    return d && d < new Date() && t.status !== 'done';
  }},
  { id: 'in_review', isBuiltIn: true, filters: { status: ['in_review'] } },
];

// =============================================
// FILTER STATE
// =============================================
export interface FilterState {
  status: string[];
  priority: string[];
  assignee: string[];
  type: string[];
  tags: string[];
  dateRange: { from: string | null; to: string | null };
  search: string;
  // New filters
  hasAttachments?: boolean;
  hasDependencies?: boolean;
  isBlocked?: boolean;
  noDate?: boolean;
  noAssignee?: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  status: [],
  priority: [],
  assignee: [],
  type: [],
  tags: [],
  dateRange: { from: null, to: null },
  search: '',
  hasAttachments: false,
  hasDependencies: false,
  isBlocked: false,
  noDate: false,
  noAssignee: false,
};

// =============================================
// SORT OPTIONS
// =============================================
export const SORT_OPTIONS = [
  { id: 'created', field: 'createdAt' },
  { id: 'priority', field: 'priority' },
  { id: 'due', field: 'dueDate' },
  { id: 'title', field: 'title' },
  { id: 'status', field: 'status' },
  { id: 'points', field: 'points' },
] as const;

// =============================================
// GROUP OPTIONS
// =============================================
export const GROUP_OPTIONS = [
  { id: 'status' },
  { id: 'priority' },
  { id: 'type' },
  { id: 'assignee' },
  { id: 'none' },
] as const;

// =============================================
// TASK GROUP
// =============================================
export interface TaskGroup {
  key: string;
  label: string;
  color: string;
  tasks: Task[];
  count: number;
}

// =============================================
// KEYBOARD SHORTCUTS
// =============================================
export const SHORTCUTS = {
  newTask: 'n',
  search: 'f',
  viewList: '1',
  viewBoard: '2',
  viewCalendar: '3',
  escape: 'Escape',
  delete: 'Delete',
} as const;

// =============================================
// SAVED VIEW (enhanced)
// =============================================
export interface SavedView {
  id: string;
  name: string;
  view: ViewType;
  filters: FilterState;
  sortBy: string;
  groupBy: string;
  createdBy: string;
  createdAt?: any;
  // Enhanced fields
  pinned?: boolean;
  shared?: boolean;
  density?: Density;
  columns?: string[];
  subtaskDisplay?: SubtaskDisplay;
  calendarMode?: CalendarMode;
}

// =============================================
// USER PREFERENCES (persisted to Firestore)
// =============================================
export interface TaskPreferences {
  defaultView: ViewType;
  density: Density;
  sidebarOpen: boolean;
  columns: string[];
  subtaskDisplay: SubtaskDisplay;
  calendarMode: CalendarMode;
  pinnedPresets: string[];
  collapsedSections: string[];
  meMode: boolean;
  lastSortBy: string;
  lastSortDir: 'asc' | 'desc';
  lastGroupBy: string;
}

export const DEFAULT_PREFERENCES: TaskPreferences = {
  defaultView: 'list',
  density: 'comfortable',
  sidebarOpen: true,
  columns: ['checkbox', 'status', 'title', 'priority', 'assignees', 'due', 'tags', 'points'],
  subtaskDisplay: 'count',
  calendarMode: 'month',
  pinnedPresets: ['all', 'my_tasks', 'today'],
  collapsedSections: [],
  meMode: false,
  lastSortBy: 'created',
  lastSortDir: 'desc',
  lastGroupBy: 'status',
};

// =============================================
// LIST COLUMNS (configurable)
// =============================================
export interface ColumnDef {
  id: string;
  labelKey: string;
  width: string;
  minWidth?: string;
  sortable: boolean;
  hideable: boolean;
  defaultVisible: boolean;
}

export const ALL_COLUMNS: ColumnDef[] = [
  { id: 'checkbox', labelKey: '', width: 'w-10', sortable: false, hideable: false, defaultVisible: true },
  { id: 'status', labelKey: 'taskCreate.status', width: 'w-10', sortable: true, hideable: false, defaultVisible: true },
  { id: 'title', labelKey: 'taskCreate.titlePlaceholder', width: 'flex-1', minWidth: 'min-w-[200px]', sortable: true, hideable: false, defaultVisible: true },
  { id: 'priority', labelKey: 'taskCreate.priority', width: 'w-24', sortable: true, hideable: true, defaultVisible: true },
  { id: 'assignees', labelKey: 'taskCreate.assignees', width: 'w-28', sortable: false, hideable: true, defaultVisible: true },
  { id: 'due', labelKey: 'taskCreate.dueDate', width: 'w-28', sortable: true, hideable: true, defaultVisible: true },
  { id: 'tags', labelKey: 'taskCreate.tags', width: 'w-32', sortable: false, hideable: true, defaultVisible: true },
  { id: 'points', labelKey: 'taskCreate.points', width: 'w-16', sortable: true, hideable: true, defaultVisible: true },
  { id: 'type', labelKey: 'taskCreate.type', width: 'w-20', sortable: false, hideable: true, defaultVisible: false },
  { id: 'timeEstimate', labelKey: 'taskCreate.timeEstimate', width: 'w-20', sortable: true, hideable: true, defaultVisible: false },
  { id: 'created', labelKey: 'taskDetail.created', width: 'w-28', sortable: true, hideable: true, defaultVisible: false },
  { id: 'team', labelKey: 'taskCreate.department', width: 'w-24', sortable: false, hideable: true, defaultVisible: false },
];

// =============================================
// STATUSES
// =============================================
export const STATUSES = [
  { id: 'todo', color: '#64748B', Icon: Circle },
  { id: 'in_progress', color: '#3B82F6', Icon: Loader2 },
  { id: 'in_review', color: '#A855F7', Icon: Eye },
  { id: 'done', color: '#22C55E', Icon: CheckCircle2 },
  { id: 'blocked', color: '#EF4444', Icon: AlertCircle },
];

// =============================================
// PRIORITIES
// =============================================
export const PRIORITIES = [
  { id: 'urgent', color: '#EF4444', icon: '🔴' },
  { id: 'high', color: '#F59E0B', icon: '🟠' },
  { id: 'medium', color: '#3B82F6', icon: '🔵' },
  { id: 'low', color: '#64748B', icon: '⚪' },
];

// =============================================
// TASK TYPES
// =============================================
export const TASK_TYPES = [
  { id: 'task', Icon: CheckSquare, color: '#3B82F6' },
  { id: 'bug', Icon: Bug, color: '#EF4444' },
  { id: 'feature', Icon: Zap, color: '#A855F7' },
  { id: 'milestone', Icon: Milestone, color: '#F59E0B' },
  { id: 'epic', Icon: Target, color: '#22C55E' },
];

// =============================================
// VISIBILITY
// =============================================
export const VISIBILITY = [
  { id: 'team', Icon: Users, color: '#3B82F6' },
  { id: 'public', Icon: Globe, color: '#22C55E' },
  { id: 'private', Icon: Lock, color: '#EF4444' },
];

// =============================================
// PRIORITY ORDER (for sorting)
// =============================================
export const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// =============================================
// PREDEFINED CUSTOM FIELDS
// =============================================
export const DEFAULT_CUSTOM_FIELDS: { id: string; label: string; type: string; group: string; options?: string[] }[] = [
  // Legal / Case fields
  { id: 'caseNumber', label: 'No. de Caso', type: 'text', group: 'legal' },
  { id: 'caseValue', label: 'Valor del Caso', type: 'currency', group: 'legal' },
  { id: 'filingDate', label: 'Fecha de Presentacion', type: 'date', group: 'legal' },
  { id: 'caseType', label: 'Tipo de Caso', type: 'select', group: 'legal', options: ['Civil', 'Criminal', 'Familia', 'Inmigracion', 'Laboral', 'Otro'] },
  { id: 'courtLocation', label: 'Ubicacion del Juzgado', type: 'text', group: 'legal' },
  { id: 'retainerPaid', label: 'Anticipo Pagado', type: 'checkbox', group: 'legal' },
  // Client fields
  { id: 'clientName', label: 'Nombre del Cliente', type: 'text', group: 'client' },
  { id: 'clientPhone', label: 'Telefono del Cliente', type: 'phone', group: 'client' },
  { id: 'clientEmail', label: 'Email del Cliente', type: 'email', group: 'client' },
  // Reference
  { id: 'referenceUrl', label: 'URL de Referencia', type: 'url', group: 'reference' },
];

export const CUSTOM_FIELD_GROUPS = [
  { id: 'legal', labelKey: 'customFieldGroup.legal' },
  { id: 'client', labelKey: 'customFieldGroup.client' },
  { id: 'reference', labelKey: 'customFieldGroup.reference' },
];

// =============================================
// ACCEPTED FILE TYPES
// =============================================
export const ACCEPTED_FILES = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';

// =============================================
// HELPERS
// =============================================
export function getStatusConfig(id: string) {
  return STATUSES.find(s => s.id === id) || STATUSES[0];
}
export function getPriorityConfig(id: string) {
  return PRIORITIES.find(p => p.id === id) || PRIORITIES[2];
}
export function getTypeConfig(id: string) {
  return TASK_TYPES.find(t => t.id === id) || TASK_TYPES[0];
}
export function getVisibilityConfig(id: string) {
  return VISIBILITY.find(v => v.id === id) || VISIBILITY[0];
}

export function isOverdue(task: Task): boolean {
  const d = task.dueDate?.toDate?.();
  return d && d < new Date() && task.status !== 'done';
}

export function getSubtaskProgress(task: Task): { done: number; total: number; pct: number } {
  const total = (task.subtasks || []).length;
  const done = (task.subtasks || []).filter(s => s.done).length;
  return { done, total, pct: total > 0 ? Math.round(done / total * 100) : 0 };
}

export function countActiveFilters(f: FilterState): number {
  return [
    f.status.length,
    f.priority.length,
    f.assignee.length,
    f.type.length,
    f.tags.length,
    f.dateRange.from || f.dateRange.to ? 1 : 0,
    f.hasAttachments ? 1 : 0,
    f.hasDependencies ? 1 : 0,
    f.isBlocked ? 1 : 0,
    f.noDate ? 1 : 0,
    f.noAssignee ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

export function applyFilters(tasks: Task[], filters: FilterState): Task[] {
  let result = tasks.filter(t => !t.archived);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t => {
      if (t.title?.toLowerCase().includes(q)) return true;
      if (t.description?.toLowerCase().includes(q)) return true;
      if (t.tags?.some(tag => tag.toLowerCase().includes(q))) return true;
      // Search all custom field string values dynamically
      if (t.customFields) {
        for (const val of Object.values(t.customFields)) {
          if (typeof val === 'string' && val.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }

  if (filters.status.length > 0) result = result.filter(t => filters.status.includes(t.status));
  if (filters.priority.length > 0) result = result.filter(t => filters.priority.includes(t.priority));
  if (filters.assignee.length > 0) result = result.filter(t => t.assignees?.some(a => filters.assignee.includes(a)));
  if (filters.type.length > 0) result = result.filter(t => filters.type.includes(t.type || 'task'));
  if (filters.tags.length > 0) result = result.filter(t => t.tags?.some(tag => filters.tags.includes(tag)));

  if (filters.dateRange.from) {
    const from = new Date(filters.dateRange.from);
    result = result.filter(t => { const d = t.dueDate?.toDate?.(); return d && d >= from; });
  }
  if (filters.dateRange.to) {
    const to = new Date(filters.dateRange.to); to.setHours(23, 59, 59);
    result = result.filter(t => { const d = t.dueDate?.toDate?.(); return d && d <= to; });
  }

  if (filters.hasAttachments) result = result.filter(t => (t.attachments || []).length > 0);
  if (filters.hasDependencies) result = result.filter(t => (t.dependencies || []).length > 0);
  if (filters.isBlocked) result = result.filter(t => t.status === 'blocked');
  if (filters.noDate) result = result.filter(t => !t.dueDate);
  if (filters.noAssignee) result = result.filter(t => !t.assignees?.length);

  return result;
}

export function sortTasks(tasks: Task[], sortBy: string, sortDir: 'asc' | 'desc'): Task[] {
  return [...tasks].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'priority': return ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)) * dir;
      case 'due': return ((a.dueDate?.seconds || 9e9) - (b.dueDate?.seconds || 9e9)) * dir;
      case 'title': return (a.title || '').localeCompare(b.title || '') * dir;
      case 'status': {
        const so: Record<string, number> = {};
        STATUSES.forEach((s, i) => so[s.id] = i);
        return ((so[a.status] ?? 9) - (so[b.status] ?? 9)) * dir;
      }
      case 'points': return ((a.points || 0) - (b.points || 0)) * dir;
      default: return ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) * dir;
    }
  });
}

export function groupTasks(tasks: Task[], groupBy: string, members: any[], t: (k: string) => string): TaskGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: t('tasks.all'), tasks, color: '#94A3B8', count: tasks.length }];
  if (groupBy === 'status') return STATUSES.map(s => {
    const tk = tasks.filter(x => x.status === s.id);
    return { key: s.id, label: t(`status.${s.id}`), tasks: tk, color: s.color, count: tk.length };
  });
  if (groupBy === 'priority') return PRIORITIES.map(p => {
    const tk = tasks.filter(x => x.priority === p.id);
    return { key: p.id, label: t(`priority.${p.id}`), tasks: tk, color: p.color, count: tk.length };
  });
  if (groupBy === 'assignee') {
    const grouped: TaskGroup[] = members.map(m => {
      const tk = tasks.filter(x => x.assignees?.includes(m.id));
      return { key: m.id, label: m.displayName || m.email, tasks: tk, color: '#3B82F6', count: tk.length };
    });
    const unassigned = tasks.filter(x => !x.assignees?.length);
    if (unassigned.length > 0) grouped.push({ key: '__none__', label: t('tasks.unassigned'), tasks: unassigned, color: '#64748B', count: unassigned.length });
    return grouped;
  }
  return TASK_TYPES.map(tp => {
    const tk = tasks.filter(x => (x.type || 'task') === tp.id);
    return { key: tp.id, label: t(`taskType.${tp.id}`), tasks: tk, color: tp.color, count: tk.length };
  });
}
