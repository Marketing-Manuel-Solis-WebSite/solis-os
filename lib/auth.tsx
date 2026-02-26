'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, limit, query, serverTimestamp } from 'firebase/firestore';
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
  | 'automation' | 'analytics' | 'admin' | 'user' | 'org';

export type PermAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

// ============================================
// DEFAULT PERMISSIONS MATRIX
// ============================================
const DEFAULT_PERMS: Record<Role, Record<ResourceType, Record<PermAction, boolean>>> = {
  owner: Object.fromEntries(
    (['workspace', 'task', 'doc', 'channel', 'automation', 'analytics', 'admin', 'user', 'org'] as ResourceType[]).map(r => [r, { create: true, read: true, update: true, delete: true, manage: true }])
  ) as any,
  admin: Object.fromEntries(
    (['workspace', 'task', 'doc', 'channel', 'automation', 'analytics', 'admin', 'user', 'org'] as ResourceType[]).map(r => [r, { create: true, read: true, update: true, delete: true, manage: true }])
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
  { name: 'Dirección', color: '#D4A843', icon: '👔', description: 'Management & executive team' },
];

const ORG_ID = 'solis-center';

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

  // Derived state
  const isAdmin = me?.role === 'owner' || me?.role === 'admin';
  const isManager = isAdmin || me?.role === 'manager';
  const isDirector = isAdmin || me?.hierarchyLevel === 'director';
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
    setActiveTeamIdRaw(id);
  }, []);

  // Refresh teams from Firestore
  const refreshTeams = useCallback(async () => {
    const teamsCol = collection(db, 'orgs', ORG_ID, 'teams');
    const teamsSnap = await getDocs(teamsCol);
    setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
  }, []);

  // Refresh members from Firestore
  const refreshMembers = useCallback(async () => {
    const membersSnap = await getDocs(collection(db, 'orgs', ORG_ID, 'members'));
    setAllMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Member)));
  }, []);

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
        // Ensure org exists
        const orgRef = doc(db, 'orgs', ORG_ID);
        if (!(await getDoc(orgRef)).exists()) {
          await setDoc(orgRef, {
            name: 'Law Office of Manuel Solis',
            slug: ORG_ID,
            primaryColor: '#D4A843',
            secondaryColor: '#0C1017',
            timezone: 'America/Chicago',
            createdBy: u.uid,
            createdAt: serverTimestamp(),
          });
        }

        // Ensure teams/departments exist
        const teamsCol = collection(db, 'orgs', ORG_ID, 'teams');
        let teamsSnap = await getDocs(teamsCol);
        if (teamsSnap.empty) {
          for (const t of DEFAULT_TEAMS) {
            const id = t.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            await setDoc(doc(db, 'orgs', ORG_ID, 'teams', id), t);
          }
          teamsSnap = await getDocs(teamsCol);
        }
        const loadedTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
        setTeams(loadedTeams);

        // Ensure member exists
        const memRef = doc(db, 'orgs', ORG_ID, 'members', u.uid);
        if (!(await getDoc(memRef)).exists()) {
          const existing = await getDocs(query(collection(db, 'orgs', ORG_ID, 'members'), limit(1)));
          const isFirst = existing.empty;
          const role: Role = isFirst ? 'owner' : 'member';
          const direccionTeam = loadedTeams.find(t => t.name.toLowerCase().includes('direcci')) || loadedTeams[0];
          const firstTeam = direccionTeam?.id || loadedTeams[0]?.id || '';

          await setDoc(memRef, {
            userId: u.uid, orgId: ORG_ID, role,
            teamId: isFirst ? firstTeam : '',
            teamIds: isFirst ? loadedTeams.map(t => t.id) : [],
            displayName: u.displayName || u.email?.split('@')[0] || 'User',
            email: u.email || '',
            title: isFirst ? 'Managing Partner' : '',
            department: isFirst ? (direccionTeam?.name || '') : '',
            managerId: '',
            hierarchyLevel: isFirst ? 'owner' : 'member',
            photoURL: u.photoURL || '',
            active: true,
            joinedAt: serverTimestamp(),
          });
        }

        const meData = (await getDoc(memRef)).data() as Member;
        if (!meData.teamIds) meData.teamIds = meData.teamId ? [meData.teamId] : [];
        setMe(meData);

        // Load all members
        const allMembersSnap = await getDocs(collection(db, 'orgs', ORG_ID, 'members'));
        const allMems = allMembersSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Member));
        setAllMembers(allMems);

        // Load permissions matrix
        try {
          const permDoc = await getDoc(doc(db, 'orgs', ORG_ID, 'settings', 'permissions'));
          if (permDoc.exists() && permDoc.data()?.matrix) {
            setPermMatrix(permDoc.data().matrix);
          }
        } catch { /* Use defaults */ }

        // Set active team
        const userIsAdmin = meData.role === 'owner' || meData.role === 'admin';
        const userIsDirector = userIsAdmin || meData.hierarchyLevel === 'director';
        const userCanSeeAll = userIsAdmin || userIsDirector;
        setActiveTeamIdRaw(userCanSeeAll ? '__all__' : (meData.teamId || meData.teamIds?.[0] || ''));

        setLoading(false);
      } catch (e) {
        console.error('Auth bootstrap:', e);
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
