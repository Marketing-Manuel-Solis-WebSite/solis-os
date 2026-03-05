'use client';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Circle, Loader2, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

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

interface TasksDrillDownProps {
  tasks: any[];
  teams: any[];
  filter?: { status?: string; priority?: string; teamId?: string };
  title?: string;
}

export default function TasksDrillDown({ tasks, teams, filter }: TasksDrillDownProps) {
  const { t } = useI18n();
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = tasks;
    if (filter?.status) result = result.filter(tk => tk.status === filter.status);
    if (filter?.priority) result = result.filter(tk => (tk.priority || 'medium') === filter.priority);
    if (filter?.teamId) result = result.filter(tk => tk.teamId === filter.teamId);
    return result;
  }, [tasks, filter]);

  const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div>
      <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-[13px] text-[var(--text-muted)]">
          {filtered.length} {t('dashboard.tasksLabel', { n: filtered.length })}
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {paginated.map((tk: any) => {
          const StIcon = statusIcons[tk.status] || Circle;
          const sColor = statusColors[tk.status] || '#64748B';
          const team = teams.find((tm: any) => tm.id === tk.teamId);
          const due = tk.dueDate ? (tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate)) : null;

          return (
            <div key={tk.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[var(--bg-hover)] transition">
              <StIcon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: sColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)]">{tk.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {team && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${team.color}10`, color: team.color }}
                    >
                      {team.icon} {team.name}
                    </span>
                  )}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${priorityColors[tk.priority] || '#64748B'}15`,
                      color: priorityColors[tk.priority] || '#64748B',
                    }}
                  >
                    {t(`priority.${tk.priority || 'medium'}`)}
                  </span>
                  {due && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <div className="p-4 text-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
      )}
    </div>
  );
}
