'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getTasks, createTask, updateTask, deleteTask, logAction, getTaskComments, addTaskComment, addTaskActivity, getTaskActivity } from '@/lib/db';
import { Plus, Trash2, Check, X, CheckSquare, ChevronDown, ChevronRight, Calendar, Flag, Tag, MessageSquare, Search, LayoutList, LayoutGrid, Eye, AlertCircle, Loader2, Bug, Zap, Milestone, Target, Hash, Send, CheckCircle2, Circle } from 'lucide-react';

// === CONSTANTS ===
const STS = [
  { id:'todo', label:'To Do', color:'#64748B', I:Circle },
  { id:'in_progress', label:'In Progress', color:'#3B82F6', I:Loader2 },
  { id:'in_review', label:'In Review', color:'#A855F7', I:Eye },
  { id:'done', label:'Done', color:'#22C55E', I:CheckCircle2 },
  { id:'blocked', label:'Blocked', color:'#EF4444', I:AlertCircle },
];
const PRI = [
  { id:'urgent', label:'Urgent', color:'#EF4444', ic:'🔴' },
  { id:'high', label:'High', color:'#F59E0B', ic:'🟠' },
  { id:'medium', label:'Medium', color:'#3B82F6', ic:'🔵' },
  { id:'low', label:'Low', color:'#64748B', ic:'⚪' },
];
const TYP = [
  { id:'task', label:'Task', I:CheckSquare, color:'#3B82F6' },
  { id:'bug', label:'Bug', I:Bug, color:'#EF4444' },
  { id:'feature', label:'Feature', I:Zap, color:'#A855F7' },
  { id:'milestone', label:'Milestone', I:Milestone, color:'#F59E0B' },
  { id:'epic', label:'Epic', I:Target, color:'#22C55E' },
];
const priOrd: Record<string,number> = { urgent:0, high:1, medium:2, low:3 };

