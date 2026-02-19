'use client';
import { useAuth, Role } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { getMembers, updateMember, getAuditLogs, logAction, getOrg, updateOrg, getSettings, saveSettings, getWorkspaces, createWorkspace, deleteWorkspace, getTemplates, createTemplate, deleteTemplate, getAutomations, createAutomation, deleteAutomation, ORG } from '@/lib/db';
import { Shield, Users, Building2, Columns3, Zap, Bell, Bot, Plug, ScrollText, FileStack, LayoutGrid, Plus, Trash2, Save, Search, ChevronRight, Check, X } from 'lucide-react';

type S = 'org'|'users'|'perms'|'struct'|'fields'|'tpl'|'auto'|'notif'|'ai'|'integ'|'audit';
const SS: {id:S;l:string;i:any;d:string}[] = [
  {id:'org',l:'Organization',i:Building2,d:'Branding & settings'},{id:'users',l:'Users & Teams',i:Users,d:'Members & roles'},
  {id:'perms',l:'Permissions',i:Shield,d:'RBAC matrix'},{id:'struct',l:'Structure',i:LayoutGrid,d:'Workspaces'},
  {id:'fields',l:'Custom Fields',i:Columns3,d:'Field schemas'},{id:'tpl',l:'Templates',i:FileStack,d:'Task templates'},
  {id:'auto',l:'Automations',i:Zap,d:'Rules'},{id:'notif',l:'Notifications',i:Bell,d:'Email config'},
  {id:'ai',l:'AI Config',i:Bot,d:'AI features'},{id:'integ',l:'Integrations',i:Plug,d:'Webhooks'},
  {id:'audit',l:'Audit Logs',i:ScrollText,d:'Security'},
];

