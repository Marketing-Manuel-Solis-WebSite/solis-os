'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getTasks, getGoals, getAuditLogs } from '@/lib/db';
import {
  ensureSpaceDashboard,
  ensureListDashboard,
  ensureFolderDashboard,
  saveDashboard,
} from '@/lib/dashboard-db';
import type { DashboardConfig, WidgetLayout, WidgetProps, DashboardScopeType } from '@/lib/dashboard-types';
import WidgetGrid from './widget-grid';
import DashboardBuilder from './dashboard-builder';
import { Loader2, LayoutGrid } from 'lucide-react';

interface ContextualDashboardProps {
  scopeType: DashboardScopeType;
  scopeId: string;         // spaceId, folderId, or listId
  /** Tasks pre-loaded from parent — avoids redundant fetches */
  tasks?: any[];
  /** Goals pre-loaded from parent */
  goals?: any[];
  /** Members scoped to this context */
  members?: any[];
}

export default function ContextualDashboard({
  scopeType,
  scopeId,
  tasks: externalTasks,
  goals: externalGoals,
  members: externalMembers,
}: ContextualDashboardProps) {
  const { user, me, teams, allMembers, canSeeAllTeams, activeTeamId } = useAuth();
  const { lang } = useI18n();

  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Internal data — only fetched when no external data provided
  const [internalTasks, setInternalTasks] = useState<any[]>([]);
  const [internalGoals, setInternalGoals] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const dashboardLoaded = useRef(false);

  const tasks = externalTasks ?? internalTasks;
  const goals = externalGoals ?? internalGoals;
  const members = externalMembers ?? allMembers;

  const isAdmin = useMemo(() => {
    return canSeeAllTeams || ['owner', 'admin', 'director'].includes(me?.role || '');
  }, [canSeeAllTeams, me?.role]);

  // Load dashboard config
  useEffect(() => {
    if (!user?.uid || !scopeId || dashboardLoaded.current) return;
    dashboardLoaded.current = true;
    setLoading(true);

    const ensureFn =
      scopeType === 'list' ? ensureListDashboard :
      scopeType === 'folder' ? ensureFolderDashboard :
      ensureSpaceDashboard;

    ensureFn(user.uid, scopeId)
      .then(d => { setDashboard(d); setLoading(false); })
      .catch(err => {
        console.error(`[ContextualDashboard] Failed to load ${scopeType} dashboard:`, err);
        dashboardLoaded.current = false;
        setLoading(false);
      });
  }, [user?.uid, scopeId, scopeType]);

  // Reset when scope changes
  useEffect(() => {
    dashboardLoaded.current = false;
    setDashboard(null);
    setEditing(false);
  }, [scopeId, scopeType]);

  // Fetch data if not provided externally
  useEffect(() => {
    if (!user || externalTasks !== undefined) return;
    const teamId = scopeType === 'space' ? scopeId : activeTeamId;
    Promise.all([
      getTasks(teamId).catch(() => ({ items: [] })),
      getGoals(teamId === '__all__' ? undefined : teamId).catch(() => ({ items: [] })),
      isAdmin ? getAuditLogs().catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    ]).then(([tasksRes, goalsRes, logsRes]) => {
      setInternalTasks(tasksRes.items);
      setInternalGoals(goalsRes.items);
      setLogs(logsRes.items);
    });
  }, [user, scopeId, scopeType, activeTeamId, isAdmin, externalTasks]);

  // Dashboard handlers
  const handleUpdateWidgets = useCallback((widgets: WidgetLayout[]) => {
    setDashboard(prev => prev ? { ...prev, widgets } : prev);
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setDashboard(prev => {
      if (!prev) return prev;
      const updated = prev.widgets.filter(w => w.widgetId !== widgetId);
      queueMicrotask(() => saveDashboard(prev.id, { widgets: updated }).catch(err => console.error('[ContextualDashboard] save failed:', err)));
      return { ...prev, widgets: updated };
    });
  }, []);

  const handleReorder = useCallback((widgets: WidgetLayout[]) => {
    setDashboard(prev => {
      if (!prev) return prev;
      queueMicrotask(() => saveDashboard(prev.id, { widgets }).catch(err => console.error('[ContextualDashboard] save failed:', err)));
      return { ...prev, widgets };
    });
  }, []);

  const sharedProps: Omit<WidgetProps, 'config'> = useMemo(() => ({
    tasks,
    goals,
    logs,
    teams,
    members,
    user,
    me,
    canSeeAllTeams,
    activeTeamId: scopeType === 'space' ? scopeId : (activeTeamId || '__all__'),
  }), [tasks, goals, logs, teams, members, user, me, canSeeAllTeams, activeTeamId, scopeId, scopeType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
          <div className="relative w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        </div>
        <p className="text-[13px] text-[var(--text-muted)]">
          {lang === 'es' ? 'Cargando dashboard...' : 'Loading dashboard...'}
        </p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
          <LayoutGrid className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
        </div>
        <p className="text-[14px] text-[var(--text-muted)] font-medium mb-1">
          {lang === 'es' ? 'Dashboard no disponible' : 'Dashboard unavailable'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <DashboardBuilder
          dashboard={dashboard}
          editing={editing}
          isAdmin={isAdmin}
          onEditingChange={setEditing}
          onUpdate={handleUpdateWidgets}
        />
      </div>
      <WidgetGrid
        widgets={dashboard.widgets}
        sharedProps={sharedProps}
        isAdmin={isAdmin}
        editing={editing}
        onReorder={handleReorder}
        onRemove={handleRemoveWidget}
      />
    </div>
  );
}
