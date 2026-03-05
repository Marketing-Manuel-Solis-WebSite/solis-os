'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { AnimatedCounter } from '@/components/ui/motion';
import { CheckSquare, Clock, TrendingUp, AlertTriangle, FileText, Users } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

const METRIC_CONFIG: Record<string, {
  icon: React.ComponentType<any>;
  color: string;
  gradient: string;
  labelKey: string;
}> = {
  totalTasks: { icon: CheckSquare, color: '#3B82F6', gradient: 'from-blue-500/10 to-blue-600/5', labelKey: 'dashboard.totalTasks' },
  inProgress: { icon: Clock, color: '#F59E0B', gradient: 'from-amber-500/10 to-amber-600/5', labelKey: 'dashboard.inProgress' },
  completed: { icon: TrendingUp, color: '#22C55E', gradient: 'from-emerald-500/10 to-emerald-600/5', labelKey: 'dashboard.completed' },
  overdue: { icon: AlertTriangle, color: '#EF4444', gradient: 'from-red-500/10 to-red-600/5', labelKey: 'dashboard.overdue' },
  documents: { icon: FileText, color: '#8B5CF6', gradient: 'from-purple-500/10 to-purple-600/5', labelKey: 'dashboard.documents' },
  teamMembers: { icon: Users, color: '#3B82F6', gradient: 'from-blue-500/10 to-blue-600/5', labelKey: 'dashboard.team' },
};

function StatCardInner({ config, tasks, members, activeTeamId }: WidgetProps) {
  const { t } = useI18n();
  const metric = config.metric || 'totalTasks';
  const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.totalTasks;
  const Icon = cfg.icon;

  const value = useMemo(() => {
    switch (metric) {
      case 'totalTasks': return tasks.length;
      case 'inProgress': return tasks.filter(t => t.status === 'in_progress').length;
      case 'completed': return tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      case 'overdue': return tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
        return due < new Date() && t.status !== 'done' && t.status !== 'completed';
      }).length;
      case 'teamMembers': {
        if (activeTeamId === '__all__') return members.length;
        return members.filter((m: any) => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId)).length;
      }
      default: return 0;
    }
  }, [metric, tasks, members, activeTeamId]);

  return (
    <div className="relative rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-5 overflow-hidden h-full flex flex-col justify-between cursor-default transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-80`} />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{t(cfg.labelKey)}</p>
          <AnimatedCounter value={value} className="text-3xl font-bold text-[var(--text-primary)]" />
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${cfg.color}15` }}
        >
          <Icon className="h-5 w-5" style={{ color: cfg.color }} />
        </div>
      </div>
    </div>
  );
}

export const StatCardWidget = memo(StatCardInner);
