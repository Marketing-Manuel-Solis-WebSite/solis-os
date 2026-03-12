'use client';
import { memo, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { AnimatedCounter } from '@/components/ui/motion';
import { CheckSquare, Clock, TrendingUp, AlertTriangle, FileText, Users } from 'lucide-react';
import type { WidgetProps } from '@/lib/dashboard-types';

const METRIC_CONFIG: Record<string, {
  icon: React.ComponentType<any>;
  color: string;
  bgFrom: string;
  bgTo: string;
  labelKey: string;
}> = {
  totalTasks:  { icon: CheckSquare,    color: '#3B82F6', bgFrom: 'from-blue-500/12',    bgTo: 'to-blue-600/4',    labelKey: 'dashboard.totalTasks' },
  inProgress:  { icon: Clock,          color: '#F59E0B', bgFrom: 'from-amber-500/12',   bgTo: 'to-amber-600/4',   labelKey: 'dashboard.inProgress' },
  completed:   { icon: TrendingUp,     color: '#22C55E', bgFrom: 'from-emerald-500/12', bgTo: 'to-emerald-600/4', labelKey: 'dashboard.completed' },
  overdue:     { icon: AlertTriangle,  color: '#EF4444', bgFrom: 'from-red-500/12',     bgTo: 'to-red-600/4',     labelKey: 'dashboard.overdue' },
  documents:   { icon: FileText,       color: '#8B5CF6', bgFrom: 'from-purple-500/12',  bgTo: 'to-purple-600/4',  labelKey: 'dashboard.documents' },
  teamMembers: { icon: Users,          color: '#3B82F6', bgFrom: 'from-blue-500/12',    bgTo: 'to-blue-600/4',    labelKey: 'dashboard.team' },
};

function StatCardInner({ config, tasks, members, user, canSeeAllTeams, activeTeamId }: WidgetProps) {
  const { t } = useI18n();
  const metric = config.metric || 'totalTasks';
  const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.totalTasks;
  const Icon = cfg.icon;

  const value = useMemo(() => {
    // SECURITY: For non-admin users, stat cards show PERSONAL metrics only
    const scopedTasks = canSeeAllTeams
      ? tasks
      : tasks.filter(tk => tk.assignees?.includes(user?.uid) || tk.createdBy === user?.uid);

    switch (metric) {
      case 'totalTasks': return scopedTasks.length;
      case 'inProgress': return scopedTasks.filter(t => t.status === 'in_progress').length;
      case 'completed': return scopedTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      case 'overdue': return scopedTasks.filter(t => {
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
  }, [metric, tasks, members, activeTeamId, canSeeAllTeams, user?.uid]);

  return (
    <div className="relative rounded-2xl overflow-hidden h-full flex flex-col justify-between cursor-default transition-all duration-300 group bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${cfg.bgFrom} ${cfg.bgTo} opacity-90 transition-opacity duration-300 group-hover:opacity-100`} />

      {/* Accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(to right, ${cfg.color}40, ${cfg.color}10)` }}
      />

      <div className="relative p-5 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t(cfg.labelKey)}</p>
          <AnimatedCounter value={value} className="text-3xl font-bold text-[var(--text-primary)]" />
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${cfg.color}12`, boxShadow: `0 0 0 1px ${cfg.color}10` }}
        >
          <Icon className="h-5 w-5" style={{ color: cfg.color }} />
        </div>
      </div>
    </div>
  );
}

export const StatCardWidget = memo(StatCardInner);
