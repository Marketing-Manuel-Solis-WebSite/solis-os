'use client';
import { useAuth, Team } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { getMembers, updateMember, logAction, getTeams } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronDown, Crown, Shield, User, Eye, Briefcase, Star,
  AlertTriangle, Edit2, Check, X, Network, Building2, ArrowRight,
} from 'lucide-react';

type HierarchyLevel = 'owner' | 'director' | 'manager' | 'lead' | 'member' | 'guest';

interface OrgMember {
  id: string; displayName: string; email: string; title: string; department: string;
  role: string; teamId: string; managerId: string; hierarchyLevel: HierarchyLevel;
  photoURL: string; active: boolean;
}

interface OrgNode extends OrgMember { children: OrgNode[]; }

const LEVELS: { id: HierarchyLevel; label: string; icon: any; color: string; order: number }[] = [
  { id: 'owner', label: 'CEO / Owner', icon: Crown, color: 'var(--accent)', order: 0 },
  { id: 'director', label: 'Director', icon: Star, color: '#A855F7', order: 1 },
  { id: 'manager', label: 'Manager', icon: Shield, color: '#3B82F6', order: 2 },
  { id: 'lead', label: 'Team Lead', icon: Briefcase, color: '#22C55E', order: 3 },
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

    // Track who already has an explicit manager
    const assigned = new Set<string>();
    map.forEach(node => {
      if (node.managerId && map.has(node.managerId) && node.managerId !== node.id) {
        assigned.add(node.id);
      }
    });

    // Auto-infer hierarchy for members WITHOUT explicit managerId
    const unassigned = [...map.values()].filter(n => !assigned.has(n.id));

    // Find global top-level people (owners/CEOs) — they stay as roots
    const minOrder = Math.min(...unassigned.map(n => getLevelConfig(n.hierarchyLevel).order));
    const globalRoots = unassigned.filter(n => getLevelConfig(n.hierarchyLevel).order === minOrder);
    const globalRootIds = new Set(globalRoots.map(r => r.id));

    // Group remaining unassigned by department (teamId)
    const byTeam = new Map<string, OrgNode[]>();
    unassigned.forEach(node => {
      if (globalRootIds.has(node.id)) return; // skip roots
      const key = node.teamId || '__none__';
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(node);
    });

    // For each department, build internal hierarchy chain
    byTeam.forEach((teamMembers) => {
      // Sort by hierarchy: highest level first
      teamMembers.sort((a, b) => getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order);

      // Group by level order
      const levelBuckets: OrgNode[][] = [];
      let currentOrder = -1;
      let currentBucket: OrgNode[] = [];
      for (const m of teamMembers) {
        const order = getLevelConfig(m.hierarchyLevel).order;
        if (order !== currentOrder) {
          if (currentBucket.length > 0) levelBuckets.push(currentBucket);
          currentBucket = [m];
          currentOrder = order;
        } else {
          currentBucket.push(m);
        }
      }
      if (currentBucket.length > 0) levelBuckets.push(currentBucket);

      // Top level of this department → reports to first global root
      if (levelBuckets.length > 0 && globalRoots.length > 0) {
        for (const head of levelBuckets[0]) {
          if (!globalRootIds.has(head.id)) {
            head.managerId = globalRoots[0].id;
            assigned.add(head.id);
          }
        }
      }

      // Each subsequent level → reports to members of the level above
      // Distribute evenly among parents
      for (let i = 1; i < levelBuckets.length; i++) {
        const parents = levelBuckets[i - 1];
        for (let j = 0; j < levelBuckets[i].length; j++) {
          const child = levelBuckets[i][j];
          child.managerId = parents[j % parents.length].id;
          assigned.add(child.id);
        }
      }
    });

    // Build tree from all relationships (explicit + inferred)
    const roots: OrgNode[] = [];
    map.forEach(node => {
      if (node.managerId && map.has(node.managerId) && node.managerId !== node.id) {
        map.get(node.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: OrgNode[]) => {
      nodes.sort((a, b) => {
        // Sort by department first so same-department nodes cluster together
        const teamA = allTeams.findIndex(t => t.id === a.teamId);
        const teamB = allTeams.findIndex(t => t.id === b.teamId);
        if (teamA !== teamB) return teamA - teamB;
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

  const getManagerName = (managerId: string) => {
    const mgr = members.find(m => m.id === managerId);
    return mgr ? mgr.displayName : null;
  };

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
      {[1, 2, 3].map(i => <div key={i} className="h-32 skeleton rounded-lg" />)}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            Organization
            {canEdit && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent)] font-bold tracking-wider">ADMIN</span>}
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-0.5">{members.length} members across {allTeams.length} departments</p>
        </div>
        <div className="flex items-center rounded-xl p-1 bg-[var(--bg-elevated)] shadow-card">
          {[
            { id: 'department' as const, label: 'Departments', icon: Building2 },
            { id: 'tree' as const, label: 'Tree', icon: Network },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === v.id ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              {view === v.id && <motion.div layoutId="org-view" className="absolute inset-0 rounded-lg bg-[var(--accent-subtle)]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
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
            <div className="space-y-6">
              {byDepartment.map((group, gi) => (
                <DeptCard key={group.team.id} team={group.team} deptMembers={group.members} allMembers={members}
                  index={gi} canEdit={canEdit} onEdit={openEdit} getManagerName={getManagerName} />
              ))}
              {unassigned.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: byDepartment.length * 0.08 }}
                  className="rounded-lg p-6"
                  style={{
                    background: 'rgba(245, 158, 11, 0.04)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                  }}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <span className="text-base font-bold text-amber-400">Unassigned</span>
                    <span className="text-sm text-[var(--text-muted)]">{unassigned.length} members need a department</span>
                  </div>
                  <div className="space-y-2">
                    {unassigned.map((m, i) => (
                      <MemberRow key={m.id} member={m} index={i} canEdit={canEdit} onEdit={openEdit} getManagerName={getManagerName} />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* TREE VIEW */}
          {view === 'tree' && (
            <div className="overflow-x-auto pb-10">
              <div className="flex flex-col items-center min-w-fit pt-4">
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
// DEPARTMENT CARD - Hierarchical layout
// =======================================
function DeptCard({ team, deptMembers, allMembers, index, canEdit, onEdit, getManagerName }: {
  team: Team; deptMembers: OrgMember[]; allMembers: OrgMember[]; index: number;
  canEdit: boolean; onEdit: (m: OrgMember) => void; getManagerName: (id: string) => string | null;
}) {
  const [open, setOpen] = useState(true);

  // Group members by hierarchy level
  const levelGroups: { level: typeof LEVELS[number]; members: OrgMember[] }[] = [];
  LEVELS.forEach(lv => {
    const lvMembers = deptMembers.filter(m => m.hierarchyLevel === lv.id);
    if (lvMembers.length > 0) levelGroups.push({ level: lv, members: lvMembers });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="rounded-xl overflow-hidden bg-[var(--bg-secondary)] shadow-card"
    >
      {/* Gradient accent */}
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${team.color}, ${team.color}90, ${team.color}30)` }} />

      {/* Header */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-6 py-5 transition-all hover:bg-[var(--bg-hover)]">
        <div className="w-14 h-14 rounded-lg flex items-center justify-center text-3xl shrink-0"
          style={{
            background: `linear-gradient(135deg, ${team.color}30, ${team.color}12)`,
            border: `1px solid ${team.color}35`,
            boxShadow: `0 4px 16px ${team.color}20`,
          }}>
          {team.icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-lg font-bold" style={{ color: team.color }}>{team.name}</p>
          <p className="text-base text-[var(--text-muted)] mt-0.5">
            {deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}{team.description ? ` · ${team.description}` : ''}
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-[var(--text-muted)]" />
        </motion.div>
      </button>

      {/* Members grouped by level */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4">
              {levelGroups.map((group, gi) => (
                <div key={group.level.id}>
                  {/* Level header */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <group.level.icon className="h-3.5 w-3.5" style={{ color: group.level.color }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.level.color }}>
                      {group.level.label}{group.members.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${group.level.color}35, transparent)` }} />
                  </div>
                  {/* Members in this level */}
                  <div className="space-y-1.5">
                    {group.members.map((m, mi) => (
                      <MemberRow key={m.id} member={m} teamColor={team.color} index={mi} canEdit={canEdit}
                        onEdit={onEdit} getManagerName={getManagerName} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =======================================
// MEMBER ROW - Clear, readable, shows reporting
// =======================================
function MemberRow({ member, teamColor, index = 0, canEdit, onEdit, getManagerName }: {
  member: OrgMember; teamColor?: string; index?: number;
  canEdit: boolean; onEdit: (m: OrgMember) => void;
  getManagerName: (id: string) => string | null;
}) {
  const lv = getLevelConfig(member.hierarchyLevel);
  const managerName = member.managerId ? getManagerName(member.managerId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      whileHover={canEdit ? { x: 4 } : {}}
      onClick={() => canEdit && onEdit(member)}
      className={`flex items-center gap-4 rounded-xl px-4 py-3.5 group transition-all duration-200 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] hover:shadow-card-hover ${canEdit ? 'cursor-pointer' : ''}`}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${lv.color}40`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '';
      }}
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
        style={{
          background: `linear-gradient(135deg, ${lv.color}, ${lv.color}90)`,
          color: '#fff',
          boxShadow: `0 4px 14px ${lv.color}35`,
        }}>
        {member.displayName?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.displayName}</p>
        <p className="text-[13px] text-[var(--text-secondary)] truncate">{member.title || 'No title assigned'}</p>
        {managerName && (
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">Reports to <span className="font-medium text-[var(--text-secondary)]">{managerName}</span></span>
          </div>
        )}
      </div>

      {/* Level badge */}
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[13px] px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1"
          style={{ background: `${lv.color}25`, color: lv.color, border: `1px solid ${lv.color}35` }}>
          <lv.icon className="h-3 w-3" />{lv.label}
        </span>
        {canEdit && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
        )}
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
  const teamColor = team?.color || lv.color;

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
        className={`relative rounded-lg px-6 py-4 text-center min-w-[210px] max-w-[270px] group bg-[var(--bg-elevated)] ${canEdit ? 'cursor-pointer' : ''}`}
        style={{
          border: `2px solid ${teamColor}50`,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${teamColor}80`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${teamColor}50`;
        }}
      >
        {canEdit && (
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
        )}

        {/* Avatar */}
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3"
          style={{
            background: `linear-gradient(135deg, ${lv.color}, ${lv.color}90)`,
            color: '#fff',
            boxShadow: `0 6px 20px ${lv.color}40`,
          }}>
          {node.displayName?.[0]?.toUpperCase() || '?'}
        </div>

        {/* Name */}
        <p className="text-[15px] font-bold text-[var(--text-primary)] truncate">{node.displayName}</p>
        {/* Title */}
        <p className="text-[13px] text-[var(--text-secondary)] truncate mt-0.5">{node.title || 'No title'}</p>

        {/* Badges */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5 flex-wrap">
          <span className="text-[13px] px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1"
            style={{ background: `${lv.color}30`, color: lv.color }}>
            <lv.icon className="h-3 w-3" />{lv.label}
          </span>
          {team && (
            <span className="text-[13px] px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1"
              style={{ background: `${team.color}25`, color: team.color }}>
              {team.icon} {team.name}
            </span>
          )}
        </div>

        {/* Direct reports count */}
        {hasKids && (
          <p className="text-[13px] text-[var(--text-muted)] mt-2.5">
            {node.children.length} direct report{node.children.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Expand toggle */}
        {hasKids && (
          <button onClick={e => { e.stopPropagation(); setOpen(!open); }}
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all"
            style={{
              background: 'var(--bg-base)',
              border: `2px solid ${teamColor}60`,
              boxShadow: `0 2px 8px rgba(0,0,0,0.25)`,
            }}>
            <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: teamColor }} />
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
            <div className="w-[3px] h-10 rounded-full"
              style={{ background: `linear-gradient(to bottom, ${teamColor}80, ${teamColor}50)` }} />

            {/* Children container */}
            {node.children.length === 1 ? (
              <TreeNode node={node.children[0]} members={members} teams={teams}
                canEdit={canEdit} onEdit={onEdit} index={0} />
            ) : (
              <div className="relative flex items-start gap-10">
                {/* Horizontal connector line */}
                <div className="absolute top-0 h-[3px] rounded-full"
                  style={{
                    left: `calc(${100 / (node.children.length * 2)}%)`,
                    right: `calc(${100 / (node.children.length * 2)}%)`,
                    background: `linear-gradient(90deg, ${teamColor}40, ${teamColor}70, ${teamColor}70, ${teamColor}40)`,
                  }} />

                {node.children.map((child, ci) => {
                  const childTeam = teams.find(t => t.id === child.teamId);
                  const childColor = childTeam?.color || getLevelConfig(child.hierarchyLevel).color;
                  return (
                    <div key={child.id} className="flex flex-col items-center">
                      {/* Vertical line from horizontal to child */}
                      <div className="w-[3px] h-8 rounded-full"
                        style={{ background: `linear-gradient(to bottom, ${teamColor}70, ${childColor}60)` }} />
                      <TreeNode node={child} members={members} teams={teams}
                        canEdit={canEdit} onEdit={onEdit} index={ci} />
                    </div>
                  );
                })}
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
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-xl overflow-hidden bg-[var(--bg-elevated)] shadow-modal"
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
              <p className="text-sm text-[var(--text-muted)]">{member.email}</p>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Job Title</label>
            <input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })}
              placeholder="e.g. Marketing Manager"
              className="input-dark" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Level</label>
              <select value={editData.hierarchyLevel} onChange={e => setEditData({ ...editData, hierarchyLevel: e.target.value })}
                className="select-dark h-[42px]">
                {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Department</label>
              <select value={editData.teamId} onChange={e => setEditData({ ...editData, teamId: e.target.value })}
                className="select-dark h-[42px]">
                <option value="">None</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">Reports To</label>
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
              className="flex-1 h-10 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-text)',
              }}>
              <Check className="h-4 w-4" /> Save Changes
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="h-10 px-5 rounded-md text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all duration-200 bg-[var(--bg-tertiary)]">
              Cancel
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
