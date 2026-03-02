'use client';
import { useAuth, Role, Team } from '@/lib/auth';
import { useEffect, useState } from 'react';
import {
  getMembers, updateMember, getAuditLogs, logAction, getOrg, updateOrg,
  getSettings, saveSettings, getWorkspaces, createWorkspace, deleteWorkspace,
  getTemplates, createTemplate, deleteTemplate, getAutomations, createAutomation,
  deleteAutomation, getTeams, createTeam, updateTeam, deleteTeam, ORG,
  createMember, softDeleteMember, reactivateMember,
} from '@/lib/db';
import { createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut } from 'firebase/auth';
import { getSecondaryAuth } from '@/lib/firebase';
import { useToast } from '@/components/notifications/toast-provider';
import {
  Shield, Users, Building2, Columns3, Zap, Bell, Bot, Plug, ScrollText,
  FileStack, LayoutGrid, Plus, Trash2, Save, Search, ChevronRight, Check, X,
  Edit2, Palette, Hash, FolderOpen, UserPlus, AlertTriangle, UserX, RotateCcw
} from 'lucide-react';

type S = 'org'|'users'|'departments'|'perms'|'struct'|'fields'|'tpl'|'auto'|'notif'|'ai'|'integ'|'audit';
const SS: {id:S;l:string;i:any;d:string}[] = [
  {id:'org',l:'Organization',i:Building2,d:'Branding & settings'},
  {id:'users',l:'Users & Teams',i:Users,d:'Members & roles'},
  {id:'departments',l:'Departments',i:FolderOpen,d:'Manage departments'},
  {id:'perms',l:'Permissions',i:Shield,d:'RBAC matrix'},
  {id:'struct',l:'Structure',i:LayoutGrid,d:'Workspaces'},
  {id:'fields',l:'Custom Fields',i:Columns3,d:'Field schemas'},
  {id:'tpl',l:'Templates',i:FileStack,d:'Task templates'},
  {id:'auto',l:'Automations',i:Zap,d:'Rules'},
  {id:'notif',l:'Notifications',i:Bell,d:'Email config'},
  {id:'ai',l:'AI Config',i:Bot,d:'AI features'},
  {id:'integ',l:'Integrations',i:Plug,d:'Webhooks'},
  {id:'audit',l:'Audit Logs',i:ScrollText,d:'Security'},
];

