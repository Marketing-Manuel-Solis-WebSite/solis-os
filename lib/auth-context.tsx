'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'guest' | 'readonly';

export interface Membership {
  userId: string;
  orgId: string;
  role: UserRole;
  displayName: string;
  email: string;
  title: string;
  department: string;
  managerId: string;
  teams: string[];
  active: boolean;
  photoURL: string;
  joinedAt: any;
}

export interface OrgData {
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  createdBy: string;
  createdAt: any;
}

interface AuthCtx {
  user: User | null;
  membership: Membership | null;
  orgId: string | null;
  orgData: OrgData | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null, membership: null, orgId: null, orgData: null, loading: true, isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthCtx>({
    user: null, membership: null, orgId: null, orgData: null, loading: true, isAdmin: false,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, membership: null, orgId: null, orgData: null, loading: false, isAdmin: false });
        return;
      }

      try {
        // Find or create org + membership
        const { membership, orgId, orgData } = await ensureOrgAndMembership(firebaseUser);
        const isAdmin = membership.role === 'owner' || membership.role === 'admin';
        setState({ user: firebaseUser, membership, orgId, orgData, loading: false, isAdmin });
      } catch (err) {
        console.error('Auth bootstrap error:', err);
        setState({ user: firebaseUser, membership: null, orgId: null, orgData: null, loading: false, isAdmin: false });
      }
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// --- Bootstrap: ensure org exists, ensure user has membership ---
async function ensureOrgAndMembership(user: User) {
  const ORG_ID = 'solis-center'; // single-tenant for now

  // 1. Check if org exists, if not create it (first user becomes owner)
  const orgRef = doc(db, 'orgs', ORG_ID);
  let orgSnap = await getDoc(orgRef);

  if (!orgSnap.exists()) {
    const orgData: OrgData = {
      name: 'Law Office of Manuel Solis',
      slug: 'solis-center',
      primaryColor: '#C9A84C',
      secondaryColor: '#1B2A4A',
      timezone: 'America/Chicago',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };
    await setDoc(orgRef, orgData);
    orgSnap = await getDoc(orgRef);
  }

  // 2. Check if user has membership
  const memberRef = doc(db, 'orgs', ORG_ID, 'members', user.uid);
  let memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists()) {
    // Check if this is the first member (becomes owner)
    const membersQ = query(collection(db, 'orgs', ORG_ID, 'members'), limit(1));
    const existingMembers = await getDocs(membersQ);
    const isFirstUser = existingMembers.empty;

    const membership: Membership = {
      userId: user.uid,
      orgId: ORG_ID,
      role: isFirstUser ? 'owner' : 'member',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      title: isFirstUser ? 'Owner' : '',
      department: '',
      managerId: '',
      teams: [],
      active: true,
      photoURL: user.photoURL || '',
      joinedAt: serverTimestamp(),
    };
    await setDoc(memberRef, membership);
    memberSnap = await getDoc(memberRef);
  }

  const membership = memberSnap.data() as Membership;
  const orgData = orgSnap.data() as OrgData;

  return { membership, orgId: ORG_ID, orgData };
}
