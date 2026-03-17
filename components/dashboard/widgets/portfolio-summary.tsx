'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Briefcase, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

/** Health color based on overdue ratio */
function healthColor(total: number, overdue: number, done: number): string {
  if (total === 0) return '#64748B';
  const pctDone = done / total;
  if (pctDone >= 0.8) return '#22C55E';
  if (overdue / total > 0.2) return '#EF4444';
  if (overdue > 0) return '#F59E0B';
  return '#3B82F6';
}

function PortfolioSummaryInner({ tasks, teams, onDrillDown }: WidgetProps) {
  const { t } = useI18n();

  const data = useMemo(() => {
    const teamMap: Record<string, { name: string; icon?: string; color?: string; total: number; done: number; overdue: number; inProgress: number }> = {};

    for (const team of teams || []) {
      if (team.status === 'archived') continue;
      teamMap[team.id] = { name: team.name, icon: team.icon, color: team.color, total: 0, done: 0, overdue: 0, inProgress: 0 };
    }

    const now = Date.now();
    for (const task of tasks) {
      const tid = task.teamId;
      if (!tid || !teamMap[tid]) continue;
      teamMap[tid].total++;
      const status = task.status === 'completed' ? 'done' : task.status;
      if (status === 'done') teamMap[tid].done++;
      if (status === 'in_progress' || status === 'in_review') teamMap[tid].inProgress++;
      if (task.dueDate) {
        const due = task.dueDate.seconds ? task.dueDate.seconds * 1000 : new Date(task.dueDate).getTime();
        if (due < now && status !== 'done') teamMap[tid].overdue++;
      }
    }

    return Object.entries(teamMap)
      .filter(([, v]) => v.total > 0)
      .map(([id, v]) => ({ id, ...v, pctDone: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [tasks, teams]);

  return (
    <WidgetShell title={t('dashboard.widget.portfolioSummary') || 'Portfolio'} icon={<Briefcase className="h-4 w-4" />}>
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Briefcase className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-full">
          {data.map(row => {
            const hc = healthColor(row.total, row.overdue, row.done);
            return (
              <button
                key={row.id}
                onClick={() => onDrillDown?.('portfolio', { teamId: row.id, teamName: row.name })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition text-left group"
              >
                {/* Health dot */}
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hc }} />
                {/* Icon + Name */}
                <span className="text-sm shrink-0">{row.icon || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{row.name}</p>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-0.5">
                    <span>{row.total} tasks</span>
                    <span className="flex items-center gap-0.5 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> {row.pctDone}%
                    </span>
                    {row.overdue > 0 && (
                      <span className="flex items-center gap-0.5 text-red-400">
                        <AlertTriangle className="h-3 w-3" /> {row.overdue}
                      </span>
                    )}
                    {row.inProgress > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-400">
                        <Clock className="h-3 w-3" /> {row.inProgress}
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-16 shrink-0">
                  <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${row.pctDone}%`, backgroundColor: hc }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

export const PortfolioSummaryWidget = memo(PortfolioSummaryInner);
