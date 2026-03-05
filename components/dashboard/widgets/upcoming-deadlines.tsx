'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { CalendarClock, Clock } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

function UpcomingDeadlinesInner({ tasks, teams }: WidgetProps) {
  const { t } = useI18n();

  const upcoming = useMemo(() => {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 86400000);
    return tasks
      .filter(tk => {
        if (!tk.dueDate || tk.status === 'done' || tk.status === 'completed') return false;
        const due = tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate);
        return due >= now && due <= weekLater;
      })
      .sort((a: any, b: any) => {
        const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        const db = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
        return da.getTime() - db.getTime();
      })
      .slice(0, 8);
  }, [tasks]);

  return (
    <WidgetShell
      title={t('dashboard.upcomingDeadlines')}
      icon={<CalendarClock className="h-4 w-4" />}
      noPadding
      headerRight={<span className="text-[11px] text-[var(--text-muted)] font-medium">{t('dashboard.next7Days')}</span>}
    >
      <div className="overflow-y-auto h-full scrollbar-thin">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <Clock className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
            <p className="text-[13px] text-[var(--text-muted)]">{t('dashboard.noDeadlines')}</p>
          </div>
        ) : (
          upcoming.map((tk: any) => {
            const due = tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate);
            const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
            const team = teams.find((tm: any) => tm.id === tk.teamId);
            const urgencyColor = daysLeft <= 1 ? '#EF4444' : daysLeft <= 3 ? '#F59E0B' : 'var(--text-muted)';
            return (
              <div key={tk.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition border-b border-[var(--border-subtle)]/40 last:border-b-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${urgencyColor}12` }}
                >
                  <CalendarClock className="h-3.5 w-3.5" style={{ color: urgencyColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate font-medium">{tk.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {team && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: `${team.color}10`, color: team.color }}
                      >
                        {team.icon}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {due.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                  style={{
                    backgroundColor: `${urgencyColor}12`,
                    color: urgencyColor,
                  }}
                >
                  {daysLeft === 0 ? t('dashboard.today') : daysLeft === 1 ? t('dashboard.tomorrow') : t('dashboard.daysLeft', { n: daysLeft })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </WidgetShell>
  );
}

export const UpcomingDeadlinesWidget = memo(UpcomingDeadlinesInner);
