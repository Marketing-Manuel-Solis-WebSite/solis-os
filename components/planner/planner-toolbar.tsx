'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, CalendarDays, GanttChart, Users,
  Filter, ChevronDown,
} from 'lucide-react';
import { STATUSES, PRIORITIES, FilterState } from '@/components/tasks/constants';
import { useI18n } from '@/lib/i18n';

export type PlannerView = 'calendar' | 'timeline' | 'workload';

interface Props {
  view: PlannerView;
  filters: FilterState;
  taskCount: number;
  canCreate: boolean;
  activeTeam: any;
  canSeeAllTeams: boolean;
  activeTeamId: string;
  onViewChange: (v: PlannerView) => void;
  onFiltersChange: (f: FilterState) => void;
  onNewTask: () => void;
}

const PLANNER_VIEWS: { id: PlannerView; labelKey: string; Icon: typeof CalendarDays }[] = [
  { id: 'calendar', labelKey: 'planner.calendar', Icon: CalendarDays },
  { id: 'timeline', labelKey: 'planner.timeline', Icon: GanttChart },
  { id: 'workload', labelKey: 'planner.workload', Icon: Users },
];

export default function PlannerToolbar({
  view, filters, taskCount, canCreate, activeTeam, canSeeAllTeams, activeTeamId,
  onViewChange, onFiltersChange, onNewTask,
}: Props) {
  const { t } = useI18n();
  const [showFilters, setShowFilters] = useState(false);

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

  const toggleStatus = (id: string) => {
    const next = filters.status.includes(id)
      ? filters.status.filter(x => x !== id)
      : [...filters.status, id];
    onFiltersChange({ ...filters, status: next });
  };

  const togglePriority = (id: string) => {
    const next = filters.priority.includes(id)
      ? filters.priority.filter(x => x !== id)
      : [...filters.priority, id];
    onFiltersChange({ ...filters, priority: next });
  };

  return (
    <div className="px-6 pt-5 pb-3 space-y-3 shrink-0">
      {/* Row 1: Title + Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            {t('planner.title')}
            {activeTeam && (
              <span className="text-sm font-semibold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: `${activeTeam.color}15`, color: activeTeam.color, border: `1px solid ${activeTeam.color}25` }}>
                {activeTeam.icon} {activeTeam.name}
              </span>
            )}
            {canSeeAllTeams && activeTeamId === '__all__' && (
              <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold">{t('common.generalView')}</span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('planner.datedTasks', { n: taskCount })}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onNewTask}
              className="flex items-center gap-2 px-5 h-10 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('tasks.newTask')}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Row 2: Search + View Switch + Filter toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={filters.search}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder={t('planner.searchPlaceholder')}
            className="input-dark pl-10 pr-8 h-9 text-sm w-full"
          />
          {filters.search && (
            <button onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
          {PLANNER_VIEWS.map(v => (
            <button key={v.id} onClick={() => onViewChange(v.id)}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition ${
                view === v.id
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              <v.Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t(v.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm transition ${
            showFilters || activeChips.length > 0
              ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          } shadow-card`}>
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('common.filter')}</span>
          {activeChips.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-text)] text-[10px] flex items-center justify-center font-bold">
              {activeChips.length}
            </span>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter dropdown */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-4 py-2">
              {/* Status filters */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{t('group.status')}</p>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map(s => (
                    <button key={s.id} onClick={() => toggleStatus(s.id)}
                      className={`px-2 py-1 rounded-md text-[12px] font-medium transition ${
                        filters.status.includes(s.id)
                          ? 'text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                      style={filters.status.includes(s.id) ? { backgroundColor: s.color } : {}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority filters */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{t('group.priority')}</p>
                <div className="flex flex-wrap gap-1">
                  {PRIORITIES.map(p => (
                    <button key={p.id} onClick={() => togglePriority(p.id)}
                      className={`px-2 py-1 rounded-md text-[12px] font-medium transition ${
                        filters.priority.includes(p.id)
                          ? 'text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                      style={filters.priority.includes(p.id) ? { backgroundColor: p.color } : {}}>
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">{t('common.filters')}</span>
          {activeChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)] text-[13px] font-medium">
              {chip.label}
              <button onClick={chip.onRemove} className="hover:text-[var(--accent)]/70">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={() => onFiltersChange({ status: [], priority: [], assignee: [], type: [], tags: [], dateRange: { from: null, to: null }, search: filters.search })}
            className="text-[13px] text-red-400 hover:text-red-300 ml-1">
            {t('common.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}
