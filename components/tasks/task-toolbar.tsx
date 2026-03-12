'use client';
import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, PanelLeft, Keyboard,
  ArrowUpDown, LayoutList, LayoutGrid, Calendar, Upload,
} from 'lucide-react';
import {
  VIEWS, STATUSES, PRIORITIES, SORT_OPTIONS, GROUP_OPTIONS,
  ViewType, FilterState, SavedView, countActiveFilters,
} from './constants';
import TaskViewTabs from './task-view-tabs';

// =============================================
// PROPS
// =============================================
interface Props {
  view: ViewType;
  filters: FilterState;
  search: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  groupBy: string;
  canCreate: boolean;
  activeTeam?: any;
  canSeeAllTeams?: boolean;
  activeTeamId?: string;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  selectedCount: number;
  sidebarOpen: boolean;
  // View tabs props
  activePreset: string;
  savedViews: SavedView[];
  pinnedPresets: string[];
  // Callbacks
  onViewChange: (v: ViewType) => void;
  onSearchChange: (s: string) => void;
  onFiltersChange: (f: FilterState) => void;
  onSortByChange: (s: string) => void;
  onSortDirToggle: () => void;
  onGroupByChange: (g: string) => void;
  onNewTask: () => void;
  onClearFilters: () => void;
  onToggleSidebar: () => void;
  onPresetChange: (id: string) => void;
  onSaveView: () => void;
  onLoadView: (sv: SavedView) => void;
  onDeleteView?: (id: string) => void;
  onDuplicateView?: (sv: SavedView) => void;
  onImport?: () => void;
  allPresets?: any[];
}

