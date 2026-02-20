'use client';
import { useAuth, Team } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getMembers, updateMember, logAction, getTeams } from '@/lib/db';
import {
  Users, ChevronDown, ChevronRight, Edit2, Check, X, Crown, Shield,
  User, Eye, Search, Briefcase, Star, AlertTriangle
} from 'lucide-react';

// ========== TYPES ==========
type HierarchyLevel = 'owner' | 'director' | 'manager' | 'lead' | 'member' | 'guest';

interface OrgMember {
  id: string;
  displayName: string;
  email: string;
  title: string;
  department: string;
  role: string;
  teamId: string;
  managerId: string;
  hierarchyLevel: HierarchyLevel;
  photoURL: string;
  active: boolean;
}

interface OrgNode extends OrgMember {
  children: OrgNode[];
}

const LEVELS: { id: HierarchyLevel; label: string; icon: any; color: string; order: number; description: string }[] = [
  { id: 'owner', label: 'Owner / CEO', icon: Crown, color: '#D4A843', order: 0, description: 'Top-level leadership' },
  { id: 'director', label: 'Director', icon: Star, color: '#A855F7', order: 1, description: 'Department directors' },
  { id: 'manager', label: 'Manager', icon: Shield, color: '#3B82F6', order: 2, description: 'Team managers' },
  { id: 'lead', label: 'Team Lead', icon: Briefcase, color: '#22C55E', order: 3, description: 'Team leads & supervisors' },
  { id: 'member', label: 'Member', icon: User, color: '#64748B', order: 4, description: 'Team members' },
  { id: 'guest', label: 'Guest', icon: Eye, color: '#475569', order: 5, description: 'External guests' },
];

const getLevelConfig = (level: HierarchyLevel) => LEVELS.find(l => l.id === level) || LEVELS[4];

function inferLevel(role: string): HierarchyLevel {
  switch (role) {
    case 'owner': return 'owner';
    case 'admin': return 'director';
    case 'manager': return 'manager';
    case 'guest': return 'guest';
    default: return 'member';
  }
}

