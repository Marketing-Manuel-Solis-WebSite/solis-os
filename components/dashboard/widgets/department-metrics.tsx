'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

function DepartmentMetricsInner({ tasks, teams, members, onDrillDown }: WidgetProps) {
  const { t } = useI18n();

  const data = useMemo(() => {
    const teamStats: Record<string, {
      name: string; icon: string; color: string;
      total: number; done: number; inProgress: number; overdue: number; memberCount: number;
    }> = {};

    for (const team of teams || []) {
      if (team.status === 'archived') continue;
      const memberCount = (members || []).filter((m: any) => m.active !== false && (m.teamId === team.id || m.teamIds?.includes(team.id))).length;
      teamStats[team.id] = { name: team.name, icon: team.icon || '📁', color: team.color || '#6B7280', total: 0, done: 0, inProgress: 0, overdue: 0, memberCount };
    }

    const now = Date.now();
    for (const task of tasks) {
      const tid = task.teamId;
      if (!tid || !teamStats[tid]) continue;
      teamStats[tid].total++;
      const status = task.status === 'completed' ? 'done' : task.status;
      if (status === 'done') teamStats[tid].done++;
      if (status === 'in_progress' || status === 'in_review') teamStats[tid].inProgress++;
      if (task.dueDate) {
        const due = task.dueDate.seconds ? task.dueDate.seconds * 1000 : new Date(task.dueDate).getTime();
        if (due < now && status !== 'done') teamStats[tid].overdue++;
      }
    }

    return Object.entries(teamStats)
      .filter(([, v]) => v.total > 0 || v.memberCount > 0)
      .map(([id, v]) => ({
        id,
        ...v,
        completionRate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
        velocity: v.memberCount > 0 ? Math.round(v.done / v.memberCount * 10) / 10 : 0,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);
  }, [tasks, teams, members]);

  return (
    <WidgetShell title={t('dashboard.widget.departmentMetrics') || 'Department Metrics'} icon={<Building2 className="h-4 w-4" />}>
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Building2 className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left px-2 py-2 text-[var(--text-muted)] font-medium">Dept</th>
                <th className="text-right px-2 py-2 text-[var(--text-muted)] font-medium">Members</th>
                <th className="text-right px-2 py-2 text-[var(--text-muted)] font-medium">Tasks</th>
                <th className="text-right px-2 py-2 text-[var(--text-muted)] font-medium">Done %</th>
                <th className="text-right px-2 py-2 text-[var(--text-muted)] font-medium">Overdue</th>
                <th className="text-right px-2 py-2 text-[var(--text-muted)] font-medium">Velocity</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const TrendIcon = row.completionRate >= 70 ? TrendingUp : row.completionRate <= 30 ? TrendingDown : Minus;
                const trendColor = row.completionRate >= 70 ? 'text-emerald-400' : row.completionRate <= 30 ? 'text-red-400' : 'text-[var(--text-muted)]';
                return (
                  <tr
                    key={row.id}
                    onClick={() => onDrillDown?.('department', { teamId: row.id, teamName: row.name })}
                    className="border-b border-[var(--border)]/10 hover:bg-white/[0.02] cursor-pointer transition"
                  >
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span>{row.icon}</span>
                        <span className="text-[var(--text-primary)] font-medium truncate max-w-[100px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[var(--text-muted)]">{row.memberCount}</td>
                    <td className="px-2 py-2.5 text-right text-[var(--text-secondary)]">{row.total}</td>
                    <td className="px-2 py-2.5 text-right">
                      <span className={`inline-flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon className="h-3 w-3" />
                        {row.completionRate}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {row.overdue > 0 ? (
                        <span className="text-red-400 font-medium">{row.overdue}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[var(--text-muted)]">{row.velocity}/member</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </WidgetShell>
  );
}

export const DepartmentMetricsWidget = memo(DepartmentMetricsInner);
