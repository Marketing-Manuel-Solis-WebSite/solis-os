'use client';
import { memo, useState, useCallback, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Sparkles, RefreshCw, Brain } from 'lucide-react';
import { generateDashboardInsights, type DashboardMetrics } from '@/lib/dashboard-ai';
import type { WidgetProps } from '@/lib/dashboard-types';

function AIInsightsInner({ tasks, goals, teams, user, me, activeTeamId }: WidgetProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    setError('');
    try {
      const completedTasks = tasks.filter(tk => tk.status === 'done' || tk.status === 'completed').length;
      const overdueTasks = tasks.filter(tk => {
        if (!tk.dueDate) return false;
        const due = tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate);
        return due < new Date() && tk.status !== 'done' && tk.status !== 'completed';
      }).length;

      const myTeam = teams.find((tm: any) => tm.id === me.teamId);
      const metrics: DashboardMetrics = {
        totalTasks: tasks.length,
        completedTasks,
        overdueTasks,
        inProgressTasks: tasks.filter(tk => tk.status === 'in_progress').length,
        completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
        goalsAtRisk: goals.filter((g: any) => g.status === 'at_risk' || g.status === 'behind').length,
        totalGoals: goals.length,
        teamName: myTeam?.name || '',
        userName: me.displayName || '',
      };

      const result = await generateDashboardInsights(metrics);
      setText(result.trim());
      setHasLoaded(true);
    } catch {
      setError('No se pudo conectar con el asistente. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tasks, goals, teams, me]);

  useEffect(() => {
    if (!hasLoaded && tasks.length > 0 && me) {
      fetchInsights();
    }
  }, [hasLoaded, tasks.length, me, fetchInsights]);

  return (
    <WidgetShell
      title="Resumen IA"
      icon={<Brain className="h-4 w-4" />}
      loading={loading}
      headerRight={
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition disabled:opacity-50"
          title="Actualizar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {error ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-[13px] text-[var(--text-muted)] text-center max-w-[200px]">{error}</p>
          <button
            onClick={fetchInsights}
            className="text-[12px] text-[var(--accent)] hover:underline"
          >
            Reintentar
          </button>
        </div>
      ) : !text ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <p className="text-[13px] text-[var(--text-muted)] text-center">Analizando tus datos...</p>
        </div>
      ) : (
        <div className="overflow-y-auto h-full scrollbar-thin">
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
            {text}
          </p>
        </div>
      )}
    </WidgetShell>
  );
}

export const AIInsightsWidget = memo(AIInsightsInner);
