'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronDown, X, User,
  Calendar, Paperclip, Link2, Ban,
  UserX, LayoutList, AlignCenter, AlignJustify,
} from 'lucide-react';
import {
  STATUSES, PRIORITIES, TASK_TYPES,
  SORT_OPTIONS, GROUP_OPTIONS, DENSITIES,
  FilterState, EMPTY_FILTERS, Density,
  countActiveFilters,
} from './constants';

/* ============================================================
   Props
   ============================================================ */
interface Props {
  open: boolean;
  filters: FilterState;
  groupBy: string;
  sortBy: string;
  members: any[];
  taskCounts: Record<string, number>;
  density: Density;
  meMode: boolean;
  onFiltersChange: (f: FilterState) => void;
  onGroupByChange: (g: string) => void;
  onSortByChange: (s: string) => void;
  onDensityChange: (d: Density) => void;
  onMeModeToggle: () => void;
  onToggle: () => void;
}

/* ============================================================
   FilterSection - Reusable pill toggle group
   ============================================================ */
function FilterSection({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { id: string; label: string; color: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold mb-3">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 border gap-1.5 ${
                active
                  ? 'shadow-sm'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
              style={
                active
                  ? {
                      color: item.color,
                      backgroundColor: `${item.color}12`,
                      borderColor: `${item.color}40`,
                    }
                  : undefined
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   BooleanToggle - Compact on/off switch
   ============================================================ */
function BooleanToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-lg text-[13px] transition-all duration-200 hover:bg-[var(--bg-hover)]"
    >
      <span
        className={`truncate ${
          active ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-muted)]'
        }`}
      >
        {label}
      </span>
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 shrink-0 ${
          active ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
        }`}
      >
        <motion.div
          animate={{ x: active ? 15 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-[3px] w-[12px] h-[12px] rounded-full bg-white shadow-sm"
        />
      </div>
    </button>
  );
}

/* ============================================================
   DensityIcon - Simplified icons for density levels
   ============================================================ */
const DENSITY_ICONS: Record<Density, typeof LayoutList> = {
  compact: LayoutList,
  comfortable: AlignCenter,
  spacious: AlignJustify,
};

/* ============================================================
   TaskSidebar
   ============================================================ */
export default function TaskSidebar({
  open,
  filters,
  groupBy,
  sortBy,
  members,
  taskCounts,
  density,
  meMode,
  onFiltersChange,
  onGroupByChange,
  onSortByChange,
  onDensityChange,
  onMeModeToggle,
  onToggle,
}: Props) {
  const { t } = useI18n();
  const [showFilters, setShowFilters] = useState(true);

  const activeFilterCount = countActiveFilters(filters);

  return (
    <motion.aside
      animate={{
        width: open ? 260 : 0,
        opacity: open ? 1 : 0,
      }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full bg-[var(--bg-elevated)] shadow-panel flex flex-col overflow-hidden shrink-0"
    >
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)] tracking-tight">
          {t('tasks.title')}
        </h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      {/* ===== Scrollable content ===== */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* ===== Me Mode Toggle ===== */}
        <div className="px-5 py-4">
          <button
            onClick={onMeModeToggle}
            className={`w-full flex items-center gap-2.5 px-4 h-11 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
              meMode
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)] shadow-sm'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <User className="h-4 w-4" />
            <span>{t('tasks.meMode')}</span>
            <div
              className={`ml-auto relative w-8 h-[18px] rounded-full transition-colors duration-200 ${
                meMode ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]'
              }`}
            >
              <motion.div
                animate={{ x: meMode ? 15 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-[3px] w-3 h-3 rounded-full bg-white shadow-sm"
              />
            </div>
          </button>
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-5" />

        {/* ===== Filters Section ===== */}
        <div className="py-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <motion.span
              animate={{ rotate: showFilters ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.span>
            {t('common.filter')}
            {activeFilterCount > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">
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
                {/* Status */}
                <FilterSection
                  label={t('taskCreate.status')}
                  items={STATUSES.map((s) => ({
                    id: s.id,
                    label: t(`status.${s.id}`),
                    color: s.color,
                  }))}
                  selected={filters.status}
                  onChange={(ids) =>
                    onFiltersChange({ ...filters, status: ids })
                  }
                />

                {/* Priority */}
                <FilterSection
                  label={t('taskCreate.priority')}
                  items={PRIORITIES.map((p) => ({
                    id: p.id,
                    label: t(`priority.${p.id}`),
                    color: p.color,
                  }))}
                  selected={filters.priority}
                  onChange={(ids) =>
                    onFiltersChange({ ...filters, priority: ids })
                  }
                />

                {/* Type */}
                <FilterSection
                  label={t('taskCreate.type')}
                  items={TASK_TYPES.map((tp) => ({
                    id: tp.id,
                    label: t(`taskType.${tp.id}`),
                    color: tp.color,
                  }))}
                  selected={filters.type}
                  onChange={(ids) =>
                    onFiltersChange({ ...filters, type: ids })
                  }
                />

                {/* Assignee */}
                <FilterSection
                  label={t('taskCreate.assignees')}
                  items={members.map((m) => ({
                    id: m.id,
                    label: m.displayName || m.email,
                    color: '#3B82F6',
                  }))}
                  selected={filters.assignee}
                  onChange={(ids) =>
                    onFiltersChange({ ...filters, assignee: ids })
                  }
                />

                {/* Date range */}
                <div className="px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold mb-3">
                    {t('taskCreate.dueDate')}
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)] pointer-events-none" />
                      <input
                        type="date"
                        value={filters.dateRange.from || ''}
                        onChange={(e) =>
                          onFiltersChange({
                            ...filters,
                            dateRange: {
                              ...filters.dateRange,
                              from: e.target.value || null,
                            },
                          })
                        }
                        className="input-dark h-8 text-[12px] w-full pl-7"
                        placeholder={t('filter.from')}
                      />
                    </div>
                    <div className="flex-1 relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)] pointer-events-none" />
                      <input
                        type="date"
                        value={filters.dateRange.to || ''}
                        onChange={(e) =>
                          onFiltersChange({
                            ...filters,
                            dateRange: {
                              ...filters.dateRange,
                              to: e.target.value || null,
                            },
                          })
                        }
                        className="input-dark h-8 text-[12px] w-full pl-7"
                        placeholder={t('filter.to')}
                      />
                    </div>
                  </div>
                </div>

                {/* Boolean filters */}
                <div className="px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-semibold mb-3">
                    {t('filter.additionalFilters')}
                  </p>
                  <div className="grid grid-cols-1 gap-0.5">
                    <BooleanToggle
                      label={t('filter.noDate')}
                      active={!!filters.noDate}
                      onToggle={() =>
                        onFiltersChange({
                          ...filters,
                          noDate: !filters.noDate,
                        })
                      }
                    />
                    <BooleanToggle
                      label={t('filter.noAssignee')}
                      active={!!filters.noAssignee}
                      onToggle={() =>
                        onFiltersChange({
                          ...filters,
                          noAssignee: !filters.noAssignee,
                        })
                      }
                    />
                    <BooleanToggle
                      label={t('filter.blocked')}
                      active={!!filters.isBlocked}
                      onToggle={() =>
                        onFiltersChange({
                          ...filters,
                          isBlocked: !filters.isBlocked,
                        })
                      }
                    />
                    <BooleanToggle
                      label={t('filter.hasAttachments')}
                      active={!!filters.hasAttachments}
                      onToggle={() =>
                        onFiltersChange({
                          ...filters,
                          hasAttachments: !filters.hasAttachments,
                        })
                      }
                    />
                    <BooleanToggle
                      label={t('filter.hasDependencies')}
                      active={!!filters.hasDependencies}
                      onToggle={() =>
                        onFiltersChange({
                          ...filters,
                          hasDependencies: !filters.hasDependencies,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Clear all */}
                {activeFilterCount > 0 && (
                  <div className="px-5 pb-2">
                    <button
                      onClick={() => onFiltersChange(EMPTY_FILTERS)}
                      className="w-full h-9 text-[13px] text-red-400 hover:bg-red-400/10 border border-red-400/20 rounded-xl flex items-center justify-center gap-1.5 transition-colors font-medium"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('common.clearAll')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-5" />

        {/* ===== Sort & Group ===== */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {t('tasks.sortLabel', { name: '' }).replace(/[: ]+$/, '')} &{' '}
            {t('tasks.groupLabel', { name: '' }).replace(/[: ]+$/, '')}
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">
                {t('tasks.sortLabel', { name: '' }).replace(/[: ]+$/, '')}
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="select-dark h-9 text-[13px] w-full rounded-lg"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(`sort.${s.id}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">
                {t('tasks.groupLabel', { name: '' }).replace(/[: ]+$/, '')}
              </label>
              <select
                value={groupBy}
                onChange={(e) => onGroupByChange(e.target.value)}
                className="select-dark h-9 text-[13px] w-full rounded-lg"
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {t(`group.${g.id}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-5" />

        {/* ===== Density ===== */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-3">
            {t('filter.density')}
          </p>
          <div className="flex gap-1.5">
            {DENSITIES.map((d) => {
              const Icon = DENSITY_ICONS[d.id];
              const active = density === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => onDensityChange(d.id)}
                  title={d.id}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 h-9 rounded-xl text-[11px] font-medium capitalize transition-all duration-200 ${
                    active
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] shadow-sm'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom spacer for comfortable scrolling */}
        <div className="h-4 shrink-0" />
      </div>
    </motion.aside>
  );
}
