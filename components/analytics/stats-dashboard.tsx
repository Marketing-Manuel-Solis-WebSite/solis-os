'use client';
import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useFeatureFlag } from '@/lib/feature-flags';
import { auth } from '@/lib/firebase';
import type { AnalyticsSnapshot } from '@/app/app/analytics/page';
import {
  CheckSquare, FileText, Users, TrendingUp,
  Clock, AlertTriangle,
  BarChart3, PieChart, Activity, Zap, ArrowUp, ArrowDown, Minus, Loader2
} from 'lucide-react';

interface Props {
  data: AnalyticsSnapshot;
}

export default function StatsDashboard({ data }: Props) {
  const { t, lang } = useI18n();
  const velocityEnabled = useFeatureFlag('analytics-velocity');
  const slaEnabled = useFeatureFlag('analytics-sla');
  const [section, setSection] = useState<'overview' | 'tasks' | 'velocity' | 'sla' | 'docs' | 'team' | 'activity'>('overview');

  // All metrics are pre-computed server-side — no useMemo needed
  const {
    totalTasks, completedTasks, completionRate, overdueTasks,
    tasksByStatus, tasksByPriority,
    totalDocs, totalWords, docsByVisibility, topDocuments,
    totalMembers, activeMembers, membersByRole,
    activityByDay, activityByAction, recentLogs,
    departments, deptMetrics,
  } = data;

  const NAV = [
    { id: 'overview' as const, label: t('statsDash.overview'), icon: BarChart3 },
    { id: 'tasks' as const, label: t('statsDash.tasks'), icon: CheckSquare },
    ...(velocityEnabled ? [{ id: 'velocity' as const, label: lang === 'es' ? 'Velocidad' : 'Velocity', icon: Zap }] : []),
    ...(slaEnabled ? [{ id: 'sla' as const, label: 'SLA', icon: Clock }] : []),
    { id: 'docs' as const, label: t('statsDash.documents'), icon: FileText },
    { id: 'team' as const, label: t('statsDash.team'), icon: Users },
    { id: 'activity' as const, label: t('statsDash.activity'), icon: Activity },
  ];

  return (
    <div>
      {/* Section tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-[var(--bg-base)] shadow-card w-fit anim-slide" style={{ animationDelay: '80ms' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setSection(n.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${section === n.id ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            <n.icon className="h-3.5 w-3.5" /> {n.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {section === 'overview' && (
        <div className="space-y-6">
          {/* Department Performance */}
          <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '120ms' }}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[var(--accent)]" /> {t('statsDash.deptPerformance')}</h3>
            <div className="space-y-4">
              {departments.map(dept => {
                const dm = deptMetrics[dept.id] || { tasks: 0, completed: 0, rate: 0, docs: 0, members: 0, words: 0 };
                return (
                  <div key={dept.id} className="flex items-center gap-4">
                    <div className="w-28 flex items-center gap-2 shrink-0">
                      <span className="text-sm">{dept.icon}</span>
                      <span className="text-sm font-medium truncate" style={{ color: dept.color }}>{dept.name}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dm.rate}%`, backgroundColor: dept.color, opacity: 0.7 }} />
                        </div>
                        <span className="text-sm font-bold w-10 text-right" style={{ color: dept.color }}>{dm.rate}%</span>
                      </div>
                      <div className="flex gap-4 text-[12px] text-[var(--text-muted)]">
                        <span>{t('statsDash.nTasks', { n: dm.tasks })}</span>
                        <span>{t('statsDash.nDone', { n: dm.completed })}</span>
                        <span>{t('statsDash.nDocs', { n: dm.docs })}</span>
                        <span>{t('statsDash.nPeople', { n: dm.members })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Completion Rate Ring */}
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '160ms' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('statsDash.taskCompletion')}</h3>
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--accent)" strokeWidth="8"
                      strokeDasharray={`${completionRate * 2.51} ${251 - completionRate * 2.51}`}
                      strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{completionRate}%</p>
                      <p className="text-[9px] text-[var(--text-muted)]">{t('statsDash.complete')}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[var(--text-secondary)]">{t('statsDash.completed', { n: completedTasks })}</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-[var(--text-secondary)]">{t('statsDash.inProgress', { n: totalTasks - completedTasks - overdueTasks })}</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-[var(--text-secondary)]">{t('statsDash.overdue', { n: overdueTasks })}</span></div>
                </div>
              </div>
            </div>

            {/* Activity chart */}
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '200ms' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('statsDash.weeklyActivity')}</h3>
              <div className="flex items-end gap-2 h-32">
                {Object.entries(activityByDay).map(([day, count]) => {
                  const max = Math.max(...Object.values(activityByDay), 1);
                  const height = (count / max) * 100;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-[var(--text-muted)]">{count}</span>
                      <div className="w-full rounded-t-lg transition-all duration-700 bg-[var(--accent)]" style={{ height: `${Math.max(height, 4)}%`, opacity: 0.6 }} />
                      <span className="text-[9px] text-[var(--text-muted)]">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content metrics */}
          <div className="grid grid-cols-3 gap-4 anim-slide" style={{ animationDelay: '240ms' }}>
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
              <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('statsDash.totalWordsWritten')}</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{totalWords.toLocaleString()}</p>
              <p className="text-[12px] text-[var(--text-muted)] mt-1">{t('statsDash.acrossDocs', { n: totalDocs })}</p>
            </div>
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
              <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('statsDash.avgWordsDoc')}</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{totalDocs > 0 ? Math.round(totalWords / totalDocs).toLocaleString() : 0}</p>
              <p className="text-[12px] text-[var(--text-muted)] mt-1">{t('statsDash.perDocAvg')}</p>
            </div>
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
              <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">{t('statsDash.tasksMember')}</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{totalMembers > 0 ? (totalTasks / totalMembers).toFixed(1) : 0}</p>
              <p className="text-[12px] text-[var(--text-muted)] mt-1">{t('statsDash.avgWorkload')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== TASKS ===== */}
      {section === 'tasks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* By Status */}
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('statsDash.tasksByStatus')}</h3>
              <div className="space-y-3">
                {Object.entries(tasksByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                  const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                  const colors: Record<string, string> = { done: '#22C55E', completed: '#22C55E', 'in-progress': '#3B82F6', 'in_progress': '#3B82F6', todo: '#6B7280', review: '#F59E0B', blocked: '#EF4444' };
                  const color = colors[status] || '#6B7280';
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-24 capitalize truncate">{status.replace(/[-_]/g, ' ')}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Priority */}
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('statsDash.tasksByPriority')}</h3>
              <div className="space-y-3">
                {['urgent', 'high', 'medium', 'low'].map(p => {
                  const count = tasksByPriority[p] || 0;
                  const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                  const colors: Record<string, string> = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#6B7280' };
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-24 capitalize">{p}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[p] }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* By Department */}
          <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '80ms' }}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t('statsDash.tasksByDept')}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {departments.map(dept => {
                const dm = deptMetrics[dept.id];
                if (!dm) return null;
                return (
                  <div key={dept.id} className="p-4 rounded-xl bg-[var(--bg-base)]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{dept.icon || ''}</span>
                      <span className="text-sm font-medium" style={{ color: dept.color }}>{dept.name}</span>
                    </div>
                    <p className="text-xl font-bold text-[var(--text-primary)]">{dm.tasks}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">{t('statsDash.tasksAssigned')}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== VELOCITY ===== */}
      {section === 'velocity' && velocityEnabled && <VelocitySection lang={lang} />}

      {/* ===== SLA ===== */}
      {section === 'sla' && slaEnabled && <SLASection lang={lang} />}

      {/* ===== DOCS ===== */}
      {section === 'docs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Documents by Department</h3>
              <div className="space-y-3">
                {departments.map(dept => {
                  const count = deptMetrics[dept.id]?.docs || 0;
                  if (!count) return null;
                  const pct = totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0;
                  return (
                    <div key={dept.id} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-24 truncate">{dept.icon || ''} {dept.name}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: dept.color }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Visibility Distribution</h3>
              <div className="space-y-3">
                {Object.entries(docsByVisibility).map(([vis, count]) => {
                  const colors: Record<string, string> = { public: '#22C55E', team: '#3B82F6', private: '#EF4444' };
                  const pct = totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0;
                  return (
                    <div key={vis} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-24 capitalize">{vis}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[vis] || '#6B7280' }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top documents */}
          <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '80ms' }}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Top Documents by Word Count</h3>
            <div className="space-y-2">
              {topDocuments.map((d, i) => {
                const dept = departments.find(dept => deptMetrics[dept.id]?.docs > 0 && dept.name === d.teamName);
                return (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.01]">
                    <span className="text-[12px] text-[var(--text-muted)] w-5">{i + 1}.</span>
                    <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span className="text-sm text-[var(--text-secondary)] flex-1 truncate">{d.title}</span>
                    {dept && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${dept.color}10`, color: dept.color }}>{dept.icon} {dept.name}</span>}
                    <span className="text-sm text-[var(--text-muted)] font-mono">{d.wordCount.toLocaleString()}w</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== TEAM ===== */}
      {section === 'team' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Members by Department</h3>
              <div className="space-y-3">
                {departments.map(dept => {
                  const count = deptMetrics[dept.id]?.members || 0;
                  if (!count) return null;
                  const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
                  return (
                    <div key={dept.id} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-24 truncate">{dept.icon || ''} {dept.name}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: dept.color }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Members by Role</h3>
              <div className="space-y-3">
                {Object.entries(membersByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                  const colors: Record<string, string> = { owner: '#3B82F6', admin: '#A855F7', manager: '#3B82F6', member: '#6B7280', guest: '#475569' };
                  const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
                  return (
                    <div key={role} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-24 capitalize">{role}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[role] || '#6B7280' }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ACTIVITY ===== */}
      {section === 'activity' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Actions (Last 7 Days)</h3>
              <div className="space-y-3">
                {Object.entries(activityByAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => {
                  const colors: Record<string, string> = { created: '#22C55E', updated: '#3B82F6', deleted: '#EF4444', role_changed: '#F59E0B', assigned: '#8B5CF6' };
                  return (
                    <div key={action} className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)] w-28 capitalize">{action.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / Math.max(...Object.values(activityByAction), 1)) * 100}%`, backgroundColor: colors[action] || '#6B7280' }} />
                      </div>
                      <span className="text-sm font-bold w-10 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Recent Events</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentLogs.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.action === 'created' ? 'bg-emerald-400' : l.action === 'deleted' ? 'bg-red-400' : 'bg-blue-400'}`} />
                    <span className="text-[var(--text-muted)]">{l.actorName}</span>
                    <span className="text-[var(--text-secondary)] font-medium">{l.action}</span>
                    <span className="text-[var(--text-muted)]">{l.resource}</span>
                    <span className="text-[var(--text-muted)] truncate flex-1">{l.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// Velocity Section — Fetches and renders weekly velocity chart
// ================================================================

interface VelocityBucket {
  label: string;
  startDate: string;
  endDate: string;
  completed: number;
  created: number;
  netThroughput: number;
}

interface VelocityData {
  buckets: VelocityBucket[];
  avgCompleted: number;
  avgCreated: number;
  avgNetThroughput: number;
  trend: 'improving' | 'stable' | 'declining';
}

function VelocitySection({ lang }: { lang: string }) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(8);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/analytics/velocity?weeks=${weeks}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [weeks]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!data || data.buckets.length === 0) {
    return (
      <div className="text-center py-20">
        <Zap className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-[var(--text-muted)]">{lang === 'es' ? 'Sin datos de velocidad' : 'No velocity data available'}</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.buckets.flatMap(b => [b.completed, b.created]), 1);

  const TrendIcon = data.trend === 'improving' ? ArrowUp : data.trend === 'declining' ? ArrowDown : Minus;
  const trendColor = data.trend === 'improving' ? '#22C55E' : data.trend === 'declining' ? '#EF4444' : '#6B7280';
  const trendLabel = data.trend === 'improving'
    ? (lang === 'es' ? 'Mejorando' : 'Improving')
    : data.trend === 'declining'
      ? (lang === 'es' ? 'Declinando' : 'Declining')
      : (lang === 'es' ? 'Estable' : 'Stable');

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 anim-slide">
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Promedio completadas' : 'Avg Completed'}
          </p>
          <p className="text-3xl font-bold text-emerald-400">{data.avgCompleted}</p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">{lang === 'es' ? 'por semana' : 'per week'}</p>
        </div>
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Promedio creadas' : 'Avg Created'}
          </p>
          <p className="text-3xl font-bold text-blue-400">{data.avgCreated}</p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">{lang === 'es' ? 'por semana' : 'per week'}</p>
        </div>
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Rendimiento neto' : 'Net Throughput'}
          </p>
          <p className={`text-3xl font-bold ${data.avgNetThroughput >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.avgNetThroughput >= 0 ? '+' : ''}{data.avgNetThroughput}
          </p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">{lang === 'es' ? 'por semana' : 'per week'}</p>
        </div>
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Tendencia' : 'Trend'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <TrendIcon className="h-6 w-6" style={{ color: trendColor }} />
            <span className="text-lg font-bold" style={{ color: trendColor }}>{trendLabel}</span>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">
            {lang === 'es' ? `Últimas ${weeks} semanas` : `Last ${weeks} weeks`}
          </p>
        </div>
      </div>

      {/* Weeks selector */}
      <div className="flex items-center gap-2 anim-slide" style={{ animationDelay: '40ms' }}>
        <span className="text-[12px] text-[var(--text-muted)] font-semibold uppercase">
          {lang === 'es' ? 'Periodo' : 'Period'}:
        </span>
        {[4, 8, 12].map(w => (
          <button
            key={w}
            onClick={() => setWeeks(w)}
            className={`px-3 py-1 rounded-lg text-[12px] font-medium transition ${
              weeks === w
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {w} {lang === 'es' ? 'sem' : 'wk'}
          </button>
        ))}
      </div>

      {/* Velocity chart — stacked bars */}
      <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '80ms' }}>
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--accent)]" />
          {lang === 'es' ? 'Velocidad semanal' : 'Weekly Velocity'}
        </h3>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-[12px] text-[var(--text-muted)]">{lang === 'es' ? 'Completadas' : 'Completed'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-[12px] text-[var(--text-muted)]">{lang === 'es' ? 'Creadas' : 'Created'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-[12px] text-[var(--text-muted)]">{lang === 'es' ? 'Neto' : 'Net'}</span>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-48">
          {data.buckets.map((b, i) => {
            const completedH = (b.completed / maxVal) * 100;
            const createdH = (b.created / maxVal) * 100;

            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Tooltip */}
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-[var(--bg-base)] shadow-dropdown rounded-lg px-3 py-2 whitespace-nowrap">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">{b.label}</p>
                  <p className="text-[10px] text-emerald-400">{lang === 'es' ? 'Completadas' : 'Completed'}: {b.completed}</p>
                  <p className="text-[10px] text-blue-400">{lang === 'es' ? 'Creadas' : 'Created'}: {b.created}</p>
                  <p className={`text-[10px] ${b.netThroughput >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lang === 'es' ? 'Neto' : 'Net'}: {b.netThroughput >= 0 ? '+' : ''}{b.netThroughput}
                  </p>
                </div>

                {/* Bars */}
                <div className="w-full flex gap-0.5 items-end h-40">
                  <div
                    className="flex-1 rounded-t-md bg-emerald-500 transition-all duration-500"
                    style={{ height: `${Math.max(completedH, 2)}%`, opacity: 0.7 }}
                  />
                  <div
                    className="flex-1 rounded-t-md bg-blue-500 transition-all duration-500"
                    style={{ height: `${Math.max(createdH, 2)}%`, opacity: 0.7 }}
                  />
                </div>

                {/* Net indicator */}
                <div className={`text-[9px] font-bold px-1 rounded ${
                  b.netThroughput > 0 ? 'text-emerald-400' : b.netThroughput < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'
                }`}>
                  {b.netThroughput >= 0 ? '+' : ''}{b.netThroughput}
                </div>

                {/* Label */}
                <span className="text-[10px] text-[var(--text-muted)]">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-week detail table */}
      <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '120ms' }}>
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
          {lang === 'es' ? 'Detalle semanal' : 'Weekly Detail'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-[12px] uppercase tracking-wider">
                <th className="text-left pb-2 font-semibold">{lang === 'es' ? 'Semana' : 'Week'}</th>
                <th className="text-left pb-2 font-semibold">{lang === 'es' ? 'Periodo' : 'Period'}</th>
                <th className="text-right pb-2 font-semibold">{lang === 'es' ? 'Completadas' : 'Completed'}</th>
                <th className="text-right pb-2 font-semibold">{lang === 'es' ? 'Creadas' : 'Created'}</th>
                <th className="text-right pb-2 font-semibold">{lang === 'es' ? 'Neto' : 'Net'}</th>
              </tr>
            </thead>
            <tbody>
              {data.buckets.map(b => (
                <tr key={b.label} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition">
                  <td className="py-2 font-medium text-[var(--text-primary)]">{b.label}</td>
                  <td className="py-2 text-[var(--text-muted)] text-[12px]">{b.startDate} — {b.endDate}</td>
                  <td className="py-2 text-right text-emerald-400 font-semibold">{b.completed}</td>
                  <td className="py-2 text-right text-blue-400 font-semibold">{b.created}</td>
                  <td className={`py-2 text-right font-semibold ${b.netThroughput >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {b.netThroughput >= 0 ? '+' : ''}{b.netThroughput}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SLA Section — Fetches and renders SLA compliance metrics
// ================================================================

interface SLAMetrics {
  totalEvaluated: number;
  responseTimeMet: number;
  responseTimeBreached: number;
  responseTimeRate: number;
  resolutionTimeMet: number;
  resolutionTimeBreached: number;
  resolutionTimeRate: number;
  overallComplianceRate: number;
  avgCycleTimeHours: number;
  medianCycleTimeHours: number;
  avgResponseTimeHours: number;
  byPriority: Record<string, { total: number; resolutionMet: number; resolutionBreached: number; avgCycleHours: number }>;
  currentlyBreaching: { id: string; title: string; priority: string; hoursOverdue: number }[];
}

function SLASection({ lang }: { lang: string }) {
  const [data, setData] = useState<SLAMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/analytics/sla', {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <Clock className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-[var(--text-muted)]">{lang === 'es' ? 'Sin datos de SLA' : 'No SLA data available'}</p>
      </div>
    );
  }

  const formatHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${Math.round(h * 10) / 10}h`;
    return `${Math.round(h / 24 * 10) / 10}d`;
  };

  const rateColor = (rate: number) =>
    rate >= 90 ? '#22C55E' : rate >= 70 ? '#F59E0B' : '#EF4444';

  const priorityColors: Record<string, string> = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#6B7280' };

  return (
    <div className="space-y-6">
      {/* Compliance summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 anim-slide">
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Cumplimiento general' : 'Overall Compliance'}
          </p>
          <p className="text-3xl font-bold" style={{ color: rateColor(data.overallComplianceRate) }}>
            {data.overallComplianceRate}%
          </p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">
            {data.totalEvaluated} {lang === 'es' ? 'tareas evaluadas' : 'tasks evaluated'}
          </p>
        </div>
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Tiempo de respuesta' : 'Response Time'}
          </p>
          <p className="text-3xl font-bold" style={{ color: rateColor(data.responseTimeRate) }}>
            {data.responseTimeRate}%
          </p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">
            {lang === 'es' ? 'Promedio' : 'Avg'}: {formatHours(data.avgResponseTimeHours)}
          </p>
        </div>
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Tiempo de resolución' : 'Resolution Time'}
          </p>
          <p className="text-3xl font-bold" style={{ color: rateColor(data.resolutionTimeRate) }}>
            {data.resolutionTimeRate}%
          </p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">
            {lang === 'es' ? 'Ciclo medio' : 'Avg cycle'}: {formatHours(data.avgCycleTimeHours)}
          </p>
        </div>
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-5">
          <p className="text-[12px] text-[var(--text-muted)] uppercase font-semibold mb-1">
            {lang === 'es' ? 'Ciclo mediano' : 'Median Cycle'}
          </p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            {formatHours(data.medianCycleTimeHours)}
          </p>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">
            {lang === 'es' ? 'Creación → Completado' : 'Creation → Done'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Compliance by priority */}
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
            {lang === 'es' ? 'Cumplimiento por prioridad' : 'Compliance by Priority'}
          </h3>
          <div className="space-y-3">
            {['urgent', 'high', 'medium', 'low'].map(p => {
              const pd = data.byPriority[p];
              if (!pd || pd.total === 0) return null;
              const rate = pd.total > 0 ? Math.round((pd.resolutionMet / pd.total) * 100) : 100;
              return (
                <div key={p}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize" style={{ color: priorityColors[p] }}>{p}</span>
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {pd.resolutionMet}/{pd.total} ({rate}%)
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--bg-base)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${rate}%`, backgroundColor: rateColor(rate) }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {lang === 'es' ? 'Ciclo medio' : 'Avg cycle'}: {formatHours(pd.avgCycleHours)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Response vs Resolution breakdown */}
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '80ms' }}>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--accent)]" />
            {lang === 'es' ? 'Desglose' : 'Breakdown'}
          </h3>
          <div className="space-y-4">
            {/* Response time */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)] font-medium">
                  {lang === 'es' ? 'Tiempo de respuesta' : 'Response Time'}
                </span>
                <span className="text-sm font-bold" style={{ color: rateColor(data.responseTimeRate) }}>
                  {data.responseTimeRate}%
                </span>
              </div>
              <div className="flex gap-2 text-[12px]">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
                  {data.responseTimeMet} {lang === 'es' ? 'cumplidas' : 'met'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400">
                  {data.responseTimeBreached} {lang === 'es' ? 'incumplidas' : 'breached'}
                </span>
              </div>
            </div>

            {/* Resolution time */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)] font-medium">
                  {lang === 'es' ? 'Tiempo de resolución' : 'Resolution Time'}
                </span>
                <span className="text-sm font-bold" style={{ color: rateColor(data.resolutionTimeRate) }}>
                  {data.resolutionTimeRate}%
                </span>
              </div>
              <div className="flex gap-2 text-[12px]">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
                  {data.resolutionTimeMet} {lang === 'es' ? 'cumplidas' : 'met'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400">
                  {data.resolutionTimeBreached} {lang === 'es' ? 'incumplidas' : 'breached'}
                </span>
              </div>
            </div>

            {/* Visual gauge */}
            <div className="pt-2">
              <p className="text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-2">
                {lang === 'es' ? 'Salud general' : 'Overall Health'}
              </p>
              <div className="h-5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${data.overallComplianceRate}%`, backgroundColor: rateColor(data.overallComplianceRate) }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Currently breaching tasks */}
      {data.currentlyBreaching.length > 0 && (
        <div className="rounded-xl shadow-card bg-[var(--bg-elevated)] p-6 anim-slide" style={{ animationDelay: '120ms' }}>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            {lang === 'es' ? 'Tareas incumpliendo SLA' : 'Tasks Breaching SLA'}
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">
              {data.currentlyBreaching.length}
            </span>
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {data.currentlyBreaching.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize shrink-0"
                  style={{ backgroundColor: `${priorityColors[t.priority] || '#6B7280'}15`, color: priorityColors[t.priority] || '#6B7280' }}
                >
                  {t.priority}
                </span>
                <span className="text-sm text-[var(--text-secondary)] flex-1 truncate">{t.title}</span>
                <span className="text-[12px] text-red-400 font-semibold shrink-0">
                  +{formatHours(t.hoursOverdue)} {lang === 'es' ? 'vencido' : 'overdue'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
