'use client';
import { useAuth, Team } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getMembers, updateMember, logAction, getTeams } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronDown, Crown, Shield, User, Eye, Briefcase, Star,
  AlertTriangle, Edit2, Check, X, Network, Building2,
} from 'lucide-react';

type HierarchyLevel = 'owner' | 'director' | 'manager' | 'lead' | 'member' | 'guest';

interface OrgMember {
  id: string; displayName: string; email: string; title: string; department: string;
  role: string; teamId: string; managerId: string; hierarchyLevel: HierarchyLevel;
  photoURL: string; active: boolean;
}

interface OrgNode extends OrgMember { children: OrgNode[]; }

const LEVELS: { id: HierarchyLevel; label: string; icon: any; color: string; order: number }[] = [
  { id: 'owner', label: 'CEO', icon: Crown, color: '#D4A843', order: 0 },
  { id: 'director', label: 'Director', icon: Star, color: '#A855F7', order: 1 },
  { id: 'manager', label: 'Manager', icon: Shield, color: '#3B82F6', order: 2 },
  { id: 'lead', label: 'Lead', icon: Briefcase, color: '#22C55E', order: 3 },
  { id: 'member', label: 'Member', icon: User, color: '#64748B', order: 4 },
  { id: 'guest', label: 'Guest', icon: Eye, color: '#475569', order: 5 },
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

// =======================================
// MAIN PAGE
// =======================================
export default function OrgChartPage() {
  const { user, me, teams, isAdmin } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'department' | 'tree'>('department');
  const [editMember, setEditMember] = useState<OrgMember | null>(null);
  const [editData, setEditData] = useState({ title: '', hierarchyLevel: 'member' as HierarchyLevel, teamId: '', managerId: '' });

  const canEdit = isAdmin;

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

  const tree = buildTree(members);

  const byDepartment = allTeams.map(t => ({
    team: t,
    members: members.filter(m => m.teamId === t.id).sort((a, b) => getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order),
  })).filter(g => g.members.length > 0);

  const unassigned = members.filter(m => !m.teamId || m.teamId === '');

  const openEdit = (m: OrgMember) => {
    if (!canEdit) return;
    setEditMember(m);
    setEditData({ title: m.title || '', hierarchyLevel: m.hierarchyLevel || 'member', teamId: m.teamId || '', managerId: m.managerId || '' });
  };

  const saveEdit = async () => {
    if (!editMember) return;
    const team = allTeams.find(t => t.id === editData.teamId);
    await updateMember(editMember.id, {
      title: editData.title, department: team?.name || '',
      managerId: editData.managerId, hierarchyLevel: editData.hierarchyLevel,
      teamId: editData.teamId, teamIds: editData.teamId ? [editData.teamId] : [],
    });
    await logAction({ action: 'updated', resource: 'org-chart', detail: `${editMember.displayName} → ${editData.title} / ${editData.hierarchyLevel}`, actorId: user!.uid, actorName: me!.displayName });
    setEditMember(null);
    load();
  };

  if (loading) return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            Organization
            {canEdit && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20 font-bold tracking-wider">ADMIN</span>}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{members.length} members across {allTeams.length} departments</p>
        </div>
        <div className="flex items-center rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { id: 'department' as const, label: 'Departments', icon: Building2 },
            { id: 'tree' as const, label: 'Tree', icon: Network },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${view === v.id ? 'text-[#D4A843]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              {view === v.id && <motion.div layoutId="org-view" className="absolute inset-0 rounded-lg" style={{ background: 'rgba(212,168,67,0.08)', boxShadow: '0 0 20px rgba(212,168,67,0.05)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              <span className="relative flex items-center gap-1.5"><v.icon className="h-3.5 w-3.5" />{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-10 w-10 text-[var(--text-muted)]/30 mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">No members yet.</p>
        </div>
      ) : (
        <>
          {/* DEPARTMENT VIEW */}
          {view === 'department' && (
            <div className="space-y-5">
              {byDepartment.map((group, gi) => (
                <DeptCard key={group.team.id} team={group.team} deptMembers={group.members} allMembers={members}
                  index={gi} canEdit={canEdit} onEdit={openEdit} />
              ))}
              {unassigned.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: byDepartment.length * 0.08 }}
                  className="rounded-2xl p-5 backdrop-blur-xl"
                  style={{
                    background: 'rgba(245, 158, 11, 0.03)',
                    border: '1px solid rgba(245, 158, 11, 0.12)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                  }}>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">Unassigned</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{unassigned.length} members need a department</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {unassigned.map((m, i) => (
                      <MemberCard key={m.id} member={m} index={i} canEdit={canEdit} onEdit={openEdit} />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* TREE VIEW */}
          {view === 'tree' && (
            <div className="overflow-x-auto pb-10">
              <div className="flex flex-col items-center min-w-fit">
                {tree.map((root, i) => (
                  <TreeNode key={root.id} node={root} members={members} teams={allTeams}
                    canEdit={canEdit} onEdit={openEdit} isRoot index={i} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editMember && (
          <EditModal member={editMember} editData={editData} setEditData={setEditData}
            teams={allTeams} members={members} onSave={saveEdit} onClose={() => setEditMember(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =======================================
// DEPARTMENT CARD
// =======================================
function DeptCard({ team, deptMembers, allMembers, index, canEdit, onEdit }: {
  team: Team; deptMembers: OrgMember[]; allMembers: OrgMember[]; index: number;
  canEdit: boolean; onEdit: (m: OrgMember) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="rounded-2xl overflow-hidden backdrop-blur-xl"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Gradient accent */}
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${team.color}, ${team.color}40, transparent)` }} />

      {/* Header */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-6 py-5 transition-all hover:bg-white/[0.01]">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 backdrop-blur-sm"
          style={{
            background: `linear-gradient(135deg, ${team.color}15, ${team.color}05)`,
            border: `1px solid ${team.color}20`,
            boxShadow: `0 4px 16px ${team.color}10`,
          }}>
          {team.icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-lg font-bold" style={{ color: team.color }}>{team.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}{team.description ? ` · ${team.description}` : ''}
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        </motion.div>
      </button>

      {/* Members */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {deptMembers.map((m, i) => (
                  <MemberCard key={m.id} member={m} teamColor={team.color} index={i} canEdit={canEdit} onEdit={onEdit} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =======================================
// MEMBER CARD (glassmorphic)
// =======================================
function MemberCard({ member, teamColor, index = 0, canEdit, onEdit }: {
  member: OrgMember; teamColor?: string; index?: number;
  canEdit: boolean; onEdit: (m: OrgMember) => void;
}) {
  const lv = getLevelConfig(member.hierarchyLevel);
  const color = teamColor || lv.color;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      whileHover={canEdit ? { scale: 1.03, y: -2 } : { scale: 1.01 }}
      onClick={() => canEdit && onEdit(member)}
      className={`relative rounded-xl p-3.5 backdrop-blur-xl group transition-all ${canEdit ? 'cursor-pointer' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.1), 0 0 20px ${color}08`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03)';
      }}
    >
      {/* Edit icon */}
      {canEdit && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit2 className="h-3 w-3 text-[var(--text-muted)]" />
        </div>
      )}

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2.5 mx-auto"
        style={{
          background: `linear-gradient(135deg, ${lv.color}30, ${lv.color}10)`,
          color: lv.color,
          boxShadow: `0 4px 12px ${lv.color}15`,
        }}>
        {member.displayName?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Info */}
      <div className="text-center">
        <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{member.displayName}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{member.title || 'No title'}</p>
        <div className="flex items-center justify-center gap-1 mt-2">
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5"
            style={{ background: `${lv.color}12`, color: lv.color }}>
            <lv.icon className="h-2 w-2" />{lv.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =======================================
// TREE VIEW - Vertical org tree
// =======================================
function TreeNode({ node, members, teams, canEdit, onEdit, isRoot = false, index = 0 }: {
  node: OrgNode; members: OrgMember[]; teams: Team[];
  canEdit: boolean; onEdit: (m: OrgMember) => void;
  isRoot?: boolean; index?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasKids = node.children.length > 0;
  const lv = getLevelConfig(node.hierarchyLevel);
  const team = teams.find(t => t.id === node.teamId);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex flex-col items-center"
    >
      {/* Node card */}
      <motion.div
        whileHover={canEdit ? { scale: 1.04, y: -2 } : { scale: 1.02 }}
        onClick={() => canEdit && onEdit(node)}
        className={`relative rounded-xl px-5 py-3.5 backdrop-blur-xl text-center min-w-[160px] max-w-[200px] group ${canEdit ? 'cursor-pointer' : ''}`}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${lv.color}15`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px ${lv.color}08`,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${lv.color}35`;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px rgba(0,0,0,0.12), 0 0 24px ${lv.color}10`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${lv.color}15`;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px ${lv.color}08`;
        }}
      >
        {canEdit && (
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 className="h-2.5 w-2.5 text-[var(--text-muted)]" />
          </div>
        )}
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2"
          style={{
            background: `linear-gradient(135deg, ${lv.color}30, ${lv.color}10)`,
            color: lv.color,
            boxShadow: `0 4px 14px ${lv.color}20`,
          }}>
          {node.displayName?.[0]?.toUpperCase() || '?'}
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{node.displayName}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate">{node.title || 'No title'}</p>
        <div className="flex items-center justify-center gap-1 mt-1.5 flex-wrap">
          <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5"
            style={{ background: `${lv.color}12`, color: lv.color }}>
            <lv.icon className="h-2 w-2" />{lv.label}
          </span>
          {team && (
            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `${team.color}10`, color: team.color }}>
              {team.icon}
            </span>
          )}
        </div>

        {/* Expand toggle */}
        {hasKids && (
          <button onClick={e => { e.stopPropagation(); setOpen(!open); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all"
            style={{
              background: 'var(--bg-base)',
              border: `1.5px solid ${lv.color}30`,
              boxShadow: `0 2px 8px rgba(0,0,0,0.1)`,
            }}>
            <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3 w-3" style={{ color: lv.color }} />
            </motion.div>
          </button>
        )}
      </motion.div>

      {/* Connector lines + children */}
      <AnimatePresence>
        {open && hasKids && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center overflow-visible"
          >
            {/* Vertical line down from parent */}
            <div className="w-px h-8" style={{ background: `linear-gradient(to bottom, ${lv.color}30, ${lv.color}15)` }} />

            {/* Children container */}
            {node.children.length === 1 ? (
              <TreeNode node={node.children[0]} members={members} teams={teams}
                canEdit={canEdit} onEdit={onEdit} index={0} />
            ) : (
              <div className="relative flex items-start gap-4">
                {/* Horizontal connector line */}
                <div className="absolute top-0 h-px"
                  style={{
                    left: `calc(${100 / (node.children.length * 2)}% - 0px)`,
                    right: `calc(${100 / (node.children.length * 2)}% - 0px)`,
                    background: `linear-gradient(90deg, transparent, ${lv.color}20, ${lv.color}20, transparent)`,
                  }} />

                {node.children.map((child, ci) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical line from horizontal to child */}
                    <div className="w-px h-6" style={{ background: `${lv.color}20` }} />
                    <TreeNode node={child} members={members} teams={teams}
                      canEdit={canEdit} onEdit={onEdit} index={ci} />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =======================================
// EDIT MODAL
// =======================================
function EditModal({ member, editData, setEditData, teams, members, onSave, onClose }: {
  member: OrgMember;
  editData: { title: string; hierarchyLevel: HierarchyLevel; teamId: string; managerId: string };
  setEditData: (d: any) => void;
  teams: Team[]; members: OrgMember[];
  onSave: () => void; onClose: () => void;
}) {
  const lv = getLevelConfig(member.hierarchyLevel);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl backdrop-blur-xl overflow-hidden"
        style={{
          background: 'rgba(var(--bg-card-rgb, 15,18,25), 0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
              style={{
                background: `linear-gradient(135deg, ${lv.color}30, ${lv.color}10)`,
                color: lv.color,
                boxShadow: `0 4px 14px ${lv.color}20`,
              }}>
              {member.displayName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">{member.displayName}</p>
              <p className="text-xs text-[var(--text-muted)]">{member.email}</p>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Job Title</label>
            <input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })}
              placeholder="e.g. Marketing Manager"
              className="input-dark" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Level</label>
              <select value={editData.hierarchyLevel} onChange={e => setEditData({ ...editData, hierarchyLevel: e.target.value })}
                className="select-dark h-[42px]">
                {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Department</label>
              <select value={editData.teamId} onChange={e => setEditData({ ...editData, teamId: e.target.value })}
                className="select-dark h-[42px]">
                <option value="">None</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Reports To</label>
            <select value={editData.managerId} onChange={e => setEditData({ ...editData, managerId: e.target.value })}
              className="select-dark h-[42px]">
              <option value="">No Manager (Top Level)</option>
              {members.filter(m => m.id !== member.id).map(m => {
                const ml = getLevelConfig(m.hierarchyLevel);
                return <option key={m.id} value={m.id}>{m.displayName} ({ml.label})</option>;
              })}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onSave}
              className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, #D4A843, #9A7B2F)',
                color: '#06080F',
                boxShadow: '0 4px 14px rgba(212,168,67,0.25)',
              }}>
              <Check className="h-4 w-4" /> Save Changes
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
