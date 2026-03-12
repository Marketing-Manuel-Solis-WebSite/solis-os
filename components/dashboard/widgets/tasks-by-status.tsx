'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { WidgetProps } from '@/lib/dashboard-types';

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const { name, value, payload: entry } = payload[0];
  return (
    <div className="rounded-lg px-3 py-2 text-[12px] shadow-lg border border-[var(--border)]" style={{ background: 'var(--bg-elevated)' }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry?.color }} />
        <span className="text-[var(--text-primary)] font-medium">{name}</span>
        <span className="text-[var(--text-muted)] ml-1 font-bold">{value}</span>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#64748B',
  in_progress: '#3B82F6',
  in_review: '#A855F7',
  done: '#22C55E',
  completed: '#22C55E',
  blocked: '#EF4444',
};

const STATUS_KEYS: Record<string, string> = {
  todo: 'status.todo',
  in_progress: 'status.inProgress',
  in_review: 'status.inReview',
  done: 'status.done',
  blocked: 'status.blocked',
};

function TasksByStatusInner({ tasks, user, canSeeAllTeams }: WidgetProps) {
  const { t } = useI18n();

  // SECURITY: Non-admin users see only their own tasks distribution
  const scopedTasks = useMemo(() => {
    if (canSeeAllTeams) return tasks;
    return tasks.filter(tk => tk.assignees?.includes(user?.uid) || tk.createdBy === user?.uid);
  }, [tasks, canSeeAllTeams, user?.uid]);

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedTasks.forEach(task => {
      const s = task.status === 'completed' ? 'done' : (task.status || 'todo');
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, value]) => ({
        name: t(STATUS_KEYS[status] || `status.${status}`),
        value,
        color: STATUS_COLORS[status] || '#64748B',
      }))
      .sort((a, b) => b.value - a.value);
  }, [scopedTasks, t]);

  const total = scopedTasks.length;

  return (
    <WidgetShell title={t('dashboard.widget.tasksByStatus')} icon={<PieIcon className="h-4 w-4" />}>
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <PieIcon className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="flex items-center gap-4 h-full">
          <div className="flex-1 h-full min-h-[140px] relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center number */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="text-2xl font-bold text-[var(--text-primary)]">{total}</span>
                <p className="text-[10px] text-[var(--text-muted)]">total</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 shrink-0 pr-1">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">{d.name}</span>
                <span className="text-[12px] font-bold text-[var(--text-primary)]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export const TasksByStatusWidget = memo(TasksByStatusInner);
