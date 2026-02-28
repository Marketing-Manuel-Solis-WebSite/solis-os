import {
  Circle, Loader2, Eye, CheckCircle2, AlertCircle,
  CheckSquare, Bug, Zap, Milestone, Target,
  Users, Globe, Lock,
  LayoutList, LayoutGrid, Calendar as CalendarIcon,
} from 'lucide-react';

// === TASK INTERFACE ===
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
}

// === VIEW TYPES ===
export type ViewType = 'list' | 'board' | 'calendar';

export const VIEWS = [
  { id: 'list' as ViewType, label: 'Lista', Icon: LayoutList, shortcut: '1' },
  { id: 'board' as ViewType, label: 'Tablero', Icon: LayoutGrid, shortcut: '2' },
  { id: 'calendar' as ViewType, label: 'Calendario', Icon: CalendarIcon, shortcut: '3' },
] as const;

// === FILTER STATE ===
export interface FilterState {
  status: string[];
  priority: string[];
  assignee: string[];
  type: string[];
  tags: string[];
  dateRange: { from: string | null; to: string | null };
  search: string;
}

export const EMPTY_FILTERS: FilterState = {
  status: [],
  priority: [],
  assignee: [],
  type: [],
  tags: [],
  dateRange: { from: null, to: null },
  search: '',
};

// === SORT OPTIONS ===
export const SORT_OPTIONS = [
  { id: 'created', label: 'Más recientes', field: 'createdAt' },
  { id: 'priority', label: 'Prioridad', field: 'priority' },
  { id: 'due', label: 'Fecha límite', field: 'dueDate' },
  { id: 'title', label: 'A-Z', field: 'title' },
  { id: 'status', label: 'Estado', field: 'status' },
  { id: 'points', label: 'Puntos', field: 'points' },
] as const;

// === GROUP OPTIONS ===
export const GROUP_OPTIONS = [
  { id: 'status', label: 'Estado' },
  { id: 'priority', label: 'Prioridad' },
  { id: 'type', label: 'Tipo' },
  { id: 'assignee', label: 'Asignado' },
  { id: 'none', label: 'Sin agrupar' },
] as const;

// === TASK GROUP ===
export interface TaskGroup {
  key: string;
  label: string;
  color: string;
  tasks: Task[];
  count: number;
}

// === KEYBOARD SHORTCUTS ===
export const SHORTCUTS = {
  newTask: 'n',
  search: 'f',
  viewList: '1',
  viewBoard: '2',
  viewCalendar: '3',
  escape: 'Escape',
  delete: 'Delete',
} as const;

// === SAVED VIEW ===
export interface SavedView {
  id: string;
  name: string;
  view: ViewType;
  filters: FilterState;
  sortBy: string;
  groupBy: string;
  createdBy: string;
  createdAt?: any;
}

// === STATUSES ===
export const STATUSES = [
  { id: 'todo', label: 'Por Hacer', color: '#64748B', Icon: Circle },
  { id: 'in_progress', label: 'En Progreso', color: '#3B82F6', Icon: Loader2 },
  { id: 'in_review', label: 'En Revisión', color: '#A855F7', Icon: Eye },
  { id: 'done', label: 'Completado', color: '#22C55E', Icon: CheckCircle2 },
  { id: 'blocked', label: 'Bloqueado', color: '#EF4444', Icon: AlertCircle },
];

// === PRIORITIES ===
export const PRIORITIES = [
  { id: 'urgent', label: 'Urgente', color: '#EF4444', icon: '🔴' },
  { id: 'high', label: 'Alta', color: '#F59E0B', icon: '🟠' },
  { id: 'medium', label: 'Media', color: '#3B82F6', icon: '🔵' },
  { id: 'low', label: 'Baja', color: '#64748B', icon: '⚪' },
];

// === TASK TYPES ===
export const TASK_TYPES = [
  { id: 'task', label: 'Tarea', Icon: CheckSquare, color: '#3B82F6' },
  { id: 'bug', label: 'Error', Icon: Bug, color: '#EF4444' },
  { id: 'feature', label: 'Función', Icon: Zap, color: '#A855F7' },
  { id: 'milestone', label: 'Hito', Icon: Milestone, color: '#F59E0B' },
  { id: 'epic', label: 'Épica', Icon: Target, color: '#22C55E' },
];

// === VISIBILITY ===
export const VISIBILITY = [
  { id: 'team', label: 'Equipo', Icon: Users, color: '#3B82F6' },
  { id: 'public', label: 'Público', Icon: Globe, color: '#22C55E' },
  { id: 'private', label: 'Privado', Icon: Lock, color: '#EF4444' },
];

// === PRIORITY ORDER (for sorting) ===
export const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// === PREDEFINED CUSTOM FIELDS ===
export const DEFAULT_CUSTOM_FIELDS: { id: string; label: string; type: string; options?: string[] }[] = [
  { id: 'caseNumber', label: 'No. de Caso', type: 'text' },
  { id: 'caseValue', label: 'Valor del Caso', type: 'currency' },
  { id: 'filingDate', label: 'Fecha de Presentación', type: 'date' },
  { id: 'caseType', label: 'Tipo de Caso', type: 'select', options: ['Civil', 'Criminal', 'Familia', 'Inmigración', 'Laboral', 'Otro'] },
  { id: 'courtLocation', label: 'Ubicación del Juzgado', type: 'text' },
  { id: 'retainerPaid', label: 'Anticipo Pagado', type: 'checkbox' },
  { id: 'clientName', label: 'Nombre del Cliente', type: 'text' },
  { id: 'clientPhone', label: 'Teléfono del Cliente', type: 'phone' },
  { id: 'clientEmail', label: 'Email del Cliente', type: 'email' },
  { id: 'referenceUrl', label: 'URL de Referencia', type: 'url' },
];

// === ACCEPTED FILE TYPES ===
export const ACCEPTED_FILES = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
