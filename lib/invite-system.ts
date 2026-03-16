// ================================================================
// Invite System — Create, send, accept org invitations
// ================================================================
// Supports email-based invitations with role assignment,
// team assignment, expiry, and acceptance flow.

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: string;
  teamId: string;
  teamName: string;
  token: string;
  status: InviteStatus;
  invitedBy: string;
  invitedByName: string;
  message: string;
  expiresAt: any;
  acceptedAt: any;
  acceptedBy: string | null;
  createdAt: any;
  updatedAt: any;
}

// ---- Token Generation ----

function generateInviteToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'inv_';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  for (const byte of array) {
    token += chars[byte % chars.length];
  }
  return token;
}

// ---- CRUD ----

export async function createInvitation(data: {
  email: string;
  role: string;
  teamId: string;
  teamName: string;
  invitedBy: string;
  invitedByName: string;
  message?: string;
  expiresInDays?: number;
}): Promise<{ id: string; token: string }> {
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

  // Check if there's already a pending invite for this email
  const existing = await getPendingInviteByEmail(data.email);
  if (existing) {
    // Revoke old invite
    await updateDoc(doc(db, 'orgs', ORG, 'invitations', existing.id), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  }

  const ref = await addDoc(collection(db, 'orgs', ORG, 'invitations'), {
    orgId: ORG,
    email: data.email.toLowerCase().trim(),
    role: data.role,
    teamId: data.teamId,
    teamName: data.teamName,
    token,
    status: 'pending' as InviteStatus,
    invitedBy: data.invitedBy,
    invitedByName: data.invitedByName,
    message: data.message || '',
    expiresAt,
    acceptedAt: null,
    acceptedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: ref.id, token };
}

export async function getInvitation(id: string): Promise<Invitation | null> {
  const snap = await getDoc(doc(db, 'orgs', ORG, 'invitations', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invitation;
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const q = query(
    collection(db, 'orgs', ORG, 'invitations'),
    where('token', '==', token),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Invitation;
}

export async function getPendingInviteByEmail(email: string): Promise<Invitation | null> {
  const q = query(
    collection(db, 'orgs', ORG, 'invitations'),
    where('email', '==', email.toLowerCase().trim()),
    where('status', '==', 'pending'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Invitation;
}

export async function getPendingInvitations(): Promise<Invitation[]> {
  const q = query(
    collection(db, 'orgs', ORG, 'invitations'),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Invitation))
    .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getAllInvitations(): Promise<Invitation[]> {
  const snap = await getDocs(collection(db, 'orgs', ORG, 'invitations'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Invitation))
    .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// ---- Validation & Acceptance ----

export interface InviteValidation {
  valid: boolean;
  invite?: Invitation;
  error?: 'not_found' | 'expired' | 'already_accepted' | 'revoked';
}

export function validateInvitation(invite: Invitation): InviteValidation {
  if (invite.status === 'accepted') {
    return { valid: false, invite, error: 'already_accepted' };
  }

  if (invite.status === 'revoked') {
    return { valid: false, invite, error: 'revoked' };
  }

  if (invite.expiresAt) {
    const expires = invite.expiresAt?.seconds
      ? invite.expiresAt.seconds * 1000
      : new Date(invite.expiresAt).getTime();
    if (Date.now() > expires) {
      return { valid: false, invite, error: 'expired' };
    }
  }

  return { valid: true, invite };
}

export async function validateInviteToken(token: string): Promise<InviteValidation> {
  const invite = await getInvitationByToken(token);
  if (!invite) return { valid: false, error: 'not_found' };
  return validateInvitation(invite);
}

/**
 * Accept an invitation — marks it as accepted.
 * The actual member creation should happen in the auth flow
 * using the invite data (role, teamId).
 */
export async function acceptInvitation(
  inviteId: string,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, 'orgs', ORG, 'invitations', inviteId), {
    status: 'accepted' as InviteStatus,
    acceptedAt: serverTimestamp(),
    acceptedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function revokeInvitation(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'orgs', ORG, 'invitations', inviteId), {
    status: 'revoked' as InviteStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInvitation(inviteId: string): Promise<void> {
  await deleteDoc(doc(db, 'orgs', ORG, 'invitations', inviteId));
}

/**
 * Clean up expired invitations (bulk operation for cron/admin).
 */
export async function cleanupExpiredInvitations(): Promise<number> {
  const q = query(
    collection(db, 'orgs', ORG, 'invitations'),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  let cleaned = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (data.expiresAt) {
      const expires = data.expiresAt?.seconds
        ? data.expiresAt.seconds * 1000
        : new Date(data.expiresAt).getTime();
      if (Date.now() > expires) {
        await updateDoc(d.ref, { status: 'expired', updatedAt: serverTimestamp() });
        cleaned++;
      }
    }
  }

  return cleaned;
}
