'use client';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/notifications/toast-provider';
import StatsDashboard from '@/components/analytics/stats-dashboard';
import AIAnalysisPanel from '@/components/analytics/ai-analysis-panel';
import ExportModal from '@/components/analytics/export-modal';
import DashboardShareModal from '@/components/dashboard/dashboard-share-modal';
import ScheduledReportModal from '@/components/analytics/scheduled-report-modal';
import { useFeatureFlag } from '@/lib/feature-flags';
import {
  BarChart3, Brain, RefreshCw, Download, Share2, CalendarClock,
  Users, FileText, CheckSquare, MessageSquare, Activity, Zap, AlertTriangle
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { AnalyticsSnapshot } from '@/lib/analytics-snapshot';
import type { DashboardConfig } from '@/lib/dashboard-types';
import { ensureDefaultDashboard } from '@/lib/dashboard-db';

export type { AnalyticsSnapshot };

export default function AnalyticsPage() {
  const { user, me } = useAuth();
  const toast = useToast();
  const { t, lang } = useI18n();
  const exportEnabled = useFeatureFlag('analytics-export');
  const dashboardSharingEnabled = useFeatureFlag('dashboard-sharing');
  const scheduledReportsEnabled = useFeatureFlag('scheduled-reports');
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'ai'>('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showScheduleReport, setShowScheduleReport] = useState(false);
  const [shareDashboard, setShareDashboard] = useState<DashboardConfig | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/analytics/snapshot', {
        headers: idToken ? { 'Authorization': `Bearer ${idToken}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
    } catch (err) {
      toast.error(t('analytics.loadError'), t('analytics.loadErrorMsg'));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  const refresh = async () => {
    setRefreshing(true);
    await loadSnapshot();
    setRefreshing(false);
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
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
                {data ? t('analytics.lastUpdated', { time: new Date(data.computedAt).toLocaleTimeString() }) : t('analytics.loadingData')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scheduledReportsEnabled && (
                <button onClick={() => setShowScheduleReport(true)}
                  className="flex items-center gap-2 px-4 h-9 rounded-md bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all duration-200">
                  <CalendarClock className="h-3.5 w-3.5" /> {lang === 'es' ? 'Programar' : 'Schedule'}
                </button>
              )}
              {dashboardSharingEnabled && (
                <button onClick={async () => {
                  if (!user) return;
                  try {
                    const isAdmin = me?.role === 'admin' || me?.role === 'director';
                    const dash = await ensureDefaultDashboard(user.uid, isAdmin);
                    setShareDashboard(dash);
                    setShowShare(true);
                  } catch {
                    toast.error(lang === 'es' ? 'Error al cargar dashboard' : 'Failed to load dashboard');
                  }
                }}
                  className="flex items-center gap-2 px-4 h-9 rounded-md bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all duration-200">
                  <Share2 className="h-3.5 w-3.5" /> {lang === 'es' ? 'Compartir' : 'Share'}
                </button>
              )}
              {exportEnabled && (
                <button onClick={() => setShowExport(true)}
                  className="flex items-center gap-2 px-4 h-9 rounded-md bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all duration-200">
                  <Download className="h-3.5 w-3.5" /> {lang === 'es' ? 'Exportar' : 'Export'}
                </button>
              )}
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

          {/* Quick stats bar — from server-computed snapshot */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 anim-slide" style={{ animationDelay: '40ms' }}>
              {[
                { label: t('analytics.tasks'), value: data.totalTasks, sub: t('analytics.tasksDone', { n: data.completedTasks }), icon: CheckSquare, color: '#22C55E' },
                { label: t('analytics.documents'), value: data.totalDocs, sub: t('analytics.total'), icon: FileText, color: '#3B82F6' },
                { label: t('analytics.members'), value: data.activeMembers, sub: t('analytics.ofTotal', { n: data.totalMembers }), icon: Users, color: 'var(--accent)' },
                { label: t('analytics.channels'), value: data.totalChannels, sub: t('analytics.active'), icon: MessageSquare, color: '#8B5CF6' },
                { label: t('analytics.activity'), value: data.actionsLast30d, sub: t('analytics.events'), icon: Activity, color: '#F59E0B' },
                { label: t('analytics.aiChats'), value: data.aiConversationsTotal, sub: t('analytics.conversations'), icon: Zap, color: '#EC4899' },
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

          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-48 skeleton rounded-lg" />)}</div>
          ) : !data ? (
            <div className="text-center py-20"><BarChart3 className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" /><p className="text-[var(--text-muted)]">{t('analytics.noData')}</p></div>
          ) : (
            <>
              {view === 'dashboard' && <StatsDashboard data={data} />}
              {view === 'ai' && <AIAnalysisPanel data={data} userId={user?.uid || ''} userName={me?.displayName || ''} userRole={me?.role || 'member'} />}
            </>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {exportEnabled && <ExportModal open={showExport} onClose={() => setShowExport(false)} />}

      {/* Dashboard Share Modal */}
      {dashboardSharingEnabled && showShare && shareDashboard && (
        <DashboardShareModal
          dashboard={shareDashboard}
          onClose={() => setShowShare(false)}
          onUpdate={(updated) => setShareDashboard(updated)}
        />
      )}

      {/* Scheduled Report Modal */}
      {scheduledReportsEnabled && (
        <ScheduledReportModal open={showScheduleReport} onClose={() => setShowScheduleReport(false)} />
      )}
    </div>
  );
}
