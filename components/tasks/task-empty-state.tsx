'use client';
import { useI18n } from '@/lib/i18n';
import { CheckSquare, Search, Calendar, Filter, User, AlertTriangle, Inbox } from 'lucide-react';

type EmptyType = 'no-tasks' | 'no-results' | 'no-my-tasks' | 'no-overdue' | 'no-today' | 'no-date';

interface Props {
  type: EmptyType;
  canCreate?: boolean;
  onCreateTask?: () => void;
  onClearFilters?: () => void;
}

const CONFIG: Record<EmptyType, { icon: any; titleKey: string; descKey: string; action?: 'create' | 'clear' }> = {
  'no-tasks': { icon: Inbox, titleKey: 'emptyState.noTasks', descKey: 'emptyState.noTasksDesc', action: 'create' },
  'no-results': { icon: Search, titleKey: 'emptyState.noResults', descKey: 'emptyState.noResultsDesc', action: 'clear' },
  'no-my-tasks': { icon: User, titleKey: 'emptyState.noMyTasks', descKey: 'emptyState.noMyTasksDesc', action: 'create' },
  'no-overdue': { icon: CheckSquare, titleKey: 'emptyState.noOverdue', descKey: 'emptyState.noOverdueDesc' },
  'no-today': { icon: Calendar, titleKey: 'emptyState.noToday', descKey: 'emptyState.noTodayDesc', action: 'create' },
  'no-date': { icon: Filter, titleKey: 'emptyState.noDate', descKey: 'emptyState.noDateDesc', action: 'clear' },
};

export default function TaskEmptyState({ type, canCreate, onCreateTask, onClearFilters }: Props) {
  const { t } = useI18n();
  const cfg = CONFIG[type];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] shadow-md flex items-center justify-center mb-6">
        <Icon className="h-7 w-7 text-[var(--text-muted)]" strokeWidth={1.5} />
      </div>
      <h3 className="text-[17px] font-semibold text-[var(--text-primary)] mb-2">
        {t(cfg.titleKey)}
      </h3>
      <p className="text-[14px] text-[var(--text-muted)] max-w-md mb-6">
        {t(cfg.descKey)}
      </p>
      {cfg.action === 'create' && canCreate && onCreateTask && (
        <button
          onClick={onCreateTask}
          className="h-10 px-6 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-[14px] font-semibold transition-all duration-200 shadow-sm"
        >
          {t('tasks.newTask')}
        </button>
      )}
      {cfg.action === 'clear' && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="h-10 px-6 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[14px] font-semibold text-[var(--text-secondary)] transition-all duration-200 shadow-sm"
        >
          {t('common.clearAll')}
        </button>
      )}
    </div>
  );
}
