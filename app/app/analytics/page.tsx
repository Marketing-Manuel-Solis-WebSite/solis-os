'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getTasks, getDocuments, getMembers, getAuditLogs, getTeams, getChannels } from '@/lib/db';
import { getAIConversations } from '@/lib/ai-db';
import { useToast } from '@/components/notifications/toast-provider';
import StatsDashboard from '@/components/analytics/stats-dashboard';
import AIAnalysisPanel from '@/components/analytics/ai-analysis-panel';
import {
  BarChart3, TrendingUp, Brain, ChevronRight, Sparkles, RefreshCw,
  Users, FileText, CheckSquare, MessageSquare, Activity, Zap, AlertTriangle
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export interface PlatformData {
  tasks: any[];
  docs: any[];
  members: any[];
  teams: any[];
  channels: any[];
  auditLogs: any[];
  aiConversations: any[];
  loadedAt: Date;
}

export default function AnalyticsPage() {
  const { user, me, isAdmin, teams, can, canSeeAllTeams } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'ai'>('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [truncatedCollections, setTruncatedCollections] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    try {
      const [tasksRes, docsRes, members, teamsList, channelsRes, auditLogsRes, aiConvos] = await Promise.all([
        getTasks('__all__').catch(() => ({ items: [], hasMore: false })),
        getDocuments('__all__').catch(() => ({ items: [], hasMore: false })),
        getMembers().catch(() => []),
        getTeams().catch(() => []),
        getChannels('__all__').catch(() => ({ items: [], hasMore: false })),
        getAuditLogs().catch(() => ({ items: [], hasMore: false })),
        getAIConversations(user.uid).catch(() => []),
      ]);
      const truncated: string[] = [];
      if (tasksRes.hasMore) truncated.push(t('analytics.tasks'));
      if (docsRes.hasMore) truncated.push(t('analytics.documents'));
      if (channelsRes.hasMore) truncated.push(t('analytics.channels'));
      if (auditLogsRes.hasMore) truncated.push(t('analytics.activity'));
      setTruncatedCollections(truncated);
      setData({
        tasks: tasksRes.items as any[],
        docs: docsRes.items as any[],
        members: members as any[],
        teams: teamsList as any[],
        channels: channelsRes.items as any[],
        auditLogs: auditLogsRes.items as any[],
        aiConversations: aiConvos as any[],
        loadedAt: new Date(),
      });
    } catch (err) {
      toast.error(t('analytics.loadError'), t('analytics.loadErrorMsg'));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Quick stats
  const stats = data ? {
    totalTasks: data.tasks.length,
    completedTasks: data.tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length,
    overdueTasks: data.tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'completed').length,
    totalDocs: data.docs.length,
    totalMembers: data.members.length,
    activeMembers: data.members.filter((m: any) => m.active !== false).length,
    totalChannels: data.channels.length,
    totalMessages: data.auditLogs.length,
    aiConversations: data.aiConversations.length,
    departments: data.teams.length,
  } : null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 anim-slide">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                {t('analytics.title')}
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent)] font-semibold">{t('analytics.aiPowered')}</span>
              </h1>
              <p className="text-base text-[var(--text-muted)] mt-1">
                {data ? t('analytics.lastUpdated', { time: data.loadedAt.toLocaleTimeString() }) : t('analytics.loadingData')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refresh} disabled={refreshing}
                className="flex items-center gap-2 px-4 h-9 rounded-md bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-all duration-200">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {t('common.refresh')}
              </button>
              <div className="flex rounded-md bg-[var(--bg-tertiary)] overflow-hidden">
                <button onClick={() => setView('dashboard')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${view === 'dashboard' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                  <BarChart3 className="h-3.5 w-3.5" /> {t('analytics.dashboard')}
                </button>
                <button onClick={() => setView('ai')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${view === 'ai' ? 'bg-purple-500/10 text-purple-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                  <Brain className="h-3.5 w-3.5" /> {t('analytics.aiAnalysis')}
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 anim-slide" style={{ animationDelay: '40ms' }}>
              {[
                { label: t('analytics.tasks'), value: stats.totalTasks, sub: t('analytics.tasksDone', { n: stats.completedTasks }), icon: CheckSquare, color: '#22C55E' },
                { label: t('analytics.documents'), value: stats.totalDocs, sub: t('analytics.total'), icon: FileText, color: '#3B82F6' },
                { label: t('analytics.members'), value: stats.activeMembers, sub: t('analytics.ofTotal', { n: stats.totalMembers }), icon: Users, color: 'var(--accent)' },
                { label: t('analytics.channels'), value: stats.totalChannels, sub: t('analytics.active'), icon: MessageSquare, color: '#8B5CF6' },
                { label: t('analytics.activity'), value: stats.totalMessages, sub: t('analytics.events'), icon: Activity, color: '#F59E0B' },
                { label: t('analytics.aiChats'), value: stats.aiConversations, sub: t('analytics.conversations'), icon: Zap, color: '#EC4899' },
              ].map((s, i) => (
                <div key={s.label} className="p-4 rounded-xl bg-[var(--bg-secondary)] shadow-card anim-slide" style={{ animationDelay: `${(i + 2) * 40}ms` }}>
                  <div className="flex items-center justify-between mb-2">
                    <s.icon className="h-4 w-4" style={{ color: s.color }} />
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${s.color}10`, color: s.color }}>{s.sub}</span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Truncation warning */}
          {truncatedCollections.length > 0 && !loading && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-[13px] text-amber-300">
                {t('analytics.dataTruncated', { collections: truncatedCollections.join(', ') })}
              </span>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-48 skeleton rounded-lg" />)}</div>
          ) : !data ? (
            <div className="text-center py-20"><BarChart3 className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" /><p className="text-[var(--text-muted)]">{t('analytics.noData')}</p></div>
          ) : (
            <>
              {view === 'dashboard' && <StatsDashboard data={data} />}
              {view === 'ai' && <AIAnalysisPanel data={data} userId={user?.uid || ''} userName={me?.displayName || ''} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}