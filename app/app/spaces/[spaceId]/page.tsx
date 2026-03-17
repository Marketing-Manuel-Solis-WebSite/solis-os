'use client';
import { useAuth, type Team, type Member } from '@/lib/auth';
import { getInheritanceConfig, setInheritanceConfig } from '@/lib/inheritance';
import type { InheritanceConfig, InheritanceMode } from '@/types';
import { useI18n } from '@/lib/i18n';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  getTasks, getGoals, getDocuments, getAuditLogs, getUserPreferences, saveUserPreferences,
  getFolders, getLists, createFolder, createList, ensureDefaultList,
  type FolderData, type ListData,
} from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Users, CheckSquare, Target, FileText, ArrowLeft,
  Loader2, ShieldAlert, ChevronRight, Clock, TrendingUp,
  BarChart3, Calendar, AlertTriangle, LayoutDashboard, Settings2, Settings,
  FolderOpen, List, Plus, FolderPlus, ListPlus, MessageSquare,
} from 'lucide-react';
import ContextualDashboard from '@/components/dashboard/contextual-dashboard';
import SpaceTasksPanel from '@/components/spaces/space-tasks-panel';
import SpaceChatEmbed from '@/components/chat/space-chat-embed';
import RequestAccessModal from '@/components/shared/request-access-modal';

// ─── Constants ───────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  todo: '#64748B', in_progress: '#3B82F6', in_review: '#A855F7',
  done: '#22C55E', completed: '#22C55E', blocked: '#EF4444',
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#64748B',
};
const GOAL_STATUS_COLORS: Record<string, string> = {
  on_track: '#22C55E', at_risk: '#F59E0B', behind: '#EF4444', completed: '#3B82F6',
};

type Tab = 'overview' | 'dashboard' | 'tasks' | 'docs' | 'goals' | 'chat' | 'settings';

