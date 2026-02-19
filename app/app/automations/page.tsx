'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getAutomations, createAutomation, deleteAutomation, logAction } from '@/lib/db';
import { Plus, Trash2, Zap, ArrowRight } from 'lucide-react';

export default function AutomationsPage() {
  const { user, me } = useAuth();
  const [rules, setRules] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({name:'',trigger:'task_created',condition:'',action:'change_status'});

  const load = async () => { setRules(await getAutomations()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return;
    await createAutomation(form);
    await logAction({ action:'created', resource:'automation', detail:form.name, actorId:user!.uid, actorName:me!.displayName });
    setForm({name:'',trigger:'task_created',condition:'',action:'change_status'}); setShowNew(false); load();
  };

  const remove = async (r:any) => { if (!confirm('Delete?')) return; await deleteAutomation(r.id); load(); };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div><h1 className="text-2xl font-bold text-white">Automations</h1><p className="text-sm text-gray-500 mt-1">Automate your workflow</p></div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl btn-gold text-sm"><Plus className="h-4 w-4" /> New Rule</button>
      </div>
      {showNew && (
        <div className="mb-5 p-5 rounded-2xl border border-[#D4A843]/20 bg-[#111827] space-y-3 anim-fade">
          <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Rule name..." className="input-dark" />
          <div className="flex gap-3 flex-wrap">
            <select value={form.trigger} onChange={e=>setForm({...form,trigger:e.target.value})} className="select-dark"><option value="task_created">Task Created</option><option value="status_changed">Status Changed</option><option value="due_approaching">Due Approaching</option><option value="schedule_daily">Daily Schedule</option></select>
            <input value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})} placeholder="Condition" className="input-dark flex-1 h-[38px]" />
            <select value={form.action} onChange={e=>setForm({...form,action:e.target.value})} className="select-dark"><option value="change_status">Change Status</option><option value="assign_user">Assign User</option><option value="send_email">Send Email</option><option value="ai_summary">AI Summary</option></select>
          </div>
          <div className="flex gap-2"><button onClick={add} className="px-5 h-9 rounded-xl btn-gold text-sm">Create</button><button onClick={()=>setShowNew(false)} className="px-4 h-9 rounded-xl border border-[#1F2937] text-sm text-gray-400">Cancel</button></div>
        </div>
      )}
      {loading ? <div className="h-20 skeleton" /> : !rules.length ? (
        <div className="text-center py-20"><Zap className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-600">No automations yet.</p></div>
      ) : (
        <div className="space-y-2">{rules.map((r,i) => (
          <div key={r.id} className="flex items-center gap-4 p-5 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover group anim-slide" style={{animationDelay:`${i*40}ms`}}>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Zap className="h-5 w-5 text-amber-400" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{r.name}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">{r.trigger}</span>
                <ArrowRight className="h-3 w-3 text-gray-700" />
                {r.condition && <><span className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">{r.condition}</span><ArrowRight className="h-3 w-3 text-gray-700" /></>}
                <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">{r.action}</span>
              </div>
            </div>
            <button onClick={()=>remove(r)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-400 rounded-lg transition"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}</div>
      )}
    </div>
  );
}
