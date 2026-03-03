'use client';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { GOAL_STATUSES } from './constants';
import type { GoalStatus } from './constants';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: GoalStatus | '';
  onStatusFilter: (v: GoalStatus | '') => void;
  ownerFilter: string;
  onOwnerFilter: (v: string) => void;
}

export default function GoalFilters({ search, onSearch, statusFilter, onStatusFilter, ownerFilter, onOwnerFilter }: Props) {
  const { t } = useI18n();
  const { allMembers } = useAuth();

  const hasFilters = statusFilter || ownerFilter;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition w-52"
        />
      </div>

      {/* Status */}
      <select
        value={statusFilter}
        onChange={e => onStatusFilter(e.target.value as GoalStatus | '')}
        className="h-8 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
      >
        <option value="">{t('goals.filterAll')} — {t('goals.status')}</option>
        {GOAL_STATUSES.map(s => (
          <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
        ))}
      </select>

      {/* Owner */}
      <select
        value={ownerFilter}
        onChange={e => onOwnerFilter(e.target.value)}
        className="h-8 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
      >
        <option value="">{t('goals.filterAll')} — {t('goals.owner')}</option>
        {allMembers.filter(m => m.active !== false).map(m => (
          <option key={m.userId} value={m.userId}>{m.displayName}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => { onStatusFilter(''); onOwnerFilter(''); }}
          className="flex items-center gap-1 h-8 px-3 rounded-lg text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
        >
          <X className="h-3.5 w-3.5" /> {t('common.clearAll')}
        </button>
      )}
    </div>
  );
}
