'use client';
import { useEffect, useState, use } from 'react';
import { Loader2, AlertCircle, LayoutDashboard } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { WidgetLayout } from '@/lib/dashboard-types';
import WidgetGrid from '@/components/dashboard/widget-grid';

interface SharedDashboard {
  id: string;
  title: string;
  widgets: WidgetLayout[];
  shareMode: 'view' | 'interact';
  snapshot?: any;
  taskCountsByStatus?: Record<string, number>;
  goalCountsByStatus?: Record<string, number>;
  teams?: any[];
}

export default function SharedDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t, lang } = useI18n();
  const [dashboard, setDashboard] = useState<SharedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/dashboard/public?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          setError(lang === 'es' ? 'Dashboard no encontrado' : 'Dashboard not found');
          return;
        }
        setDashboard(await res.json());
      } catch {
        setError(lang === 'es' ? 'Error al cargar' : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, lang]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es' ? 'Cargando dashboard...' : 'Loading dashboard...'}
        </p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center gap-3 p-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{error}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es'
            ? 'El enlace puede haber expirado o el dashboard ya no esta compartido.'
            : 'The link may have expired or the dashboard is no longer shared.'}
        </p>
      </div>
    );
  }

  // Build shared props from aggregated data returned by the API
  // Note: API returns counts-by-status (not raw entities) for security
  const sharedProps = {
    tasks: [],
    goals: [],
    logs: dashboard.snapshot?.recentLogs || [],
    teams: dashboard.teams || [],
    members: [],
    user: null,
    me: null,
    canSeeAllTeams: true,
    activeTeamId: '__all__',
    snapshot: {
      ...(dashboard.snapshot || {}),
      taskCountsByStatus: dashboard.taskCountsByStatus || {},
      goalCountsByStatus: dashboard.goalCountsByStatus || {},
    },
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-[var(--bg-elevated)]/80 backdrop-blur-sm border-b border-[var(--border-subtle)]">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <LayoutDashboard className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-[var(--text-primary)] truncate">{dashboard.title}</h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              {lang === 'es' ? 'Dashboard compartido' : 'Shared dashboard'}
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
            {lang === 'es' ? 'Solo lectura' : 'Read only'}
          </span>
        </div>
      </div>

      {/* Widgets */}
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        <WidgetGrid
          widgets={dashboard.widgets}
          sharedProps={sharedProps}
          editing={false}
          isAdmin={false}
          onReorder={() => {}}
          onRemove={() => {}}
        />
      </div>
    </div>
  );
}
