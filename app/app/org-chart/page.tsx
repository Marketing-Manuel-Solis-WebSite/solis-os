'use client';
import { useAuth, Team } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getMembers, updateMember, logAction, getTeams } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronDown, Crown, Shield, User, Eye, Briefcase, Star,
  AlertTriangle, Edit2, Check, X, Network, Building2, ArrowRight,
  ZoomIn, ZoomOut, Maximize2, Move,
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
  const { t } = useI18n();
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

  const buildTree = useCallback((list: OrgMember[]): OrgNode[] => {
    const map = new Map<string, OrgNode>();
    list.forEach(m => map.set(m.id, { ...m, children: [] }));

    const assigned = new Set<string>();
    map.forEach(node => {
      if (node.managerId && map.has(node.managerId) && node.managerId !== node.id) {
        assigned.add(node.id);
      }
    });

    const unassigned = [...map.values()].filter(n => !assigned.has(n.id));
    const minOrder = Math.min(...unassigned.map(n => getLevelConfig(n.hierarchyLevel).order));
    const globalRoots = unassigned.filter(n => getLevelConfig(n.hierarchyLevel).order === minOrder);
    const globalRootIds = new Set(globalRoots.map(r => r.id));

    const byTeam = new Map<string, OrgNode[]>();
    unassigned.forEach(node => {
      if (globalRootIds.has(node.id)) return;
      const key = node.teamId || '__none__';
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(node);
    });

    byTeam.forEach((teamMembers) => {
      teamMembers.sort((a, b) => getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order);
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

      if (levelBuckets.length > 0 && globalRoots.length > 0) {
        for (const head of levelBuckets[0]) {
          if (!globalRootIds.has(head.id)) {
            head.managerId = globalRoots[0].id;
            assigned.add(head.id);
          }
        }
      }

      for (let i = 1; i < levelBuckets.length; i++) {
        const parents = levelBuckets[i - 1];
        for (let j = 0; j < levelBuckets[i].length; j++) {
          const child = levelBuckets[i][j];
          child.managerId = parents[j % parents.length].id;
          assigned.add(child.id);
        }
      }
    });

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
  }, [allTeams]);

  const tree = useMemo(() => buildTree(members), [members, buildTree]);

  const byDepartment = useMemo(() =>
    allTeams.map(t => ({
      team: t,
      members: members.filter(m => m.teamId === t.id).sort((a, b) => getLevelConfig(a.hierarchyLevel).order - getLevelConfig(b.hierarchyLevel).order),
    })).filter(g => g.members.length > 0),
    [allTeams, members]
  );

  const unassignedMembers = useMemo(() =>
    members.filter(m => !m.teamId || m.teamId === ''),
    [members]
  );

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
            {t('orgChart.organization')}
            {canEdit && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent)] font-bold tracking-wider">{t('orgChart.admin')}</span>}
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-0.5">{t('orgChart.subtitle', { members: members.length, departments: allTeams.length })}</p>
        </div>
        <div className="flex items-center rounded-xl p-1 bg-[var(--bg-elevated)] shadow-card">
          {[
            { id: 'department' as const, label: t('orgChart.departments'), icon: Building2 },
            { id: 'tree' as const, label: t('orgChart.tree'), icon: Network },
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
          <p className="text-[var(--text-muted)]">{t('orgChart.noMembers')}</p>
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
              {unassignedMembers.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: byDepartment.length * 0.08 }}
                  className="rounded-lg p-6"
                  style={{
                    background: 'rgba(245, 158, 11, 0.04)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                  }}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <span className="text-base font-bold text-amber-400">{t('orgChart.unassigned')}</span>
                    <span className="text-sm text-[var(--text-muted)]">{t('orgChart.needsDept', { n: unassignedMembers.length })}</span>
                  </div>
                  <div className="space-y-2">
                    {unassignedMembers.map((m, i) => (
                      <MemberRow key={m.id} member={m} index={i} canEdit={canEdit} onEdit={openEdit} getManagerName={getManagerName} />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* TREE VIEW — with zoom & pan */}
          {view === 'tree' && (
            <ZoomPanContainer>
              <div className="flex flex-col items-center min-w-fit pt-4 pb-20">
                {tree.map((root, i) => (
                  <TreeNode key={root.id} node={root} members={members} teams={allTeams}
                    canEdit={canEdit} onEdit={openEdit} isRoot index={i} />
                ))}
              </div>
            </ZoomPanContainer>
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
// ZOOM & PAN CONTAINER
// =======================================
function ZoomPanContainer({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 2;
  const BUTTON_STEP = 0.15;

  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, s + BUTTON_STEP));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, s - BUTTON_STEP));
  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  // Normalize deltaY across devices: trackpads send small deltas frequently,
  // scroll wheels send large deltas infrequently. Clamp so both feel the same.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    // deltaMode 1 = lines (some mice), multiply to match pixel-based deltas
    const raw = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // Clamp between -150 and 150 so no single event jumps too much
    const clamped = Math.max(-150, Math.min(150, raw));
    // Scale factor: 150px of scroll = 0.15 zoom change (same as button step)
    const zoomDelta = -(clamped / 150) * BUTTON_STEP;
    setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + zoomDelta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, select, [role="button"]')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({
      x: translateStart.current.x + dx,
      y: translateStart.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch support: single-finger drag + two-finger pinch-to-zoom
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchScale = useRef(1);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single finger drag
      if ((e.target as HTMLElement).closest('button, input, select, [role="button"]')) return;
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      translateStart.current = { ...translate };
    } else if (e.touches.length === 2) {
      // Pinch start
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
      lastTouchScale.current = scale;
    }
  }, [translate, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setTranslate({ x: translateStart.current.x + dx, y: translateStart.current.y + dy });
    } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / lastTouchDist.current;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, lastTouchScale.current * ratio)));
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDist.current = null;
  }, []);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        {/* Hint */}
        <span className="text-[11px] text-[var(--text-muted)] mr-2 hidden sm:inline-flex items-center gap-1.5">
          <Move className="h-3 w-3" />
          {t('orgChart.dragToMove')}
        </span>

        <div className="flex items-center rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          <button onClick={zoomOut} title={t('orgChart.zoomOut')}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-[12px] font-medium text-[var(--text-secondary)] min-w-[48px] text-center tabular-nums border-x border-[var(--border-subtle)]">
            {zoomPercent}%
          </span>
          <button onClick={zoomIn} title={t('orgChart.zoomIn')}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <button onClick={resetView} title={t('orgChart.resetZoom')}
          className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shadow-sm">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] touch-none"
        style={{
          height: 'calc(100vh - 220px)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center top',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// =======================================
// DEPARTMENT CARD
// =======================================
function DeptCard({ team, deptMembers, allMembers, index, canEdit, onEdit, getManagerName }: {
  team: Team; deptMembers: OrgMember[]; allMembers: OrgMember[]; index: number;
  canEdit: boolean; onEdit: (m: OrgMember) => void; getManagerName: (id: string) => string | null;
}) {
  const [open, setOpen] = useState(true);

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
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${team.color}, ${team.color}60, transparent)` }} />

      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-6 py-5 transition-all hover:bg-[var(--bg-hover)]">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{
            background: `linear-gradient(135deg, ${team.color}20, ${team.color}08)`,
            border: `1px solid ${team.color}25`,
          }}>
          {team.icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[15px] font-bold" style={{ color: team.color }}>{team.name}</p>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}{team.description ? ` · ${team.description}` : ''}
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-[var(--text-muted)]" />
        </motion.div>
      </button>

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
              {levelGroups.map((group) => (
                <div key={group.level.id}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <group.level.icon className="h-3.5 w-3.5" style={{ color: group.level.color }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.level.color }}>
                      {group.level.label}{group.members.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${group.level.color}25, transparent)` }} />
                  </div>
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
// MEMBER ROW
// =======================================
function MemberRow({ member, teamColor, index = 0, canEdit, onEdit, getManagerName }: {
  member: OrgMember; teamColor?: string; index?: number;
  canEdit: boolean; onEdit: (m: OrgMember) => void;
  getManagerName: (id: string) => string | null;
}) {
  const { t } = useI18n();
  const lv = getLevelConfig(member.hierarchyLevel);
  const managerName = member.managerId ? getManagerName(member.managerId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      whileHover={canEdit ? { x: 4 } : {}}
      onClick={() => canEdit && onEdit(member)}
      className={`flex items-center gap-4 rounded-xl px-4 py-3 group transition-all duration-200 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] ${canEdit ? 'cursor-pointer' : ''}`}
    >
      {/* Avatar */}
      {member.photoURL ? (
        <img src={member.photoURL} alt={member.displayName} className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: `linear-gradient(135deg, ${lv.color}, ${lv.color}90)`, color: '#fff' }}>
          {member.displayName?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{member.displayName}</p>
        <p className="text-[13px] text-[var(--text-secondary)] truncate">{member.title || t('orgChart.noTitleAssigned')}</p>
        {managerName && (
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />
            <span className="text-[12px] text-[var(--text-muted)]">{t('orgChart.reportsToLabel')} <span className="font-medium text-[var(--text-secondary)]">{managerName}</span></span>
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1"
          style={{ background: `${lv.color}15`, color: lv.color }}>
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
// TREE VIEW — Minimalist org tree
// =======================================
function TreeNode({ node, members, teams, canEdit, onEdit, isRoot = false, index = 0 }: {
  node: OrgNode; members: OrgMember[]; teams: Team[];
  canEdit: boolean; onEdit: (m: OrgMember) => void;
  isRoot?: boolean; index?: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const hasKids = node.children.length > 0;
  const lv = getLevelConfig(node.hierarchyLevel);
  const team = teams.find(t => t.id === node.teamId);
  const teamColor = team?.color || lv.color;

  return (
    <div className="flex flex-col items-center">
      {/* Node card — minimalist */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        whileHover={canEdit ? { y: -2 } : {}}
        onClick={() => canEdit && onEdit(node)}
        className={`relative rounded-2xl px-5 py-4 text-center min-w-[180px] max-w-[240px] group transition-all duration-200 ${canEdit ? 'cursor-pointer' : ''}`}
        style={{
          background: 'var(--bg-elevated)',
          border: `1.5px solid var(--border-subtle)`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = teamColor;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${teamColor}20`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full" style={{ background: teamColor }} />

        {canEdit && (
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 className="h-3 w-3 text-[var(--text-muted)]" />
          </div>
        )}

        {/* Avatar */}
        {node.photoURL ? (
          <div className="w-12 h-12 rounded-full mx-auto mb-2.5 p-[2px]" style={{ background: teamColor }}>
            <img src={node.photoURL} alt={node.displayName}
              className="w-full h-full rounded-full object-cover border-2 border-[var(--bg-elevated)]"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold mx-auto mb-2.5"
            style={{
              background: `linear-gradient(135deg, ${lv.color}, ${lv.color}80)`,
              color: '#fff',
            }}>
            {node.displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}

        {/* Name */}
        <p className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">{node.displayName}</p>
        {/* Title */}
        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{node.title || t('orgChart.noTitle')}</p>

        {/* Level + team pills */}
        <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold inline-flex items-center gap-0.5"
            style={{ background: `${lv.color}15`, color: lv.color }}>
            <lv.icon className="h-2.5 w-2.5" />{lv.label}
          </span>
          {team && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: `${team.color}12`, color: team.color }}>
              {team.name}
            </span>
          )}
        </div>

        {/* Direct reports count */}
        {hasKids && (
          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            {t('orgChart.directReports', { n: node.children.length })}
          </p>
        )}

        {/* Expand toggle */}
        {hasKids && (
          <button onClick={e => { e.stopPropagation(); setOpen(!open); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] shadow-sm">
            <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
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
            {/* Vertical line from parent */}
            <div className="w-px h-8" style={{ background: `linear-gradient(to bottom, ${teamColor}50, ${teamColor}30)` }} />

            {node.children.length === 1 ? (
              <TreeNode node={node.children[0]} members={members} teams={teams}
                canEdit={canEdit} onEdit={onEdit} index={0} />
            ) : (
              <ChildrenRows children={node.children} members={members} teams={teams}
                canEdit={canEdit} onEdit={onEdit} teamColor={teamColor} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =======================================
// CHILDREN ROWS — max 3 per row
// =======================================
const MAX_PER_ROW = 3;

function ChildrenRows({ children, members, teams, canEdit, onEdit, teamColor }: {
  children: OrgNode[]; members: OrgMember[]; teams: Team[];
  canEdit: boolean; onEdit: (m: OrgMember) => void; teamColor: string;
}) {
  // Split children into chunks of MAX_PER_ROW
  const rows: OrgNode[][] = [];
  for (let i = 0; i < children.length; i += MAX_PER_ROW) {
    rows.push(children.slice(i, i + MAX_PER_ROW));
  }

  return (
    <div className="flex flex-col items-center">
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-col items-center">
          {/* Vertical connector between rows (skip for first row — parent already draws it) */}
          {ri > 0 && (
            <div className="w-px h-6" style={{ background: `linear-gradient(to bottom, ${teamColor}40, ${teamColor}25)` }} />
          )}

          <div className="relative flex items-start gap-8">
            {/* Horizontal connector line across the row */}
            {row.length > 1 && (
              <div className="absolute top-0 h-px"
                style={{
                  left: `calc(${100 / (row.length * 2)}%)`,
                  right: `calc(${100 / (row.length * 2)}%)`,
                  background: `linear-gradient(90deg, ${teamColor}25, ${teamColor}40, ${teamColor}40, ${teamColor}25)`,
                }} />
            )}

            {row.map((child, ci) => {
              const childTeam = teams.find(t => t.id === child.teamId);
              const childColor = childTeam?.color || getLevelConfig(child.hierarchyLevel).color;
              return (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-6" style={{ background: `linear-gradient(to bottom, ${teamColor}40, ${childColor}30)` }} />
                  <TreeNode node={child} members={members} teams={teams}
                    canEdit={canEdit} onEdit={onEdit} index={ri * MAX_PER_ROW + ci} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
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
  const { t } = useI18n();
  const lv = getLevelConfig(member.hierarchyLevel);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />

      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-xl overflow-hidden bg-[var(--bg-elevated)] shadow-modal"
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            {member.photoURL ? (
              <img src={member.photoURL} alt={member.displayName} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                style={{
                  background: `linear-gradient(135deg, ${lv.color}30, ${lv.color}10)`,
                  color: lv.color,
                }}>
                {member.displayName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">{member.displayName}</p>
              <p className="text-sm text-[var(--text-muted)]">{member.email}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{t('orgChart.jobTitle')}</label>
            <input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })}
              placeholder="e.g. Marketing Manager"
              className="input-dark" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{t('orgChart.level')}</label>
              <select value={editData.hierarchyLevel} onChange={e => setEditData({ ...editData, hierarchyLevel: e.target.value })}
                className="select-dark h-[42px]">
                {LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{t('orgChart.department')}</label>
              <select value={editData.teamId} onChange={e => setEditData({ ...editData, teamId: e.target.value })}
                className="select-dark h-[42px]">
                <option value="">None</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">{t('orgChart.reportsTo')}</label>
            <select value={editData.managerId} onChange={e => setEditData({ ...editData, managerId: e.target.value })}
              className="select-dark h-[42px]">
              <option value="">{t('orgChart.noManager')}</option>
              {members.filter(m => m.id !== member.id).map(m => {
                const ml = getLevelConfig(m.hierarchyLevel);
                return <option key={m.id} value={m.id}>{m.displayName} ({ml.label})</option>;
              })}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onSave}
              className="flex-1 h-10 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
              <Check className="h-4 w-4" /> {t('orgChart.saveChanges')}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="h-10 px-5 rounded-md text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all duration-200 bg-[var(--bg-tertiary)]">
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