export default function SpacePage() {
  const { user, me, teams, allMembers, canSeeAllTeams, setActiveTeamId, isManager } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();
  const { spaceId } = useParams<{ spaceId: string }>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [lists, setLists] = useState<ListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const lastFetchedId = useRef<string | null>(null);
  const tabLoaded = useRef(false);

  const [showRequestAccess, setShowRequestAccess] = useState(false);

  const team: Team | undefined = teams.find(t => t.id === spaceId);

  // SECURITY: Access check
  const hasAccess = useMemo(() => {
    if (canSeeAllTeams) return true;
    if (!me || !spaceId) return false;
    return me.teamId === spaceId || me.teamIds?.includes(spaceId);
  }, [canSeeAllTeams, me, spaceId]);

  const spaceMembers = useMemo(() => {
    return allMembers.filter(m => m.teamId === spaceId || m.teamIds?.includes(spaceId));
  }, [allMembers, spaceId]);

  // ─── Load space data ────────────────────────────────────
  const loadSpaceData = useCallback(async () => {
    if (!user || !spaceId || !hasAccess) return;
    setLoading(true);
    const [tasksRes, goalsRes, docsRes, logsRes, foldersRes, listsRes] = await Promise.all([
      getTasks(spaceId).catch(() => ({ items: [] })),
      getGoals(spaceId).catch(() => ({ items: [] })),
      getDocuments(spaceId).catch(() => ({ items: [] })),
      canSeeAllTeams ? getAuditLogs().catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
      getFolders(spaceId).catch(() => []),
      getLists(spaceId).catch(() => []),
    ]);
    setTasks(tasksRes.items);
    setGoals(goalsRes.items);
    setDocs(docsRes.items);
    setLogs(logsRes.items);
    setFolders(foldersRes as FolderData[]);
    setLists(listsRes as ListData[]);
    setLoading(false);
  }, [user, spaceId, hasAccess, canSeeAllTeams]);

  useEffect(() => {
    if (!user || !spaceId || !hasAccess) return;
    if (lastFetchedId.current === spaceId) return;
    lastFetchedId.current = spaceId;
    loadSpaceData();
  }, [user, spaceId, hasAccess, loadSpaceData]);

  // Force reload (for CRUD from tasks panel)
  const handleReload = useCallback(() => {
    lastFetchedId.current = null;
    loadSpaceData();
  }, [loadSpaceData]);

  // ─── Load tab preference ─────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !spaceId || tabLoaded.current) return;
    getUserPreferences(user.uid, `spaceTab_${spaceId}`).then((data: any) => {
      if (data?.activeTab) setActiveTab(data.activeTab);
      tabLoaded.current = true;
    }).catch(() => { tabLoaded.current = true; });
  }, [user?.uid, spaceId]);

  // Persist tab changes
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (user?.uid && tabLoaded.current) {
      saveUserPreferences(user.uid, `spaceTab_${spaceId}`, { activeTab: tab }).catch(() => {});
    }
  }, [user?.uid, spaceId]);

  // Reset refs when spaceId changes
  useEffect(() => {
    tabLoaded.current = false;
  }, [spaceId]);

  // ─── Stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const nonDeleted = tasks.filter(tk => !tk.deleted);
    const openTasks = nonDeleted.filter(tk => tk.status !== 'done' && tk.status !== 'completed');
    const overdue = openTasks.filter(tk => {
      if (!tk.dueDate) return false;
      const due = tk.dueDate?.toDate ? tk.dueDate.toDate() : new Date(tk.dueDate);
      return due < new Date();
    });
    const recentTasks = [...nonDeleted]
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 5);
    const completedCount = nonDeleted.filter(tk => tk.status === 'done' || tk.status === 'completed').length;
    const completionRate = nonDeleted.length > 0 ? Math.round((completedCount / nonDeleted.length) * 100) : 0;
    return { open: openTasks.length, overdue: overdue.length, recent: recentTasks, completionRate, total: nonDeleted.length };
  }, [tasks]);

  // ─── Tabs config ────────────────────────────────────────
  const TABS: { key: Tab; labelKey: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'overview', labelKey: 'spaces.tabOverview', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: 'dashboard', labelKey: 'spaces.tabDashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { key: 'tasks', labelKey: 'spaces.tabTasks', icon: <CheckSquare className="h-3.5 w-3.5" />, count: tasks.filter(t => !t.deleted).length },
    { key: 'docs', labelKey: 'spaces.tabDocs', icon: <FileText className="h-3.5 w-3.5" />, count: docs.length },
    { key: 'goals', labelKey: 'spaces.tabGoals', icon: <Target className="h-3.5 w-3.5" />, count: goals.length },
    { key: 'chat', labelKey: 'nav.chat', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    ...(isManager ? [{ key: 'settings' as Tab, labelKey: 'spaces.tabSettings', icon: <Settings className="h-3.5 w-3.5" /> }] : []),
  ];

  // Navigate to full module with space scope
  const goToModule = (path: string) => {
    setActiveTeamId(spaceId);
    router.push(path);
  };

  // Not found
  if (!team && !loading) {
    return (
      <div className="px-6 pt-5 pb-8 max-w-[1440px] mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Layers className="h-12 w-12 text-[var(--text-muted)] opacity-30" />
          <p className="text-[15px] font-medium text-[var(--text-muted)]">{t('spaces.spaceNotFound')}</p>
          <button onClick={() => router.push('/app/spaces')} className="text-[13px] text-[var(--accent)] hover:underline mt-2">
            {t('spaces.goBack')}
          </button>
        </div>
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="px-6 pt-5 pb-8 max-w-[1440px] mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-[15px] font-medium text-[var(--text-primary)]">{t('spaces.noAccess')}</p>
          <p className="text-[13px] text-[var(--text-muted)]">{t('spaces.noAccessDesc')}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setShowRequestAccess(true)}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-[13px] font-medium transition"
            >
              {lang === 'es' ? 'Solicitar acceso' : 'Request Access'}
            </button>
            <button onClick={() => router.push('/app/spaces')} className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline transition">
              {t('spaces.goBack')}
            </button>
          </div>
        </div>
        {showRequestAccess && (
          <RequestAccessModal
            resourceType="space"
            resourceId={spaceId}
            resourceName={team?.name || spaceId}
            onClose={() => setShowRequestAccess(false)}
          />
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="px-6 pt-5 pb-8 max-w-[1440px] mx-auto"
    >
      {/* ─── Hero ──────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-secondary)] to-[var(--accent)]/[0.04]">
          <div className="h-1.5 w-full" style={{ backgroundColor: team?.color || 'var(--accent)' }} />
          <div className="p-6 sm:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <button
                  onClick={() => router.push('/app/spaces')}
                  className="mt-1 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: `${team?.color || 'var(--accent)'}15` }}
                >
                  {team?.icon || '📁'}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight truncate">
                    {team?.name}
                  </h1>
                  {team?.description && (
                    <p className="text-[14px] text-[var(--text-muted)] leading-relaxed mt-1">{team.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold"
                      style={{ backgroundColor: `${team?.color || 'var(--accent)'}15`, color: team?.color || 'var(--accent)' }}
                    >
                      <Users className="h-3 w-3" />
                      {spaceMembers.length} {lang === 'es' ? 'miembros' : 'members'}
                    </span>
                    {!loading && stats.total > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
                        {stats.completionRate}% {lang === 'es' ? 'completado' : 'complete'}
                      </span>
                    )}
                    {!loading && stats.open > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                        {stats.open} {lang === 'es' ? 'abiertas' : 'open'}
                      </span>
                    )}
                    {!loading && stats.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 font-semibold animate-pulse">
                        {stats.overdue} {lang === 'es' ? 'vencidas' : 'overdue'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className={active ? 'text-[var(--accent)]' : ''}>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                    active ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content ─────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
            <div className="relative w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-[13px] text-[var(--text-muted)]">
            {lang === 'es' ? 'Cargando espacio...' : 'Loading workspace...'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <OverviewTab
                team={team}
                spaceId={spaceId}
                spaceMembers={spaceMembers}
                stats={stats}
                tasks={tasks}
                goals={goals}
                docs={docs}
                folders={folders}
                lists={lists}
                lang={lang}
                t={t}
                goToModule={goToModule}
                onTabChange={handleTabChange}
              />
            )}
            {activeTab === 'dashboard' && (
              <ContextualDashboard
                scopeType="space"
                scopeId={spaceId}
                tasks={tasks}
                goals={goals}
                members={spaceMembers}
              />
            )}
            {activeTab === 'tasks' && (
              <SpaceTasksPanel
                spaceId={spaceId}
                tasks={tasks.filter(tk => !tk.deleted) as any}
                members={spaceMembers}
                teams={teams}
                onReload={handleReload}
              />
            )}
            {activeTab === 'docs' && (
              <DocsTab docs={docs} lang={lang} t={t} goToModule={goToModule} />
            )}
            {activeTab === 'goals' && (
              <GoalsTab goals={goals} lang={lang} t={t} teamColor={team?.color} goToModule={goToModule} />
            )}
            {activeTab === 'chat' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[var(--accent)]" />
                    {lang === 'es' ? 'Chat del Espacio' : 'Space Chat'}
                  </h3>
                  <button onClick={() => goToModule('/app/chat')} className="text-[12px] text-[var(--accent)] hover:underline">
                    {lang === 'es' ? 'Abrir Chat completo →' : 'Open full Chat →'}
                  </button>
                </div>
                <SpaceChatEmbed spaceId={spaceId} spaceName={team?.name || spaceId} />
              </div>
            )}
            {activeTab === 'settings' && isManager && (
              <SettingsTab spaceId={spaceId} t={t} lang={lang} />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ team, spaceId, spaceMembers, stats, tasks, goals, docs, folders, lists, lang, t, goToModule, onTabChange }: {
  team?: Team; spaceId: string; spaceMembers: Member[];
  stats: { open: number; overdue: number; recent: any[]; completionRate: number; total: number };
  tasks: any[]; goals: any[]; docs: any[];
  folders: FolderData[]; lists: ListData[];
  lang: string; t: (k: string) => string;
  goToModule: (path: string) => void;
  onTabChange: (tab: Tab) => void;
}) {
  const nonDeleted = tasks.filter(tk => !tk.deleted);
  const completedCount = nonDeleted.filter(tk => tk.status === 'done' || tk.status === 'completed').length;
  const inProgressCount = nonDeleted.filter(tk => tk.status === 'in_progress').length;
  const activeGoals = goals.filter(g => g.status !== 'completed');
  const avgGoalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / activeGoals.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickStatCard
          label={lang === 'es' ? 'Total tareas' : 'Total tasks'}
          value={stats.total}
          color="var(--accent)"
          icon={<CheckSquare className="h-4 w-4" />}
        />
        <QuickStatCard
          label={lang === 'es' ? 'En progreso' : 'In progress'}
          value={inProgressCount}
          color="#3B82F6"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <QuickStatCard
          label={lang === 'es' ? 'Completadas' : 'Completed'}
          value={completedCount}
          subtitle={stats.total > 0 ? `${stats.completionRate}%` : undefined}
          color="#22C55E"
          icon={<CheckSquare className="h-4 w-4" />}
        />
        <QuickStatCard
          label={lang === 'es' ? 'Vencidas' : 'Overdue'}
          value={stats.overdue}
          color={stats.overdue > 0 ? '#EF4444' : '#64748B'}
          icon={<AlertTriangle className="h-4 w-4" />}
          pulse={stats.overdue > 0}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--accent)] opacity-80" />
              {t('spaces.members')}
            </h2>
            <span className="text-[12px] text-[var(--text-muted)] font-medium tabular-nums">{spaceMembers.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {spaceMembers.slice(0, 12).map(m => (
              <div
                key={m.userId}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)]/60 hover:bg-[var(--bg-hover)] transition-colors"
                title={m.email}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: team?.color || 'var(--accent)' }}
                >
                  {(m.displayName || 'U')[0].toUpperCase()}
                </div>
                <span className="text-[12px] text-[var(--text-secondary)] font-medium truncate max-w-[100px]">
                  {m.displayName || m.email}
                </span>
              </div>
            ))}
            {spaceMembers.length > 12 && (
              <span className="text-[12px] text-[var(--text-muted)] px-2">+{spaceMembers.length - 12} {lang === 'es' ? 'más' : 'more'}</span>
            )}
          </div>
        </div>

        {/* Goals summary */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--accent)] opacity-80" />
              {t('spaces.tabGoals')}
            </h2>
            <button onClick={() => onTabChange('goals')} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1">
              {t('spaces.viewAll')} <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {goals.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)]">{t('spaces.noGoals')}</p>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 4).map(goal => {
                const progress = goal.progress || 0;
                const color = GOAL_STATUS_COLORS[goal.status] || '#3B82F6';
                return (
                  <div key={goal.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[var(--text-primary)] font-medium truncate">{goal.name || goal.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color }}>{progress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeGoals.length > 0 && (
                <div className="pt-2 border-t border-[var(--border-subtle)]/40">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'es' ? 'Progreso promedio' : 'Avg progress'}: <strong className="text-[var(--text-primary)]">{avgGoalProgress}%</strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks */}
      {stats.recent.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--bg-tertiary)]/30">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--accent)] opacity-80" />
              {t('spaces.recentTasks')}
            </h2>
            <button onClick={() => onTabChange('tasks')} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1">
              {t('spaces.viewTasks')} <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)]/60 to-transparent" />
          <div className="divide-y divide-[var(--border-subtle)]/40">
            {stats.recent.map(task => (
              <div key={task.id} className="px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <StatusDot status={task.status} />
                  <span className="text-[13px] text-[var(--text-primary)] font-medium truncate flex-1">{task.title}</span>
                  {task.priority && <PriorityBadge priority={task.priority} lang={lang} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hierarchy: Folders & Lists */}
      {(folders.length > 0 || lists.length > 0) && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--bg-tertiary)]/30">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--accent)] opacity-80" />
              {lang === 'es' ? 'Estructura' : 'Structure'}
            </h2>
            <span className="text-[11px] text-[var(--text-muted)]">
              {folders.length} {lang === 'es' ? 'carpetas' : 'folders'} · {lists.length} {lang === 'es' ? 'listas' : 'lists'}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)]/60 to-transparent" />
          <StructureView folders={folders} lists={lists} tasks={tasks} spaceId={spaceId} teamColor={team?.color} lang={lang} />
        </div>
      )}

      {/* Quick navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickNavCard
          icon={<LayoutDashboard className="h-5 w-5" />}
          label={lang === 'es' ? 'Dashboard del Space' : 'Space Dashboard'}
          description={lang === 'es' ? 'Métricas y widgets configurables' : 'Configurable metrics & widgets'}
          onClick={() => onTabChange('dashboard')}
          color={team?.color}
        />
        <QuickNavCard
          icon={<CheckSquare className="h-5 w-5" />}
          label={lang === 'es' ? 'Tareas del Space' : 'Space Tasks'}
          description={lang === 'es' ? 'Vista operativa completa' : 'Full operational view'}
          onClick={() => onTabChange('tasks')}
          color={team?.color}
        />
        <QuickNavCard
          icon={<FileText className="h-5 w-5" />}
          label={lang === 'es' ? 'Documentos' : 'Documents'}
          description={`${docs.length} ${lang === 'es' ? 'documentos' : 'documents'}`}
          onClick={() => onTabChange('docs')}
          color={team?.color}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOCS TAB
// ═══════════════════════════════════════════════════════════════
function DocsTab({ docs, lang, t, goToModule }: {
  docs: any[]; lang: string; t: (k: string) => string;
  goToModule: (path: string) => void;
}) {
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  const sorted = useMemo(() => [...docs].sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)), [docs]);

  if (docs.length === 0) {
    return <EmptyState icon={<FileText className="h-8 w-8" />} message={t('spaces.noDocs')} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] text-[var(--text-muted)]">{docs.length} {lang === 'es' ? 'documentos' : 'documents'}</span>
        <button onClick={() => goToModule('/app/docs')} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1">
          {lang === 'es' ? 'Abrir vista completa' : 'Open full view'} <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.slice(0, 30).map(doc => {
          const updated = doc.updatedAt?.seconds ? new Date(doc.updatedAt.seconds * 1000) : null;
          return (
            <div key={doc.id} className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 hover:border-[var(--accent)]/30 hover:shadow-sm transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                    {doc.title || (lang === 'es' ? 'Sin título' : 'Untitled')}
                  </h3>
                  {updated && (
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      {t('spaces.lastUpdated')}: {updated.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GOALS TAB
// ═══════════════════════════════════════════════════════════════
function GoalsTab({ goals, lang, t, teamColor, goToModule }: {
  goals: any[]; lang: string; t: (k: string) => string;
  teamColor?: string; goToModule: (path: string) => void;
}) {
  const statusLabelsEs: Record<string, string> = { on_track: 'En camino', at_risk: 'En riesgo', behind: 'Atrasada', completed: 'Completada' };
  const statusLabelsEn: Record<string, string> = { on_track: 'On track', at_risk: 'At risk', behind: 'Behind', completed: 'Completed' };
  const statusLabels = lang === 'es' ? statusLabelsEs : statusLabelsEn;
  const sorted = useMemo(() => [...goals].sort((a, b) => (b.progress || 0) - (a.progress || 0)), [goals]);

  if (goals.length === 0) {
    return <EmptyState icon={<Target className="h-8 w-8" />} message={t('spaces.noGoals')} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] text-[var(--text-muted)]">{goals.length} {lang === 'es' ? 'metas' : 'goals'}</span>
        <button onClick={() => goToModule('/app/goals')} className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1">
          {lang === 'es' ? 'Abrir vista completa' : 'Open full view'} <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-3">
        {sorted.map(goal => {
          const progress = goal.progress || 0;
          const color = GOAL_STATUS_COLORS[goal.status] || '#3B82F6';
          return (
            <div key={goal.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 hover:border-[var(--accent)]/20 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] text-[var(--text-primary)] font-semibold truncate flex-1 mr-3">{goal.name || goal.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ backgroundColor: `${color}15`, color }}>
                  {statusLabels[goal.status] || goal.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
                </div>
                <span className="text-[12px] font-bold shrink-0 w-9 text-right tabular-nums" style={{ color }}>{progress}%</span>
              </div>
              {goal.description && (
                <p className="text-[12px] text-[var(--text-muted)] mt-2 truncate">{goal.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB (Inheritance)
// ═══════════════════════════════════════════════════════════════
function SettingsTab({ spaceId, t, lang }: {
  spaceId: string; t: (k: string) => string; lang: string;
}) {
  const [config, setConfig] = useState<InheritanceConfig>({
    statusMode: 'inherit', customFieldMode: 'inherit', automationMode: 'inherit',
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    getInheritanceConfig(spaceId).then(cfg => {
      if (!cancelled) { setConfig(cfg); setLoadingConfig(false); }
    }).catch(() => { if (!cancelled) setLoadingConfig(false); });
    return () => { cancelled = true; };
  }, [spaceId]);

  const updateMode = useCallback((field: keyof InheritanceConfig, value: InheritanceMode) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setInheritanceConfig(spaceId, config);
      setDirty(false);
    } catch (err) {
      console.error('[Settings] Failed to save inheritance config:', err);
    } finally {
      setSaving(false);
    }
  }, [spaceId, config]);

  const MODES: { key: InheritanceMode; labelKey: string; descKey: string }[] = [
    { key: 'inherit', labelKey: 'inheritance.inherit', descKey: 'inheritance.inheritDesc' },
    { key: 'extend', labelKey: 'inheritance.extend', descKey: 'inheritance.extendDesc' },
    { key: 'override', labelKey: 'inheritance.override', descKey: 'inheritance.overrideDesc' },
  ];

  const SECTIONS: { field: keyof InheritanceConfig; labelKey: string }[] = [
    { field: 'statusMode', labelKey: 'inheritance.statusMode' },
    { field: 'customFieldMode', labelKey: 'inheritance.customFieldMode' },
    { field: 'automationMode', labelKey: 'inheritance.automationMode' },
  ];

  if (loadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        <p className="text-[13px] text-[var(--text-muted)]">
          {lang === 'es' ? 'Cargando ajustes...' : 'Loading settings...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--accent)] opacity-80" />
            {t('inheritance.settings')}
          </h2>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all duration-200 ${
              dirty
                ? 'bg-[var(--accent)] text-white hover:opacity-90'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            {saving
              ? (lang === 'es' ? 'Guardando...' : 'Saving...')
              : (lang === 'es' ? 'Guardar' : 'Save')}
          </button>
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">
          {lang === 'es'
            ? 'Configura cómo las listas de este espacio heredan estados, campos y automatizaciones.'
            : 'Configure how lists in this space inherit statuses, fields, and automations.'}
        </p>
      </div>

      {/* Inheritance sections */}
      {SECTIONS.map(section => (
        <div key={section.field} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-4">{t(section.labelKey)}</h3>
          <div className="space-y-2">
            {MODES.map(mode => {
              const selected = config[section.field] === mode.key;
              return (
                <button
                  key={mode.key}
                  onClick={() => updateMode(section.field, mode.key)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${
                    selected
                      ? 'border-[var(--accent)]/40 bg-[var(--accent)]/[0.06]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/40 hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-[var(--accent)]' : 'border-[var(--text-muted)]/40'
                  }`}>
                    {selected && (
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-medium ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {t(mode.labelKey)}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {t(mode.descKey)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] opacity-40">
        {icon}
      </div>
      <p className="text-[13px] text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] || '#64748B' }} />;
}

function PriorityBadge({ priority, lang }: { priority: string; lang: string }) {
  const labelsEs: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };
  const labelsEn: Record<string, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
  const labels = lang === 'es' ? labelsEs : labelsEn;
  const color = PRIORITY_COLORS[priority] || '#64748B';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ backgroundColor: `${color}15`, color }}>
      {labels[priority] || priority}
    </span>
  );
}

function QuickStatCard({ label, value, subtitle, color, icon, pulse }: {
  label: string; value: number; subtitle?: string; color: string; icon: React.ReactNode; pulse?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
        {subtitle && <span className="text-[11px] text-[var(--text-muted)] font-semibold">{subtitle}</span>}
      </div>
    </div>
  );
}

// Pre-aggregated task counts to avoid O(n²) in-render filtering
function StructureView({ folders, lists, tasks, spaceId, teamColor, lang }: {
  folders: FolderData[]; lists: ListData[]; tasks: any[]; spaceId: string; teamColor?: string; lang: string;
}) {
  const countByList = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tk of tasks) {
      if (tk.deleted) continue;
      const lid = tk.listId || '__none__';
      map[lid] = (map[lid] || 0) + 1;
    }
    return map;
  }, [tasks]);

  return (
    <div className="p-4 space-y-2">
      {folders.map(folder => {
        const folderLists = lists.filter(l => l.folderId === folder.id);
        const taskCount = folderLists.reduce((sum, l) => sum + (countByList[l.id!] || 0), 0);
        return (
          <div key={folder.id} className="rounded-xl bg-[var(--bg-tertiary)]/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="h-4 w-4" style={{ color: folder.color || teamColor || 'var(--text-muted)' }} />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">{folder.name}</span>
              <span className="text-[10px] text-[var(--text-muted)] ml-auto">{folderLists.length} {lang === 'es' ? 'listas' : 'lists'} · {taskCount} {lang === 'es' ? 'tareas' : 'tasks'}</span>
            </div>
            {folderLists.length > 0 && (
              <div className="pl-4 space-y-1">
                {folderLists.map(list => (
                  <a
                    key={list.id}
                    href={`/app/spaces/${spaceId}/list/${list.id}`}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)] transition text-[12px] text-[var(--text-secondary)]"
                  >
                    <List className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span className="truncate">{list.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto tabular-nums">{countByList[list.id!] || 0}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {lists.filter(l => !l.folderId).map(list => (
        <a
          key={list.id}
          href={`/app/spaces/${spaceId}/list/${list.id}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] transition text-[13px] text-[var(--text-secondary)]"
        >
          <List className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="truncate">{list.name}</span>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto tabular-nums">{countByList[list.id!] || 0}</span>
        </a>
      ))}
    </div>
  );
}

function QuickNavCard({ icon, label, description, onClick, color }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 hover:border-[var(--accent)]/30 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: `${color || 'var(--accent)'}15`, color: color || 'var(--accent)' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{label}</div>
          <div className="text-[11px] text-[var(--text-muted)]">{description}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
      </div>
    </button>
  );
}
