'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, limit, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// ============================================
// TYPES
// ============================================
export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'guest' | 'readonly';

export interface Team {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export interface Member {
  userId: string;
  orgId: string;
  role: Role;
  teamId: string;
  teamIds: string[];
  displayName: string;
  email: string;
  title: string;
  department: string;
  managerId: string;
  hierarchyLevel: string;
  photoURL: string;
  active: boolean;
}

export type ResourceType =
  | 'workspace' | 'task' | 'doc' | 'channel'
  | 'automation' | 'analytics' | 'admin' | 'user' | 'org'
  | 'goal' | 'timesheet' | 'whiteboard' | 'form' | 'integration';

export type PermAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

// ============================================
// DEFAULT PERMISSIONS MATRIX
// ============================================
const ALL_RESOURCES: ResourceType[] = [
  'workspace', 'task', 'doc', 'channel', 'automation', 'analytics',
  'admin', 'user', 'org', 'goal', 'timesheet', 'whiteboard', 'form', 'integration',
];

const DEFAULT_PERMS: Record<Role, Record<ResourceType, Record<PermAction, boolean>>> = {
  owner: Object.fromEntries(
    ALL_RESOURCES.map(r => [r, { create: true, read: true, update: true, delete: true, manage: true }])
  ) as any,
  admin: Object.fromEntries(
    ALL_RESOURCES.map(r => [r, { create: true, read: true, update: true, delete: true, manage: true }])
  ) as any,
  manager: {
    workspace: { create: true, read: true, update: true, delete: false, manage: false },
    task: { create: true, read: true, update: true, delete: true, manage: true },
    doc: { create: true, read: true, update: true, delete: true, manage: true },
    channel: { create: true, read: true, update: true, delete: false, manage: true },
    automation: { create: true, read: true, update: true, delete: true, manage: false },
    analytics: { create: false, read: true, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: true, update: false, delete: false, manage: false },
    goal: { create: true, read: true, update: true, delete: true, manage: true },
    timesheet: { create: true, read: true, update: true, delete: true, manage: true },
    whiteboard: { create: true, read: true, update: true, delete: true, manage: true },
    form: { create: true, read: true, update: true, delete: true, manage: false },
    integration: { create: false, read: true, update: false, delete: false, manage: false },
  },
  member: {
    workspace: { create: false, read: true, update: false, delete: false, manage: false },
    task: { create: true, read: true, update: true, delete: false, manage: false },
    doc: { create: true, read: true, update: true, delete: false, manage: false },
    channel: { create: true, read: true, update: false, delete: false, manage: false },
    automation: { create: false, read: true, update: false, delete: false, manage: false },
    analytics: { create: false, read: true, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: true, update: false, delete: false, manage: false },
    goal: { create: true, read: true, update: true, delete: false, manage: false },
    timesheet: { create: true, read: true, update: true, delete: false, manage: false },
    whiteboard: { create: true, read: true, update: true, delete: false, manage: false },
    form: { create: false, read: false, update: false, delete: false, manage: false },
    integration: { create: false, read: false, update: false, delete: false, manage: false },
  },
  guest: {
    workspace: { create: false, read: true, update: false, delete: false, manage: false },
    task: { create: true, read: true, update: false, delete: false, manage: false },
    doc: { create: false, read: true, update: false, delete: false, manage: false },
    channel: { create: false, read: true, update: false, delete: false, manage: false },
    automation: { create: false, read: false, update: false, delete: false, manage: false },
    analytics: { create: false, read: false, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: false, update: false, delete: false, manage: false },
    goal: { create: false, read: true, update: false, delete: false, manage: false },
    timesheet: { create: false, read: true, update: false, delete: false, manage: false },
    whiteboard: { create: false, read: true, update: false, delete: false, manage: false },
    form: { create: false, read: false, update: false, delete: false, manage: false },
    integration: { create: false, read: false, update: false, delete: false, manage: false },
  },
  readonly: {
    workspace: { create: false, read: true, update: false, delete: false, manage: false },
    task: { create: false, read: true, update: false, delete: false, manage: false },
    doc: { create: false, read: true, update: false, delete: false, manage: false },
    channel: { create: false, read: true, update: false, delete: false, manage: false },
    automation: { create: false, read: false, update: false, delete: false, manage: false },
    analytics: { create: false, read: true, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: false, update: false, delete: false, manage: false },
    goal: { create: false, read: true, update: false, delete: false, manage: false },
    timesheet: { create: false, read: true, update: false, delete: false, manage: false },
    whiteboard: { create: false, read: true, update: false, delete: false, manage: false },
    form: { create: false, read: false, update: false, delete: false, manage: false },
    integration: { create: false, read: false, update: false, delete: false, manage: false },
  },
};

// ============================================
// CONTEXT
// ============================================
interface Ctx {
  user: User | null;
  me: Member | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isDirector: boolean;
  teams: Team[];
  allMembers: Member[];
  activeTeamId: string;
  setActiveTeamId: (id: string) => void;
  canSeeAllTeams: boolean;
  teamMembers: Member[];
  refreshTeams: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  can: (resource: ResourceType, action: PermAction) => boolean;
  canSeeResource: (resource: { teamId?: string; createdBy?: string; visibility?: string; assignees?: string[] }) => boolean;
  getMemberById: (id: string) => Member | undefined;
  getMembersByTeam: (teamId: string) => Member[];
}

const AuthCtx = createContext<Ctx>({
  user: null, me: null, loading: true, isAdmin: false, isManager: false, isDirector: false,
  teams: [], allMembers: [], activeTeamId: '', setActiveTeamId: () => {}, canSeeAllTeams: false,
  teamMembers: [], refreshTeams: async () => {}, refreshMembers: async () => {},
  can: () => false, canSeeResource: () => false, getMemberById: () => undefined, getMembersByTeam: () => [],
});

// Default departments for the law office
const DEFAULT_TEAMS: Omit<Team, 'id'>[] = [
  { name: 'Marketing', color: '#8B5CF6', icon: '📣', description: 'Marketing & social media campaigns' },
  { name: 'Openers', color: '#3B82F6', icon: '🚀', description: 'Lead intake & case openers' },
  { name: 'Closers', color: '#22C55E', icon: '🎯', description: 'Case closers & client conversion' },
  { name: 'Dirección', color: '#3B82F6', icon: '👔', description: 'Management & executive team' },
];

const ORG_ID = 'solis-center';

// ============================================
// ROLE NORMALIZATION — maps any variation to canonical role
// ============================================
function normalizeRole(raw: string | undefined | null): Role {
  if (!raw) return 'member';
  const r = raw.toLowerCase().trim();
  // Owner variations
  if (['owner', 'dueño', 'dueña', 'propietario', 'ceo', 'fundador'].includes(r)) return 'owner';
  // Admin variations
  if (['admin', 'administrador', 'administradora', 'administrator', 'superadmin', 'super_admin', 'super-admin'].includes(r)) return 'admin';
  // Manager variations
  if (['manager', 'gerente', 'supervisor', 'lead', 'líder', 'lider', 'jefe', 'jefa', 'coordinador', 'coordinadora'].includes(r)) return 'manager';
  // Guest variations
  if (['guest', 'invitado', 'invitada', 'visitante', 'externo', 'externa'].includes(r)) return 'guest';
  // Readonly variations
  if (['readonly', 'read-only', 'read_only', 'solo_lectura', 'lectura', 'viewer', 'observador'].includes(r)) return 'readonly';
  // If it's already a valid canonical role, return it
  if (['owner', 'admin', 'manager', 'member', 'guest', 'readonly'].includes(r)) return r as Role;
  // Default
  return 'member';
}

// ============================================
// PROVIDER
// ============================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [activeTeamId, setActiveTeamIdRaw] = useState('');
  const [permMatrix, setPermMatrix] = useState<any>(null);

