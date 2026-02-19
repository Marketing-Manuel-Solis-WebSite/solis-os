'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, limit, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type Role = 'owner'|'admin'|'manager'|'member'|'guest';

export interface Member {
  userId: string; orgId: string; role: Role; displayName: string; email: string;
  title: string; department: string; managerId: string; photoURL: string; active: boolean;
}

interface Ctx {
  user: User|null; me: Member|null; loading: boolean; isAdmin: boolean;
}

const AuthCtx = createContext<Ctx>({ user: null, me: null, loading: true, isAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Ctx>({ user: null, me: null, loading: true, isAdmin: false });

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setState({ user: null, me: null, loading: false, isAdmin: false }); return; }
      try {
        const O = 'solis-center';
        // Ensure org
        const orgRef = doc(db, 'orgs', O);
        if (!(await getDoc(orgRef)).exists()) {
          await setDoc(orgRef, { name: 'Law Office of Manuel Solis', slug: O, primaryColor: '#D4A843', secondaryColor: '#0C1017', createdBy: u.uid, createdAt: serverTimestamp() });
        }
        // Ensure membership
        const memRef = doc(db, 'orgs', O, 'members', u.uid);
        if (!(await getDoc(memRef)).exists()) {
          const existing = await getDocs(query(collection(db, 'orgs', O, 'members'), limit(1)));
          const role: Role = existing.empty ? 'owner' : 'member';
          await setDoc(memRef, {
            userId: u.uid, orgId: O, role, displayName: u.displayName || u.email?.split('@')[0] || 'User',
            email: u.email || '', title: role === 'owner' ? 'Managing Partner' : '', department: '',
            managerId: '', photoURL: u.photoURL || '', active: true, joinedAt: serverTimestamp(),
          });
        }
        const me = (await getDoc(memRef)).data() as Member;
        setState({ user: u, me, loading: false, isAdmin: me.role === 'owner' || me.role === 'admin' });
      } catch (e) {
        console.error('Auth bootstrap:', e);
        setState({ user: u, me: null, loading: false, isAdmin: false });
      }
    });
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
