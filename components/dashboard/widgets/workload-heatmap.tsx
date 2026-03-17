'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Flame } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

/** Color scale for heatmap cells */
function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'var(--bg-tertiary)';
  const ratio = count / max;
  if (ratio > 0.8) return '#EF4444';
  if (ratio > 0.6) return '#F59E0B';
  if (ratio > 0.3) return '#3B82F6';
  return '#22C55E';
}

function WorkloadHeatmapInner({ tasks, members, user, canSeeAllTeams }: WidgetProps) {
  const { t } = useI18n();

  const data = useMemo(() => {
    // Build a grid: member × day-of-week
    const relevantMembers = (members || []).filter((m: any) => m.active !== false).slice(0, 10);
    const now = new Date();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const grid: { memberId: string; memberName: string; cells: number[] }[] = [];
    let maxCount = 0;

    for (const member of relevantMembers) {
      const cells = [0, 0, 0, 0, 0, 0, 0];
      const memberTasks = tasks.filter((tk: any) => tk.assignees?.includes(member.userId));

      for (const task of memberTasks) {
        if (task.dueDate) {
          const due = task.dueDate.seconds ? new Date(task.dueDate.seconds * 1000) : new Date(task.dueDate);
          const dayIndex = (due.getDay() + 6) % 7; // Monday = 0
          cells[dayIndex]++;
          if (cells[dayIndex] > maxCount) maxCount = cells[dayIndex];
        }
      }

      grid.push({ memberId: member.userId, memberName: member.displayName || member.email || '?', cells });
    }

    return { grid, days, maxCount };
  }, [tasks, members]);

  return (
    <WidgetShell title={t('dashboard.widget.workloadHeatmap') || 'Workload Heatmap'} icon={<Flame className="h-4 w-4" />}>
      {data.grid.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Flame className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-left px-1 py-1 text-[var(--text-muted)] font-medium w-24" />
                {data.days.map(d => (
                  <th key={d} className="text-center px-1 py-1 text-[var(--text-muted)] font-medium">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.grid.map(row => (
                <tr key={row.memberId}>
                  <td className="px-1 py-1 text-[var(--text-secondary)] truncate max-w-[96px]">{row.memberName}</td>
                  {row.cells.map((count, i) => (
                    <td key={i} className="px-1 py-1 text-center">
                      <div
                        className="w-7 h-7 rounded-md mx-auto flex items-center justify-center text-[10px] font-bold text-white/90"
                        style={{ backgroundColor: heatColor(count, data.maxCount) }}
                        title={`${count} tasks`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetShell>
  );
}

export const WorkloadHeatmapWidget = memo(WorkloadHeatmapInner);
