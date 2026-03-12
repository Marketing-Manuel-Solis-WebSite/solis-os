'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { AnalyticsSnapshot } from '@/app/app/analytics/page';
import {
  CheckSquare, FileText, Users, TrendingUp,
  Clock, AlertTriangle,
  BarChart3, PieChart, Activity
} from 'lucide-react';

interface Props {
  data: AnalyticsSnapshot;
}

export default function StatsDashboard({ data }: Props) {
  const { t } = useI18n();
  const [section, setSection] = useState<'overview' | 'tasks' | 'docs' | 'team' | 'activity'>('overview');

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
