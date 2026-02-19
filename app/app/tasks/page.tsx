'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getTasks, createTask, updateTask, deleteTask, logAction, getMembers } from '@/lib/db';
import { Plus, Trash2, Check, X, Edit2, CheckSquare, Filter, ChevronDown } from 'lucide-react';

export default function TasksPage() {
  const { user, me } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [assignee, setAssignee] = useState('');
  const [filter, setFilter] = useState('all');
  const [editId, setEditId] = useState<string|null>(null);
  const [editTitle, setEditTitle] = useState('');

  const load = async () => { const [t, m] = await Promise.all([getTasks(), getMembers()]); setTasks(t); setMembers(m); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    await createTask({ title: title.trim(), status, priority, assignees: assignee ? [assignee] : [] });
    await logAction({ action: 'created', resource: 'task', detail: title.trim(), actorId: user!.uid, actorName: me!.displayName });
    setTitle(''); setShowNew(false); load();
  };

  const toggleDone = async (t: any) => {
    const ns = t.status === 'done' ? 'todo' : 'done';
    await updateTask(t.id, { status: ns });
    await logAction({ action: 'completed', resource: 'task', detail: t.title, actorId: user!.uid, actorName: me!.displayName });
    load();
  };

  const changeStatus = async (id: string, s: string) => { await updateTask(id, { status: s }); load(); };
  const changePriority = async (id: string, p: string) => { await updateTask(id, { priority: p }); load(); };

  const remove = async (t: any) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await deleteTask(t.id);
    await logAction({ action: 'deleted', resource: 'task', detail: t.title, actorId: user!.uid, actorName: me!.displayName });
    load();
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    await updateTask(id, { title: editTitle.trim() });
    setEditId(null); load();
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const counts = { all: tasks.length, todo: tasks.filter(t=>t.status==='todo').length, in_progress: tasks.filter(t=>t.status==='in_progress').length, in_review: tasks.filter(t=>t.status==='in_review').length, done: tasks.filter(t=>t.status==='done').length };

  const statusStyle: Record<string,string> = {
    todo: 'bg-gray-800/60 text-gray-400 border-gray-700', in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    in_review: 'bg-purple-500/10 text-purple-400 border-purple-500/20', done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  const priStyle: Record<string,string> = {
    urgent: 'bg-red-500/10 text-red-400 border-red-500/20', high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20', low: 'bg-gray-800/60 text-gray-500 border-gray-700',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 anim-slide">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">{tasks.length} tasks across your workspace</p>
        </div>
        <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl btn-gold text-sm">
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap anim-slide" style={{ animationDelay: '60ms' }}>
        {(['all','todo','in_progress','in_review','done'] as const).map(s => (
          <button key={s} onClick={()=>setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filter===s ? 'bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 shadow-sm shadow-[#D4A843]/10' : 'bg-[#111827] text-gray-500 border border-[#1F2937]/60 hover:border-gray-600 hover:text-gray-400'}`}>
            {s === 'all' ? 'All' : s.replace('_',' ')} <span className="ml-1.5 text-[10px] opacity-60">{counts[s as keyof typeof counts]}</span>
          </button>
        ))}
      </div>

      {/* Create form */}
      {showNew && (
        <div className="mb-5 p-5 rounded-2xl border border-[#D4A843]/20 bg-[#111827] space-y-3 anim-fade glow-accent" style={{ boxShadow: '0 0 40px rgba(212,168,67,0.05)' }}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus className="input-dark text-base font-medium" onKeyDown={e => e.key==='Enter' && add()} />
          <div className="flex gap-3 flex-wrap items-center">
            <select value={status} onChange={e=>setStatus(e.target.value)} className="select-dark">
              <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="in_review">In Review</option><option value="done">Done</option>
            </select>
            <select value={priority} onChange={e=>setPriority(e.target.value)} className="select-dark">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <select value={assignee} onChange={e=>setAssignee(e.target.value)} className="select-dark">
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
            <div className="flex gap-2 ml-auto">
              <button onClick={add} className="px-5 h-9 rounded-xl btn-gold text-sm">Create</button>
              <button onClick={()=>setShowNew(false)} className="px-4 h-9 rounded-xl border border-[#1F2937] text-sm text-gray-400 hover:bg-[#1F2937]/30">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      {loading ? <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-16 skeleton" />)}</div> :
       filtered.length === 0 ? (
        <div className="text-center py-20 anim-slide">
          <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1F2937]/60 flex items-center justify-center mx-auto mb-4"><CheckSquare className="h-7 w-7 text-gray-700" /></div>
          <p className="text-gray-500 text-sm">No tasks yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover group anim-slide" style={{ animationDelay: `${i * 30}ms` }}>
              <button onClick={()=>toggleDone(t)}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${t.status==='done' ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'border-[#374151] hover:border-[#D4A843] hover:shadow-[0_0_8px_rgba(212,168,67,0.15)]'}`}>
                {t.status === 'done' && <Check className="h-3.5 w-3.5" />}
              </button>

              {editId === t.id ? (
                <div className="flex-1 flex gap-2">
                  <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="input-dark flex-1 h-9" onKeyDown={e=>e.key==='Enter'&&saveEdit(t.id)} autoFocus />
                  <button onClick={()=>saveEdit(t.id)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="h-4 w-4" /></button>
                  <button onClick={()=>setEditId(null)} className="p-2 text-gray-500 hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <p className={`flex-1 text-sm ${t.status==='done' ? 'line-through text-gray-600' : 'text-gray-200'}`}>{t.title}</p>
              )}

              <select value={t.status} onChange={e=>changeStatus(t.id, e.target.value)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg font-semibold border cursor-pointer appearance-none ${statusStyle[t.status]||statusStyle.todo}`}>
                <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="in_review">In Review</option><option value="done">Done</option>
              </select>

              <select value={t.priority} onChange={e=>changePriority(t.id, e.target.value)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg font-semibold border cursor-pointer appearance-none ${priStyle[t.priority]||priStyle.medium}`}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>

              {t.assignees?.length > 0 && (
                <div className="w-7 h-7 rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-[10px] font-bold text-[#D4A843]">
                  {members.find(m=>m.id===t.assignees[0])?.displayName?.[0] || '?'}
                </div>
              )}

              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition">
                <button onClick={()=>{setEditId(t.id);setEditTitle(t.title);}} className="p-2 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={()=>remove(t)} className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
