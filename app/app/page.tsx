'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getTasks, getMembers, getAuditLogs } from '@/lib/db';
import { CheckSquare, Clock, AlertTriangle, Users, TrendingUp, Zap, ArrowUpRight, Activity } from 'lucide-react';

export default function Dashboard() {
  const { me, activeTeamId } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTasks(activeTeamId), getMembers(), getAuditLogs()]).then(([t, m, l]) => {
      setTasks(t); setMembers(m); setLogs(l); setLoading(false);
    });
  }, [activeTeamId]);

  const done = tasks.filter(t => t.status === 'done').length;
  const active = tasks.filter(t => t.status === 'in_progress').length;
  const overdue = tasks.filter(t => t.dueDate?.toDate && t.dueDate.toDate() < new Date() && t.status !== 'done').length;
  const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const stats = [
    { label: 'Total Tasks', val: tasks.length, icon: CheckSquare, color: 'from-blue-500/20 to-blue-600/5', iconColor: 'text-blue-400', glow: 'shadow-blue-500/10' },
    { label: 'In Progress', val: active, icon: Clock, color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400', glow: 'shadow-amber-500/10' },
    { label: 'Completed', val: done, icon: TrendingUp, color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    { label: 'Overdue', val: overdue, icon: AlertTriangle, color: 'from-red-500/20 to-red-600/5', iconColor: 'text-red-400', glow: 'shadow-red-500/10' },
    { label: 'Team', val: members.length, icon: Users, color: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400', glow: 'shadow-purple-500/10' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 anim-slide">
        <h1 className="text-3xl font-bold text-white mb-1">
          Welcome back{me?.displayName ? `, ${me.displayName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-500 text-sm">Here&apos;s what&apos;s happening in your workspace today.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[1,2,3,4,5].map(i=><div key={i} className="h-28 skeleton" />)}</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {stats.map((s, i) => (
              <div key={s.label} className={`relative rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5 card-hover overflow-hidden anim-slide`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-40`} />
                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3 ${s.glow} shadow-lg`}>
                    <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                  </div>
                  <p className="text-3xl font-bold text-white">{s.val}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Completion bar */}
          <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5 mb-8 anim-slide" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">Completion Rate</p>
              <p className="text-sm font-bold text-[#D4A843]">{rate}%</p>
            </div>
            <div className="h-2 rounded-full bg-[#1F2937] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#D4A843] to-[#E8C85A] transition-all duration-1000 shadow-[0_0_12px_rgba(212,168,67,0.4)]" style={{ width: `${rate}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Tasks */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden anim-slide" style={{ animationDelay: '400ms' }}>
              <div className="p-5 border-b border-[#1F2937]/60 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2"><CheckSquare className="h-4 w-4 text-[#D4A843]" /> Recent Tasks</h2>
                <span className="text-xs text-gray-600">{tasks.length} total</span>
              </div>
              <div className="divide-y divide-[#1F2937]/40 max-h-[340px] overflow-y-auto">
                {tasks.length === 0 ? <p className="p-6 text-sm text-gray-600 text-center">No tasks yet. Go create some!</p> : tasks.slice(0, 8).map(t => (
                  <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-white/[0.01] transition">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status==='done'?'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]':t.status==='in_progress'?'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]':'bg-gray-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${t.status==='done'?'text-gray-600 line-through':'text-gray-200'}`}>{t.title}</p>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                      t.priority==='urgent'?'bg-red-500/10 text-red-400 border border-red-500/20':
                      t.priority==='high'?'bg-amber-500/10 text-amber-400 border border-amber-500/20':
                      t.priority==='medium'?'bg-blue-500/10 text-blue-400 border border-blue-500/20':
                      'bg-gray-800 text-gray-500 border border-gray-700'
                    }`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden anim-slide" style={{ animationDelay: '500ms' }}>
              <div className="p-5 border-b border-[#1F2937]/60">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Activity className="h-4 w-4 text-[#D4A843]" /> Activity Feed</h2>
              </div>
              <div className="divide-y divide-[#1F2937]/40 max-h-[340px] overflow-y-auto">
                {logs.length === 0 ? <p className="p-6 text-sm text-gray-600 text-center">Actions will appear here.</p> : logs.slice(0, 10).map(l => (
                  <div key={l.id} className="px-5 py-3.5 hover:bg-white/[0.01] transition">
                    <p className="text-sm"><span className="text-[#D4A843] font-medium">{l.actorName || l.actorId?.slice(0,8)}</span> <span className="text-gray-500">{l.action}</span> <span className="text-gray-300">{l.resource}</span></p>
                    {l.detail && <p className="text-[11px] text-gray-600 mt-0.5">{l.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
