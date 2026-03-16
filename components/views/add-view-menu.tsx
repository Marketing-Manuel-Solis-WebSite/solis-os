'use client';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, List, Columns3, Calendar, Table, GanttChart, Clock, Users,
  LayoutDashboard, FileText, FileInput, PenTool,
} from 'lucide-react';

export type TaskViewType = 'list' | 'board' | 'calendar' | 'table' | 'gantt' | 'timeline' | 'workload';
export type ArtifactViewType = 'dashboard' | 'doc' | 'form' | 'whiteboard';
export type ViewType = TaskViewType | ArtifactViewType;

interface AddViewMenuProps {
  onSelect: (viewType: ViewType) => void;
  /** Disable certain view types that already exist */
  disabledTypes?: ViewType[];
}

const TASK_VIEWS: { type: TaskViewType; labelEs: string; labelEn: string; icon: React.ComponentType<any> }[] = [
  { type: 'list', labelEs: 'Lista', labelEn: 'List', icon: List },
  { type: 'board', labelEs: 'Tablero', labelEn: 'Board', icon: Columns3 },
  { type: 'calendar', labelEs: 'Calendario', labelEn: 'Calendar', icon: Calendar },
  { type: 'table', labelEs: 'Tabla', labelEn: 'Table', icon: Table },
  { type: 'gantt', labelEs: 'Gantt', labelEn: 'Gantt', icon: GanttChart },
  { type: 'timeline', labelEs: 'Linea de tiempo', labelEn: 'Timeline', icon: Clock },
  { type: 'workload', labelEs: 'Carga de trabajo', labelEn: 'Workload', icon: Users },
];

const ARTIFACT_VIEWS: { type: ArtifactViewType; labelEs: string; labelEn: string; icon: React.ComponentType<any> }[] = [
  { type: 'dashboard', labelEs: 'Dashboard', labelEn: 'Dashboard', icon: LayoutDashboard },
  { type: 'doc', labelEs: 'Documento', labelEn: 'Doc', icon: FileText },
  { type: 'form', labelEs: 'Formulario', labelEn: 'Form', icon: FileInput },
  { type: 'whiteboard', labelEs: 'Pizarra', labelEn: 'Whiteboard', icon: PenTool },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function AddViewMenu({ onSelect, disabledTypes = [] }: AddViewMenuProps) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (type: ViewType) => {
    onSelect(type);
    setOpen(false);
  };

  const disabledSet = new Set(disabledTypes);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
      >
        <Plus className="h-3.5 w-3.5" />
        {lang === 'es' ? 'Agregar vista' : 'Add View'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute left-0 top-full mt-1.5 w-[260px] rounded-xl bg-[var(--bg-elevated)] shadow-xl border border-[var(--border)] z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                {lang === 'es' ? 'Agregar vista' : 'Add View'}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* Task views section */}
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] px-1 mb-1.5">
                {lang === 'es' ? 'Vistas de tareas' : 'Task Views'}
              </p>
              <div className="space-y-0.5">
                {TASK_VIEWS.map(view => {
                  const disabled = disabledSet.has(view.type);
                  const Icon = view.icon;
                  return (
                    <button
                      key={view.type}
                      onClick={() => !disabled && handleSelect(view.type)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      <span>{lang === 'es' ? view.labelEs : view.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[var(--border-subtle)] mx-3 my-1" />

            {/* Artifact views section */}
            <div className="px-3 pt-1 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] px-1 mb-1.5">
                {lang === 'es' ? 'Vistas de artefactos' : 'Artifact Views'}
              </p>
              <div className="space-y-0.5">
                {ARTIFACT_VIEWS.map(view => {
                  const disabled = disabledSet.has(view.type);
                  const Icon = view.icon;
                  return (
                    <button
                      key={view.type}
                      onClick={() => !disabled && handleSelect(view.type)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      <span>{lang === 'es' ? view.labelEs : view.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
