// ================================================================
// Share Links — Token-based resource sharing
// ================================================================
// Generates unique, expirable share links for tasks, docs, goals,
// and whiteboards. Supports permission levels (view, comment, edit).

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export type SharePermission = 'view' | 'comment' | 'edit';
export type ShareableResource = 'task' | 'doc' | 'goal' | 'whiteboard';

export interface ShareLink {
  id: string;
  orgId: string;
  token: string;
  resourceType: ShareableResource;
  resourceId: string;
  resourceTitle: string;
  permission: SharePermission;
  createdBy: string;
  createdByName: string;
  expiresAt: any;           // null = never expires
  maxUses: number | null;   // null = unlimited
  useCount: number;
  password: string | null;  // optional password protection
  active: boolean;
  allowedEmails: string[];  // empty = anyone with link
  createdAt: any;
  updatedAt: any;
}

// ---- Token Generation ----

function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  for (const byte of array) {
    token += chars[byte % chars.length];
  }
  return token;
}

// ---- CRUD Operations ----

export async function createShareLink(data: {
  resourceType: ShareableResource;
  resourceId: string;
  resourceTitle: string;
  permission: SharePermission;
  createdBy: string;
  createdByName: string;
  expiresAt?: any;
  maxUses?: number | null;
  password?: string | null;
  allowedEmails?: string[];
}): Promise<{ id: string; token: string }> {
  const token = generateShareToken();

  const ref = await addDoc(collection(db, 'shareLinks'), {
    orgId: ORG,
    token,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    resourceTitle: data.resourceTitle,
    permission: data.permission,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    expiresAt: data.expiresAt || null,
    maxUses: data.maxUses ?? null,
    useCount: 0,
    password: data.password || null,
    active: true,
    allowedEmails: data.allowedEmails || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: ref.id, token };
}

export async function getShareLinkByToken(token: string): Promise<ShareLink | null> {
  const q = query(
    collection(db, 'shareLinks'),
    where('token', '==', token),
    where('active', '==', true),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ShareLink;
}

export async function getShareLinksForResource(
  resourceType: ShareableResource,
  resourceId: string,
): Promise<ShareLink[]> {
  const q = query(
    collection(db, 'shareLinks'),
    where('orgId', '==', ORG),
    where('resourceType', '==', resourceType),
    where('resourceId', '==', resourceId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShareLink));
}

export async function revokeShareLink(id: string): Promise<void> {
  await updateDoc(doc(db, 'shareLinks', id), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteShareLink(id: string): Promise<void> {
  await deleteDoc(doc(db, 'shareLinks', id));
}

// ---- Validation ----

export interface ShareLinkValidation {
  valid: boolean;
  link?: ShareLink;
  error?: 'not_found' | 'expired' | 'max_uses' | 'email_restricted' | 'inactive';
}

export async function validateShareLink(
  token: string,
  accessorEmail?: string,
): Promise<ShareLinkValidation> {
  const link = await getShareLinkByToken(token);

  if (!link) {
    return { valid: false, error: 'not_found' };
  }

  if (!link.active) {
    return { valid: false, error: 'inactive' };
  }

  // Check expiration
  if (link.expiresAt) {
    const expires = link.expiresAt?.seconds
      ? link.expiresAt.seconds * 1000
      : new Date(link.expiresAt).getTime();
    if (Date.now() > expires) {
      return { valid: false, error: 'expired' };
    }
  }

  // Check max uses
  if (link.maxUses !== null && link.useCount >= link.maxUses) {
    return { valid: false, error: 'max_uses' };
  }

  // Check email restriction
  if (link.allowedEmails.length > 0 && accessorEmail) {
    if (!link.allowedEmails.includes(accessorEmail.toLowerCase())) {
      return { valid: false, error: 'email_restricted' };
    }
  }

  return { valid: true, link };
}

/**
 * Record a share link access (increment use count).
 */
export async function recordShareLinkAccess(linkId: string): Promise<void> {
  const ref = doc(db, 'shareLinks', linkId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current = snap.data()?.useCount || 0;
  await updateDoc(ref, {
    useCount: current + 1,
    lastAccessedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
