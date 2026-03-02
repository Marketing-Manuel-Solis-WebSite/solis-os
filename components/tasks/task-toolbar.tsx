'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, PanelLeft, Keyboard,
} from 'lucide-react';
import { VIEWS, STATUSES, PRIORITIES, SORT_OPTIONS, GROUP_OPTIONS, ViewType, FilterState } from './constants';

interface Props {
  view: ViewType;
  filters: FilterState;
  search: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  groupBy: string;
  canCreate: boolean;
  activeTeam: any;
  canSeeAllTeams: boolean;
  activeTeamId: string;
  taskCount: number;
  doneCount: number;
  selectedCount: number;
  sidebarOpen: boolean;
  onViewChange: (v: ViewType) => void;
  onSearchChange: (s: string) => void;
  onFiltersChange: (f: FilterState) => void;
  onSortByChange: (s: string) => void;
  onSortDirToggle: () => void;
  onGroupByChange: (g: string) => void;
  onNewTask: () => void;
  onClearFilters: () => void;
  onToggleSidebar: () => void;
}

export default function TaskToolbar({
  view, filters, search, sortBy, sortDir, groupBy,
  canCreate, activeTeam, canSeeAllTeams, activeTeamId,
  taskCount, doneCount, selectedCount, sidebarOpen,
  onViewChange, onSearchChange, onFiltersChange,
  onSortByChange, onSortDirToggle, onGroupByChange,
  onNewTask, onClearFilters, onToggleSidebar,
}: Props) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (filters.status.length > 0) {
    filters.status.forEach(s => {
      const st = STATUSES.find(x => x.id === s);
      if (st) activeChips.push({
        label: st.label,
        onRemove: () => onFiltersChange({ ...filters, status: filters.status.filter(x => x !== s) }),
      });
    });
  }
  if (filters.priority.length > 0) {
    filters.priority.forEach(p => {
      const pr = PRIORITIES.find(x => x.id === p);
      if (pr) activeChips.push({
        label: pr.label,
        onRemove: () => onFiltersChange({ ...filters, priority: filters.priority.filter(x => x !== p) }),
      });
    });
  }
  if (filters.dateRange.from || filters.dateRange.to) {
    activeChips.push({
      label: `${filters.dateRange.from || '...'} → ${filters.dateRange.to || '...'}`,
      onRemove: () => onFiltersChange({ ...filters, dateRange: { from: null, to: null } }),
    });
  }

  return (
    <div className="px-6 pt-5 pb-3 space-y-3 shrink-0">
      {/* Row 1: Title + Create button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <button onClick={onToggleSidebar} className="p-2 -ml-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              Tareas
              {activeTeam && (
                <span className="text-sm font-semibold px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: `${activeTeam.color}15`, color: activeTeam.color, border: `1px solid ${activeTeam.color}25` }}>
                  {activeTeam.icon} {activeTeam.name}
                </span>
              )}
              {canSeeAllTeams && activeTeamId === '__all__' && (
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold">VISTA GENERAL</span>
              )}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">{taskCount} tareas · {doneCount} completadas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShortcuts(!showShortcuts)}
            className="hidden md:flex p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            title="Atajos de teclado">
            <Keyboard className="h-4 w-4" />
          </button>
          {canCreate && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onNewTask}
              className="flex items-center gap-2 px-5 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva Tarea</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts tooltip */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-4 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] shadow-card text-[13px] text-[var(--text-muted)]">
            <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-mono">N</kbd> Nueva</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-mono">F</kbd> Buscar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-mono">1-3</kbd> Vistas</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-mono">Esc</kbd> Cerrar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-mono">Del</kbd> Eliminar</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 2: Search + View switch + Sort/Group */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            id="task-search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar tareas... (F)"
            className="input-dark pl-10 pr-8 h-9 text-sm w-full"
          />
          {search && (
            <button onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => onViewChange(v.id)}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition ${
                view === v.id
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              <v.Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Group */}
        <select value={groupBy} onChange={e => onGroupByChange(e.target.value)} className="select-dark h-9 text-sm">
          {GROUP_OPTIONS.map(g => (
            <option key={g.id} value={g.id}>Grupo: {g.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select value={sortBy} onChange={e => onSortByChange(e.target.value)} className="select-dark h-9 text-sm">
          {SORT_OPTIONS.map(s => (
            <option key={s.id} value={s.id}>Orden: {s.label}</option>
          ))}
        </select>
      </div>

      {/* Row 3: Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Filtros:</span>
          {activeChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)] text-[13px] font-medium">
              {chip.label}
              <button onClick={chip.onRemove} className="hover:text-[var(--accent)]/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={onClearFilters} className="text-[13px] text-red-400 hover:text-red-300 ml-1">
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
