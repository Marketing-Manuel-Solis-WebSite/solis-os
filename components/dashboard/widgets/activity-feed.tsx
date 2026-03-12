'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Activity, Zap } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

function ActivityFeedInner({ config, logs, members, activeTeamId, canSeeAllTeams }: WidgetProps) {
  const { t } = useI18n();
  const limit = config.limit || 10;

  const filteredLogs = useMemo(() => {
    if (activeTeamId === '__all__') return logs;
    const teamMemberIds = new Set(
      members
        .filter((m: any) => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId))
        .map((m: any) => m.userId)
    );
    return logs.filter((log: any) => {
      if (log.actorId && teamMemberIds.has(log.actorId)) return true;
      if (!log.actorId || log.actorId === 'system') return true;
      return false;
    });
  }, [logs, activeTeamId, members]);

  return (
    <WidgetShell title={t('dashboard.recentActivity')} icon={<Activity className="h-4 w-4" />} noPadding>
      <div className="overflow-y-auto h-full scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <Zap className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
            <p className="text-[13px] text-[var(--text-muted)]">{t('dashboard.actionsWillAppear')}</p>
          </div>
        ) : (
          filteredLogs.slice(0, limit).map((l: any, i: number) => (
            <div key={l.id} className="px-5 py-3 hover:bg-[var(--bg-hover)] transition border-b border-[var(--border-subtle)]/40 last:border-b-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[var(--accent)]">
                    {(l.actorName || 'S')[0].toUpperCase()}
                  </span>
                </div>
                <p className="text-[13px] min-w-0 truncate">
                  <span className="font-medium text-[var(--text-primary)]">{l.actorName || 'System'}</span>{' '}
                  <span className="text-[var(--text-muted)]">{l.action}</span>{' '}
                  <span className="text-[var(--text-secondary)]">{l.resource}</span>
                </p>
              </div>
              {l.detail && <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate ml-8">{l.detail}</p>}
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}

export const ActivityFeedWidget = memo(ActivityFeedInner);
