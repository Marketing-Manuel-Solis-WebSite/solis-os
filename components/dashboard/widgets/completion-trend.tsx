'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { WidgetProps } from '@/lib/dashboard-types';

function CustomChartTooltip({ active, payload, label }: any) {
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

function CompletionTrendInner({ config, tasks, user, canSeeAllTeams }: WidgetProps) {
  const { t, lang } = useI18n();
  const dateRange = config.dateRange || '30d';

  // SECURITY: Non-admin users see only their own task trends
  const scopedTasks = useMemo(() => {
    if (canSeeAllTeams) return tasks;
    return tasks.filter(tk => tk.assignees?.includes(user?.uid) || tk.createdBy === user?.uid);
  }, [tasks, canSeeAllTeams, user?.uid]);

  const chartData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
    const now = new Date();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const data: { date: string; created: number; completed: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

      const created = scopedTasks.filter(tk => {
        const c = tk.createdAt?.seconds ? new Date(tk.createdAt.seconds * 1000) : null;
        return c && c.toISOString().split('T')[0] === dateStr;
      }).length;

      const completed = scopedTasks.filter(tk => {
        if (tk.status !== 'done' && tk.status !== 'completed') return false;
        const u = tk.updatedAt?.seconds ? new Date(tk.updatedAt.seconds * 1000) : null;
        return u && u.toISOString().split('T')[0] === dateStr;
      }).length;

      data.push({ date: label, created, completed });
    }

    return data;
  }, [scopedTasks, dateRange, lang]);

  const hasData = chartData.some(d => d.created > 0 || d.completed > 0);

  return (
    <WidgetShell
      title={t('dashboard.widget.completionTrend')}
      icon={<TrendingUp className="h-4 w-4" />}
      headerRight={
        <span className="text-[11px] text-[var(--text-muted)] font-medium">
          {dateRange === '7d' ? '7d' : dateRange === '90d' ? '90d' : '30d'}
        </span>
      }
    >
      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <TrendingUp className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="h-full">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-[11px] text-[var(--text-muted)]">{t('dashboard.completed')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span className="text-[11px] text-[var(--text-muted)]">{t('dashboard.widget.created')}</span>
            </div>
          </div>
          <div className="flex-1" style={{ height: 'calc(100% - 28px)' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={80}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name={t('dashboard.completed')}
                  stroke="#22C55E"
                  fill="url(#completedGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name={t('dashboard.widget.created')}
                  stroke="#3B82F6"
                  fill="url(#createdGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

export const CompletionTrendWidget = memo(CompletionTrendInner);
