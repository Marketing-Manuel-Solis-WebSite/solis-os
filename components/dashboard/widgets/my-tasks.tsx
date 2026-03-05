'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { WidgetShell } from '../widget-shell';
import { ListTodo, Circle, Loader2, Eye, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

const statusIcons: Record<string, any> = {
  todo: Circle,
  in_progress: Loader2,
  in_review: Eye,
  done: CheckCircle2,
  blocked: AlertTriangle,
};
const statusColors: Record<string, string> = {
  todo: '#64748B',
  in_progress: '#3B82F6',
  in_review: '#A855F7',
  done: '#22C55E',
  blocked: '#EF4444',
};
const priorityColors: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#64748B',
};

function MyTasksInner({ config, tasks, user, teams }: WidgetProps) {
  const { t } = useI18n();
  const router = useRouter();
  const limit = config.limit || 8;

  const myPending = useMemo(() => {
    return tasks
      .filter(tk => (tk.assignees?.includes(user?.uid) || tk.createdBy === user?.uid) && tk.status !== 'done' && tk.status !== 'completed')
      .sort((a: any, b: any) => {
        const pa = { urgent: 0, high: 1, medium: 2, low: 3 }[a.priority as string] ?? 2;
        const pb = { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority as string] ?? 2;
        return pa - pb;
      });
  }, [tasks, user?.uid]);

  const myOverdue = useMemo(() => {
    return myPending.filter(tk => {
      if (!tk.dueDate) return false;
      const due = tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate);
      return due < new Date();
    });
  }, [myPending]);

  return (
    <WidgetShell
      title={t('dashboard.myTasks')}
      icon={<ListTodo className="h-4 w-4" />}
      noPadding
      headerRight={
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
            {myPending.length}
          </span>
          {myOverdue.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
              {myOverdue.length} {t('dashboard.overdue')}
            </span>
          )}
        </div>
      }
    >
      <div className="overflow-y-auto h-full scrollbar-thin">
        {myPending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-60" />
            <p className="text-[13px] text-[var(--text-muted)]">{t('dashboard.allCaughtUp')}</p>
          </div>
        ) : (
          <>
            {myPending.slice(0, limit).map((tk: any) => {
              const StIcon = statusIcons[tk.status] || Circle;
              const sColor = statusColors[tk.status] || '#64748B';
              const pColor = priorityColors[tk.priority] || '#64748B';
              const team = teams.find((tm: any) => tm.id === tk.teamId);
              return (
                <div
                  key={tk.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition cursor-pointer border-b border-[var(--border-subtle)]/40 last:border-b-0"
                  onClick={() => router.push('/app/tasks')}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${sColor}12` }}
                  >
                    <StIcon className="h-3.5 w-3.5" style={{ color: sColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[var(--text-primary)] truncate font-medium">{tk.title}</p>
                    {team && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block"
                        style={{ backgroundColor: `${team.color}10`, color: team.color }}
                      >
                        {team.icon} {team.name}
                      </span>
                    )}
                  </div>
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: pColor }}
                    title={t(`priority.${tk.priority}`)}
                  />
                </div>
              );
            })}
            {myPending.length > limit && (
              <div className="p-3 text-center">
                <button onClick={() => router.push('/app/tasks')} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1 mx-auto font-medium">
                  {t('dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </WidgetShell>
  );
}

export const MyTasksWidget = memo(MyTasksInner);
