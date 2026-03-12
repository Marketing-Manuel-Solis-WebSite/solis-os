'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Flag } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#64748B',
};

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

function PriorityBreakdownInner({ tasks, user, canSeeAllTeams }: WidgetProps) {
  const { t, lang } = useI18n();

  // SECURITY: Non-admin users see only their own task priorities
  const scopedTasks = useMemo(() => {
    if (canSeeAllTeams) return tasks;
    return tasks.filter(tk => tk.assignees?.includes(user?.uid) || tk.createdBy === user?.uid);
  }, [tasks, canSeeAllTeams, user?.uid]);

  const data = useMemo(() => {
    const openTasks = scopedTasks.filter(tk => tk.status !== 'done' && tk.status !== 'completed');
    const total = openTasks.length;
    return PRIORITIES.map(p => ({
      name: t(`priority.${p}`),
      value: openTasks.filter(tk => (tk.priority || 'medium') === p).length,
      color: PRIORITY_COLORS[p],
      pct: total > 0 ? Math.round((openTasks.filter(tk => (tk.priority || 'medium') === p).length / total) * 100) : 0,
    }));
  }, [scopedTasks, t]);

  const hasData = data.some(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const totalLabel = lang === 'es' ? 'Total abiertas' : 'Total open';

  return (
    <WidgetShell title={t('dashboard.openByPriority')} icon={<Flag className="h-4 w-4" />}>
      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Flag className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden mb-5">
            {data.filter(d => d.value > 0).map(d => (
              <div
                key={d.name}
                className="h-full transition-all duration-500"
                style={{ width: `${d.pct}%`, backgroundColor: d.color }}
              />
            ))}
          </div>

          {/* Items */}
          <div className="space-y-3.5 flex-1">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-[13px] text-[var(--text-secondary)] flex-1">{d.name}</span>
                <span className="text-[13px] font-bold text-[var(--text-primary)] tabular-nums">{d.value}</span>
                <span className="text-[11px] text-[var(--text-muted)] w-10 text-right tabular-nums">{d.pct}%</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="pt-3 mt-auto border-t border-[var(--border-subtle)]/50 flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">{totalLabel}</span>
            <span className="text-[13px] font-bold text-[var(--text-primary)]">{total}</span>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export const PriorityBreakdownWidget = memo(PriorityBreakdownInner);
