'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, X, ChevronDown, LayoutGrid, List, ArrowUpDown,
  Trash2, Archive, CheckSquare,
} from 'lucide-react';

// ---- Types ----

export interface FilterOption {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface SortOption {
  value: string;
  label: string;
}

export interface BulkAction {
  id: string;
  label: string;
  icon: any;
  variant?: 'default' | 'danger';
  onAction: (ids: Set<string>) => void;
}

export interface HubToolbarProps {
  /** Search query */
  search: string;
  onSearchChange: (query: string) => void;

  /** Filter dropdowns */
  filters?: FilterOption[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (filterId: string, value: string) => void;

  /** Sort */
  sortOptions?: SortOption[];
  activeSort?: string;
  onSortChange?: (sort: string) => void;

  /** View mode toggle */
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  showViewToggle?: boolean;

  /** Bulk actions */
  selectedCount?: number;
  bulkActions?: BulkAction[];
  onClearSelection?: () => void;

  /** Results count */
  totalCount?: number;
  filteredCount?: number;
}

// ---- Component ----

export default function HubToolbar({
  search,
  onSearchChange,
  filters,
  activeFilters,
  onFilterChange,
  sortOptions,
  activeSort,
  onSortChange,
  viewMode,
  onViewModeChange,
  showViewToggle = true,
  selectedCount = 0,
  bulkActions,
  onClearSelection,
  totalCount,
  filteredCount,
}: HubToolbarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const hasActiveFilters = useMemo(() => {
    if (!activeFilters) return false;
    return Object.values(activeFilters).some(v => v !== '' && v !== 'all');
  }, [activeFilters]);

  // Bulk action bar
  if (selectedCount > 0 && bulkActions?.length) {
    return (
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20 mb-4"
      >
        <div className="flex items-center gap-2 text-sm text-[var(--accent)] font-medium">
          <CheckSquare className="h-4 w-4" />
          {selectedCount} selected
        </div>
        <div className="h-4 w-px bg-[var(--accent)]/20" />
        {bulkActions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => action.onAction(new Set())}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium transition ${
                action.variant === 'danger'
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </button>
          );
        })}
        <button
          onClick={onClearSelection}
          className="ml-auto text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="input-dark pl-10 w-full h-9 text-sm"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {filters?.map(filter => {
        const currentValue = activeFilters?.[filter.id] || '';
        const isActive = currentValue && currentValue !== 'all';
        return (
          <div key={filter.id} className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === filter.id ? null : filter.id)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-[13px] font-medium border transition ${
                isActive
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/30'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {filter.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {openDropdown === filter.id && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1 w-44 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown border border-[var(--border)] z-40 py-1"
                >
                  <button
                    onClick={() => { onFilterChange?.(filter.id, ''); setOpenDropdown(null); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] rounded-lg transition ${
                      !currentValue ? 'text-[var(--accent)] bg-[var(--accent-subtle)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    All
                  </button>
                  {filter.options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { onFilterChange?.(filter.id, opt.value); setOpenDropdown(null); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] rounded-lg transition ${
                        currentValue === opt.value ? 'text-[var(--accent)] bg-[var(--accent-subtle)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={() => filters?.forEach(f => onFilterChange?.(f.id, ''))}
          className="text-[12px] text-[var(--accent)] hover:underline"
        >
          Clear filters
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Result count */}
      {totalCount !== undefined && filteredCount !== undefined && filteredCount < totalCount && (
        <span className="text-[12px] text-[var(--text-muted)]">
          {filteredCount} of {totalCount}
        </span>
      )}

      {/* Sort dropdown */}
      {sortOptions && sortOptions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === '__sort__' ? null : '__sort__')}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-[13px] font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-secondary)] transition"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort
          </button>
          <AnimatePresence>
            {openDropdown === '__sort__' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full right-0 mt-1 w-44 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown border border-[var(--border)] z-40 py-1"
              >
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange?.(opt.value); setOpenDropdown(null); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] rounded-lg transition ${
                      activeSort === opt.value ? 'text-[var(--accent)] bg-[var(--accent-subtle)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* View toggle */}
      {showViewToggle && onViewModeChange && (
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] overflow-hidden border border-[var(--border)]">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-2 py-1.5 transition ${viewMode === 'grid' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-2 py-1.5 transition ${viewMode === 'list' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
