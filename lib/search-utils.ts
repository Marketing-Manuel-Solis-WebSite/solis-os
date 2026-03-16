// ================================================================
// SOLIS CENTER — Global Search Utilities
// Pure functions: scoring, matching, accent-stripping, icons
// ================================================================

import {
  CheckSquare, FileText, MessageSquare, Target, Users, FileInput,
  LayoutDashboard, CalendarDays, Zap, BarChart3, Bot, Clock, PenTool, Plug,
  Shield, Settings, Sun, Moon, Plus, Activity,
} from 'lucide-react';

// --- Types ---
export type SearchEntityType = 'task' | 'doc' | 'channel' | 'goal' | 'member' | 'form';
export type QuickActionType = 'navigate' | 'create' | 'toggle';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  status?: string;
  href?: string;
  score: number;
  raw: any;
}

export interface QuickAction {
  id: string;
  type: QuickActionType;
  label: string;
  labelEs: string;
  icon: any;
  href?: string;
  action?: string;
  keywords: string[];
}

// --- Accent stripping for bilingual search ---
const ACCENT_MAP: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u',
  ñ: 'n', Á: 'a', É: 'e', Í: 'i', Ó: 'o', Ú: 'u', Ñ: 'n',
};

export function stripAccents(str: string): string {
  return str.replace(/[áéíóúüñÁÉÍÓÚÑ]/g, c => ACCENT_MAP[c] || c);
}

export function normalize(str: string): string {
  return stripAccents(str).toLowerCase().trim();
}

// --- Scoring ---
export function scoreMatch(query: string, title: string, subtitle?: string): number {
  const q = normalize(query);
  const t = normalize(title);
  const s = subtitle ? normalize(subtitle) : '';

  if (!q) return 0;

  // Exact match
  if (t === q) return 100;
  // Starts with
  if (t.startsWith(q)) return 90;
  // Word starts with
  const words = t.split(/\s+/);
  if (words.some(w => w.startsWith(q))) return 75;
  // Contains
  if (t.includes(q)) return 60;
  // Subtitle match
  if (s.includes(q)) return 40;
  // Fuzzy: all query chars in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 20;

  return 0;
}

// --- Highlight matched text ---
export function highlightMatch(text: string, query: string): { text: string; highlight: boolean }[] {
  if (!query.trim()) return [{ text, highlight: false }];
  const q = normalize(query);
  const lower = normalize(text);
  const idx = lower.indexOf(q);
  if (idx === -1) return [{ text, highlight: false }];
  return [
    ...(idx > 0 ? [{ text: text.slice(0, idx), highlight: false }] : []),
    { text: text.slice(idx, idx + q.length), highlight: true },
    ...(idx + q.length < text.length ? [{ text: text.slice(idx + q.length), highlight: false }] : []),
  ];
}

// --- Entity type config ---
export const ENTITY_CONFIG: Record<SearchEntityType, { icon: any; color: string; labelEs: string; labelEn: string }> = {
  task: { icon: CheckSquare, color: 'var(--accent)', labelEs: 'Tareas', labelEn: 'Tasks' },
  doc: { icon: FileText, color: '#8B5CF6', labelEs: 'Documentos', labelEn: 'Documents' },
  channel: { icon: MessageSquare, color: '#06B6D4', labelEs: 'Canales', labelEn: 'Channels' },
  goal: { icon: Target, color: '#F59E0B', labelEs: 'Metas', labelEn: 'Goals' },
  member: { icon: Users, color: '#10B981', labelEs: 'Miembros', labelEn: 'Members' },
  form: { icon: FileInput, color: '#EC4899', labelEs: 'Formularios', labelEn: 'Forms' },
};

