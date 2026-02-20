'use client';
import { useState } from 'react';
import type { PlatformData } from '@/app/app/analytics/page';
import {
  CheckSquare, FileText, Users, MessageSquare, TrendingUp, TrendingDown,
  Clock, AlertTriangle, Star, Hash, ArrowUp, ArrowDown, Minus,
  BarChart3, PieChart, Activity
} from 'lucide-react';

interface Props {
  data: PlatformData;
}

export default function StatsDashboard({ data }: Props) {
  const [section, setSection] = useState<'overview' | 'tasks' | 'docs' | 'team' | 'activity'>('overview');

  // ========== COMPUTED METRICS ==========
  const tasks = data.tasks;
  const docs = data.docs;
  const members = data.members;
  const teams = data.teams;
  const logs = data.auditLogs;

  // Task stats
  const tasksByStatus: Record<string, number> = {};
  tasks.forEach((t: any) => { tasksByStatus[t.status || 'unknown'] = (tasksByStatus[t.status || 'unknown'] || 0) + 1; });
  const tasksByPriority: Record<string, number> = {};
  tasks.forEach((t: any) => { tasksByPriority[t.priority || 'medium'] = (tasksByPriority[t.priority || 'medium'] || 0) + 1; });
  const tasksByDept: Record<string, number> = {};
  tasks.forEach((t: any) => {
    const team = teams.find((tm: any) => tm.id === t.teamId);
    const name = team ? team.name : 'Unassigned';
    tasksByDept[name] = (tasksByDept[name] || 0) + 1;
  });
  const completedTasks = tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'completed').length;

  // Doc stats
  const docsByDept: Record<string, number> = {};
  docs.forEach((d: any) => {
    const team = teams.find((tm: any) => tm.id === d.teamId);
    const name = team ? team.name : 'Unassigned';
    docsByDept[name] = (docsByDept[name] || 0) + 1;
  });
  const docsByVisibility: Record<string, number> = {};
  docs.forEach((d: any) => { docsByVisibility[d.visibility || 'team'] = (docsByVisibility[d.visibility || 'team'] || 0) + 1; });
  const totalWords = docs.reduce((sum: number, d: any) => sum + (d.wordCount || 0), 0);

  // Team stats
  const membersByDept: Record<string, number> = {};
  members.forEach((m: any) => {
    const team = teams.find((tm: any) => tm.id === m.teamId);
    const name = team ? team.name : 'Unassigned';
    membersByDept[name] = (membersByDept[name] || 0) + 1;
  });
  const membersByRole: Record<string, number> = {};
  members.forEach((m: any) => { membersByRole[m.role || 'member'] = (membersByRole[m.role || 'member'] || 0) + 1; });

  // Activity (last 7 days)
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const recentLogs = logs.filter((l: any) => (l.createdAt?.seconds || 0) * 1000 > weekAgo);
  const activityByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toLocaleDateString('en-US', { weekday: 'short' });
    activityByDay[key] = 0;
  }
  recentLogs.forEach((l: any) => {
    const d = new Date((l.createdAt?.seconds || 0) * 1000);
    const key = d.toLocaleDateString('en-US', { weekday: 'short' });
    if (activityByDay[key] !== undefined) activityByDay[key]++;
  });
  const activityByAction: Record<string, number> = {};
  recentLogs.forEach((l: any) => { activityByAction[l.action || 'unknown'] = (activityByAction[l.action || 'unknown'] || 0) + 1; });

  // Department performance
  const deptPerformance = teams.map((t: any) => {
    const dTasks = tasks.filter((tk: any) => tk.teamId === t.id);
    const dDocs = docs.filter((d: any) => d.teamId === t.id);
    const dMembers = members.filter((m: any) => m.teamId === t.id);
    const dCompleted = dTasks.filter((tk: any) => tk.status === 'done' || tk.status === 'completed').length;
    return {
      team: t,
      tasks: dTasks.length,
      completed: dCompleted,
      rate: dTasks.length > 0 ? Math.round((dCompleted / dTasks.length) * 100) : 0,
      docs: dDocs.length,
      members: dMembers.length,
      words: dDocs.reduce((s: number, d: any) => s + (d.wordCount || 0), 0),
    };
  });

  const NAV = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare },
    { id: 'docs' as const, label: 'Documents', icon: FileText },
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'activity' as const, label: 'Activity', icon: Activity },
  ];

  return (
    <div>
      {/* Section tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-[#0C1017] border border-[#1F2937]/60 w-fit anim-slide" style={{ animationDelay: '80ms' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setSection(n.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition ${section === n.id ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`}>
            <n.icon className="h-3.5 w-3.5" /> {n.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {section === 'overview' && (
        <div className="space-y-6">
          {/* Department Performance */}
          <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '120ms' }}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#D4A843]" /> Department Performance</h3>
            <div className="space-y-4">
              {deptPerformance.map(dp => (
                <div key={dp.team.id} className="flex items-center gap-4">
                  <div className="w-28 flex items-center gap-2 shrink-0">
                    <span className="text-sm">{dp.team.icon}</span>
                    <span className="text-xs font-medium truncate" style={{ color: dp.team.color }}>{dp.team.name}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-5 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dp.rate}%`, backgroundColor: dp.team.color, opacity: 0.7 }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right" style={{ color: dp.team.color }}>{dp.rate}%</span>
                    </div>
                    <div className="flex gap-4 text-[10px] text-gray-600">
                      <span>{dp.tasks} tasks</span>
                      <span>{dp.completed} done</span>
                      <span>{dp.docs} docs</span>
                      <span>{dp.members} people</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Completion Rate Ring */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '160ms' }}>
              <h3 className="text-sm font-bold text-white mb-4">Task Completion</h3>
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#D4A843" strokeWidth="8"
                      strokeDasharray={`${completionRate * 2.51} ${251 - completionRate * 2.51}`}
                      strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{completionRate}%</p>
                      <p className="text-[9px] text-gray-600">complete</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-gray-400">{completedTasks} completed</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-gray-400">{tasks.length - completedTasks - overdueTasks} in progress</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-gray-400">{overdueTasks} overdue</span></div>
                </div>
              </div>
            </div>

            {/* Activity chart */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '200ms' }}>
              <h3 className="text-sm font-bold text-white mb-4">Weekly Activity</h3>
              <div className="flex items-end gap-2 h-32">
                {Object.entries(activityByDay).map(([day, count]) => {
                  const max = Math.max(...Object.values(activityByDay), 1);
                  const height = (count / max) * 100;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-600">{count}</span>
                      <div className="w-full rounded-t-lg transition-all duration-700 bg-gradient-to-t from-[#D4A843]/60 to-[#D4A843]/20" style={{ height: `${Math.max(height, 4)}%` }} />
                      <span className="text-[9px] text-gray-600">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content metrics */}
          <div className="grid grid-cols-3 gap-4 anim-slide" style={{ animationDelay: '240ms' }}>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5">
              <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Total Words Written</p>
              <p className="text-3xl font-bold text-white">{totalWords.toLocaleString()}</p>
              <p className="text-[10px] text-gray-600 mt-1">across {docs.length} documents</p>
            </div>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5">
              <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Avg Words/Doc</p>
              <p className="text-3xl font-bold text-white">{docs.length > 0 ? Math.round(totalWords / docs.length).toLocaleString() : 0}</p>
              <p className="text-[10px] text-gray-600 mt-1">per document average</p>
            </div>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5">
              <p className="text-[10px] text-gray-600 uppercase font-semibold mb-1">Tasks/Member</p>
              <p className="text-3xl font-bold text-white">{members.length > 0 ? (tasks.length / members.length).toFixed(1) : 0}</p>
              <p className="text-[10px] text-gray-600 mt-1">average workload</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== TASKS ===== */}
      {section === 'tasks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* By Status */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide">
              <h3 className="text-sm font-bold text-white mb-4">Tasks by Status</h3>
              <div className="space-y-3">
                {Object.entries(tasksByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                  const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                  const colors: Record<string, string> = { done: '#22C55E', completed: '#22C55E', 'in-progress': '#3B82F6', 'in_progress': '#3B82F6', todo: '#6B7280', review: '#F59E0B', blocked: '#EF4444' };
                  const color = colors[status] || '#6B7280';
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 capitalize truncate">{status.replace(/[-_]/g, ' ')}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Priority */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-white mb-4">Tasks by Priority</h3>
              <div className="space-y-3">
                {['urgent', 'high', 'medium', 'low'].map(p => {
                  const count = tasksByPriority[p] || 0;
                  const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                  const colors: Record<string, string> = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#6B7280' };
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 capitalize">{p}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[p] }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* By Department */}
          <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '80ms' }}>
            <h3 className="text-sm font-bold text-white mb-4">Tasks by Department</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(tasksByDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                const team = teams.find((t: any) => t.name === dept);
                return (
                  <div key={dept} className="p-4 rounded-xl bg-[#0C1017] border border-[#1F2937]/40">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{team?.icon || '📁'}</span>
                      <span className="text-xs font-medium" style={{ color: team?.color || '#6B7280' }}>{dept}</span>
                    </div>
                    <p className="text-xl font-bold text-white">{count}</p>
                    <p className="text-[10px] text-gray-600">tasks assigned</p>
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
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide">
              <h3 className="text-sm font-bold text-white mb-4">Documents by Department</h3>
              <div className="space-y-3">
                {Object.entries(docsByDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                  const team = teams.find((t: any) => t.name === dept);
                  const pct = docs.length > 0 ? Math.round((count / docs.length) * 100) : 0;
                  return (
                    <div key={dept} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 truncate">{team?.icon || ''} {dept}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: team?.color || '#6B7280' }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-white mb-4">Visibility Distribution</h3>
              <div className="space-y-3">
                {Object.entries(docsByVisibility).map(([vis, count]) => {
                  const colors: Record<string, string> = { public: '#22C55E', team: '#3B82F6', private: '#EF4444' };
                  const pct = docs.length > 0 ? Math.round((count / docs.length) * 100) : 0;
                  return (
                    <div key={vis} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 capitalize">{vis}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[vis] || '#6B7280' }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top documents */}
          <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '80ms' }}>
            <h3 className="text-sm font-bold text-white mb-4">Top Documents by Word Count</h3>
            <div className="space-y-2">
              {docs.sort((a: any, b: any) => (b.wordCount || 0) - (a.wordCount || 0)).slice(0, 8).map((d: any, i: number) => {
                const team = teams.find((t: any) => t.id === d.teamId);
                return (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.01]">
                    <span className="text-[10px] text-gray-700 w-5">{i + 1}.</span>
                    <FileText className="h-3.5 w-3.5 text-[#D4A843]" />
                    <span className="text-xs text-gray-300 flex-1 truncate">{d.title || 'Untitled'}</span>
                    {team && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${team.color}10`, color: team.color }}>{team.icon} {team.name}</span>}
                    <span className="text-xs text-gray-500 font-mono">{(d.wordCount || 0).toLocaleString()}w</span>
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
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide">
              <h3 className="text-sm font-bold text-white mb-4">Members by Department</h3>
              <div className="space-y-3">
                {Object.entries(membersByDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
                  const team = teams.find((t: any) => t.name === dept);
                  const pct = members.length > 0 ? Math.round((count / members.length) * 100) : 0;
                  return (
                    <div key={dept} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 truncate">{team?.icon || ''} {dept}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: team?.color || '#6B7280' }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-white mb-4">Members by Role</h3>
              <div className="space-y-3">
                {Object.entries(membersByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                  const colors: Record<string, string> = { owner: '#D4A843', admin: '#A855F7', manager: '#3B82F6', member: '#6B7280', guest: '#475569' };
                  const pct = members.length > 0 ? Math.round((count / members.length) * 100) : 0;
                  return (
                    <div key={role} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 capitalize">{role}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[role] || '#6B7280' }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
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
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide">
              <h3 className="text-sm font-bold text-white mb-4">Actions (Last 7 Days)</h3>
              <div className="space-y-3">
                {Object.entries(activityByAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => {
                  const colors: Record<string, string> = { created: '#22C55E', updated: '#3B82F6', deleted: '#EF4444', role_changed: '#F59E0B', assigned: '#8B5CF6' };
                  return (
                    <div key={action} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-28 capitalize">{action.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-4 rounded-full bg-[#0C1017] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / Math.max(...Object.values(activityByAction), 1)) * 100}%`, backgroundColor: colors[action] || '#6B7280' }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right text-gray-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{ animationDelay: '40ms' }}>
              <h3 className="text-sm font-bold text-white mb-4">Recent Events</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.slice(0, 20).map((l: any) => (
                  <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.action === 'created' ? 'bg-emerald-400' : l.action === 'deleted' ? 'bg-red-400' : 'bg-blue-400'}`} />
                    <span className="text-gray-500">{l.actorName}</span>
                    <span className="text-gray-300 font-medium">{l.action}</span>
                    <span className="text-gray-600">{l.resource}</span>
                    <span className="text-gray-700 truncate flex-1">{l.detail}</span>
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