  // Derived state — normalize role for robust comparison
  const roleNorm = (me?.role || '').toLowerCase().trim();
  const hierNorm = (me?.hierarchyLevel || '').toLowerCase().trim();
  const isAdmin = roleNorm === 'owner' || roleNorm === 'admin';
  const isManager = isAdmin || roleNorm === 'manager';
  const isDirector = isAdmin || hierNorm === 'director' || hierNorm === 'owner';
  const canSeeAllTeams = isAdmin || isDirector;

  const teamMembers = useMemo(() => {
    if (activeTeamId === '__all__') return allMembers;
    return allMembers.filter(m =>
      m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId)
    );
  }, [allMembers, activeTeamId]);

  // Permission check
  const can = useCallback((resource: ResourceType, action: PermAction): boolean => {
    if (!me) return false;
    const role = me.role;

    // Check custom matrix first
    if (permMatrix?.[role]?.[resource]?.[action] !== undefined) {
      return !!permMatrix[role][resource][action];
    }

    // Fall back to defaults
    return DEFAULT_PERMS[role]?.[resource]?.[action] ?? false;
  }, [me, permMatrix]);

  // Visibility check for resources (tasks, docs, etc)
  const canSeeResource = useCallback((resource: {
    teamId?: string;
    createdBy?: string;
    visibility?: string;
    assignees?: string[];
  }): boolean => {
    if (!me || !user) return false;

    // Admins and directors see everything
    if (canSeeAllTeams) return true;

    // Created by self
    if (resource.createdBy === user.uid) return true;

    // Assigned to self
    if (resource.assignees?.includes(user.uid)) return true;

    // Public visibility
    if (resource.visibility === 'public') return true;

    // Team visibility — check if in same team
    if (resource.visibility === 'team' || !resource.visibility) {
      if (!resource.teamId) return true; // No team = general
      if (resource.teamId === me.teamId) return true;
      if (me.teamIds?.includes(resource.teamId)) return true;
    }

    // Private — only creator and assignees (already checked above)
    if (resource.visibility === 'private') return false;

    // General (no team restriction) — everyone can see
    if (!resource.teamId || resource.teamId === '') return true;

    return false;
  }, [me, user, canSeeAllTeams]);

  const getMemberById = useCallback((id: string) => {
    return allMembers.find(m => m.userId === id || (m as any).id === id);
  }, [allMembers]);

  const getMembersByTeam = useCallback((teamId: string) => {
    if (teamId === '__all__') return allMembers;
    return allMembers.filter(m => m.teamId === teamId || m.teamIds?.includes(teamId));
  }, [allMembers]);

  const setActiveTeamId = useCallback((id: string) => {
    if (!canSeeAllTeams) {
      if (id === '__all__') return;
      if (me && me.teamId !== id && !me.teamIds?.includes(id)) return;
    }
    setActiveTeamIdRaw(id);
  }, [canSeeAllTeams, me]);

  // Refresh teams from Firestore
  const refreshTeams = useCallback(async () => {
    const teamsCol = collection(db, 'orgs', ORG_ID, 'teams');
    const teamsSnap = await getDocs(teamsCol);
    setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
  }, []);

  // Refresh members from Firestore — also updates `me` if current user's data changed
  const refreshMembers = useCallback(async () => {
    const membersSnap = await getDocs(collection(db, 'orgs', ORG_ID, 'members'));
    const allMems = membersSnap.docs.map(d => {
      const data = { id: d.id, ...d.data() } as unknown as Member;
      // Normalize role on read
      const norm = normalizeRole(data.role);
      if (norm !== data.role) data.role = norm;
      return data;
    });
    setAllMembers(allMems);
    // Sync `me` with latest Firestore data
    if (user) {
      const fresh = allMems.find(m => m.userId === user.uid || (m as any).id === user.uid);
      if (fresh) {
        if (!fresh.teamIds) fresh.teamIds = fresh.teamId ? [fresh.teamId] : [];
        setMe(fresh);
      }
    }
  }, [user]);

  // Auth state listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setMe(null);
        setLoading(false);
        setTeams([]);
        setAllMembers([]);
        setActiveTeamIdRaw('');
        return;
      }

      setUser(u);

      try {
        const orgRef = doc(db, 'orgs', ORG_ID);
        const memRef = doc(db, 'orgs', ORG_ID, 'members', u.uid);
        const teamsCol = collection(db, 'orgs', ORG_ID, 'teams');

        // --- STEP 1: Parallel fetch of org, teams, member ---
        const [orgSnap, teamsSnap, memSnap] = await Promise.all([
          getDoc(orgRef),
          getDocs(teamsCol),
          getDoc(memRef),
        ]);

        // Ensure org exists (first-time only)
        if (!orgSnap.exists()) {
          await setDoc(orgRef, {
            name: 'Law Office of Manuel Solis',
            slug: ORG_ID,
            primaryColor: '#3B82F6',
            secondaryColor: '#0C1017',
            timezone: 'America/Chicago',
            createdBy: u.uid,
            createdAt: serverTimestamp(),
          });
        }

        // Ensure teams exist (first-time only)
        let loadedTeams: Team[];
        if (teamsSnap.empty) {
          for (const t of DEFAULT_TEAMS) {
            const id = t.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            await setDoc(doc(db, 'orgs', ORG_ID, 'teams', id), t);
          }
          const freshTeams = await getDocs(teamsCol);
          loadedTeams = freshTeams.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        } else {
          loadedTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        }
        setTeams(loadedTeams);

        // --- STEP 2: Validate member ---
        if (!memSnap.exists()) {
          const existing = await getDocs(query(collection(db, 'orgs', ORG_ID, 'members'), limit(1)));
          if (existing.empty) {
            const direccionTeam = loadedTeams.find(t => t.name.toLowerCase().includes('direcci')) || loadedTeams[0];
            const firstTeam = direccionTeam?.id || loadedTeams[0]?.id || '';
            await setDoc(memRef, {
              userId: u.uid, orgId: ORG_ID, role: 'owner' as Role,
              teamId: firstTeam,
              teamIds: loadedTeams.map(t => t.id),
              displayName: u.displayName || u.email?.split('@')[0] || 'User',
              email: u.email || '',
              title: 'Managing Partner',
              department: direccionTeam?.name || '',
              managerId: '', hierarchyLevel: 'owner',
              photoURL: u.photoURL || '',
              active: true,
              joinedAt: serverTimestamp(),
            });
          } else {
            await signOut(auth);
            if (typeof window !== 'undefined') window.location.href = '/login?error=no_account';
            setLoading(false);
            return;
          }
        }

        let meData = memSnap.exists() ? (memSnap.data() as Member) : ((await getDoc(memRef)).data() as Member);

        if (meData.active === false) {
          await signOut(auth);
          if (typeof window !== 'undefined') window.location.href = '/login?error=deactivated';
          setLoading(false);
          return;
        }

        // Normalize role
        const rawRole = meData.role;
        const canonicalRole = normalizeRole(rawRole);
        if (rawRole !== canonicalRole) {
          updateDoc(memRef, { role: canonicalRole });
          meData = { ...meData, role: canonicalRole };
        }

        if (!meData.teamIds) meData.teamIds = meData.teamId ? [meData.teamId] : [];
        setMe(meData);

        // Set active team
        const userIsAdmin = meData.role === 'owner' || meData.role === 'admin';
        const h = (meData.hierarchyLevel || '').toLowerCase().trim();
        const userIsDirector = userIsAdmin || h === 'director' || h === 'owner';
        const userCanSeeAll = userIsAdmin || userIsDirector;
        setActiveTeamIdRaw(userCanSeeAll ? '__all__' : (meData.teamId || meData.teamIds?.[0] || ''));

        // --- STEP 3: Unblock UI — user can see app now ---
        setLoading(false);

        // --- STEP 4: Background — load members + permissions (non-blocking) ---
        getDocs(collection(db, 'orgs', ORG_ID, 'members')).then(allMembersSnap => {
          const allMems = allMembersSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Member));

          // Self-heal: sole active member → owner
          const activeMems = allMems.filter(m => m.active !== false);
          if (activeMems.length === 1 && (activeMems[0].userId === u.uid || (activeMems[0] as any).id === u.uid) && canonicalRole !== 'owner') {
            updateDoc(memRef, { role: 'owner', hierarchyLevel: 'owner' });
            setMe(prev => prev ? { ...prev, role: 'owner', hierarchyLevel: 'owner' } : prev);
          }

          const normalizedAllMems = allMems.map(m => {
            const norm = normalizeRole(m.role);
            return norm !== m.role ? { ...m, role: norm } : m;
          });
          setAllMembers(normalizedAllMems);
        }).catch(() => {});

        getDoc(doc(db, 'orgs', ORG_ID, 'settings', 'permissions')).then(permSnap => {
          if (permSnap.exists() && permSnap.data()?.matrix) {
            setPermMatrix(permSnap.data().matrix);
          }
        }).catch(() => {});

      } catch (e) {
        setMe(null);
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(() => ({
    user, me, loading, isAdmin, isManager, isDirector,
    teams, allMembers, activeTeamId, setActiveTeamId,
    canSeeAllTeams, teamMembers,
    refreshTeams, refreshMembers,
    can, canSeeResource, getMemberById, getMembersByTeam,
  }), [
    user, me, loading, isAdmin, isManager, isDirector,
    teams, allMembers, activeTeamId, setActiveTeamId,
    canSeeAllTeams, teamMembers,
    refreshTeams, refreshMembers,
    can, canSeeResource, getMemberById, getMembersByTeam,
  ]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