// --- Quick actions ---
export const QUICK_ACTIONS: QuickAction[] = [
  // Navigation
  { id: 'nav-dashboard', type: 'navigate', label: 'Go to Dashboard', labelEs: 'Ir al Dashboard', icon: LayoutDashboard, href: '/app', keywords: ['dashboard', 'home', 'inicio'] },
  { id: 'nav-tasks', type: 'navigate', label: 'Go to Tasks', labelEs: 'Ir a Tareas', icon: CheckSquare, href: '/app/tasks', keywords: ['tasks', 'tareas'] },
  { id: 'nav-docs', type: 'navigate', label: 'Go to Documents', labelEs: 'Ir a Documentos', icon: FileText, href: '/app/docs', keywords: ['docs', 'documents', 'documentos'] },
  { id: 'nav-chat', type: 'navigate', label: 'Go to Chat', labelEs: 'Ir al Chat', icon: MessageSquare, href: '/app/chat', keywords: ['chat', 'messages', 'mensajes'] },
  { id: 'nav-planner', type: 'navigate', label: 'Go to Planner', labelEs: 'Ir al Planificador', icon: CalendarDays, href: '/app/planner', keywords: ['planner', 'planificador', 'calendar'] },
  { id: 'nav-goals', type: 'navigate', label: 'Go to Goals', labelEs: 'Ir a Metas', icon: Target, href: '/app/goals', keywords: ['goals', 'metas', 'objectives'] },
  { id: 'nav-automations', type: 'navigate', label: 'Go to Automations', labelEs: 'Ir a Automaciones', icon: Zap, href: '/app/automations', keywords: ['automations', 'automaciones'] },
  { id: 'nav-analytics', type: 'navigate', label: 'Go to Analytics', labelEs: 'Ir a Analítica', icon: BarChart3, href: '/app/analytics', keywords: ['analytics', 'analitica', 'reports'] },
  { id: 'nav-timesheets', type: 'navigate', label: 'Go to Timesheets', labelEs: 'Ir a Horas', icon: Clock, href: '/app/timesheets', keywords: ['timesheets', 'horas', 'time'] },
  { id: 'nav-whiteboards', type: 'navigate', label: 'Go to Whiteboards', labelEs: 'Ir a Pizarras', icon: PenTool, href: '/app/whiteboards', keywords: ['whiteboards', 'pizarras'] },
  { id: 'nav-forms', type: 'navigate', label: 'Go to Forms', labelEs: 'Ir a Formularios', icon: FileInput, href: '/app/forms', keywords: ['forms', 'formularios'] },
  { id: 'nav-integrations', type: 'navigate', label: 'Go to Integrations', labelEs: 'Ir a Integraciones', icon: Plug, href: '/app/integrations', keywords: ['integrations', 'integraciones'] },
  { id: 'nav-ai', type: 'navigate', label: 'Go to Solis AI', labelEs: 'Ir a Solis AI', icon: Bot, href: '/app/ai', keywords: ['ai', 'assistant', 'asistente', 'solis'] },
  { id: 'nav-activity', type: 'navigate', label: 'Go to Activity', labelEs: 'Ir a Actividad', icon: Activity, href: '/app/activity', keywords: ['activity', 'actividad', 'feed', 'log', 'history'] },
  { id: 'nav-admin', type: 'navigate', label: 'Go to Admin', labelEs: 'Ir a Admin', icon: Shield, href: '/app/admin', keywords: ['admin', 'settings', 'configuracion'] },
  // Create actions
  { id: 'create-task', type: 'create', label: 'Create Task', labelEs: 'Crear Tarea', icon: Plus, action: 'create-task', keywords: ['create', 'new', 'task', 'crear', 'nueva', 'tarea'] },
  { id: 'create-doc', type: 'create', label: 'Create Document', labelEs: 'Crear Documento', icon: Plus, action: 'create-doc', keywords: ['create', 'new', 'doc', 'document', 'crear', 'nuevo', 'documento'] },
];

// --- Search quick actions ---
export function searchQuickActions(query: string, lang: 'es' | 'en'): QuickAction[] {
  const q = normalize(query);
  if (!q) return [];
  return QUICK_ACTIONS.filter(a => {
    const label = normalize(lang === 'es' ? a.labelEs : a.label);
    if (label.includes(q)) return true;
    return a.keywords.some(k => k.includes(q));
  }).slice(0, 5);
}
