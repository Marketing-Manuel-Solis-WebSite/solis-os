'use client';
import { useEffect, useState } from 'react';
import { getTasks, getMembers } from '@/lib/db';
import { BarChart3, TrendingUp, Target } from 'lucide-react';

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState<any[]>([]); const [members, setMembers] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([getTasks(), getMembers()]).then(([t,m])=>{setTasks(t);setMembers(m);setLoading(false);}); }, []);

  const byStatus = tasks.reduce((a:any,t:any)=>{a[t.status]=(a[t.status]||0)+1;return a;},{});
  const byPriority = tasks.reduce((a:any,t:any)=>{a[t.priority]=(a[t.priority]||0)+1;return a;},{});
  const done = byStatus['done']||0; const rate = tasks.length ? Math.round(done/tasks.length*100) : 0;

  const sC:any = {todo:'#64748B',in_progress:'#60A5FA',in_review:'#C084FC',done:'#4ADE80'};
  const pC:any = {urgent:'#FB7185',high:'#FBBF24',medium:'#60A5FA',low:'#64748B'};

  if (loading) return <div className="p-6"><div className="h-64 skeleton" /></div>;
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 anim-slide"><h1 className="text-2xl font-bold text-white">Analytics</h1><p className="text-sm text-gray-500 mt-1">Workspace performance metrics</p></div>
      {!tasks.length ? <div className="text-center py-20"><BarChart3 className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-600">Create tasks to see analytics.</p></div> : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 anim-slide">
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5 text-center"><p className="text-3xl font-bold text-white">{tasks.length}</p><p className="text-xs text-gray-500 mt-1">Total Tasks</p></div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center"><p className="text-3xl font-bold text-emerald-400">{rate}%</p><p className="text-xs text-gray-500 mt-1">Completion</p></div>
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-5 text-center"><p className="text-3xl font-bold text-white">{members.length}</p><p className="text-xs text-gray-500 mt-1">Members</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Status */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{animationDelay:'100ms'}}>
              <h3 className="font-semibold text-sm text-white mb-5 flex items-center gap-2"><Target className="h-4 w-4 text-[#D4A843]" /> By Status</h3>
              {Object.entries(byStatus).map(([s,c])=>(
                <div key={s} className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:sC[s]||'#666',boxShadow:`0 0 8px ${sC[s]||'#666'}40`}} />
                  <span className="text-sm text-gray-400 flex-1 capitalize w-24">{s.replace('_',' ')}</span>
                  <div className="w-40 h-2.5 rounded-full bg-[#1F2937] overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${((c as number)/tasks.length)*100}%`,backgroundColor:sC[s]}} /></div>
                  <span className="text-sm font-bold text-white w-8 text-right">{c as number}</span>
                </div>
              ))}
            </div>
            {/* By Priority */}
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6 anim-slide" style={{animationDelay:'200ms'}}>
              <h3 className="font-semibold text-sm text-white mb-5 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#D4A843]" /> By Priority</h3>
              {Object.entries(byPriority).map(([p,c])=>(
                <div key={p} className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:pC[p]||'#666',boxShadow:`0 0 8px ${pC[p]||'#666'}40`}} />
                  <span className="text-sm text-gray-400 flex-1 capitalize w-24">{p}</span>
                  <div className="w-40 h-2.5 rounded-full bg-[#1F2937] overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{width:`${((c as number)/tasks.length)*100}%`,backgroundColor:pC[p]}} /></div>
                  <span className="text-sm font-bold text-white w-8 text-right">{c as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
