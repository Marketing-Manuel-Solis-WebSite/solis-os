'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';
import type { WidgetProps } from '@/lib/dashboard-types';

const STATUS_COLORS: Record<string, string> = {
  on_track: '#22C55E',
  at_risk: '#F59E0B',
  behind: '#EF4444',
  completed: '#3B82F6',
};

const STATUS_LABELS: Record<string, string> = {
  on_track: 'En camino',
  at_risk: 'En riesgo',
  behind: 'Atrasada',
  completed: 'Completada',
};

function GoalsProgressInner({ goals, user, me }: WidgetProps) {
  const { t } = useI18n();

  const myGoals = useMemo(() => {
    return goals
      .filter((g: any) => g.ownerId === user?.uid || g.teamId === me?.teamId)
      .sort((a: any, b: any) => (b.progress || 0) - (a.progress || 0))
      .slice(0, 8);
  }, [goals, user?.uid, me?.teamId]);

  return (
    <WidgetShell title={t('dashboard.widget.goalsProgress')} icon={<Target className="h-4 w-4" />}>
      {myGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <Target className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('dashboard.widget.noGoals')}</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto h-full scrollbar-thin">
          {myGoals.map((goal: any) => {
            const progress = goal.progress || 0;
            const color = STATUS_COLORS[goal.status] || '#3B82F6';
            return (
              <div key={goal.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[var(--text-primary)] truncate flex-1 mr-3 font-medium">{goal.name}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {STATUS_LABELS[goal.status] || goal.status}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-2.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <span className="text-[12px] font-bold shrink-0 w-9 text-right" style={{ color }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

export const GoalsProgressWidget = memo(GoalsProgressInner);
