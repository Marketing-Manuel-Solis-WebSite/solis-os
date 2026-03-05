'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { WidgetProps } from '@/lib/dashboard-types';

function TeamPerformanceInner({ tasks, teams, canSeeAllTeams }: WidgetProps) {
  const { t } = useI18n();

  const byDept = useMemo(() => {
    return teams.map((team: any) => {
      const dTasks = tasks.filter((tk: any) => tk.teamId === team.id);
      const dDone = dTasks.filter((tk: any) => tk.status === 'done' || tk.status === 'completed').length;
      const rate = dTasks.length > 0 ? Math.round((dDone / dTasks.length) * 100) : 0;
      return { team, total: dTasks.length, done: dDone, rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [tasks, teams]);

  if (!canSeeAllTeams || byDept.length === 0) {
    return (
      <WidgetShell title={t('dashboard.deptPerformance')} icon={<Users className="h-4 w-4" />}>
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Users className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={t('dashboard.deptPerformance')} icon={<Users className="h-4 w-4" />}>
      <div className="space-y-4 overflow-y-auto h-full scrollbar-thin">
        {byDept.map((dp, di) => (
          <div key={dp.team.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{dp.team.icon}</span>
                <span className="text-[13px] font-medium truncate" style={{ color: dp.team.color }}>
                  {dp.team.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[11px] text-[var(--text-muted)]">
                <span>{dp.done}/{dp.total}</span>
                <span className="font-bold text-[12px]" style={{ color: dp.team.color }}>
                  {dp.rate}%
                </span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dp.rate}%` }}
                transition={{ duration: 0.8, delay: di * 0.05 }}
                className="h-full rounded-full"
                style={{ backgroundColor: dp.team.color, opacity: 0.75 }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export const TeamPerformanceWidget = memo(TeamPerformanceInner);
