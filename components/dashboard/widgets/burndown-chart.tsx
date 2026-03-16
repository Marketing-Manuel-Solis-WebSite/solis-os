'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { WidgetProps } from '@/lib/dashboard-types';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg border border-[var(--border)]" style={{ background: 'var(--bg-elevated)' }}>
      <p className="text-[11px] text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[var(--text-secondary)]">{p.name}</span>
          <span className="font-bold text-[var(--text-primary)] ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function BurndownChartInner({ config, tasks, user, canSeeAllTeams }: WidgetProps) {
  const { t, lang } = useI18n();
  const dateRange = config.dateRange || '30d';
  const locale = lang === 'es' ? 'es-MX' : 'en-US';

  // Security scope
  const scopedTasks = useMemo(() => {
    if (canSeeAllTeams) return tasks;
    return tasks.filter(tk => tk.assignees?.includes(user?.uid) || tk.createdBy === user?.uid);
  }, [tasks, canSeeAllTeams, user?.uid]);

  const chartData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Total scope at period start: all non-deleted tasks that existed at start
    const totalScope = scopedTasks.filter(tk => {
      const c = tk.createdAt?.seconds ? new Date(tk.createdAt.seconds * 1000) : null;
      return c && c <= now; // created within our window
    }).length;

    // Ideal line: linear from totalScope → 0
    const data: { date: string; ideal: number; remaining: number }[] = [];

    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

      // Ideal: linear decrease
      const ideal = Math.max(Math.round(totalScope * (1 - i / days)), 0);

      // Actual remaining: total scope minus tasks completed by this date
      const completedByDate = scopedTasks.filter(tk => {
        if (tk.status !== 'done' && tk.status !== 'completed') return false;
        const u = tk.updatedAt?.seconds ? new Date(tk.updatedAt.seconds * 1000) : null;
        return u && u.toISOString().split('T')[0] <= dateStr;
      }).length;

      const remaining = totalScope - completedByDate;

      data.push({ date: label, ideal, remaining });
    }

    return data;
  }, [scopedTasks, dateRange, locale]);

  const hasData = chartData.length > 0 && chartData[0].ideal > 0;

  return (
    <WidgetShell
      title={lang === 'es' ? 'Burndown' : 'Burndown Chart'}
      icon={<TrendingDown className="h-4 w-4" />}
      headerRight={
        <span className="text-[11px] text-[var(--text-muted)] font-medium">
          {dateRange === '7d' ? '7d' : dateRange === '90d' ? '90d' : '30d'}
        </span>
      }
    >
      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <TrendingDown className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="h-full">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--text-muted)]" style={{ opacity: 0.4 }} />
              <span className="text-[11px] text-[var(--text-muted)]">{lang === 'es' ? 'Ideal' : 'Ideal'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent)]" />
              <span className="text-[11px] text-[var(--text-muted)]">{lang === 'es' ? 'Restantes' : 'Remaining'}</span>
            </div>
          </div>
          <div className="flex-1" style={{ height: 'calc(100% - 28px)' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={80}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  name={lang === 'es' ? 'Ideal' : 'Ideal'}
                  stroke="var(--text-muted)"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  opacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  name={lang === 'es' ? 'Restantes' : 'Remaining'}
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export const BurndownChartWidget = memo(BurndownChartInner);