// === MAIN ===
export default function TasksPage() {
  const { user, me, activeTeamId, teams } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created');
  const [view, setView] = useState<'list'|'board'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const [groupBy, setGroupBy] = useState('status');

  const load = async () => {
    const { getMembers } = await import('@/lib/db');
    const [t, m] = await Promise.all([getTasks(activeTeamId), getMembers()]);
    setTasks(t);
    setMembers(activeTeamId === '__all__' ? m : m.filter((x: any) => x.teamId === activeTeamId || x.teamIds?.includes(activeTeamId)));
    setLoading(false);
  };
  useEffect(() => { setLoading(true); load(); }, [activeTeamId]);
  useEffect(() => { if (sel) { const u = tasks.find(t => t.id === sel.id); if (u) setSel(u); } }, [tasks]);

  let vis = tasks.filter(t => !t.archived).filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.tags?.some((tg: string) => tg.toLowerCase().includes(search.toLowerCase())));
  vis.sort((a: any, b: any) => {
    if (sortBy === 'priority') return (priOrd[a.priority]??9) - (priOrd[b.priority]??9);
    if (sortBy === 'due') return (a.dueDate?.seconds||9e9) - (b.dueDate?.seconds||9e9);
    if (sortBy === 'title') return (a.title||'').localeCompare(b.title||'');
    return (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0);
  });

  const counts: Record<string,number> = { all: tasks.filter(t => !t.archived).length };
  STS.forEach(s => { counts[s.id] = tasks.filter(t => t.status === s.id && !t.archived).length; });

  const groups = (() => {
    if (groupBy === 'none') return [{ key:'all', label:'All', tasks:vis, color:'#94A3B8' }];
    if (groupBy === 'status') return STS.map(s => ({ key:s.id, label:s.label, tasks:vis.filter(t => t.status===s.id), color:s.color }));
    if (groupBy === 'priority') return PRI.map(p => ({ key:p.id, label:p.label, tasks:vis.filter(t => t.priority===p.id), color:p.color }));
    return TYP.map(tp => ({ key:tp.id, label:tp.label, tasks:vis.filter(t => (t.type||'task')===tp.id), color:tp.color }));
  })();

  const doCreate = async (data: any) => {
    await createTask({ ...data, teamId: activeTeamId === '__all__' ? '' : activeTeamId, createdBy: user!.uid });
    await logAction({ action:'created', resource:'task', detail:data.title, actorId:user!.uid, actorName:me!.displayName });
    setShowCreate(false); load();
  };
  const doUpdate = async (id: string, field: string, val: any, old?: any) => {
    await updateTask(id, { [field]: val });
    try { await addTaskActivity(id, { action:'updated', field, from:String(old||''), to:String(val), actorId:user!.uid, actorName:me!.displayName }); } catch {}
    load();
  };
  const doDelete = async (t: any) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await deleteTask(t.id);
    await logAction({ action:'deleted', resource:'task', detail:t.title, actorId:user!.uid, actorName:me!.displayName });
    if (sel?.id === t.id) setSel(null); load();
  };

  const activeTeam = teams.find(t => t.id === activeTeamId);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">Tasks
                {activeTeam && <span className="text-sm font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor:`${activeTeam.color}15`, color:activeTeam.color, border:`1px solid ${activeTeam.color}25` }}>{activeTeam.icon} {activeTeam.name}</span>}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{counts.all} tasks · {counts.done||0} completed</p>
            </div>
            <button onClick={()=>setShowCreate(true)} className="flex items-center gap-2 px-5 h-10 rounded-xl btn-gold text-sm shadow-lg shadow-[#D4A843]/10"><Plus className="h-4 w-4" /> New Task</button>
          </div>
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="input-dark pl-10 h-9 text-sm" /></div>
            <div className="flex rounded-xl border border-[#1F2937]/60 overflow-hidden">
              <button onClick={()=>setView('list')} className={`px-3 py-1.5 text-xs ${view==='list'?'bg-[#D4A843]/10 text-[#D4A843]':'text-gray-600'}`}><LayoutList className="h-3.5 w-3.5" /></button>
              <button onClick={()=>setView('board')} className={`px-3 py-1.5 text-xs ${view==='board'?'bg-[#D4A843]/10 text-[#D4A843]':'text-gray-600'}`}><LayoutGrid className="h-3.5 w-3.5" /></button>
            </div>
            <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} className="select-dark h-9 text-xs"><option value="status">Group: Status</option><option value="priority">Group: Priority</option><option value="type">Group: Type</option><option value="none">No group</option></select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="select-dark h-9 text-xs"><option value="created">Sort: Newest</option><option value="priority">Sort: Priority</option><option value="due">Sort: Due</option><option value="title">Sort: A-Z</option></select>
          </div>
          {/* Status tabs */}
          <div className="flex gap-1.5 border-b border-[#1F2937]/40 pb-0">
            {[{id:'all',label:'All',color:'#94A3B8'},...STS].map(s=>(
              <button key={s.id} onClick={()=>setFilter(s.id)} className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition ${filter===s.id?'text-white':'text-gray-600 border-transparent hover:text-gray-400'}`}
                style={filter===s.id?{color:s.color,borderColor:s.color}:{}}>{s.label} <span className="ml-1 opacity-50">{counts[s.id]||0}</span></button>))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-14 skeleton rounded-xl" />)}</div>
           : vis.length===0 ? <div className="text-center py-20"><CheckSquare className="h-10 w-10 text-gray-700 mx-auto mb-3" /><p className="text-gray-600 text-sm">No tasks found.</p></div>
           : view==='board' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">{groups.map(g=>(
              <div key={g.key} className="w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:g.color}} /><span className="text-sm font-semibold text-gray-300">{g.label}</span><span className="text-xs text-gray-600">{g.tasks.length}</span></div>
                <div className="space-y-2">{g.tasks.map((t:any)=>{const p=PRI.find(x=>x.id===t.priority); const due=t.dueDate?.toDate?.(); return(
                  <div key={t.id} onClick={()=>setSel(t)} className={`p-3.5 rounded-xl border cursor-pointer transition ${sel?.id===t.id?'bg-[#D4A843]/5 border-[#D4A843]/20':'bg-[#111827] border-[#1F2937]/50 hover:border-[#374151]'}`}>
                    <div className="flex items-center gap-2 mb-1.5"><span className="text-xs">{p?.ic}</span><p className={`text-sm font-medium flex-1 ${t.status==='done'?'line-through text-gray-600':'text-gray-200'}`}>{t.title}</p></div>
                    {t.description&&<p className="text-[11px] text-gray-600 mb-2 line-clamp-2">{t.description}</p>}
                    <div className="flex items-center gap-2 flex-wrap">{t.tags?.slice(0,2).map((tg:string)=><span key={tg} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1F2937] text-gray-500">{tg}</span>)}
                      {due&&<span className="text-[10px] text-gray-600 flex items-center gap-1"><Calendar className="h-3 w-3"/>{due.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                      <div className="flex-1"/>{t.assignees?.slice(0,2).map((uid:string)=>{const m=members.find((x:any)=>x.id===uid);return<div key={uid} className="w-5 h-5 rounded-full bg-[#D4A843]/15 flex items-center justify-center text-[8px] font-bold text-[#D4A843]">{m?.displayName?.[0]||'?'}</div>})}
                    </div></div>)})}</div></div>))}</div>
           ) : (
            <div className="space-y-5">{groups.filter(g=>g.tasks.length>0).map(g=>{
              const [col, setCol] = useState(false);
              return <div key={g.key}>
                <button onClick={()=>setCol(!col)} className="flex items-center gap-2 mb-2">{col?<ChevronRight className="h-4 w-4 text-gray-600"/>:<ChevronDown className="h-4 w-4 text-gray-600"/>}<div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:g.color,boxShadow:`0 0 8px ${g.color}40`}}/><span className="text-sm font-semibold text-gray-300">{g.label}</span><span className="text-xs text-gray-600">{g.tasks.length}</span></button>
                {!col&&<div className="space-y-1">{g.tasks.map((t:any,i:number)=>{
                  const st=STS.find(s=>s.id===t.status)||STS[0]; const p=PRI.find(x=>x.id===t.priority)||PRI[2]; const tp=TYP.find(x=>x.id===(t.type||'task'))||TYP[0];
                  const due=t.dueDate?.toDate?.(); const overdue=due&&due<new Date()&&t.status!=='done';
                  const doneSub=(t.subtasks||[]).filter((s:any)=>s.done).length; const totalSub=(t.subtasks||[]).length;
                  return <div key={t.id} onClick={()=>setSel(t)} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer group transition anim-slide ${sel?.id===t.id?'bg-[#D4A843]/5 border-[#D4A843]/20':'bg-[#111827] border-[#1F2937]/50 hover:border-[#374151] hover:bg-[#151D2E]'}`} style={{animationDelay:`${i*20}ms`}}>
                    <button onClick={e=>{e.stopPropagation();doUpdate(t.id,'status',t.status==='done'?'todo':'done',t.status)}} className="shrink-0"><st.I className="h-5 w-5" style={{color:st.color}}/></button>
                    <tp.I className="h-4 w-4 shrink-0 opacity-40" style={{color:tp.color}}/>
                    <div className="flex-1 min-w-0"><p className={`text-sm font-medium truncate ${t.status==='done'?'line-through text-gray-600':'text-gray-200'}`}>{t.title}</p>{t.description&&<p className="text-[11px] text-gray-600 truncate mt-0.5">{t.description}</p>}</div>
                    {t.tags?.length>0&&<div className="hidden lg:flex gap-1">{t.tags.slice(0,2).map((tg:string)=><span key={tg} className="text-[10px] px-2 py-0.5 rounded-md bg-[#1F2937] text-gray-400 border border-[#374151]/50">{tg}</span>)}</div>}
                    {totalSub>0&&<div className="hidden md:flex items-center gap-1.5 text-[11px] text-gray-500"><CheckSquare className="h-3 w-3"/>{doneSub}/{totalSub}</div>}
                    {due&&<span className={`hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${overdue?'bg-red-500/10 text-red-400 border border-red-500/20':'bg-[#1F2937] text-gray-500 border border-[#374151]/50'}`}><Calendar className="h-3 w-3"/>{due.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                    <span className="text-sm" title={p.label}>{p.ic}</span>
                    <div className="flex -space-x-1.5">{t.assignees?.slice(0,3).map((uid:string)=>{const m=members.find((x:any)=>x.id===uid);return<div key={uid} className="w-6 h-6 rounded-full bg-[#D4A843]/15 border-2 border-[#111827] flex items-center justify-center text-[9px] font-bold text-[#D4A843]">{m?.displayName?.[0]?.toUpperCase()||'?'}</div>})}</div>
                    {t.points&&<span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1F2937] text-gray-500 font-mono">{t.points}pt</span>}
                    <button onClick={e=>{e.stopPropagation();doDelete(t)}} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-700 hover:text-red-400 rounded-lg transition"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>})}</div>}
              </div>})}</div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {sel && <DetailPanel task={sel} members={members} uid={user!.uid} uname={me!.displayName} onUpdate={doUpdate} onDelete={doDelete} onClose={()=>setSel(null)} />}
      {/* Create Modal */}
      {showCreate && <CreateModal members={members} onClose={()=>setShowCreate(false)} onCreate={doCreate} />}
    </div>
  );
}