export default function Admin() {
  const { user, me, isAdmin } = useAuth();
  const [s, setS] = useState<S|null>(null);
  if (!isAdmin) return <div className="flex items-center justify-center h-[60vh]"><div className="text-center"><Shield className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-lg font-bold text-white">Access Denied</p><p className="text-sm text-gray-600 mt-1">Role: <span className="text-[#D4A843]">{me?.role}</span></p></div></div>;

  if (!s) return (
    <div className="p-6 max-w-5xl mx-auto"><div className="mb-8"><h1 className="text-2xl font-bold text-white">Admin Console</h1></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{SS.map((x,i)=>(
        <button key={x.id} onClick={()=>setS(x.id)} className="flex items-start gap-4 p-5 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover text-left group anim-slide" style={{animationDelay:`${i*30}ms`}}>
          <div className="p-2.5 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/20 text-[#D4A843]"><x.i className="h-5 w-5" /></div>
          <div><p className="font-semibold text-sm text-white">{x.l}</p><p className="text-xs text-gray-600">{x.d}</p></div><ChevronRight className="h-4 w-4 text-gray-700 mt-1 ml-auto" />
        </button>))}</div></div>);

  const Nav = () => <aside className="w-48 bg-[#0C1017] border-r border-[#1F2937]/60 shrink-0 p-2 overflow-y-auto"><button onClick={()=>setS(null)} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-gray-400 mb-1">← Back</button>{SS.map(x=><button key={x.id} onClick={()=>setS(x.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition ${s===x.id?'bg-[#D4A843]/10 text-[#D4A843] font-semibold':'text-gray-500 hover:text-gray-300'}`}><x.i className="h-4 w-4" />{x.l}</button>)}</aside>;

  return <div className="flex h-[calc(100vh-64px)]"><Nav />
    <div className="flex-1 overflow-y-auto">
      {s==='org'&&<OrgS />}{s==='users'&&<UsersS />}{s==='perms'&&<PermsS />}
      {s==='struct'&&<CrudS label="Workspaces" fields={['name','description']} gFn={getWorkspaces} cFn={createWorkspace} dFn={deleteWorkspace} />}
      {s==='fields'&&<SetS k="customFields" label="Custom Fields" fs={['caseNumber','caseValue','filingDate','caseType','courtLocation','retainerPaid']} />}
      {s==='tpl'&&<CrudS label="Templates" fields={['name','type','content']} gFn={getTemplates} cFn={createTemplate} dFn={deleteTemplate} />}
      {s==='auto'&&<CrudS label="Automations" fields={['name','trigger','action']} gFn={getAutomations} cFn={createAutomation} dFn={deleteAutomation} />}
      {s==='notif'&&<SetS k="notifications" label="Notifications" fs={['dailyDigest','weeklyReport','overdueAlerts','fromName','replyTo']} />}
      {s==='ai'&&<SetS k="ai" label="AI Config" fs={['summariesEnabled','qaEnabled','forecastEnabled','contextLimit','maxReqPerHour']} />}
      {s==='integ'&&<SetS k="integrations" label="Integrations" fs={['whatsappEnabled','instagramEnabled','messengerEnabled','tiktokEnabled','webhookSecret']} />}
      {s==='audit'&&<AuditS />}
    </div></div>;
}

function OrgS() {
  const { user, me } = useAuth(); const [d,setD]=useState<any>(null); const [sv,setSv]=useState(false);
  useEffect(()=>{getOrg().then(o=>setD(o||{}));},[]);
  const save=async()=>{setSv(true);await updateOrg(d);await logAction({action:'updated',resource:'org',detail:'settings',actorId:user!.uid,actorName:me!.displayName});setSv(false);};
  if(!d)return<Sk/>;
  return <div className="p-6 max-w-3xl"><div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">Organization</h2><button onClick={save} disabled={sv} className="px-5 h-9 rounded-xl btn-gold text-sm flex items-center gap-2"><Save className="h-4 w-4"/>{sv?'...':'Save'}</button></div>
    <div className="space-y-4 rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6">
      <I l="Name" v={d.name||''} c={v=>setD({...d,name:v})} /><I l="Slug" v={d.slug||''} c={v=>setD({...d,slug:v})} /><I l="Timezone" v={d.timezone||''} c={v=>setD({...d,timezone:v})} />
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-xs text-gray-500 mb-1">Primary Color</label><div className="flex gap-2"><input type="color" value={d.primaryColor||'#D4A843'} onChange={e=>setD({...d,primaryColor:e.target.value})} className="w-10 h-10 rounded-lg border border-[#1F2937] bg-transparent cursor-pointer"/><input value={d.primaryColor||''} onChange={e=>setD({...d,primaryColor:e.target.value})} className="input-dark flex-1"/></div></div>
        <div><label className="block text-xs text-gray-500 mb-1">Secondary</label><div className="flex gap-2"><input type="color" value={d.secondaryColor||'#0C1017'} onChange={e=>setD({...d,secondaryColor:e.target.value})} className="w-10 h-10 rounded-lg border border-[#1F2937] bg-transparent cursor-pointer"/><input value={d.secondaryColor||''} onChange={e=>setD({...d,secondaryColor:e.target.value})} className="input-dark flex-1"/></div></div>
      </div></div></div>;
}

function UsersS() {
  const { user, me } = useAuth(); const [ms,setMs]=useState<any[]>([]); const [ld,setLd]=useState(true); const [q,setQ]=useState('');
  useEffect(()=>{getMembers().then(m=>{setMs(m);setLd(false);});},[]);
  const cR=async(id:string,r:Role)=>{await updateMember(id,{role:r});await logAction({action:'role_changed',resource:'member',detail:r,actorId:user!.uid,actorName:me!.displayName});setMs(await getMembers());};
  const f=ms.filter(m=>m.displayName?.toLowerCase().includes(q.toLowerCase())||m.email?.toLowerCase().includes(q.toLowerCase()));
  if(ld)return<Sk/>;
  return <div className="p-6 max-w-4xl"><h2 className="text-xl font-bold text-white mb-4">Users ({ms.length})</h2>
    <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." className="input-dark pl-10"/></div>
    <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[#1F2937]/60"><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">User</th><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Role</th><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Status</th></tr></thead>
    <tbody>{f.map(m=><tr key={m.id} className="border-b border-[#1F2937]/30 hover:bg-white/[0.01]"><td className="px-5 py-3"><p className="font-medium text-white">{m.displayName}</p><p className="text-[11px] text-gray-600">{m.email}</p></td><td className="px-5 py-3"><select value={m.role} onChange={e=>cR(m.id,e.target.value as Role)} className="select-dark text-xs h-8">{['owner','admin','manager','member','guest','readonly'].map(r=><option key={r}>{r}</option>)}</select></td><td className="px-5 py-3"><span className={`text-xs ${m.active!==false?'text-emerald-400':'text-gray-600'}`}>{m.active!==false?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div></div>;
}

function PermsS() {
  const { user, me } = useAuth();
  const rs=['workspace','task','doc','channel','automation','admin','user']; const as2=['create','read','update','delete','manage']; const rls:Role[]=['owner','admin','manager','member','guest'];
  const [mx,setMx]=useState<any>({});
  useEffect(()=>{getSettings('permissions').then(d=>{if(d?.matrix)setMx(d.matrix);else{const m:any={};rls.forEach(r=>{m[r]={};rs.forEach(s=>{m[r][s]={};as2.forEach(a=>{m[r][s][a]=r==='owner'||r==='admin'||(r==='manager'&&a!=='manage'&&s!=='admin')||(r==='member'&&(a==='read'||a==='create')&&!['admin','user'].includes(s));})})});setMx(m);}});},[]);
  const t=(r:string,s:string,a:string)=>{if(r==='owner')return;setMx((p:any)=>({...p,[r]:{...p[r],[s]:{...p[r]?.[s],[a]:!p[r]?.[s]?.[a]}}}));};
  const save=async()=>{await saveSettings('permissions',{matrix:mx});await logAction({action:'updated',resource:'permissions',detail:'matrix',actorId:user!.uid,actorName:me!.displayName});alert('Saved!');};
  return <div className="p-6"><div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">Permissions</h2><button onClick={save} className="px-5 h-9 rounded-xl btn-gold text-sm flex items-center gap-2"><Save className="h-4 w-4"/>Save</button></div>
    <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-[#1F2937]/60"><th className="text-left px-3 py-2 text-gray-600">Res</th><th className="text-left px-2 py-2 text-gray-600">Act</th>{rls.map(r=><th key={r} className="text-center px-2 py-2 text-gray-600 capitalize">{r}</th>)}</tr></thead>
    <tbody>{rs.map(s=>as2.map((a,ai)=><tr key={`${s}-${a}`} className={`border-b border-[#1F2937]/20 ${ai===0?'border-t border-t-[#1F2937]/40':''}`}><td className="px-3 py-1">{ai===0?<span className="font-medium text-gray-400 capitalize">{s}</span>:null}</td><td className="px-2 py-1 text-gray-600">{a}</td>{rls.map(r=><td key={r} className="text-center px-2 py-1"><button onClick={()=>t(r,s,a)} disabled={r==='owner'} className={`w-5 h-5 rounded inline-flex items-center justify-center ${mx[r]?.[s]?.[a]?'bg-emerald-500/20 text-emerald-400':'bg-[#1F2937] text-gray-700'} ${r==='owner'?'opacity-40':''}`}>{mx[r]?.[s]?.[a]?<Check className="h-3 w-3"/>:<X className="h-3 w-3"/>}</button></td>)}</tr>))}</tbody></table></div></div>;
}

function AuditS() {
  const [ls,setLs]=useState<any[]>([]); const [ld,setLd]=useState(true); const [q,setQ]=useState('');
  useEffect(()=>{getAuditLogs().then(l=>{setLs(l);setLd(false);});},[]);
  const f=ls.filter(l=>[l.actorName,l.action,l.resource,l.detail].some(v=>v?.toLowerCase?.().includes(q.toLowerCase())));
  if(ld)return<Sk/>;
  return <div className="p-6 max-w-5xl"><h2 className="text-xl font-bold text-white mb-4">Audit Logs</h2>
    <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." className="input-dark pl-10"/></div>
    {!f.length?<p className="text-center py-12 text-gray-700">No logs yet.</p>:
    <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden"><table className="w-full text-sm"><thead><tr className="border-b border-[#1F2937]/60"><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Actor</th><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Action</th><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Resource</th><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Detail</th><th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Time</th></tr></thead>
    <tbody>{f.map(l=><tr key={l.id} className="border-b border-[#1F2937]/30 hover:bg-white/[0.01]"><td className="px-5 py-2.5 text-xs text-[#D4A843]">{l.actorName||'—'}</td><td className="px-5 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${l.action==='deleted'?'bg-red-500/10 text-red-400 border border-red-500/20':l.action==='created'?'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20':'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{l.action}</span></td><td className="px-5 py-2.5 text-xs text-gray-400">{l.resource}</td><td className="px-5 py-2.5 text-xs text-gray-600">{l.detail||'—'}</td><td className="px-5 py-2.5 text-xs text-gray-700">{l.createdAt?.toDate?.()?.toLocaleString?.() || '—'}</td></tr>)}</tbody></table></div>}</div>;
}

// Generic CRUD section
function CrudS({label,fields,gFn,cFn,dFn}:{label:string;fields:string[];gFn:()=>Promise<any[]>;cFn:(d:any)=>Promise<any>;dFn:(id:string)=>Promise<any>}) {
  const { user, me } = useAuth(); const [its,setIts]=useState<any[]>([]); const [ld,setLd]=useState(true); const [sh,setSh]=useState(false); const [fm,setFm]=useState<any>({});
  const load=async()=>{setIts(await gFn());setLd(false);}; useEffect(()=>{load();},[]);
  const add=async()=>{await cFn(fm);await logAction({action:'created',resource:label,detail:fm.name||'',actorId:user!.uid,actorName:me!.displayName});setFm({});setSh(false);load();};
  const del=async(id:string)=>{if(!confirm('Delete?'))return;await dFn(id);load();};
  if(ld)return<Sk/>;
  return <div className="p-6 max-w-4xl"><div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">{label}</h2><button onClick={()=>setSh(!sh)} className="px-5 h-9 rounded-xl btn-gold text-sm flex items-center gap-2"><Plus className="h-4 w-4"/>Add</button></div>
    {sh&&<div className="mb-4 p-5 rounded-2xl border border-[#D4A843]/20 bg-[#111827] space-y-3">{fields.map(f=><input key={f} value={fm[f]||''} onChange={e=>setFm({...fm,[f]:e.target.value})} placeholder={f} className="input-dark"/>)}<div className="flex gap-2"><button onClick={add} className="px-5 h-9 rounded-xl btn-gold text-sm">Create</button><button onClick={()=>setSh(false)} className="px-4 h-9 rounded-xl border border-[#1F2937] text-sm text-gray-400">Cancel</button></div></div>}
    {!its.length?<p className="text-center py-12 text-gray-700">No items yet.</p>:
    <div className="space-y-1.5">{its.map(it=><div key={it.id} className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-[#1F2937]/60 bg-[#111827] card-hover group"><div className="flex-1"><p className="text-sm font-medium text-white">{it.name||it.title||it.id}</p><p className="text-xs text-gray-600">{fields.filter(f=>f!=='name'&&f!=='title').map(f=>`${f}: ${it[f]||'—'}`).join(' · ')}</p></div><button onClick={()=>del(it.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-400 rounded-lg"><Trash2 className="h-4 w-4"/></button></div>)}</div>}</div>;
}

// Settings doc section
function SetS({k,label,fs}:{k:string;label:string;fs:string[]}) {
  const { user, me } = useAuth(); const [d,setD]=useState<any>({}); const [ld,setLd]=useState(true);
  useEffect(()=>{getSettings(k).then(v=>{setD(v||{});setLd(false);});},[k]);
  const save=async()=>{await saveSettings(k,d);await logAction({action:'updated',resource:label,detail:'settings',actorId:user!.uid,actorName:me!.displayName});alert('Saved!');};
  if(ld)return<Sk/>;
  return <div className="p-6 max-w-3xl"><div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-white">{label}</h2><button onClick={save} className="px-5 h-9 rounded-xl btn-gold text-sm flex items-center gap-2"><Save className="h-4 w-4"/>Save</button></div>
    <div className="space-y-4 rounded-2xl border border-[#1F2937]/60 bg-[#111827] p-6">{fs.map(f=>{
      const isBool=f.toLowerCase().includes('enabled')||f.toLowerCase().includes('digest')||f.toLowerCase().includes('report')||f.toLowerCase().includes('alert');
      return <div key={f}><label className="block text-xs font-medium text-gray-500 mb-1.5 capitalize">{f.replace(/([A-Z])/g,' $1')}</label>
        {isBool?<label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!!d[f]} onChange={e=>setD({...d,[f]:e.target.checked})} className="w-4 h-4 rounded bg-[#1F2937] border-[#374151] accent-[#D4A843]"/><span className="text-sm text-gray-300">{d[f]?'Enabled':'Disabled'}</span></label>
        :<input value={d[f]||''} onChange={e=>setD({...d,[f]:e.target.value})} className="input-dark"/>}
      </div>;
    })}</div></div>;
}

// Helpers
function I({l,v,c}:{l:string;v:string;c:(v:string)=>void}) { return <div><label className="block text-xs font-medium text-gray-500 mb-1.5">{l}</label><input value={v} onChange={e=>c(e.target.value)} className="input-dark"/></div>; }
function Sk() { return <div className="p-6 space-y-3">{[1,2,3].map(i=><div key={i} className="h-14 skeleton"/>)}</div>; }
