'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useMemo } from 'react';
import { getTasks, getDocuments, getAuditLogs } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckSquare, Clock, AlertTriangle, Users, TrendingUp,
  Activity, FileText, ArrowRight, Calendar,
  BarChart3, Target, Eye, Circle, Loader2, CheckCircle2,
  Flag
} from 'lucide-react';

export default function Dashboard() {
  const { user, me, canSeeAllTeams, activeTeamId, teams, canSeeResource, allMembers } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getTasks(activeTeamId).catch(() => []),
      getDocuments(activeTeamId).catch(() => []),
      getAuditLogs().catch(() => []),
    ]).then(([t, d, l]) => {
      const filteredTasks = canSeeAllTeams ? t : (t as any[]).filter(tk => canSeeResource({ teamId: tk.teamId, createdBy: tk.createdBy, visibility: tk.visibility, assignees: tk.assignees }));
      const filteredDocs = canSeeAllTeams ? d : (d as any[]).filter(dc => canSeeResource({ teamId: dc.teamId, createdBy: dc.createdBy, visibility: dc.visibility }));
      setTasks(filteredTasks as any[]);
      setDocs(filteredDocs as any[]);
      setLogs(l as any[]);
      setLoading(false);
    });
  }, [activeTeamId, user, canSeeAllTeams, canSeeResource]);

  const metrics = useMemo(() => {
    const done = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const inReview = tasks.filter(t => t.status === 'in_review').length;
    const overdue = tasks.filter(t => {
      if (!t.dueDate) return false;
      const due = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due < new Date() && t.status !== 'done' && t.status !== 'completed';
    }).length;
    const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

    const myTasks = tasks.filter(t => t.assignees?.includes(user?.uid) || t.createdBy === user?.uid);
    const myPending = myTasks.filter(t => t.status !== 'done' && t.status !== 'completed');
    const myOverdue = myTasks.filter(t => {
      if (!t.dueDate) return false;
      const due = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due < new Date() && t.status !== 'done' && t.status !== 'completed';
    });

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 86400000);
    const upcoming = tasks.filter(t => {
      if (!t.dueDate || t.status === 'done' || t.status === 'completed') return false;
      const due = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due >= now && due <= weekLater;
    }).sort((a, b) => {
      const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
      const db = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
      return da.getTime() - db.getTime();
    });

    const byPriority: Record<string, number> = {};
    tasks.filter(t => t.status !== 'done' && t.status !== 'completed').forEach(t => {
      byPriority[t.priority || 'medium'] = (byPriority[t.priority || 'medium'] || 0) + 1;
    });

    const byDept = teams.map(team => {
      const dTasks = tasks.filter(t => t.teamId === team.id);
      const dDone = dTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      return { team, total: dTasks.length, done: dDone, rate: dTasks.length > 0 ? Math.round((dDone / dTasks.length) * 100) : 0 };
    });

    return { done, inProgress, inReview, overdue, rate, myTasks, myPending, myOverdue, upcoming, byPriority, byDept };
  }, [tasks, user?.uid, teams]);

  const stats = [
    { label: 'Total Tasks', val: tasks.length, icon: CheckSquare, color: '#3B82F6', bg: 'from-blue-500/20 to-blue-600/5' },
    { label: 'In Progress', val: metrics.inProgress, icon: Clock, color: '#F59E0B', bg: 'from-amber-500/20 to-amber-600/5' },
    { label: 'Completed', val: metrics.done, icon: TrendingUp, color: '#22C55E', bg: 'from-emerald-500/20 to-emerald-600/5' },
    { label: 'Overdue', val: metrics.overdue, icon: AlertTriangle, color: '#EF4444', bg: 'from-red-500/20 to-red-600/5' },
    { label: 'Documents', val: docs.length, icon: FileText, color: '#8B5CF6', bg: 'from-purple-500/20 to-purple-600/5' },
    { label: 'Team', val: activeTeamId === '__all__' ? allMembers.length : allMembers.filter(m => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId)).length, icon: Users, color: '#D4A843', bg: 'from-[#D4A843]/20 to-[#D4A843]/5' },
  ];

  const filteredLogs = useMemo(() => {
    if (activeTeamId === '__all__') return logs;
    const teamMemberIds = new Set(
      allMembers
        .filter(m => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId))
        .map(m => m.userId)
    );
    return logs.filter((log: any) => {
      if (log.actorId && teamMemberIds.has(log.actorId)) return true;
      if (!log.actorId || log.actorId === 'system') return true;
      return false;
    });
  }, [logs, activeTeamId, allMembers]);

  const priorityColors: Record<string, string> = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#64748B' };
  const statusIcons: Record<string, any> = { todo: Circle, in_progress: Loader2, in_review: Eye, done: CheckCircle2, blocked: AlertTriangle };
  const statusColors: Record<string, string> = { todo: '#64748B', in_progress: '#3B82F6', in_review: '#A855F7', done: '#22C55E', blocked: '#EF4444' };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">
          Welcome back{me?.displayName ? `, ${me.displayName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-[var(--text-muted)] text-sm">
          Here&apos;s what&apos;s happening in your workspace today.
          {canSeeAllTeams && activeTeamId === '__all__' && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 font-semibold">GENERAL VIEW</span>}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">{[1,2,3,4,5,6].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 overflow-hidden cursor-default">
                <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-40`} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${s.color}15`, boxShadow: `0 4px 12px ${s.color}15` }}>
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">{s.val}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Completion bar */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Completion Rate</p>
              <p className="text-sm font-bold text-[#D4A843]">{metrics.rate}%</p>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${metrics.rate}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-[#D4A843] to-[#E8C85A] shadow-[0_0_12px_rgba(212,168,67,0.4)]" />
            </div>
            <div className="flex items-center gap-6 mt-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> {metrics.done} done</span>
              <span className="flex items-center gap-1.5 text-blue-400"><Loader2 className="h-3 w-3" /> {metrics.inProgress} in progress</span>
              <span className="flex items-center gap-1.5 text-purple-400"><Eye className="h-3 w-3" /> {metrics.inReview} in review</span>
              <span className="flex items-center gap-1.5 text-red-400"><AlertTriangle className="h-3 w-3" /> {metrics.overdue} overdue</span>
            </div>
          </motion.div>

          {/* Department performance */}
          {canSeeAllTeams && metrics.byDept.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 mb-8">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4"><BarChart3 className="h-4 w-4 text-[#D4A843]" /> Department Performance</h2>
              <div className="space-y-3">
                {metrics.byDept.map((dp, di) => (
                  <motion.div key={dp.team.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + di * 0.05 }}
                    className="flex items-center gap-4">
                    <div className="w-28 flex items-center gap-2 shrink-0">
                      <span className="text-sm">{dp.team.icon}</span>
                      <span className="text-xs font-medium truncate" style={{ color: dp.team.color }}>{dp.team.name}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 rounded-full bg-[var(--bg-base)] overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${dp.rate}%` }} transition={{ duration: 0.8, delay: 0.5 + di * 0.05 }}
                            className="h-full rounded-full" style={{ backgroundColor: dp.team.color, opacity: 0.7 }} />
                        </div>
                        <span className="text-xs font-bold w-10 text-right" style={{ color: dp.team.color }}>{dp.rate}%</span>
                      </div>
                      <div className="flex gap-4 text-[10px] text-[var(--text-muted)] mt-0.5">
                        <span>{dp.total} tasks</span><span>{dp.done} done</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* My Tasks */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Target className="h-4 w-4 text-[#D4A843]" /> My Tasks</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{metrics.myPending.length} pending</span>
                  {metrics.myOverdue.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{metrics.myOverdue.length} overdue</span>}
                </div>
              </div>
              <div className="divide-y divide-[var(--border)] max-h-[320px] overflow-y-auto scrollbar-thin">
                {metrics.myPending.length === 0 ? (
                  <p className="p-6 text-sm text-[var(--text-muted)] text-center">All caught up! No pending tasks.</p>
                ) : metrics.myPending.slice(0, 8).map((t: any) => {
                  const StIcon = statusIcons[t.status] || Circle;
                  const sColor = statusColors[t.status] || '#64748B';
                  const team = teams.find(tm => tm.id === t.teamId);
                  return (
                    <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[var(--hover-bg)] transition cursor-pointer" onClick={() => router.push('/app/tasks')}>
                      <StIcon className="h-4 w-4 shrink-0" style={{ color: sColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate">{t.title}</p>
                        {team && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${team.color}10`, color: team.color }}>{team.icon} {team.name}</span>}
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: `${priorityColors[t.priority] || '#64748B'}15`, color: priorityColors[t.priority] || '#64748B', border: `1px solid ${priorityColors[t.priority] || '#64748B'}25` }}>{t.priority}</span>
                    </div>
                  );
                })}
              </div>
              {metrics.myPending.length > 8 && (
                <div className="p-3 border-t border-[var(--border)] text-center">
                  <button onClick={() => router.push('/app/tasks')} className="text-xs text-[#D4A843] hover:underline flex items-center gap-1 mx-auto">View all <ArrowRight className="h-3 w-3" /></button>
                </div>
              )}
            </motion.div>

            {/* Upcoming Deadlines */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Calendar className="h-4 w-4 text-[#D4A843]" /> Upcoming Deadlines</h2>
                <span className="text-[10px] text-[var(--text-muted)]">Next 7 days</span>
              </div>
              <div className="divide-y divide-[var(--border)] max-h-[320px] overflow-y-auto scrollbar-thin">
                {metrics.upcoming.length === 0 ? (
                  <p className="p-6 text-sm text-[var(--text-muted)] text-center">No upcoming deadlines this week.</p>
                ) : metrics.upcoming.slice(0, 8).map((t: any) => {
                  const due = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
                  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
                  const team = teams.find(tm => tm.id === t.teamId);
                  return (
                    <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[var(--hover-bg)] transition">
                      <Calendar className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {team && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${team.color}10`, color: team.color }}>{team.icon}</span>}
                          <span className="text-[10px] text-[var(--text-muted)]">{due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${daysLeft <= 1 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : daysLeft <= 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border)]'}`}>
                        {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Priority Breakdown */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4"><Flag className="h-4 w-4 text-[#D4A843]" /> Open Tasks by Priority</h2>
              <div className="space-y-3">
                {['urgent', 'high', 'medium', 'low'].map(p => {
                  const count = metrics.byPriority[p] || 0;
                  const openTotal = Object.values(metrics.byPriority).reduce((s: number, v) => s + (v as number), 0);
                  const pct = openTotal > 0 ? Math.round((count / openTotal) * 100) : 0;
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-secondary)] w-16 capitalize">{p}</span>
                      <div className="flex-1 h-3.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: 0.65 }}
                          className="h-full rounded-full" style={{ backgroundColor: priorityColors[p] }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right text-[var(--text-secondary)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Activity Feed */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Activity className="h-4 w-4 text-[#D4A843]" /> Recent Activity</h2>
              </div>
              <div className="divide-y divide-[var(--border)] max-h-[240px] overflow-y-auto scrollbar-thin">
                {filteredLogs.length === 0 ? (
                  <p className="p-6 text-sm text-[var(--text-muted)] text-center">Actions will appear here.</p>
                ) : filteredLogs.slice(0, 10).map((l: any) => (
                  <div key={l.id} className="px-5 py-3 hover:bg-[var(--hover-bg)] transition">
                    <p className="text-sm">
                      <span className="text-[#D4A843] font-medium">{l.actorName || 'System'}</span>{' '}
                      <span className="text-[var(--text-muted)]">{l.action}</span>{' '}
                      <span className="text-[var(--text-secondary)]">{l.resource}</span>
                    </p>
                    {l.detail && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{l.detail}</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

        </>
      )}
    </motion.div>
  );
}
