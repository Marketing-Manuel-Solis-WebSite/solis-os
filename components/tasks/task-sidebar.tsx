'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronDown, X, Bookmark, Save,
} from 'lucide-react';
import {
  VIEWS, STATUSES, PRIORITIES, TASK_TYPES,
  SORT_OPTIONS, GROUP_OPTIONS,
  ViewType, FilterState, EMPTY_FILTERS, SavedView,
} from './constants';

interface Props {
  open: boolean;
  view: ViewType;
  filters: FilterState;
  groupBy: string;
  sortBy: string;
  members: any[];
  taskCounts: Record<string, number>;
  savedViews: SavedView[];
  onViewChange: (v: ViewType) => void;
  onFiltersChange: (f: FilterState) => void;
  onGroupByChange: (g: string) => void;
  onSortByChange: (s: string) => void;
  onToggle: () => void;
  onLoadView: (sv: SavedView) => void;
  onSaveView: () => void;
}

function FilterSection({ label, items, selected, onChange }: {
  label: string;
  items: { id: string; label: string; color: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <div className="px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map(item => (
          <button key={item.id} onClick={() => toggle(item.id)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
              selected.includes(item.id)
                ? 'ring-1 ring-current'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            style={selected.includes(item.id) ? { color: item.color, backgroundColor: `${item.color}15`, borderColor: `${item.color}30` } : {}}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TaskSidebar({
  open, view, filters, groupBy, sortBy, members,
  taskCounts, savedViews,
  onViewChange, onFiltersChange, onGroupByChange, onSortByChange,
  onToggle, onLoadView, onSaveView,
}: Props) {
  const [showFilters, setShowFilters] = useState(true);
  const [showSaved, setShowSaved] = useState(true);

  const activeFilterCount = [
    filters.status.length,
    filters.priority.length,
    filters.assignee.length,
    filters.type.length,
    filters.tags.length,
    filters.dateRange.from || filters.dateRange.to ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <motion.aside
      animate={{ width: open ? 240 : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full bg-[var(--bg-elevated)] shadow-panel flex flex-col overflow-hidden shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <span className="text-sm font-bold text-[var(--text-primary)]">Tareas</span>
        <button onClick={onToggle} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* View Switcher */}
        <div className="p-2 space-y-0.5">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Vistas</p>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => onViewChange(v.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all ${
                view === v.id
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}>
              <v.Icon className="h-4 w-4" />
              {v.label}
              <span className="ml-auto text-[10px] opacity-50">{v.shortcut}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-3" />

        {/* Filters Section */}
        <div className="p-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
            <motion.span animate={{ rotate: showFilters ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3 w-3" />
            </motion.span>
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <FilterSection label="Estado"
                  items={STATUSES.map(s => ({ id: s.id, label: s.label, color: s.color }))}
                  selected={filters.status}
                  onChange={(ids) => onFiltersChange({ ...filters, status: ids })} />

                <FilterSection label="Prioridad"
                  items={PRIORITIES.map(p => ({ id: p.id, label: p.label, color: p.color }))}
                  selected={filters.priority}
                  onChange={(ids) => onFiltersChange({ ...filters, priority: ids })} />

                <FilterSection label="Tipo"
                  items={TASK_TYPES.map(t => ({ id: t.id, label: t.label, color: t.color }))}
                  selected={filters.type}
                  onChange={(ids) => onFiltersChange({ ...filters, type: ids })} />

                <FilterSection label="Asignado"
                  items={members.map(m => ({ id: m.id, label: m.displayName || m.email, color: '#3B82F6' }))}
                  selected={filters.assignee}
                  onChange={(ids) => onFiltersChange({ ...filters, assignee: ids })} />

                {/* Date range */}
                <div className="px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Fecha límite</p>
                  <div className="flex gap-1">
                    <input type="date" value={filters.dateRange.from || ''}
                      onChange={e => onFiltersChange({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value || null } })}
                      className="input-dark h-7 text-[10px] flex-1" />
                    <input type="date" value={filters.dateRange.to || ''}
                      onChange={e => onFiltersChange({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value || null } })}
                      className="input-dark h-7 text-[10px] flex-1" />
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button onClick={() => onFiltersChange(EMPTY_FILTERS)}
                    className="w-full px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-400/5 rounded-lg flex items-center gap-1.5 transition">
                    <X className="h-3 w-3" /> Limpiar filtros
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-3" />

        {/* Sort & Group */}
        <div className="p-2 space-y-2">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Ordenar y Agrupar</p>
          <div className="px-2 space-y-1.5">
            <select value={sortBy} onChange={e => onSortByChange(e.target.value)} className="select-dark h-7 text-[11px] w-full">
              {SORT_OPTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select value={groupBy} onChange={e => onGroupByChange(e.target.value)} className="select-dark h-7 text-[11px] w-full">
              {GROUP_OPTIONS.map(g => (
                <option key={g.id} value={g.id}>Agrupar: {g.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-3" />

        {/* Saved Views */}
        <div className="p-2">
          <button onClick={() => setShowSaved(!showSaved)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
            <motion.span animate={{ rotate: showSaved ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3 w-3" />
            </motion.span>
            Vistas Guardadas
            {savedViews.length > 0 && (
              <span className="ml-auto text-[9px] opacity-60">{savedViews.length}</span>
            )}
          </button>

          <AnimatePresence initial={false}>
            {showSaved && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-0.5 mt-1"
              >
                {savedViews.map(sv => (
                  <button key={sv.id} onClick={() => onLoadView(sv)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
                    <Bookmark className="h-3 w-3 text-[var(--accent)]" />
                    <span className="truncate">{sv.name}</span>
                  </button>
                ))}
                <button onClick={onSaveView}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition">
                  <Save className="h-3 w-3" />
                  Guardar vista actual
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