// ========== MAIN PAGE ==========
export default function OrgChartPage() {
  const { user, me, isAdmin, teams } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'tree' | 'department' | 'list'>('tree');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: '', department: '', managerId: '', hierarchyLevel: 'member' as HierarchyLevel, teamId: '' });

  const canEdit = me?.role === 'owner' || me?.role === 'admin' || me?.role === 'manager';

  const load = useCallback(async () => {
    const [m, t] = await Promise.all([getMembers(), getTeams()]);
    const processed = (m as any[]).map(mem => ({
      ...mem,
      hierarchyLevel: mem.hierarchyLevel || inferLevel(mem.role),
    })) as OrgMember[];
    setMembers(processed);
    setAllTeams(t as Team[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build tree from manager relationships
  const buildTree = (list: OrgMember[]): OrgNode[] => {
    const map = new Map<string, OrgNode>();
    list.forEach(m => map.set(m.id, { ...m, children: [] }));
    const roots: OrgNode[] = [];
    map.forEach(node => {
      if (node.managerId && map.has(node.managerId)) {
        map.get(node.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const sortNodes = (nodes: OrgNode[]) => {
      nodes.sort((a, b) => {
        const diff = getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order;
        return diff !== 0 ? diff : (a.displayName || '').localeCompare(b.displayName || '');
      });
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  };

  // Filter
  let filtered = members.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      if (!m.displayName?.toLowerCase().includes(q) && !m.email?.toLowerCase().includes(q) && !m.title?.toLowerCase().includes(q)) return false;
    }
    if (filterDept !== 'all' && m.teamId !== filterDept) return false;
    if (filterLevel !== 'all' && m.hierarchyLevel !== filterLevel) return false;
    return true;
  });

  const tree = buildTree(filtered);

  const byDepartment = allTeams.map(t => ({
    team: t,
    members: filtered.filter(m => m.teamId === t.id).sort((a, b) => getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order),
  })).filter(g => g.members.length > 0);

  const unassigned = filtered.filter(m => !m.teamId || m.teamId === '');

  // Actions
  const saveEdit = async (id: string) => {
    const team = allTeams.find(t => t.id === editData.teamId);
    await updateMember(id, {
      title: editData.title,
      department: team?.name || editData.department,
      managerId: editData.managerId,
      hierarchyLevel: editData.hierarchyLevel,
      teamId: editData.teamId,
      teamIds: editData.teamId ? [editData.teamId] : [],
    });
    await logAction({ action: 'updated', resource: 'org-chart', detail: `${editData.title} / ${editData.hierarchyLevel}`, actorId: user!.uid, actorName: me!.displayName });
    setEditId(null);
    load();
  };

  const startEdit = (m: OrgMember) => {
    setEditId(m.id);
    setEditData({ title: m.title || '', department: m.department || '', managerId: m.managerId || '', hierarchyLevel: m.hierarchyLevel || 'member', teamId: m.teamId || '' });
  };

  const quickAssignManager = async (memberId: string, managerId: string) => {
    await updateMember(memberId, { managerId });
    await logAction({ action: 'updated', resource: 'org-chart', detail: `manager changed`, actorId: user!.uid, actorName: me!.displayName });
    load();
  };

  const quickAssignLevel = async (memberId: string, level: HierarchyLevel) => {
    await updateMember(memberId, { hierarchyLevel: level });
    load();
  };

  const quickAssignDept = async (memberId: string, teamId: string) => {
    const team = allTeams.find(t => t.id === teamId);
    await updateMember(memberId, { teamId, teamIds: teamId ? [teamId] : [], department: team?.name || '' });
    load();
  };

  // Stats
  const levelCounts = LEVELS.map(l => ({ ...l, count: members.filter(m => m.hierarchyLevel === l.id).length }));
  const totalWithManager = members.filter(m => m.managerId).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 anim-slide">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Organization Chart
              {canEdit && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">EDIT MODE</span>}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{members.length} members · {allTeams.length} departments · {totalWithManager} with managers</p>
          </div>
        </div>
      </div>

      {/* Level legend */}
      <div className="flex items-center gap-2 flex-wrap mb-4 anim-slide" style={{ animationDelay: '40ms' }}>
        {levelCounts.filter(l => l.count > 0).map(l => (
          <div key={l.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium" style={{ backgroundColor: `${l.color}10`, borderColor: `${l.color}20`, color: l.color }}>
            <l.icon className="h-3 w-3" />
            {l.label} <span className="opacity-60">({l.count})</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5 anim-slide" style={{ animationDelay: '80ms' }}>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." className="input-dark pl-10 h-9 text-sm" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="select-dark h-9 text-xs">
          <option value="all">All Departments</option>
          {allTeams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="select-dark h-9 text-xs">
          <option value="all">All Levels</option>
          {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <div className="flex rounded-xl border border-[#1F2937]/60 overflow-hidden">
          {([
            { id: 'tree' as const, label: '🌳 Tree' },
            { id: 'department' as const, label: '🏢 Depts' },
            { id: 'list' as const, label: '📋 List' },
          ]).map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-3 py-1.5 text-[11px] font-medium transition ${view === v.id ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-gray-600 hover:text-gray-400'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : members.length === 0 ? (
        <div className="text-center py-20"><Users className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-600">No members yet.</p></div>
      ) : (
        <>
          {/* TREE VIEW */}
          {view === 'tree' && (
            <div className="space-y-1">
              {tree.length === 0 && <p className="text-center py-10 text-gray-700 text-sm">No matching members</p>}
              {tree.map(n => (
                <TreeNode key={n.id} node={n} depth={0} members={members} teams={allTeams}
                  editId={editId} editData={editData} setEditData={setEditData}
                  canEdit={!!canEdit} onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditId(null)}
                  onQuickManager={quickAssignManager} onQuickLevel={quickAssignLevel} onQuickDept={quickAssignDept}
                />
              ))}
            </div>
          )}

          {/* DEPARTMENT VIEW */}
          {view === 'department' && (
            <div className="space-y-6">
              {byDepartment.map((group, gi) => (
                <DeptGroup key={group.team.id} team={group.team} deptMembers={group.members} allMembers={members} teams={allTeams} index={gi}
                  editId={editId} editData={editData} setEditData={setEditData}
                  canEdit={!!canEdit} onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditId(null)}
                  onQuickManager={quickAssignManager} onQuickLevel={quickAssignLevel} onQuickDept={quickAssignDept}
                />
              ))}
              {unassigned.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5 anim-slide">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">Unassigned ({unassigned.length})</span>
                  </div>
                  <div className="space-y-1">
                    {unassigned.map(m => (
                      <MemberRow key={m.id} member={m} members={members} teams={allTeams}
                        editId={editId} editData={editData} setEditData={setEditData}
                        canEdit={!!canEdit} onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditId(null)}
                        onQuickManager={quickAssignManager} onQuickLevel={quickAssignLevel} onQuickDept={quickAssignDept}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1F2937]/60">
                    <th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Name</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Title</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Level</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Dept</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600">Reports To</th>
                    {canEdit && <th className="text-left px-5 py-3 text-[10px] uppercase text-gray-600 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.sort((a, b) => getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order).map(m => {
                    const lv = getLevelConfig(m.hierarchyLevel);
                    const mgr = members.find(x => x.id === m.managerId);
                    const team = allTeams.find(t => t.id === m.teamId);
                    return (
                      <tr key={m.id} className="border-b border-[#1F2937]/30 hover:bg-white/[0.01]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${lv.color}15`, color: lv.color }}>
                              {m.displayName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-white text-xs">{m.displayName}</p>
                              <p className="text-[10px] text-gray-600">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400">{m.title || '—'}</td>
                        <td className="px-5 py-3">
                          {canEdit ? (
                            <select value={m.hierarchyLevel} onChange={e => quickAssignLevel(m.id, e.target.value as HierarchyLevel)}
                              className="select-dark h-7 text-[10px] px-2" style={{ borderColor: `${lv.color}30`, color: lv.color }}>
                              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                            </select>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${lv.color}15`, color: lv.color }}>{lv.label}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {canEdit ? (
                            <select value={m.teamId || ''} onChange={e => quickAssignDept(m.id, e.target.value)}
                              className="select-dark h-7 text-[10px] px-2" style={team ? { borderColor: `${team.color}30`, color: team.color } : {}}>
                              <option value="">None</option>
                              {allTeams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                            </select>
                          ) : (
                            team ? <span className="text-[10px] font-medium" style={{ color: team.color }}>{team.icon} {team.name}</span> : <span className="text-gray-700 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {canEdit ? (
                            <select value={m.managerId || ''} onChange={e => quickAssignManager(m.id, e.target.value)}
                              className="select-dark h-7 text-[10px] px-2">
                              <option value="">None (Top)</option>
                              {members.filter(x => x.id !== m.id).map(x => <option key={x.id} value={x.id}>{x.displayName}</option>)}
                            </select>
                          ) : (
                            mgr ? <span className="text-xs text-gray-400">{mgr.displayName}</span> : <span className="text-gray-700 text-xs">—</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-5 py-3">
                            <button onClick={() => startEdit(m)} className="p-1.5 text-gray-600 hover:text-blue-400 rounded-lg"><Edit2 className="h-3.5 w-3.5" /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ========== TREE NODE ==========
function TreeNode({ node, depth, members, teams, editId, editData, setEditData, canEdit, onStartEdit, onSaveEdit, onCancelEdit, onQuickManager, onQuickLevel, onQuickDept }: {
  node: OrgNode; depth: number; members: OrgMember[]; teams: Team[];
  editId: string | null; editData: any; setEditData: (d: any) => void;
  canEdit: boolean; onStartEdit: (m: OrgMember) => void; onSaveEdit: (id: string) => void; onCancelEdit: () => void;
  onQuickManager: (id: string, mgr: string) => void; onQuickLevel: (id: string, level: HierarchyLevel) => void; onQuickDept: (id: string, teamId: string) => void;
}) {
  const [open, setOpen] = useState(depth < 3);
  const hasKids = node.children.length > 0;

  return (
    <div>
      <div style={{ marginLeft: depth * 28 }}>
        {/* Connector line */}
        {depth > 0 && (
          <div className="relative">
            <div className="absolute -left-5 top-1/2 w-4 h-px bg-[#1F2937]" />
            <div className="absolute -left-5 -top-2 w-px h-[calc(50%+8px)] bg-[#1F2937]" />
          </div>
        )}
        <MemberRow member={node} members={members} teams={teams}
          hasChildren={hasKids} isOpen={open} onToggle={() => setOpen(!open)}
          editId={editId} editData={editData} setEditData={setEditData}
          canEdit={canEdit} onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
          onQuickManager={onQuickManager} onQuickLevel={onQuickLevel} onQuickDept={onQuickDept}
        />
      </div>
      {open && hasKids && node.children.map(c => (
        <TreeNode key={c.id} node={c} depth={depth + 1} members={members} teams={teams}
          editId={editId} editData={editData} setEditData={setEditData}
          canEdit={canEdit} onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
          onQuickManager={onQuickManager} onQuickLevel={onQuickLevel} onQuickDept={onQuickDept}
        />
      ))}
    </div>
  );
}

// ========== DEPARTMENT GROUP ==========
function DeptGroup({ team, deptMembers, allMembers, teams, index, editId, editData, setEditData, canEdit, onStartEdit, onSaveEdit, onCancelEdit, onQuickManager, onQuickLevel, onQuickDept }: {
  team: Team; deptMembers: OrgMember[]; allMembers: OrgMember[]; teams: Team[]; index: number;
  editId: string | null; editData: any; setEditData: (d: any) => void;
  canEdit: boolean; onStartEdit: (m: OrgMember) => void; onSaveEdit: (id: string) => void; onCancelEdit: () => void;
  onQuickManager: (id: string, mgr: string) => void; onQuickLevel: (id: string, level: HierarchyLevel) => void; onQuickDept: (id: string, teamId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const levelGroups = LEVELS.map(l => ({
    level: l,
    members: deptMembers.filter(m => m.hierarchyLevel === l.id),
  })).filter(g => g.members.length > 0);

  return (
    <div className="rounded-2xl border border-[#1F2937]/60 bg-[#111827] overflow-hidden anim-slide" style={{ animationDelay: `${index * 60}ms` }}>
      {/* Department Header */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.01] transition">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${team.color}15`, border: `1px solid ${team.color}25` }}>
          {team.icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold" style={{ color: team.color }}>{team.name}</p>
          <p className="text-[11px] text-gray-600">{deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}{team.description ? ` · ${team.description}` : ''}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {levelGroups.map(g => (
            <span key={g.level.id} className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${g.level.color}15`, color: g.level.color }}>
              {g.members.length} {g.level.label}
            </span>
          ))}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-[#1F2937]/40 px-3 pb-3">
          {levelGroups.map(g => (
            <div key={g.level.id} className="mt-3">
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <g.level.icon className="h-3 w-3" style={{ color: g.level.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: g.level.color }}>{g.level.label}s</span>
                <div className="flex-1 h-px" style={{ backgroundColor: `${g.level.color}15` }} />
              </div>
              <div className="space-y-0.5">
                {g.members.map(m => (
                  <MemberRow key={m.id} member={m} members={allMembers} teams={teams}
                    editId={editId} editData={editData} setEditData={setEditData}
                    canEdit={canEdit} onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
                    onQuickManager={onQuickManager} onQuickLevel={onQuickLevel} onQuickDept={onQuickDept}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== MEMBER ROW ==========
function MemberRow({ member, members, teams, hasChildren, isOpen, onToggle, editId, editData, setEditData, canEdit, onStartEdit, onSaveEdit, onCancelEdit, onQuickManager, onQuickLevel, onQuickDept }: {
  member: OrgMember; members: OrgMember[]; teams: Team[];
  hasChildren?: boolean; isOpen?: boolean; onToggle?: () => void;
  editId: string | null; editData: any; setEditData: (d: any) => void;
  canEdit: boolean; onStartEdit: (m: OrgMember) => void; onSaveEdit: (id: string) => void; onCancelEdit: () => void;
  onQuickManager: (id: string, mgr: string) => void; onQuickLevel: (id: string, level: HierarchyLevel) => void;
  onQuickDept?: (id: string, teamId: string) => void;
}) {
  const lv = getLevelConfig(member.hierarchyLevel);
  const team = teams.find(t => t.id === member.teamId);
  const manager = members.find(m => m.id === member.managerId);
  const directReports = members.filter(m => m.managerId === member.id).length;
  const isEditing = editId === member.id;

  // EDIT MODE
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[#D4A843]/[0.03] border border-[#D4A843]/15 flex-wrap anim-fade">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: `${lv.color}10`, color: lv.color }}>
          {member.displayName?.[0]?.toUpperCase() || '?'}
        </div>
        <span className="text-sm font-semibold text-white shrink-0 mr-1">{member.displayName}</span>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} placeholder="Job title..." className="input-dark h-8 text-xs w-32 px-2" />

          <select value={editData.hierarchyLevel} onChange={e => setEditData({ ...editData, hierarchyLevel: e.target.value })} className="select-dark h-8 text-[10px] px-2 w-28">
            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>

          <select value={editData.teamId} onChange={e => setEditData({ ...editData, teamId: e.target.value })} className="select-dark h-8 text-[10px] px-2 w-32">
            <option value="">No Dept</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>

          <select value={editData.managerId} onChange={e => setEditData({ ...editData, managerId: e.target.value })} className="select-dark h-8 text-[10px] px-2 w-36">
            <option value="">No Manager (Top)</option>
            {members.filter(m => m.id !== member.id).map(m => {
              const ml = getLevelConfig(m.hierarchyLevel);
              return <option key={m.id} value={m.id}>{m.displayName} ({ml.label})</option>;
            })}
          </select>
        </div>

        <button onClick={() => onSaveEdit(member.id)} className="h-8 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1 hover:bg-emerald-500/30 transition shrink-0">
          <Check className="h-3 w-3" /> Save
        </button>
        <button onClick={onCancelEdit} className="h-8 px-3 rounded-lg bg-[#1F2937] text-gray-400 text-xs hover:bg-[#2a3444] transition shrink-0">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // NORMAL MODE
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl card-hover group">
      {/* Expand/collapse toggle */}
      {onToggle ? (
        <button onClick={onToggle} className="w-5 shrink-0 flex items-center justify-center">
          {hasChildren
            ? (isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />)
            : <div className="w-1.5 h-1.5 rounded-full bg-[#1F2937]" />
          }
        </button>
      ) : (
        <div className="w-5 shrink-0" />
      )}

      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border" style={{ backgroundColor: `${lv.color}10`, borderColor: `${lv.color}20`, color: lv.color }}>
        {member.displayName?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{member.displayName}</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold border shrink-0 inline-flex items-center gap-0.5" style={{ backgroundColor: `${lv.color}10`, borderColor: `${lv.color}20`, color: lv.color }}>
            <lv.icon className="h-2.5 w-2.5" />{lv.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-[11px] text-gray-500 truncate">{member.title || 'No title'}</p>
          {team && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0" style={{ backgroundColor: `${team.color}10`, color: team.color }}>
              {team.icon} {team.name}
            </span>
          )}
          {manager && <span className="text-[9px] text-gray-600 shrink-0">→ {manager.displayName}</span>}
        </div>
      </div>

      {/* Stats */}
      {directReports > 0 && (
        <span className="text-[9px] px-2 py-1 rounded-full bg-[#1F2937] text-gray-500 shrink-0 flex items-center gap-1">
          <Users className="h-2.5 w-2.5" /> {directReports} report{directReports !== 1 ? 's' : ''}
        </span>
      )}

      {/* Quick actions (admin only) */}
      {canEdit && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
          {/* Quick level change */}
          <select value={member.hierarchyLevel}
            onChange={e => { e.stopPropagation(); onQuickLevel(member.id, e.target.value as HierarchyLevel); }}
            onClick={e => e.stopPropagation()}
            className="select-dark h-7 text-[9px] px-1 w-20 opacity-60 hover:opacity-100"
            title="Change level">
            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          {/* Quick manager change */}
          <select value={member.managerId || ''}
            onChange={e => { e.stopPropagation(); onQuickManager(member.id, e.target.value); }}
            onClick={e => e.stopPropagation()}
            className="select-dark h-7 text-[9px] px-1 w-24 opacity-60 hover:opacity-100"
            title="Change manager">
            <option value="">No Mgr</option>
            {members.filter(m => m.id !== member.id).map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
          </select>
          {/* Full edit */}
          <button onClick={e => { e.stopPropagation(); onStartEdit(member); }} className="p-1.5 text-gray-600 hover:text-blue-400 rounded-lg transition" title="Full edit">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}