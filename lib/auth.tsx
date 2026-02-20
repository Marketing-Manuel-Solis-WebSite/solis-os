'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, limit, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type Role = 'owner'|'admin'|'manager'|'member'|'guest';

export interface Team { id: string; name: string; color: string; icon: string; description: string; }

export interface Member {
  userId: string; orgId: string; role: Role;
  teamId: string;       // Primary team/department
  teamIds: string[];     // All teams (owner/admin get all)
  displayName: string; email: string; title: string;
  department: string; managerId: string; photoURL: string; active: boolean;
}

interface Ctx {
  user: User|null; me: Member|null; loading: boolean; isAdmin: boolean;
  teams: Team[];
  activeTeamId: string;
  setActiveTeamId: (id: string) => void;
  canSeeAllTeams: boolean;
  teamMembers: Member[];
  refreshTeams: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>({
  user:null, me:null, loading:true, isAdmin:false,
  teams:[], activeTeamId:'', setActiveTeamId:()=>{}, canSeeAllTeams:false, teamMembers:[],
  refreshTeams: async()=>{}, refreshMembers: async()=>{},
});

// Default departments for the law office
const DEFAULT_TEAMS: Omit<Team,'id'>[] = [
  { name:'Marketing', color:'#8B5CF6', icon:'📣', description:'Marketing & social media campaigns' },
  { name:'Openers', color:'#3B82F6', icon:'🚀', description:'Lead intake & case openers' },
  { name:'Closers', color:'#22C55E', icon:'🎯', description:'Case closers & client conversion' },
  { name:'Dirección', color:'#D4A843', icon:'👔', description:'Management & executive team' },
];

const ORG_ID = 'solis-center';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<Ctx,'setActiveTeamId'|'refreshTeams'|'refreshMembers'>>({
    user:null, me:null, loading:true, isAdmin:false,
    teams:[], activeTeamId:'', canSeeAllTeams:false, teamMembers:[],
  });
  const [allMembers, setAllMembers] = useState<Member[]>([]);

  const setActiveTeamId = useCallback((id: string) => {
    setState(prev => ({
      ...prev, activeTeamId: id,
      teamMembers: id === '__all__'
        ? allMembers
        : allMembers.filter(m => m.teamId === id || m.teamIds?.includes(id)),
    }));
  }, [allMembers]);

  // Refresh teams from Firestore (called after admin creates/deletes teams)
  const refreshTeams = useCallback(async () => {
    const teamsCol = collection(db, 'orgs', ORG_ID, 'teams');
    const teamsSnap = await getDocs(teamsCol);
    const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
    setState(prev => ({ ...prev, teams }));
  }, []);

  // Refresh members from Firestore
  const refreshMembers = useCallback(async () => {
    const membersSnap = await getDocs(collection(db, 'orgs', ORG_ID, 'members'));
    const allMems = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Member));
    setAllMembers(allMems);
    setState(prev => ({
      ...prev,
      teamMembers: prev.activeTeamId === '__all__'
        ? allMems
        : allMems.filter(m => m.teamId === prev.activeTeamId || m.teamIds?.includes(prev.activeTeamId)),
    }));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setState({ user:null, me:null, loading:false, isAdmin:false, teams:[], activeTeamId:'', canSeeAllTeams:false, teamMembers:[] });
        return;
      }
      try {
        const orgRef = doc(db, 'orgs', ORG_ID);
        if (!(await getDoc(orgRef)).exists()) {
          await setDoc(orgRef, { name:'Law Office of Manuel Solis', slug:ORG_ID, primaryColor:'#D4A843', secondaryColor:'#0C1017', createdBy:u.uid, createdAt:serverTimestamp() });
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
        const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));

        // Ensure member
        const memRef = doc(db, 'orgs', ORG_ID, 'members', u.uid);
        if (!(await getDoc(memRef)).exists()) {
          const existing = await getDocs(query(collection(db, 'orgs', ORG_ID, 'members'), limit(1)));
          const isFirst = existing.empty;
          const role: Role = isFirst ? 'owner' : 'member';
          const direccionTeam = teams.find(t => t.name.toLowerCase().includes('direcci')) || teams[0];
          const firstTeam = direccionTeam?.id || teams[0]?.id || '';

          await setDoc(memRef, {
            userId: u.uid, orgId: ORG_ID, role,
            teamId: isFirst ? firstTeam : '',
            teamIds: isFirst ? teams.map(t => t.id) : [],
            displayName: u.displayName || u.email?.split('@')[0] || 'User',
            email: u.email || '', title: isFirst ? 'Managing Partner' : '',
            department: isFirst ? (direccionTeam?.name || '') : '',
            managerId: '', photoURL: u.photoURL || '',
            active: true, joinedAt: serverTimestamp(),
          });
        }
        const me = (await getDoc(memRef)).data() as Member;
        if (!me.teamIds) me.teamIds = me.teamId ? [me.teamId] : [];

        // Load all members
        const allMembersSnap = await getDocs(collection(db, 'orgs', ORG_ID, 'members'));
        const allMems = allMembersSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Member));
        setAllMembers(allMems);

        const isAdmin = me.role === 'owner' || me.role === 'admin';
        const canSeeAllTeams = isAdmin;
        const activeTeamId = canSeeAllTeams ? '__all__' : (me.teamId || me.teamIds[0] || '');
        const teamMembers = activeTeamId === '__all__'
          ? allMems
          : allMems.filter(m => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId));

        setState({ user: u, me, loading: false, isAdmin, teams, activeTeamId, canSeeAllTeams, teamMembers });
      } catch (e) {
        console.error('Auth bootstrap:', e);
        setState({ user: u, me: null, loading: false, isAdmin: false, teams: [], activeTeamId: '', canSeeAllTeams: false, teamMembers: [] });
      }
    });
  }, []);

  return <AuthCtx.Provider value={{ ...state, setActiveTeamId, refreshTeams, refreshMembers }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);