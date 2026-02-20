'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, limit, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type Role = 'owner'|'admin'|'manager'|'member'|'guest';

export interface Team { id: string; name: string; color: string; icon: string; description: string; }

export interface Member {
  userId: string; orgId: string; role: Role;
  teamId: string;       // Primary team — determines default view
  teamIds: string[];     // All teams (owner/admin get all)
  displayName: string; email: string; title: string;
  department: string; managerId: string; photoURL: string; active: boolean;
}

interface Ctx {
  user: User|null; me: Member|null; loading: boolean; isAdmin: boolean;
  teams: Team[];
  activeTeamId: string;           // '__all__' for admins viewing everything
  setActiveTeamId: (id: string) => void;
  canSeeAllTeams: boolean;
  teamMembers: Member[];          // members of activeTeamId (or all if __all__)
}

const AuthCtx = createContext<Ctx>({
  user:null, me:null, loading:true, isAdmin:false,
  teams:[], activeTeamId:'', setActiveTeamId:()=>{}, canSeeAllTeams:false, teamMembers:[],
});

const DEFAULT_TEAMS: Omit<Team,'id'>[] = [
  { name:'Marketing', color:'#8B5CF6', icon:'📣', description:'Marketing & social media' },
  { name:'Openers', color:'#3B82F6', icon:'🚀', description:'Lead intake & case openers' },
  { name:'Legal', color:'#D4A843', icon:'⚖️', description:'Attorneys & paralegals' },
  { name:'Sales', color:'#22C55E', icon:'💼', description:'Sales & client relations' },
  { name:'Operations', color:'#F59E0B', icon:'⚙️', description:'Office operations' },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<Ctx,'setActiveTeamId'>>({
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

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setState({ user:null, me:null, loading:false, isAdmin:false, teams:[], activeTeamId:'', canSeeAllTeams:false, teamMembers:[] }); return; }
      try {
        const O = 'solis-center';
        const orgRef = doc(db, 'orgs', O);
        if (!(await getDoc(orgRef)).exists()) {
          await setDoc(orgRef, { name:'Law Office of Manuel Solis', slug:O, primaryColor:'#D4A843', secondaryColor:'#0C1017', createdBy:u.uid, createdAt:serverTimestamp() });
        }
        // Ensure teams
        const teamsCol = collection(db, 'orgs', O, 'teams');
        let teamsSnap = await getDocs(teamsCol);
        if (teamsSnap.empty) {
          for (const t of DEFAULT_TEAMS) {
            await setDoc(doc(db, 'orgs', O, 'teams', t.name.toLowerCase().replace(/\s+/g,'-')), t);
          }
          teamsSnap = await getDocs(teamsCol);
        }
        const teams = teamsSnap.docs.map(d => ({ id:d.id, ...d.data() } as Team));

        // Ensure member
        const memRef = doc(db, 'orgs', O, 'members', u.uid);
        if (!(await getDoc(memRef)).exists()) {
          const existing = await getDocs(query(collection(db, 'orgs', O, 'members'), limit(1)));
          const isFirst = existing.empty;
          const role: Role = isFirst ? 'owner' : 'member';
          const firstTeam = teams[0]?.id || '';
          await setDoc(memRef, {
            userId: u.uid, orgId: O, role,
            teamId: isFirst ? '' : firstTeam,
            teamIds: isFirst ? teams.map(t=>t.id) : [firstTeam],
            displayName: u.displayName || u.email?.split('@')[0] || 'User',
            email: u.email||'', title: isFirst ? 'Managing Partner' : '',
            department:'', managerId:'', photoURL: u.photoURL||'',
            active: true, joinedAt: serverTimestamp(),
          });
        }
        const me = (await getDoc(memRef)).data() as Member;
        if (!me.teamIds) me.teamIds = me.teamId ? [me.teamId] : [];

        // Load all members
        const allMembersSnap = await getDocs(collection(db, 'orgs', O, 'members'));
        const allMems = allMembersSnap.docs.map(d => ({ id:d.id, ...d.data() } as Member));
        setAllMembers(allMems);

        const isAdmin = me.role === 'owner' || me.role === 'admin';
        const canSeeAllTeams = isAdmin;
        const activeTeamId = canSeeAllTeams ? '__all__' : (me.teamId || me.teamIds[0] || '');
        const teamMembers = activeTeamId === '__all__'
          ? allMems
          : allMems.filter(m => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId));

        setState({ user:u, me, loading:false, isAdmin, teams, activeTeamId, canSeeAllTeams, teamMembers });
      } catch (e) {
        console.error('Auth bootstrap:', e);
        setState({ user:u, me:null, loading:false, isAdmin:false, teams:[], activeTeamId:'', canSeeAllTeams:false, teamMembers:[] });
      }
    });
  }, []);

  return <AuthCtx.Provider value={{ ...state, setActiveTeamId }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
