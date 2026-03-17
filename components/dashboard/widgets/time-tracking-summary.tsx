'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { WidgetProps } from '@/lib/dashboard-types';

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#22C55E', '#06B6D4', '#EF4444', '#64748B'];

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-[12px] shadow-lg border border-[var(--border)]" style={{ background: 'var(--bg-elevated)' }}>
      <p className="text-[var(--text-primary)] font-medium">{payload[0].payload.name}</p>
      <p className="text-[var(--text-muted)]">{formatHours(payload[0].value)}</p>
    </div>
  );
}

function TimeTrackingSummaryInner({ tasks, teams, members, user, canSeeAllTeams }: WidgetProps) {
  const { t } = useI18n();

  const data = useMemo(() => {
    // Aggregate time tracked per team
    const teamTimes: Record<string, { name: string; minutes: number }> = {};

    for (const team of teams || []) {
      if (team.status === 'archived') continue;
      teamTimes[team.id] = { name: team.name, minutes: 0 };
    }

    for (const task of tasks) {
      const tid = task.teamId;
      if (!tid || !teamTimes[tid]) continue;
      teamTimes[tid].minutes += task.timeTracked || 0;
    }

    return Object.entries(teamTimes)
      .filter(([, v]) => v.minutes > 0)
      .map(([id, v]) => ({ id, name: v.name, value: Math.round(v.minutes) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [tasks, teams]);

  const totalMinutes = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <WidgetShell
      title={t('dashboard.widget.timeTrackingSummary') || 'Time Tracked'}
      icon={<Clock className="h-4 w-4" />}
      headerRight={totalMinutes > 0 ? <span className="text-[12px] text-[var(--text-muted)]">{formatHours(totalMinutes)} total</span> : undefined}
    >
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Clock className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minHeight={160}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </WidgetShell>
  );
}

export const TimeTrackingSummaryWidget = memo(TimeTrackingSummaryInner);
