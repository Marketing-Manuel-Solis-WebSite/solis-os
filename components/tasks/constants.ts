import {
  Circle, Loader2, Eye, CheckCircle2, AlertCircle,
  CheckSquare, Bug, Zap, Milestone, Target,
  Users, Globe, Lock,
} from 'lucide-react';

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