// === CREATE MODAL ===
function CreateModal({ members, onClose, onCreate }: any) {
  const [d, setD] = useState<any>({ title:'', description:'', status:'todo', priority:'medium', type:'task', assignees:[] as string[], tags:'', dueDate:'', startDate:'', timeEstimate:'', points:'', subtasks:[] as any[] });
  const [newSub, setNewSub] = useState('');
  const set = (k:string,v:any) => setD((p:any)=>({...p,[k]:v}));
  const toggleA = (id:string) => set('assignees', d.assignees.includes(id) ? d.assignees.filter((x:string)=>x!==id) : [...d.assignees,id]);
  const addSub = () => { if(!newSub.trim())return; set('subtasks',[...d.subtasks,{id:Date.now().toString(),title:newSub.trim(),done:false}]); setNewSub(''); };
  const submit = () => {
    if(!d.title.trim())return;
    const out:any = { ...d, tags: d.tags.split(',').map((t:string)=>t.trim()).filter(Boolean), points: d.points?Number(d.points):null, timeEstimate: d.timeEstimate?Number(d.timeEstimate):null };
    if(d.dueDate) out.dueDate = new Date(d.dueDate);
    if(d.startDate) out.startDate = new Date(d.startDate);
    delete out.tags; out.tags = d.tags.split(',').map((t:string)=>t.trim()).filter(Boolean);
    onCreate(out);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0C1017] border border-[#1F2937] rounded-2xl shadow-2xl anim-slide">
        <div className="flex items-center justify-between p-5 border-b border-[#1F2937]/60"><h2 className="text-lg font-bold text-white">Create Task</h2><button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-5 w-5" /></button></div>
        <div className="p-5 space-y-4">
          {/* Title */}
          <input value={d.title} onChange={e=>set('title',e.target.value)} placeholder="Task title..." autoFocus className="w-full h-12 px-4 rounded-xl bg-[#111827] border border-[#1F2937] text-white text-lg font-semibold placeholder:text-gray-600 focus:outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30" />
          {/* Description */}
          <textarea value={d.description} onChange={e=>set('description',e.target.value)} placeholder="Add description, context, instructions..." rows={4} className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-[#1F2937] text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#D4A843] resize-y" />
          {/* Type + Status + Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Type</label><div className="flex flex-wrap gap-1.5">{TYP.map(t=><button key={t.id} onClick={()=>set('type',t.id)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${d.type===t.id?'border text-white':'bg-[#111827] text-gray-500 hover:text-gray-300'}`} style={d.type===t.id?{backgroundColor:`${t.color}15`,borderColor:`${t.color}30`,color:t.color}:{}}><t.I className="h-3 w-3"/>{t.label}</button>)}</div></div>
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Status</label><select value={d.status} onChange={e=>set('status',e.target.value)} className="select-dark w-full">{STS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Priority</label><div className="flex gap-1">{PRI.map(p=><button key={p.id} onClick={()=>set('priority',p.id)} title={p.label} className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition ${d.priority===p.id?'ring-2 ring-white/20 scale-110':'opacity-50 hover:opacity-80'}`}>{p.ic}</button>)}</div></div>
          </div>
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Start Date</label><input type="date" value={d.startDate} onChange={e=>set('startDate',e.target.value)} className="input-dark h-9 text-sm" /></div>
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Due Date</label><input type="date" value={d.dueDate} onChange={e=>set('dueDate',e.target.value)} className="input-dark h-9 text-sm" /></div>
          </div>
          {/* Time + Points */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Time Estimate (min)</label><input type="number" value={d.timeEstimate} onChange={e=>set('timeEstimate',e.target.value)} placeholder="60" className="input-dark h-9 text-sm" /></div>
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Story Points</label><input type="number" value={d.points} onChange={e=>set('points',e.target.value)} placeholder="5" className="input-dark h-9 text-sm" /></div>
          </div>
          {/* Assignees */}
          <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Assignees</label><div className="flex gap-2 flex-wrap">{members.map((m:any)=><button key={m.id} onClick={()=>toggleA(m.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition ${d.assignees.includes(m.id)?'bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20':'bg-[#111827] text-gray-500 border border-[#1F2937] hover:border-gray-600'}`}><div className="w-5 h-5 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[9px] font-bold">{m.displayName?.[0]?.toUpperCase()}</div>{m.displayName}{d.assignees.includes(m.id)&&<Check className="h-3 w-3"/>}</button>)}</div></div>
          {/* Tags */}
          <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Tags (comma-separated)</label><input value={d.tags} onChange={e=>set('tags',e.target.value)} placeholder="design, social, facebook" className="input-dark h-9 text-sm" /></div>
          {/* Subtasks */}
          <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Subtasks</label>
            {d.subtasks.map((s:any,i:number)=><div key={s.id} className="flex items-center gap-2 mb-1.5"><CheckSquare className="h-3.5 w-3.5 text-gray-600"/><span className="text-sm text-gray-300 flex-1">{s.title}</span><button onClick={()=>set('subtasks',d.subtasks.filter((_:any,j:number)=>j!==i))} className="text-gray-700 hover:text-red-400"><X className="h-3.5 w-3.5"/></button></div>)}
            <div className="flex gap-2"><input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Add subtask..." className="input-dark h-8 text-xs flex-1" onKeyDown={e=>e.key==='Enter'&&addSub()}/><button onClick={addSub} className="px-3 h-8 rounded-lg bg-[#1F2937] text-xs text-gray-400 hover:text-white">Add</button></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-[#1F2937]/60"><button onClick={onClose} className="px-5 h-10 rounded-xl border border-[#1F2937] text-sm text-gray-400">Cancel</button><button onClick={submit} disabled={!d.title.trim()} className="px-6 h-10 rounded-xl btn-gold text-sm disabled:opacity-40">Create Task</button></div>
      </div>
    </div>
  );
}

// === DETAIL PANEL ===
function DetailPanel({ task, members, uid, uname, onUpdate, onDelete, onClose }: any) {
  const [comments, setComments] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [newCom, setNewCom] = useState('');
  const [tab, setTab] = useState<'detail'|'comments'|'activity'>('detail');
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [descVal, setDescVal] = useState(task.description||'');
  const [editDesc, setEditDesc] = useState(false);
  const [newSub, setNewSub] = useState('');

  useEffect(() => { setTitleVal(task.title); setDescVal(task.description||''); }, [task.id, task.title, task.description]);
  useEffect(() => {
    getTaskComments(task.id).then(setComments).catch(()=>setComments([]));
    getTaskActivity(task.id).then(setActivity).catch(()=>setActivity([]));
  }, [task.id]);

  const st=STS.find(s=>s.id===task.status)||STS[0]; const tp=TYP.find(t=>t.id===(task.type||'task'))||TYP[0];
  const due=task.dueDate?.toDate?.(); const start=task.startDate?.toDate?.();
  const doneSub=(task.subtasks||[]).filter((s:any)=>s.done).length; const totalSub=(task.subtasks||[]).length;
  const progress=totalSub>0?Math.round(doneSub/totalSub*100):0;

  const postComment = async () => { if(!newCom.trim())return; await addTaskComment(task.id,{text:newCom.trim(),authorId:uid,authorName:uname}); setNewCom(''); setComments(await getTaskComments(task.id)); };
  const saveTitle = () => { if(titleVal.trim()&&titleVal!==task.title) onUpdate(task.id,'title',titleVal.trim(),task.title); setEditTitle(false); };
  const saveDesc = () => { onUpdate(task.id,'description',descVal,task.description); setEditDesc(false); };
  const toggleSub = (i:number) => { const u=[...(task.subtasks||[])]; u[i]={...u[i],done:!u[i].done}; onUpdate(task.id,'subtasks',u); };
  const addSub = () => { if(!newSub.trim())return; onUpdate(task.id,'subtasks',[...(task.subtasks||[]),{id:Date.now().toString(),title:newSub.trim(),done:false}]); setNewSub(''); };

  return (
    <div className="w-[460px] shrink-0 bg-[#0C1017] border-l border-[#1F2937]/60 flex flex-col h-full overflow-hidden anim-slide">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1F2937]/60">
        <div className="flex items-center gap-2"><tp.I className="h-4 w-4" style={{color:tp.color}}/><span className="text-xs font-semibold text-gray-500 uppercase">{tp.label}</span></div>
        <div className="flex items-center gap-1"><button onClick={()=>onDelete(task)} className="p-2 text-gray-700 hover:text-red-400 rounded-lg"><Trash2 className="h-4 w-4"/></button><button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-400 rounded-lg"><X className="h-4 w-4"/></button></div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* Title */}
          {editTitle ? <div className="flex gap-2"><input value={titleVal} onChange={e=>setTitleVal(e.target.value)} className="input-dark flex-1 text-lg font-bold" autoFocus onKeyDown={e=>e.key==='Enter'&&saveTitle()}/><button onClick={saveTitle} className="p-2 text-emerald-400"><Check className="h-4 w-4"/></button><button onClick={()=>{setEditTitle(false);setTitleVal(task.title)}} className="p-2 text-gray-600"><X className="h-4 w-4"/></button></div>
            : <h2 className="text-xl font-bold text-white cursor-pointer hover:text-[#D4A843] transition" onClick={()=>setEditTitle(true)}>{task.title}</h2>}
          {/* Status + Priority */}
          <div className="flex gap-3">
            <div className="flex-1"><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Status</label><select value={task.status} onChange={e=>onUpdate(task.id,'status',e.target.value,task.status)} className="w-full h-9 px-3 rounded-xl text-xs font-semibold border cursor-pointer" style={{backgroundColor:`${st.color}10`,borderColor:`${st.color}25`,color:st.color}}>{STS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div className="flex-1"><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Priority</label><div className="flex gap-1">{PRI.map(p=><button key={p.id} onClick={()=>onUpdate(task.id,'priority',p.id,task.priority)} title={p.label} className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition ${task.priority===p.id?'ring-2 ring-white/20 bg-white/5 scale-105':'opacity-40 hover:opacity-70'}`}>{p.ic}</button>)}</div></div>
          </div>
          {/* Assignees */}
          <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Assignees</label><div className="flex gap-1.5 flex-wrap">{members.map((m:any)=>{const a=task.assignees?.includes(m.id);return<button key={m.id} onClick={()=>{const n=a?task.assignees.filter((x:string)=>x!==m.id):[...(task.assignees||[]),m.id];onUpdate(task.id,'assignees',n,task.assignees)}} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${a?'bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20':'bg-[#111827] text-gray-600 border border-[#1F2937] hover:border-gray-600'}`}><div className="w-4 h-4 rounded-full bg-[#D4A843]/10 flex items-center justify-center text-[8px] font-bold">{m.displayName?.[0]?.toUpperCase()}</div>{m.displayName?.split(' ')[0]}{a&&<Check className="h-3 w-3"/>}</button>})}</div></div>
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Start</label><input type="date" value={start?start.toISOString().split('T')[0]:''} onChange={e=>onUpdate(task.id,'startDate',e.target.value?new Date(e.target.value):null)} className="input-dark h-8 text-xs w-full"/></div>
            <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Due</label><input type="date" value={due?due.toISOString().split('T')[0]:''} onChange={e=>onUpdate(task.id,'dueDate',e.target.value?new Date(e.target.value):null)} className="input-dark h-8 text-xs w-full"/></div>
          </div>
          {/* Description */}
          <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Description</label>
            {editDesc ? <div><textarea value={descVal} onChange={e=>setDescVal(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-xl bg-[#111827] border border-[#1F2937] text-sm text-gray-300 resize-y focus:outline-none focus:border-[#D4A843]" autoFocus/><div className="flex gap-2 mt-2"><button onClick={saveDesc} className="px-3 h-7 rounded-lg btn-gold text-[11px]">Save</button><button onClick={()=>{setEditDesc(false);setDescVal(task.description||'')}} className="px-3 h-7 rounded-lg border border-[#1F2937] text-[11px] text-gray-500">Cancel</button></div></div>
            : <div onClick={()=>setEditDesc(true)} className="min-h-[50px] px-3 py-2 rounded-xl bg-[#111827] border border-[#1F2937] cursor-pointer hover:border-gray-600">{task.description?<p className="text-sm text-gray-400 whitespace-pre-wrap">{task.description}</p>:<p className="text-sm text-gray-700">Click to add description...</p>}</div>}
          </div>
          {/* Subtasks */}
          <div><div className="flex items-center justify-between mb-1.5"><label className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Subtasks</label>{totalSub>0&&<span className="text-[10px] text-gray-600">{doneSub}/{totalSub} · {progress}%</span>}</div>
            {totalSub>0&&<div className="h-1.5 rounded-full bg-[#1F2937] mb-3 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#D4A843] to-[#E8C85A] transition-all duration-500" style={{width:`${progress}%`}}/></div>}
            {(task.subtasks||[]).map((s:any,i:number)=><div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#111827] group"><button onClick={()=>toggleSub(i)} className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${s.done?'bg-emerald-500 border-emerald-500 text-white':'border-[#374151]'}`}>{s.done&&<Check className="h-2.5 w-2.5"/>}</button><span className={`text-sm flex-1 ${s.done?'line-through text-gray-600':'text-gray-300'}`}>{s.title}</span></div>)}
            <div className="flex gap-2 mt-2"><input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Add subtask..." className="input-dark h-8 text-xs flex-1" onKeyDown={e=>e.key==='Enter'&&addSub()}/><button onClick={addSub} className="px-3 h-8 rounded-lg bg-[#1F2937] text-xs text-gray-400 hover:text-white">+</button></div>
          </div>
          {/* Tags */}
          <div><label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1.5 font-semibold">Tags</label><div className="flex gap-1.5 flex-wrap">{(task.tags||[]).map((tag:string)=><span key={tag} className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1F2937] text-gray-400 border border-[#374151]/50 flex items-center gap-1"><Hash className="h-3 w-3"/>{tag}<button onClick={()=>onUpdate(task.id,'tags',task.tags.filter((t:string)=>t!==tag))} className="text-gray-600 hover:text-red-400"><X className="h-3 w-3"/></button></span>)}</div></div>
        </div>

        {/* Tabs */}
        <div className="border-t border-[#1F2937]/60">
          <div className="flex px-5">{(['detail','comments','activity'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-2.5 text-xs font-semibold border-b-2 capitalize transition ${tab===t?'text-[#D4A843] border-[#D4A843]':'text-gray-600 border-transparent hover:text-gray-400'}`}>{t==='comments'?`Comments (${comments.length})`:t}</button>)}</div>
          <div className="p-5">
            {tab==='comments'&&<div><div className="space-y-3 mb-4 max-h-64 overflow-y-auto">{comments.length===0&&<p className="text-xs text-gray-700 text-center py-4">No comments yet.</p>}{comments.map(c=><div key={c.id} className="flex gap-2.5"><div className="w-7 h-7 rounded-lg bg-[#D4A843]/10 flex items-center justify-center text-[10px] font-bold text-[#D4A843] shrink-0">{c.authorName?.[0]?.toUpperCase()}</div><div className="flex-1"><div className="flex items-baseline gap-2"><span className="text-xs font-semibold text-white">{c.authorName}</span><span className="text-[10px] text-gray-700">{c.createdAt?.toDate?.()?.toLocaleString?.() || ''}</span></div><p className="text-sm text-gray-400 mt-0.5">{c.text}</p></div></div>)}</div><div className="flex gap-2"><input value={newCom} onChange={e=>setNewCom(e.target.value)} placeholder="Write a comment..." className="input-dark h-9 text-xs flex-1" onKeyDown={e=>e.key==='Enter'&&postComment()}/><button onClick={postComment} className="h-9 px-4 rounded-xl btn-gold text-xs"><Send className="h-3.5 w-3.5"/></button></div></div>}
            {tab==='activity'&&<div className="space-y-2 max-h-64 overflow-y-auto">{activity.length===0&&<p className="text-xs text-gray-700 text-center py-4">No activity.</p>}{activity.map(a=><div key={a.id} className="flex items-start gap-2 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-[#D4A843] mt-1.5 shrink-0"/><div><span className="text-[#D4A843] font-medium">{a.actorName}</span>{' '}<span className="text-gray-500">{a.action} {a.field}</span>{a.to&&<span className="text-gray-700"> → <span className="text-gray-300">{a.to}</span></span>}<span className="text-gray-800 ml-2">{a.createdAt?.toDate?.()?.toLocaleString?.() || ''}</span></div></div>)}</div>}
            {tab==='detail'&&<div className="space-y-3"><div className="flex items-center justify-between text-xs"><span className="text-gray-600">Type</span><span className="text-gray-300 flex items-center gap-1"><tp.I className="h-3 w-3" style={{color:tp.color}}/>{tp.label}</span></div>{task.timeEstimate&&<div className="flex items-center justify-between text-xs"><span className="text-gray-600">Estimate</span><span className="text-gray-300">{task.timeEstimate}m</span></div>}{task.points&&<div className="flex items-center justify-between text-xs"><span className="text-gray-600">Points</span><span className="text-gray-300">{task.points}</span></div>}<div className="flex items-center justify-between text-xs"><span className="text-gray-600">Created</span><span className="text-gray-300">{task.createdAt?.toDate?.()?.toLocaleDateString?.() || '—'}</span></div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
