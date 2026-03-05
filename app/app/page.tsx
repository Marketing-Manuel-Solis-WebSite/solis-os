'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getTasks, getDocuments, getAuditLogs, getGoals } from '@/lib/db';
import { ensureDefaultDashboard, saveDashboard } from '@/lib/dashboard-db';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import WidgetGrid from '@/components/dashboard/widget-grid';
import DashboardBuilder from '@/components/dashboard/dashboard-builder';
import type { DashboardConfig, WidgetLayout } from '@/lib/dashboard-types';

export default function Dashboard() {
  const { user, me, canSeeAllTeams, activeTeamId, teams, canSeeResource, allMembers } = useAuth();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [editing, setEditing] = useState(false);

  const isAdmin = useMemo(() => {
    return canSeeAllTeams || ['owner', 'admin', 'director'].includes(me?.role || '');
  }, [canSeeAllTeams, me?.role]);

  // Track if dashboard has been loaded to avoid re-fetching from Firestore
  const dashboardLoaded = useRef(false);

  // Load data
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getTasks(activeTeamId).catch(() => []),
      getDocuments(activeTeamId).catch(() => []),
      getAuditLogs().catch(() => []),
      getGoals(activeTeamId === '__all__' ? undefined : activeTeamId).catch(() => []),
    ]).then(([ts, _d, l, g]) => {
      const filteredTasks = canSeeAllTeams
        ? ts
        : (ts as any[]).filter(tk => canSeeResource({ teamId: tk.teamId, createdBy: tk.createdBy, visibility: tk.visibility, assignees: tk.assignees }));
      setTasks(filteredTasks as any[]);
      setLogs(l as any[]);
      setGoals(g as any[]);
      setLoading(false);
    });
  }, [activeTeamId, user, canSeeAllTeams, canSeeResource]);

  // Load dashboard config — only once per session
  useEffect(() => {
    if (!user?.uid || !me || dashboardLoaded.current) return;
    dashboardLoaded.current = true;
    ensureDefaultDashboard(user.uid, isAdmin).then(setDashboard).catch(() => {
      dashboardLoaded.current = false; // allow retry on error
    });
  }, [user?.uid, me, isAdmin]);

  const handleUpdateWidgets = useCallback((widgets: WidgetLayout[]) => {
    setDashboard(prev => prev ? { ...prev, widgets } : prev);
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setDashboard(prev => {
      if (!prev) return prev;
      const updated = prev.widgets.filter(w => w.widgetId !== widgetId);
      // Fire-and-forget save outside the updater via microtask
      queueMicrotask(() => saveDashboard(prev.id, { widgets: updated }).catch(() => {}));
      return { ...prev, widgets: updated };
    });
  }, []);

  const handleReorder = useCallback((widgets: WidgetLayout[]) => {
    setDashboard(prev => {
      if (!prev) return prev;
      queueMicrotask(() => saveDashboard(prev.id, { widgets }).catch(() => {}));
      return { ...prev, widgets };
    });
  }, []);

  const widgets = dashboard?.widgets || [];

  const sharedProps = useMemo(() => ({
    tasks,
    goals,
    logs,
    teams,
    members: allMembers,
    user,
    me,
    canSeeAllTeams,
    activeTeamId: activeTeamId || '__all__',
  }), [tasks, goals, logs, teams, allMembers, user, me, canSeeAllTeams, activeTeamId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">
            {t('dashboard.welcome', { name: me?.displayName ? `, ${me.displayName.split(' ')[0]}` : '' })}
          </h1>
          <p className="text-[var(--text-muted)] text-base">
            {t('dashboard.subtitle')}
            {canSeeAllTeams && activeTeamId === '__all__' && (
              <span className="ml-2 text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent)] font-semibold">
                {t('common.generalView')}
              </span>
            )}
          </p>
        </div>
        {dashboard && (
          <DashboardBuilder
            dashboard={dashboard}
            editing={editing}
            isAdmin={isAdmin}
            onEditingChange={setEditing}
            onUpdate={handleUpdateWidgets}
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <WidgetGrid
          widgets={widgets}
          sharedProps={sharedProps}
          editing={editing}
          onReorder={handleReorder}
          onRemove={handleRemoveWidget}
        />
      )}
    </motion.div>
  );
}