// =============================================
// COMPONENT
// =============================================
export default function TaskToolbar({
  view, filters, search, sortBy, sortDir, groupBy,
  canCreate, activeTeam, canSeeAllTeams, activeTeamId,
  taskCount, doneCount, overdueCount, selectedCount, sidebarOpen,
  activePreset, savedViews, pinnedPresets,
  onViewChange, onSearchChange, onFiltersChange,
  onSortByChange, onSortDirToggle, onGroupByChange,
  onNewTask, onClearFilters, onToggleSidebar,
  onPresetChange, onSaveView, onLoadView, onDeleteView, onDuplicateView,
  onImport, allPresets,
}: Props) {
  const { t } = useI18n();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ------------------------------------------
  // Active filter chips
  // ------------------------------------------
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    filters.status.forEach(s => {
      const st = STATUSES.find(x => x.id === s);
      if (st) chips.push({
        key: `status-${s}`,
        label: t(`status.${st.id}`),
        onRemove: () => onFiltersChange({ ...filters, status: filters.status.filter(x => x !== s) }),
      });
    });

    filters.priority.forEach(p => {
      const pr = PRIORITIES.find(x => x.id === p);
      if (pr) chips.push({
        key: `priority-${p}`,
        label: t(`priority.${pr.id}`),
        onRemove: () => onFiltersChange({ ...filters, priority: filters.priority.filter(x => x !== p) }),
      });
    });

    filters.type.forEach(tp => {
      chips.push({
        key: `type-${tp}`,
        label: t(`taskType.${tp}`),
        onRemove: () => onFiltersChange({ ...filters, type: filters.type.filter(x => x !== tp) }),
      });
    });

    filters.tags.forEach(tag => {
      chips.push({
        key: `tag-${tag}`,
        label: tag,
        onRemove: () => onFiltersChange({ ...filters, tags: filters.tags.filter(x => x !== tag) }),
      });
    });

    filters.assignee.forEach(a => {
      chips.push({
        key: `assignee-${a}`,
        label: a,
        onRemove: () => onFiltersChange({ ...filters, assignee: filters.assignee.filter(x => x !== a) }),
      });
    });

    if (filters.dateRange.from || filters.dateRange.to) {
      chips.push({
        key: 'dateRange',
        label: `${filters.dateRange.from || '...'} \u2192 ${filters.dateRange.to || '...'}`,
        onRemove: () => onFiltersChange({ ...filters, dateRange: { from: null, to: null } }),
      });
    }

    if (filters.hasAttachments) {
      chips.push({
        key: 'hasAttachments',
        label: t('filter.hasAttachments'),
        onRemove: () => onFiltersChange({ ...filters, hasAttachments: false }),
      });
    }

    if (filters.hasDependencies) {
      chips.push({
        key: 'hasDependencies',
        label: t('filter.hasDependencies'),
        onRemove: () => onFiltersChange({ ...filters, hasDependencies: false }),
      });
    }

    if (filters.isBlocked) {
      chips.push({
        key: 'isBlocked',
        label: t('status.blocked'),
        onRemove: () => onFiltersChange({ ...filters, isBlocked: false }),
      });
    }

    if (filters.noDate) {
      chips.push({
        key: 'noDate',
        label: t('filter.noDate'),
        onRemove: () => onFiltersChange({ ...filters, noDate: false }),
      });
    }

    if (filters.noAssignee) {
      chips.push({
        key: 'noAssignee',
        label: t('filter.noAssignee'),
        onRemove: () => onFiltersChange({ ...filters, noAssignee: false }),
      });
    }

    return chips;
  }, [filters, t, onFiltersChange]);

  // ------------------------------------------
  // Detect active saved view for badge
  // ------------------------------------------
  const activeSavedView = useMemo(() => {
    if (!activePreset.startsWith('saved:')) return null;
    const svId = activePreset.replace('saved:', '');
    return savedViews.find(sv => sv.id === svId) || null;
  }, [activePreset, savedViews]);

  // Subtitle text
  const subtitle = useMemo(() => {
    let text = t('tasks.countDone', { n: taskCount, d: doneCount });
    if (overdueCount > 0) {
      text += ` \u00B7 `;
    }
    return text;
  }, [t, taskCount, doneCount, overdueCount]);

  const filterCount = countActiveFilters(filters);

  return (
    <div className="px-5 pt-5 pb-3 space-y-3 shrink-0">

      {/* ============================================= */}
      {/* ROW 1 - Context & Actions                     */}
      {/* ============================================= */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: sidebar toggle + title block */}
        <div className="flex items-center gap-3 min-w-0">
          {!sidebarOpen && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={onToggleSidebar}
              className="p-2 -ml-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition shrink-0"
              title={t('common.open')}
            >
              <PanelLeft className="h-4 w-4" />
            </motion.button>
          )}

          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
              {t('tasks.title')}
              {activeTeam && (
                <span
                  className="text-[12px] font-semibold px-3 py-1 rounded-lg inline-flex items-center gap-1.5 shrink-0"
                  style={{
                    backgroundColor: `${activeTeam.color}15`,
                    color: activeTeam.color,
                    border: `1px solid ${activeTeam.color}25`,
                  }}
                >
                  {activeTeam.icon} {activeTeam.name}
                </span>
              )}
              {canSeeAllTeams && activeTeamId === '__all__' && (
                <span className="text-[11px] px-3 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold uppercase tracking-wide shrink-0">
                  {t('common.generalView')}
                </span>
              )}
            </h1>
            <p className="text-[13px] tracking-[-0.01em] text-[var(--text-muted)] mt-1.5">
              {subtitle}
              {overdueCount > 0 && (
                <span className="text-[var(--error)] font-semibold">
                  {overdueCount === 1 ? t('tasks.overdueOne', { n: overdueCount }) : t('tasks.overdue', { n: overdueCount })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: shortcuts + CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={`hidden md:flex p-2 rounded-lg transition ${
              showShortcuts
                ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={t('common.keyboardShortcuts')}
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {canCreate && onImport && (
            <button
              onClick={onImport}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
              title={t('import.title')}
            >
              <Upload className="h-4 w-4" />
            </button>
          )}

          {canCreate && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onNewTask}
              className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-semibold transition-shadow text-[13px] shadow-md hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('tasks.newTask')}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts tooltip */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-5 px-5 py-3 rounded-2xl bg-[var(--bg-elevated)] shadow-lg text-[13px] text-[var(--text-muted)] flex-wrap"
          >
            <span>
              <kbd className="px-2 py-1 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] font-mono text-xs border border-[var(--border-subtle)]">N</kbd>
              <span className="ml-1.5">{t('shortcuts.new')}</span>
            </span>
            <span>
              <kbd className="px-2 py-1 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] font-mono text-xs border border-[var(--border-subtle)]">F</kbd>
              <span className="ml-1.5">{t('shortcuts.search')}</span>
            </span>
            <span>
              <kbd className="px-2 py-1 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] font-mono text-xs border border-[var(--border-subtle)]">1-3</kbd>
              <span className="ml-1.5">{t('shortcuts.views')}</span>
            </span>
            <span>
              <kbd className="px-2 py-1 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] font-mono text-xs border border-[var(--border-subtle)]">Esc</kbd>
              <span className="ml-1.5">{t('shortcuts.close')}</span>
            </span>
            <span>
              <kbd className="px-2 py-1 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] font-mono text-xs border border-[var(--border-subtle)]">Del</kbd>
              <span className="ml-1.5">{t('shortcuts.delete')}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================= */}
      {/* ROW 2 - View Tabs                             */}
      {/* ============================================= */}
      <TaskViewTabs
        activePreset={activePreset}
        savedViews={savedViews}
        pinnedPresets={pinnedPresets}
        onPresetChange={onPresetChange}
        onSaveView={onSaveView}
        onLoadView={onLoadView}
        onDeleteView={onDeleteView}
        onDuplicateView={onDuplicateView}
        allPresets={allPresets}
      />

      {/* ============================================= */}
      {/* ROW 3 - Search + View Toggle + Sort/Group     */}
      {/* ============================================= */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none z-[1]" />
          <input
            id="task-search"
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('tasks.searchPlaceholder')}
            className="w-full h-8 rounded-lg text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all shadow-sm"
            style={{ paddingLeft: '2.25rem', paddingRight: '1.75rem', background: 'var(--bg-elevated)', border: '1.5px solid var(--border-strong)' }}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View toggle pills */}
        <div className="flex rounded-lg overflow-hidden shadow-sm" style={{ border: '1.5px solid var(--border-strong)', background: 'var(--bg-elevated)' }}>
          {VIEWS.map(v => {
            const isActive = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onViewChange(v.id)}
                className={`relative px-3 py-1.5 text-[12px] flex items-center gap-1 transition-all duration-200 h-8 ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] font-semibold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                title={`${t(`view.${v.id}`)} (${v.shortcut})`}
              >
                <v.Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t(`view.${v.id}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Group select */}
        <select
          value={groupBy}
          onChange={e => onGroupByChange(e.target.value)}
          className="h-8 rounded-lg text-[12px] text-[var(--text-secondary)] px-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition cursor-pointer shadow-sm"
          style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border-strong)' }}
        >
          {GROUP_OPTIONS.map(g => (
            <option key={g.id} value={g.id}>
              {t('tasks.groupLabel', { name: t(`group.${g.id}`) })}
            </option>
          ))}
        </select>

        {/* Sort select + direction toggle */}
        <div className="flex items-center">
          <select
            value={sortBy}
            onChange={e => onSortByChange(e.target.value)}
            className="h-8 rounded-lg rounded-r-none text-[12px] text-[var(--text-secondary)] px-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition cursor-pointer shadow-sm"
            style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border-strong)', borderRight: 'none' }}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.id} value={s.id}>
                {t('tasks.sortLabel', { name: t(`sort.${s.id}`) })}
              </option>
            ))}
          </select>
          <button
            onClick={onSortDirToggle}
            className="h-8 w-8 rounded-r-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition flex items-center justify-center shadow-sm"
            style={{ background: 'var(--bg-elevated)', border: '1.5px solid var(--border-strong)' }}
            title={sortDir === 'asc' ? t('sort.ascending') : t('sort.descending')}
          >
            <ArrowUpDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                sortDir === 'desc' ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* ============================================= */}
      {/* ROW 4 (conditional) - Active filter chips     */}
      {/* ============================================= */}
      <AnimatePresence>
        {(activeChips.length > 0 || activeSavedView) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {/* Label */}
              <span className="text-[12px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mr-1">
                {t('common.filters')}
              </span>

              {/* Saved view badge */}
              {activeSavedView && (
                <span className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[13px] font-semibold border border-[var(--accent-subtle)]">
                  {activeSavedView.name}
                </span>
              )}

              {/* Filter chips */}
              {activeChips.map(chip => (
                <motion.span
                  key={chip.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[12px] font-medium shadow-sm"
                  style={{ border: '1.5px solid var(--accent)' }}
                >
                  {chip.label}
                  <button
                    onClick={chip.onRemove}
                    className="ml-0.5 w-4 h-4 rounded-full hover:bg-[var(--accent)]/15 transition flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}

              {/* Clear all */}
              {activeChips.length > 0 && (
                <button
                  onClick={onClearFilters}
                  className="text-[13px] text-red-400 hover:text-red-300 font-semibold ml-1 transition"
                >
                  {t('common.clearAll')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
