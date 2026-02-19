'use client';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getMembers, updateMember, logAction } from '@/lib/db';
import { Users, ChevronDown, ChevronRight, Edit2, Check, X } from 'lucide-react';

interface Node { id:string; displayName:string; email:string; title:string; department:string; role:string; managerId:string; children:Node[]; }

export default function OrgChartPage() {
  const { user, me, isAdmin } = useAuth();
  const [members, setMembers] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string|null>(null); const [ed, setEd] = useState({title:'',department:'',managerId:''});

  const load = async () => { setMembers(await getMembers()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const tree = (() => {
    const map = new Map<string,Node>(); members.forEach(m => map.set(m.id, {...m, children:[]}));
    const roots: Node[] = []; map.forEach(n => { if (n.managerId && map.has(n.managerId)) map.get(n.managerId)!.children.push(n); else roots.push(n); });
    return roots;
  })();

  const saveEdit = async (id: string) => {
    await updateMember(id, ed);
    await logAction({ action: 'updated', resource: 'org-chart', detail: `${ed.title} / ${ed.department}`, actorId: user!.uid, actorName: me!.displayName });
    setEditId(null); load();
  };

  const roleColor: Record<string,string> = { owner:'text-[#D4A843] bg-[#D4A843]/10 border-[#D4A843]/20', admin:'text-blue-400 bg-blue-500/10 border-blue-500/20', manager:'text-purple-400 bg-purple-500/10 border-purple-500/20', member:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', guest:'text-gray-500 bg-gray-800 border-gray-700' };

  const RenderNode = ({n, depth}:{n:Node;depth:number}) => {
    const [open, setOpen] = useState(true);
    return (
      <div style={{marginLeft:depth*28}}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover group mb-1.5">
          <button onClick={()=>setOpen(!open)} className="w-5 shrink-0">{n.children.length ? (open?<ChevronDown className="h-4 w-4 text-gray-600" />:<ChevronRight className="h-4 w-4 text-gray-600" />) : null}</button>
          <div className="w-10 h-10 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center justify-center text-sm font-bold text-[#D4A843] shrink-0">{n.displayName?.[0]?.toUpperCase()||'?'}</div>
          {editId===n.id ? (
            <div className="flex-1 flex gap-2 flex-wrap">
              <input value={ed.title} onChange={e=>setEd({...ed,title:e.target.value})} placeholder="Title" className="input-dark h-8 flex-1 min-w-[100px] text-xs" />
              <input value={ed.department} onChange={e=>setEd({...ed,department:e.target.value})} placeholder="Department" className="input-dark h-8 flex-1 min-w-[100px] text-xs" />
              <select value={ed.managerId} onChange={e=>setEd({...ed,managerId:e.target.value})} className="select-dark h-8 text-xs">
                <option value="">No Manager</option>{members.filter(m=>m.id!==n.id).map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}
              </select>
              <button onClick={()=>saveEdit(n.id)} className="h-8 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs"><Check className="h-3 w-3" /></button>
              <button onClick={()=>setEditId(null)} className="h-8 px-3 rounded-lg bg-gray-800 text-gray-400 text-xs"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{n.displayName}</p><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${roleColor[n.role]||roleColor.member}`}>{n.role}</span></div>
              <p className="text-xs text-gray-500">{n.title||'No title'}{n.department?` · ${n.department}`:''}</p>
            </div>
          )}
          {n.children.length>0 && <span className="text-[10px] px-2 py-1 rounded-full bg-[#1F2937] text-gray-500">{n.children.length}</span>}
          {isAdmin && editId!==n.id && <button onClick={()=>{setEditId(n.id);setEd({title:n.title||'',department:n.department||'',managerId:n.managerId||''});}} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-blue-400 rounded-lg transition"><Edit2 className="h-3.5 w-3.5" /></button>}
        </div>
        {open && n.children.map(c => <RenderNode key={c.id} n={c} depth={depth+1} />)}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 anim-slide"><h1 className="text-2xl font-bold text-white">Organization Chart</h1><p className="text-sm text-gray-500 mt-1">{members.length} team members</p></div>
      {loading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 skeleton" />)}</div> :
       !members.length ? <div className="text-center py-20"><Users className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-600">No members yet.</p></div> :
       <div className="space-y-1.5">{tree.map(n=><RenderNode key={n.id} n={n} depth={0} />)}</div>}
    </div>
  );
}