export default function Admin() {
  const { user, me, isAdmin } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<S|null>(null);

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <Shield className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-lg font-bold text-[var(--text-primary)]">Access Denied</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Role: <span className="text-[var(--accent)]">{me?.role}</span></p>
      </div>
    </div>
  );

  if (!s) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Console</h1></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SS.map((x, i) => (
          <button key={x.id} onClick={() => setS(x.id)}
            className="flex items-start gap-4 p-5 rounded-xl bg-[var(--bg-secondary)] shadow-card text-left group anim-slide"
            style={{ animationDelay: `${i * 30}ms` }}>
            <div className={`p-2.5 rounded-xl border text-[var(--accent)] ${x.id === 'departments' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[var(--accent-subtle)] border-[var(--accent)]/20'}`}>
              <x.i className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[var(--text-primary)]">{x.l}</p>
              <p className="text-xs text-[var(--text-muted)]">{x.d}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] mt-1 ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );

  const Nav = () => (
    <aside className="w-48 bg-[var(--bg-base)] shadow-panel shrink-0 p-2 overflow-y-auto">
      <button onClick={() => setS(null)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-1">← Back</button>
      {SS.map(x => (
        <button key={x.id} onClick={() => setS(x.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition ${s === x.id ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
          <x.i className="h-4 w-4" />{x.l}
        </button>
      ))}
    </aside>
  );

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <Nav />
      <div className="flex-1 overflow-y-auto">
        {s === 'org' && <OrgS />}
        {s === 'users' && <UsersS />}
        {s === 'departments' && <DepartmentsS />}
        {s === 'perms' && <PermsS />}
        {s === 'struct' && <CrudS label="Workspaces" fields={['name', 'description']} gFn={getWorkspaces} cFn={createWorkspace} dFn={deleteWorkspace} />}
        {s === 'fields' && <SetS k="customFields" label="Custom Fields" fs={['caseNumber', 'caseValue', 'filingDate', 'caseType', 'courtLocation', 'retainerPaid']} />}
        {s === 'tpl' && <CrudS label="Templates" fields={['name', 'type', 'content']} gFn={getTemplates} cFn={createTemplate} dFn={deleteTemplate} />}
        {s === 'auto' && <CrudS label="Automations" fields={['name', 'trigger', 'action']} gFn={getAutomations} cFn={createAutomation} dFn={deleteAutomation} />}
        {s === 'notif' && <SetS k="notifications" label="Notifications" fs={['dailyDigest', 'weeklyReport', 'overdueAlerts', 'fromName', 'replyTo']} />}
        {s === 'ai' && <SetS k="ai" label="AI Config" fs={['summariesEnabled', 'qaEnabled', 'forecastEnabled', 'contextLimit', 'maxReqPerHour']} />}
        {s === 'integ' && <SetS k="integrations" label="Integrations" fs={['whatsappEnabled', 'instagramEnabled', 'messengerEnabled', 'tiktokEnabled', 'webhookSecret']} />}
        {s === 'audit' && <AuditS />}
      </div>
    </div>
  );
}

// =====================================================
// DEPARTMENTS SECTION — Full CRUD + member assignment
// =====================================================
function DepartmentsS() {
  const { user, me, teams, refreshTeams, refreshMembers } = useAuth();
  const toast = useToast();
  const [depts, setDepts] = useState<Team[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6B7280', icon: '📁', description: '' });
  const [assignDeptId, setAssignDeptId] = useState<string | null>(null);

  const load = async () => {
    const [t, m] = await Promise.all([getTeams(), getMembers()]);
    setDepts(t as Team[]);
    setMembers(m);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ICONS = ['📣', '🚀', '🎯', '👔', '⚖️', '💼', '📁', '📊', '🏢', '⚙️', '💡', '📱', '🎨', '📋', '🔧', '💰', '🤝', '📞', '✉️', '🗂️'];
  const COLORS = ['#8B5CF6', '#3B82F6', '#22C55E', '#D4A843', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4', '#6B7280', '#14B8A6', '#F97316', '#84CC16'];

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createTeam(form);
    await logAction({ action: 'created', resource: 'department', detail: form.name, actorId: user!.uid, actorName: me!.displayName });
    setForm({ name: '', color: '#6B7280', icon: '📁', description: '' });
    setShowNew(false);
    await load();
    await refreshTeams();
  };

  const handleUpdate = async () => {
    if (!editId || !form.name.trim()) return;
    await updateTeam(editId, form);
    await logAction({ action: 'updated', resource: 'department', detail: form.name, actorId: user!.uid, actorName: me!.displayName });
    setEditId(null);
    setForm({ name: '', color: '#6B7280', icon: '📁', description: '' });
    await load();
    await refreshTeams();
  };

  const handleDelete = async (dept: Team) => {
    const membersInDept = members.filter(m => m.teamId === dept.id);
    if (membersInDept.length > 0) {
      toast.warning('No se puede eliminar', `"${dept.name}" tiene ${membersInDept.length} miembro(s) asignados. Reasignalos primero.`);
      return;
    }
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    await deleteTeam(dept.id);
    await logAction({ action: 'deleted', resource: 'department', detail: dept.name, actorId: user!.uid, actorName: me!.displayName });
    await load();
    await refreshTeams();
  };

  const startEdit = (dept: Team) => {
    setEditId(dept.id);
    setForm({ name: dept.name, color: dept.color, icon: dept.icon, description: dept.description });
    setShowNew(false);
  };

  const handleAssignMember = async (memberId: string, deptId: string) => {
    const dept = depts.find(d => d.id === deptId);
    await updateMember(memberId, {
      teamId: deptId,
      teamIds: [deptId],
      department: dept?.name || '',
    });
    await logAction({ action: 'assigned', resource: 'department', detail: `${memberId} → ${dept?.name}`, actorId: user!.uid, actorName: me!.displayName });
    await load();
    await refreshMembers();
  };

  const handleRemoveFromDept = async (memberId: string) => {
    await updateMember(memberId, {
      teamId: '',
      teamIds: [],
      department: '',
    });
    await load();
    await refreshMembers();
  };

  if (loading) return <Sk />;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Departments</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{depts.length} departments · {members.length} members</p>
        </div>
        <button onClick={() => { setShowNew(true); setEditId(null); setForm({ name: '', color: '#6B7280', icon: '📁', description: '' }); }}
          className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Department
        </button>
      </div>

      {/* Create / Edit Form */}
      {(showNew || editId) && (
        <div className="mb-6 p-5 rounded-lg border border-[var(--accent)]/20 bg-[var(--bg-elevated)] space-y-4 anim-fade">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">{editId ? 'Edit Department' : 'New Department'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Department name" className="input-dark" autoFocus />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does this team do?" className="input-dark" />
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Icon</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm({ ...form, icon: ic })}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all duration-200 ${form.icon === ic ? 'bg-[var(--accent-subtle)] shadow-card scale-110' : 'bg-[var(--bg-base)] hover:shadow-card-hover'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Color</label>
            <div className="flex gap-1.5 flex-wrap items-center">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-lg transition border-2 ${form.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-gray-600'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-8 h-8 rounded-lg bg-transparent cursor-pointer" />
                <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="input-dark w-24 h-8 text-xs px-2" />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-base)]">
            <span className="text-lg">{form.icon}</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.color }} />
            <span className="text-sm font-semibold" style={{ color: form.color }}>{form.name || 'Preview'}</span>
            <span className="text-xs text-[var(--text-muted)]">{form.description}</span>
          </div>

          <div className="flex gap-2">
            {editId ? (
              <button onClick={handleUpdate} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">Update</button>
            ) : (
              <button onClick={handleCreate} disabled={!form.name.trim()} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-40">Create</button>
            )}
            <button onClick={() => { setShowNew(false); setEditId(null); }} className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Department Cards */}
      <div className="space-y-4">
        {depts.map((dept, i) => {
          const deptMembers = members.filter(m => m.teamId === dept.id);
          const unassigned = members.filter(m => !m.teamId || m.teamId === '');
          const isAssigning = assignDeptId === dept.id;

          return (
            <div key={dept.id} className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-hidden anim-slide" style={{ animationDelay: `${i * 40}ms` }}>
              {/* Department Header */}
              <div className="flex items-center gap-4 px-5 py-4 group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${dept.color}15`, border: `1px solid ${dept.color}25` }}>
                  {dept.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: dept.color }}>{dept.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${dept.color}15`, color: dept.color, border: `1px solid ${dept.color}25` }}>
                      {deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{dept.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAssignDeptId(isAssigning ? null : dept.id)}
                    className={`p-2 rounded-lg transition ${isAssigning ? 'bg-emerald-500/10 text-emerald-400' : 'text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                    title="Assign members">
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button onClick={() => startEdit(dept)} className="p-2 text-[var(--text-muted)] hover:text-blue-400 rounded-lg transition" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(dept)}
                    className="p-2 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition opacity-0 group-hover:opacity-100"
                    title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Members in this department */}
              {deptMembers.length > 0 && (
                <div className="px-5 pb-3">
                  <div className="flex flex-wrap gap-2 pt-3">
                    {deptMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] group/member">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${dept.color}15`, color: dept.color }}>
                          {m.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">{m.displayName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-elevated)] text-[var(--text-muted)]">{m.role}</span>
                        <button onClick={() => handleRemoveFromDept(m.id)}
                          className="opacity-0 group-hover/member:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-red-400 transition"
                          title="Remove from department">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assign Members Panel */}
              {isAssigning && (
                <div className="px-5 pb-4 border-t border-[var(--accent)]/20 bg-[var(--accent-subtle)]">
                  <p className="text-[10px] text-[var(--accent)] uppercase font-semibold tracking-wider py-3">Assign Members to {dept.name}</p>
                  {unassigned.length === 0 && members.filter(m => m.teamId !== dept.id).length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] pb-2">All members are already assigned to this department.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.filter(m => m.teamId !== dept.id).map(m => (
                        <button key={m.id} onClick={() => handleAssignMember(m.id, dept.id)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-base)] hover:bg-emerald-500/5 hover:shadow-card-hover transition-all duration-200 text-xs text-[var(--text-secondary)] hover:text-gray-200">
                          <div className="w-5 h-5 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)]">
                            {m.displayName?.[0]?.toUpperCase() || '?'}
                          </div>
                          {m.displayName}
                          {m.teamId && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                              {depts.find(d => d.id === m.teamId)?.icon} {depts.find(d => d.id === m.teamId)?.name}
                            </span>
                          )}
                          <Plus className="h-3 w-3 text-emerald-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned Members */}
      {(() => {
        const unassigned = members.filter(m => !m.teamId || m.teamId === '');
        if (unassigned.length === 0) return null;
        return (
          <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 anim-slide" style={{ animationDelay: `${depts.length * 40 + 100}ms` }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">Unassigned Members ({unassigned.length})</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">These members have not been assigned to a department yet.</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)]">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-[10px] font-bold text-amber-400">
                    {m.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{m.displayName}</span>
                  <select
                    onChange={e => { if (e.target.value) handleAssignMember(m.id, e.target.value); }}
                    value=""
                    className="select-dark h-7 text-[10px] px-2 ml-1">
                    <option value="">Assign to...</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// =====================================================
// ORGANIZATION SECTION
// =====================================================
function OrgS() {
  const { user, me } = useAuth();
  const [d, setD] = useState<any>(null);
  const [sv, setSv] = useState(false);

  useEffect(() => { getOrg().then(o => setD(o || {})); }, []);

  const save = async () => {
    setSv(true);
    await updateOrg(d);
    await logAction({ action: 'updated', resource: 'org', detail: 'settings', actorId: user!.uid, actorName: me!.displayName });
    setSv(false);
  };

  if (!d) return <Sk />;
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Organization</h2>
        <button onClick={save} disabled={sv} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-2">
          <Save className="h-4 w-4" />{sv ? '...' : 'Save'}
        </button>
      </div>
      <div className="space-y-4 rounded-xl bg-[var(--bg-secondary)] shadow-card p-6">
        <I l="Name" v={d.name || ''} c={v => setD({ ...d, name: v })} />
        <I l="Slug" v={d.slug || ''} c={v => setD({ ...d, slug: v })} />
        <I l="Timezone" v={d.timezone || ''} c={v => setD({ ...d, timezone: v })} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Primary Color</label>
            <div className="flex gap-2">
              <input type="color" value={d.primaryColor || '#3B82F6'} onChange={e => setD({ ...d, primaryColor: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" />
              <input value={d.primaryColor || ''} onChange={e => setD({ ...d, primaryColor: e.target.value })} className="input-dark flex-1" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Secondary</label>
            <div className="flex gap-2">
              <input type="color" value={d.secondaryColor || '#0C1017'} onChange={e => setD({ ...d, secondaryColor: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" />
              <input value={d.secondaryColor || ''} onChange={e => setD({ ...d, secondaryColor: e.target.value })} className="input-dark flex-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// USERS & TEAMS SECTION
// =====================================================
function UsersS() {
  const { user, me, teams, refreshMembers } = useAuth();
  const toast = useToast();
  const [ms, setMs] = useState<any[]>([]);
  const [ld, setLd] = useState(true);
  const [q, setQ] = useState('');

  // Create user state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [newUser, setNewUser] = useState({ displayName: '', email: '', password: '', role: 'member' as Role, teamId: '' });

  // Delete user state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { getMembers().then(m => { setMs(m); setLd(false); }); }, []);

  const cR = async (id: string, r: Role) => {
    await updateMember(id, { role: r });
    await logAction({ action: 'role_changed', resource: 'member', detail: r, actorId: user!.uid, actorName: me!.displayName });
    setMs(await getMembers());
    await refreshMembers();
  };

  const cT = async (id: string, tid: string) => {
    const team = teams.find(t => t.id === tid);
    await updateMember(id, { teamId: tid, teamIds: tid ? [tid] : [], department: team?.name || '' });
    await logAction({ action: 'dept_changed', resource: 'member', detail: `${team?.name || 'none'}`, actorId: user!.uid, actorName: me!.displayName });
    setMs(await getMembers());
    await refreshMembers();
  };

  const handleCreateUser = async () => {
    if (!newUser.displayName.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      setCreateErr('Nombre, email y contraseña son requeridos.'); return;
    }
    if (newUser.password.length < 6) { setCreateErr('La contraseña debe tener al menos 6 caracteres.'); return; }
    setCreating(true); setCreateErr('');
    try {
      const secondaryAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      await updateProfile(cred.user, { displayName: newUser.displayName });
      await firebaseSignOut(secondaryAuth);
      const team = teams.find(t => t.id === newUser.teamId);
      await createMember(cred.user.uid, {
        displayName: newUser.displayName, email: newUser.email, role: newUser.role,
        teamId: newUser.teamId, department: team?.name || '',
        hierarchyLevel: newUser.role === 'admin' ? 'admin' : newUser.role === 'manager' ? 'manager' : 'member',
      });
      await logAction({ action: 'user_created', resource: 'member', detail: `${newUser.displayName} (${newUser.email}) como ${newUser.role}`, actorId: user!.uid, actorName: me!.displayName });
      setNewUser({ displayName: '', email: '', password: '', role: 'member', teamId: '' });
      setShowCreate(false);
      setMs(await getMembers());
      await refreshMembers();
    } catch (er: any) { setCreateErr(er.message?.replace('Firebase: ', '') || 'Error al crear usuario.'); }
    setCreating(false);
  };

  const handleDeactivate = async (memberId: string) => {
    if (memberId === user!.uid) { toast.warning('Accion no permitida', 'No puedes desactivar tu propia cuenta.'); setDeleteTarget(null); return; }
    const target = ms.find(m => m.id === memberId);
    if (target?.role === 'owner') { toast.warning('Accion no permitida', 'No puedes desactivar al owner de la organizacion.'); setDeleteTarget(null); return; }
    setDeleting(true);
    try {
      await softDeleteMember(memberId);
      await logAction({ action: 'user_deactivated', resource: 'member', detail: `${target?.displayName} (${target?.email})`, actorId: user!.uid, actorName: me!.displayName });
      setDeleteTarget(null);
      setMs(await getMembers());
      await refreshMembers();
    } catch (er: any) { toast.error('Error', er.message || 'Ocurrio un error desconocido.'); }
    setDeleting(false);
  };

  const handleReactivate = async (memberId: string) => {
    await reactivateMember(memberId);
    const target = ms.find(m => m.id === memberId);
    await logAction({ action: 'user_reactivated', resource: 'member', detail: `${target?.displayName} (${target?.email})`, actorId: user!.uid, actorName: me!.displayName });
    setMs(await getMembers());
    await refreshMembers();
  };

  const f = ms.filter(m =>
    m.displayName?.toLowerCase().includes(q.toLowerCase()) ||
    m.email?.toLowerCase().includes(q.toLowerCase()) ||
    m.department?.toLowerCase().includes(q.toLowerCase())
  );

  if (ld) return <Sk />;
  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Users & Teams ({ms.length})</h2>
        <button onClick={() => { setShowCreate(!showCreate); setCreateErr(''); }}
          className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Crear Usuario
        </button>
      </div>

      {/* Create User Form */}
      {showCreate && (
        <div className="mb-4 p-5 rounded-lg border border-[var(--accent)]/20 bg-[var(--bg-elevated)] space-y-4 anim-fade">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Crear Nuevo Usuario</span>
          </div>
          {createErr && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{createErr}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Nombre Completo *</label>
              <input value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} placeholder="Juan Pérez" className="input-dark" autoFocus />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Email *</label>
              <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="juan@ejemplo.com" className="input-dark" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Contraseña *</label>
              <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 caracteres" minLength={6} className="input-dark" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Rol</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })} className="select-dark h-[42px]">
                {(['admin', 'manager', 'member', 'guest', 'readonly'] as Role[]).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">Departamento</label>
              <select value={newUser.teamId} onChange={e => setNewUser({ ...newUser, teamId: e.target.value })} className="select-dark h-[42px]">
                <option value="">Sin Departamento</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateUser} disabled={creating} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm disabled:opacity-50">
              {creating ? 'Creando...' : 'Crear Usuario'}
            </button>
            <button onClick={() => { setShowCreate(false); setCreateErr(''); }} className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">Cancelar</button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, email o departamento..." className="input-dark pl-10" />
      </div>
      <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Usuario</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Rol</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Departamento</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Estado</th>
              <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {f.map(m => {
              const tm = teams.find(t => t.id === m.teamId);
              const isInactive = m.active === false;
              return (
                <tr key={m.id} className={`border-b border-[var(--border-subtle)] hover:bg-white/[0.01] ${isInactive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: tm ? `${tm.color}15` : '#1F2937', color: tm ? tm.color : '#6B7280' }}>
                        {m.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{m.displayName}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select value={m.role} onChange={e => cR(m.id, e.target.value as Role)} className="select-dark text-xs h-8">
                      {['owner', 'admin', 'manager', 'member', 'guest', 'readonly'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <select value={m.teamId || ''} onChange={e => cT(m.id, e.target.value)}
                      className="select-dark text-xs h-8"
                      style={{ borderColor: tm ? `${tm.color}30` : undefined, color: tm ? tm.color : undefined }}>
                      <option value="">Sin Departamento</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${isInactive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {isInactive ? 'Inactivo' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {m.id !== user!.uid && m.role !== 'owner' && (
                      isInactive ? (
                        <button onClick={() => handleReactivate(m.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition"
                          title="Reactivar usuario">
                          <RotateCcw className="h-3 w-3" /> Reactivar
                        </button>
                      ) : deleteTarget === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-red-400">Confirmar?</span>
                          <button onClick={() => handleDeactivate(m.id)} disabled={deleting}
                            className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-semibold hover:bg-red-500/20 transition">
                            {deleting ? '...' : 'Sí'}
                          </button>
                          <button onClick={() => setDeleteTarget(null)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-[10px] hover:bg-[var(--bg-elevated)] transition">
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteTarget(m.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition"
                          title="Desactivar usuario">
                          <UserX className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================
// PERMISSIONS SECTION
// =====================================================
function PermsS() {
  const { user, me } = useAuth();
  const toast = useToast();
  const rs = ['workspace', 'task', 'doc', 'channel', 'automation', 'admin', 'user'];
  const as2 = ['create', 'read', 'update', 'delete', 'manage'];
  const rls: Role[] = ['owner', 'admin', 'manager', 'member', 'guest'];
  const [mx, setMx] = useState<any>({});

  useEffect(() => {
    getSettings('permissions').then((d: any) => {
      if (d?.matrix) setMx(d.matrix);
      else {
        const m: any = {};
        rls.forEach(r => {
          m[r] = {};
          rs.forEach(s => {
            m[r][s] = {};
            as2.forEach(a => {
              m[r][s][a] = r === 'owner' || r === 'admin' || (r === 'manager' && a !== 'manage' && s !== 'admin') || (r === 'member' && (a === 'read' || a === 'create') && !['admin', 'user'].includes(s));
            });
          });
        });
        setMx(m);
      }
    });
  }, []);

  const t = (r: string, s: string, a: string) => {
    if (r === 'owner') return;
    setMx((p: any) => ({ ...p, [r]: { ...p[r], [s]: { ...p[r]?.[s], [a]: !p[r]?.[s]?.[a] } } }));
  };

  const save = async () => {
    await saveSettings('permissions', { matrix: mx });
    await logAction({ action: 'updated', resource: 'permissions', detail: 'matrix', actorId: user!.uid, actorName: me!.displayName });
    toast.success('Guardado', 'Los permisos se guardaron correctamente.');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Permissions</h2>
        <button onClick={save} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-2"><Save className="h-4 w-4" />Save</button>
      </div>
      <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[var(--text-muted)]">Res</th>
              <th className="text-left px-2 py-2 text-[var(--text-muted)]">Act</th>
              {rls.map(r => <th key={r} className="text-center px-2 py-2 text-[var(--text-muted)] capitalize">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {rs.map(s => as2.map((a, ai) => (
              <tr key={`${s}-${a}`} className={`border-b border-[var(--border)]/20 ${ai === 0 ? 'border-t border-t-[#1F2937]/40' : ''}`}>
                <td className="px-3 py-1">{ai === 0 ? <span className="font-medium text-[var(--text-secondary)] capitalize">{s}</span> : null}</td>
                <td className="px-2 py-1 text-[var(--text-muted)]">{a}</td>
                {rls.map(r => (
                  <td key={r} className="text-center px-2 py-1">
                    <button onClick={() => t(r, s, a)} disabled={r === 'owner'}
                      className={`w-5 h-5 rounded inline-flex items-center justify-center ${mx[r]?.[s]?.[a] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'} ${r === 'owner' ? 'opacity-40' : ''}`}>
                      {mx[r]?.[s]?.[a] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </button>
                  </td>
                ))}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================
// AUDIT LOGS SECTION
// =====================================================
function AuditS() {
  const [ls, setLs] = useState<any[]>([]);
  const [ld, setLd] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => { getAuditLogs().then(l => { setLs(l); setLd(false); }); }, []);

  const f = ls.filter(l => [l.actorName, l.action, l.resource, l.detail].some(v => v?.toLowerCase?.().includes(q.toLowerCase())));

  if (ld) return <Sk />;
  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Audit Logs</h2>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="input-dark pl-10" />
      </div>
      {!f.length ? <p className="text-center py-12 text-[var(--text-muted)]">No logs yet.</p> :
        <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Actor</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Action</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Resource</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Detail</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase text-[var(--text-muted)]">Time</th>
              </tr>
            </thead>
            <tbody>
              {f.map(l => (
                <tr key={l.id} className="border-b border-[var(--border-subtle)] hover:bg-white/[0.01]">
                  <td className="px-5 py-2.5 text-xs text-[var(--accent)]">{l.actorName || '—'}</td>
                  <td className="px-5 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${l.action === 'deleted' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : l.action === 'created' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{l.action}</span>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-[var(--text-secondary)]">{l.resource}</td>
                  <td className="px-5 py-2.5 text-xs text-[var(--text-muted)]">{l.detail || '—'}</td>
                  <td className="px-5 py-2.5 text-xs text-[var(--text-muted)]">{l.createdAt?.toDate?.()?.toLocaleString?.() || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}

// =====================================================
// GENERIC CRUD SECTION
// =====================================================
function CrudS({ label, fields, gFn, cFn, dFn }: { label: string; fields: string[]; gFn: () => Promise<any[]>; cFn: (d: any) => Promise<any>; dFn: (id: string) => Promise<any> }) {
  const { user, me } = useAuth();
  const [its, setIts] = useState<any[]>([]);
  const [ld, setLd] = useState(true);
  const [sh, setSh] = useState(false);
  const [fm, setFm] = useState<any>({});

  const load = async () => { setIts(await gFn()); setLd(false); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    await cFn(fm);
    await logAction({ action: 'created', resource: label, detail: fm.name || '', actorId: user!.uid, actorName: me!.displayName });
    setFm({});
    setSh(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete?')) return;
    await dFn(id);
    load();
  };

  if (ld) return <Sk />;
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{label}</h2>
        <button onClick={() => setSh(!sh)} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Add</button>
      </div>
      {sh && (
        <div className="mb-4 p-5 rounded-lg border border-[var(--accent)]/20 bg-[var(--bg-elevated)] space-y-3">
          {fields.map(f => <input key={f} value={fm[f] || ''} onChange={e => setFm({ ...fm, [f]: e.target.value })} placeholder={f} className="input-dark" />)}
          <div className="flex gap-2">
            <button onClick={add} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm">Create</button>
            <button onClick={() => setSh(false)} className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">Cancel</button>
          </div>
        </div>
      )}
      {!its.length ? <p className="text-center py-12 text-[var(--text-muted)]">No items yet.</p> :
        <div className="space-y-1.5">
          {its.map(it => (
            <div key={it.id} className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[var(--bg-secondary)] shadow-card group">
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">{it.name || it.title || it.id}</p>
                <p className="text-xs text-[var(--text-muted)]">{fields.filter(f => f !== 'name' && f !== 'title').map(f => `${f}: ${it[f] || '—'}`).join(' · ')}</p>
              </div>
              <button onClick={() => del(it.id)} className="opacity-0 group-hover:opacity-100 p-2 text-[var(--text-muted)] hover:text-red-400 rounded-lg">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// =====================================================
// SETTINGS SECTION
// =====================================================
function SetS({ k, label, fs }: { k: string; label: string; fs: string[] }) {
  const { user, me } = useAuth();
  const toast = useToast();
  const [d, setD] = useState<any>({});
  const [ld, setLd] = useState(true);

  useEffect(() => { getSettings(k).then(v => { setD(v || {}); setLd(false); }); }, [k]);

  const save = async () => {
    await saveSettings(k, d);
    await logAction({ action: 'updated', resource: label, detail: 'settings', actorId: user!.uid, actorName: me!.displayName });
    toast.success('Guardado', 'Los cambios se guardaron correctamente.');
  };

  if (ld) return <Sk />;
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{label}</h2>
        <button onClick={save} className="px-5 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-sm flex items-center gap-2"><Save className="h-4 w-4" />Save</button>
      </div>
      <div className="space-y-4 rounded-xl bg-[var(--bg-secondary)] shadow-card p-6">
        {fs.map(f => {
          const isBool = f.toLowerCase().includes('enabled') || f.toLowerCase().includes('digest') || f.toLowerCase().includes('report') || f.toLowerCase().includes('alert');
          return (
            <div key={f}>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5 capitalize">{f.replace(/([A-Z])/g, ' $1')}</label>
              {isBool ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!d[f]} onChange={e => setD({ ...d, [f]: e.target.checked })} className="w-4 h-4 rounded bg-[var(--bg-elevated)] border-[var(--border)] accent-[var(--accent)]" />
                  <span className="text-sm text-[var(--text-secondary)]">{d[f] ? 'Enabled' : 'Disabled'}</span>
                </label>
              ) : (
                <input value={d[f] || ''} onChange={e => setD({ ...d, [f]: e.target.value })} className="input-dark" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// HELPERS
// =====================================================
function I({ l, v, c }: { l: string; v: string; c: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{l}</label>
      <input value={v} onChange={e => c(e.target.value)} className="input-dark" />
    </div>
  );
}

function Sk() {
  return (
    <div className="p-6 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-14 skeleton" />)}
    </div>
  );
}