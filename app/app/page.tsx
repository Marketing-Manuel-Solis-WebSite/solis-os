'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getTasks, getAuditLogs, getGoals } from '@/lib/db';
import { ensureDefaultDashboard, saveDashboard } from '@/lib/dashboard-db';
import { motion } from 'framer-motion';
import { Loader2, Calendar, Shield, Sparkles, Share2 } from 'lucide-react';
import WidgetGrid from '@/components/dashboard/widget-grid';
import DashboardBuilder from '@/components/dashboard/dashboard-builder';
import DashboardShareModal from '@/components/dashboard/dashboard-share-modal';
import type { DashboardConfig, WidgetLayout } from '@/lib/dashboard-types';
import { useFeatureFlag } from '@/lib/feature-flags';

// ─── Time-of-day greeting helper ────────────────────────────
function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'dashboard.goodMorning';
  if (h < 18) return 'dashboard.goodAfternoon';
  return 'dashboard.goodEvening';
}

function getFormattedDate(lang: string): string {
  const now = new Date();
  return now.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function Dashboard() {
  const { user, me, canSeeAllTeams, activeTeamId, teams, canSeeResource, allMembers } = useAuth();
  const { t, lang } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const dashboardSharingEnabled = useFeatureFlag('dashboard-sharing');

  const isAdmin = useMemo(() => {
    return canSeeAllTeams || ['owner', 'admin', 'director'].includes(me?.role || '');
  }, [canSeeAllTeams, me?.role]);

  const dashboardLoaded = useRef(false);

  // ─── Data loading ─────────────────────────────────────────
  // SECURITY: Only admin users fetch audit logs (Firestore rules deny non-admin reads anyway).
  // REMOVED: getDocuments() — was fetched but never used (dead Firestore read).
  useEffect(() => {
    if (!user) return;
    const promises: Promise<any>[] = [
      getTasks(activeTeamId).catch(() => ({ items: [], hasMore: false })),
      getGoals(activeTeamId === '__all__' ? undefined : activeTeamId).catch(() => ({ items: [], hasMore: false })),
    ];

    // Only admin fetches audit logs — non-admin would get permission-denied from Firestore rules anyway
    if (isAdmin) {
      promises.push(getAuditLogs().catch(() => ({ items: [], hasMore: false })));
    }

    Promise.all(promises).then((results) => {
      const [{ items: ts }, { items: g }] = results;
      const auditItems = isAdmin && results[2] ? results[2].items : [];

      // SECURITY: For non-admin users, filter tasks through canSeeResource
      const filteredTasks = canSeeAllTeams
        ? ts
        : (ts as any[]).filter((tk: any) => canSeeResource({
            teamId: tk.teamId,
            createdBy: tk.createdBy,
            visibility: tk.visibility,
            assignees: tk.assignees,
          }));
      setTasks(filteredTasks as any[]);
      setLogs(auditItems as any[]);
      setGoals(g as any[]);
      setLoading(false);
    });
  }, [activeTeamId, user, canSeeAllTeams, canSeeResource, isAdmin]);

  // Load dashboard config — only once per session
  useEffect(() => {
    if (!user?.uid || !me || dashboardLoaded.current) return;
    dashboardLoaded.current = true;
    ensureDefaultDashboard(user.uid, isAdmin).then(setDashboard).catch(() => {
      dashboardLoaded.current = false;
    });
  }, [user?.uid, me, isAdmin]);

  const handleUpdateWidgets = useCallback((widgets: WidgetLayout[]) => {
    setDashboard(prev => prev ? { ...prev, widgets } : prev);
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setDashboard(prev => {
      if (!prev) return prev;
      const updated = prev.widgets.filter(w => w.widgetId !== widgetId);
      queueMicrotask(() => saveDashboard(prev.id, { widgets: updated }).catch((err) => console.error('[Home] save widget remove failed:', err)));
      return { ...prev, widgets: updated };
    });
  }, []);

  const handleReorder = useCallback((widgets: WidgetLayout[]) => {
    setDashboard(prev => {
      if (!prev) return prev;
      queueMicrotask(() => saveDashboard(prev.id, { widgets }).catch((err) => console.error('[Home] save widget reorder failed:', err)));
      return { ...prev, widgets };
    });
  }, []);

  const widgets = dashboard?.widgets || [];
  const dateStr = useMemo(() => getFormattedDate(lang), [lang]);

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

  // Quick stats for the hero section
  const heroStats = useMemo(() => {
    const uid = user?.uid;
    const myTasks = tasks.filter((tk: any) =>
      tk.assignees?.includes(uid) || tk.createdBy === uid
    );
    const myPending = myTasks.filter((tk: any) => tk.status !== 'done' && tk.status !== 'completed');
    const myOverdue = myPending.filter((tk: any) => {
      if (!tk.dueDate) return false;
      const due = tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate);
      return due < new Date();
    });
    return { pending: myPending.length, overdue: myOverdue.length };
  }, [tasks, user?.uid]);

  const firstName = me?.displayName?.split(' ')[0] || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="px-6 pt-5 pb-8 max-w-[1440px] mx-auto"
    >
      {/* ─── Hero Section ─────────────────────────────────────── */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-secondary)] to-[var(--accent)]/[0.04] p-6 sm:p-8">
          {/* Decorative accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--accent)]/[0.02] rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Date */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span className="text-[12px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  {dateStr}
                </span>
              </div>

              {/* Greeting */}
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-2">
                {t(getGreetingKey(), { name: firstName ? `, ${firstName}` : '' })}
              </h1>

              {/* Subtitle */}
              <p className="text-[14px] text-[var(--text-muted)] leading-relaxed max-w-lg">
                {isAdmin ? t('dashboard.adminSubtitle') : t('dashboard.personalSubtitle')}
              </p>

              {/* Contextual badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {isAdmin && activeTeamId === '__all__' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
                    <Shield className="h-3 w-3" />
                    {t('common.generalView')}
                  </span>
                )}
                {!loading && heroStats.pending > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                    {heroStats.pending} {lang === 'es' ? 'pendientes' : 'pending'}
                  </span>
                )}
                {!loading && heroStats.overdue > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 font-semibold animate-pulse">
                    {heroStats.overdue} {lang === 'es' ? 'vencidas' : 'overdue'}
                  </span>
                )}
              </div>
            </div>

            {/* Builder controls */}
            {dashboard && (
              <div className="shrink-0 flex items-center gap-2">
                {dashboardSharingEnabled && !editing && (
                  <button
                    onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                    title={t('dashboardShare.title')}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {t('dashboardShare.share')}
                  </button>
                )}
                <DashboardBuilder
                  dashboard={dashboard}
                  editing={editing}
                  isAdmin={isAdmin}
                  onEditingChange={setEditing}
                  onUpdate={handleUpdateWidgets}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Widget Grid ──────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
            <div className="relative w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-[13px] text-[var(--text-muted)]">
            {lang === 'es' ? 'Cargando tu espacio...' : 'Loading your workspace...'}
          </p>
        </div>
      ) : (
        <WidgetGrid
          widgets={widgets}
          sharedProps={sharedProps}
          editing={editing}
          isAdmin={isAdmin}
          onReorder={handleReorder}
          onRemove={handleRemoveWidget}
        />
      )}

      {/* Share modal */}
      {showShare && dashboard && (
        <DashboardShareModal
          dashboard={dashboard}
          onClose={() => setShowShare(false)}
          onUpdate={(updated) => setDashboard(updated)}
        />
      )}
    </motion.div>
  );
}
