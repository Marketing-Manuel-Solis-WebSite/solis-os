'use client';

// ============================================================
// Access Requests — CRUD for requesting access to private
// resources (spaces, folders, lists, docs, etc.)
// ============================================================

import {
  collection, doc, addDoc, updateDoc, getDocs, query, where,
  orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId, ORG_ID as ORG } from '@/lib/org';

// Multi-tenant ready: resolve org at call-time
function reqCol() { return `orgs/${getCurrentOrgId()}/accessRequests`; }

export interface AccessRequest {
  id: string;
  orgId: string;
  resourceType: string;   // 'space' | 'folder' | 'list' | 'doc' | 'channel' etc.
  resourceId: string;
  resourceName: string;
  requesterId: string;
  requesterName: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: any;
  reviewNote?: string;
  createdAt: any;
}

/**
 * Check whether the user already has a pending request for this resource.
 */
export async function hasExistingRequest(
  resourceType: string,
  resourceId: string,
  userId: string,
): Promise<boolean> {
  const q = query(
    collection(db, reqCol()),
    where('resourceType', '==', resourceType),
    where('resourceId', '==', resourceId),
    where('requesterId', '==', userId),
    where('status', '==', 'pending'),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Submit an access request. Throws if a pending request already exists.
 */
export async function requestAccess(
  resourceType: string,
  resourceId: string,
  resourceName: string,
  userId: string,
  userName: string,
  reason?: string,
): Promise<string> {
  const existing = await hasExistingRequest(resourceType, resourceId, userId);
  if (existing) throw new Error('Request already pending');

  const ref = await addDoc(collection(db, reqCol()), {
    orgId: getCurrentOrgId(),
    resourceType,
    resourceId,
    resourceName,
    requesterId: userId,
    requesterName: userName,
    reason: reason || '',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Approve a pending access request.
 */
export async function approveRequest(
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNote?: string,
): Promise<void> {
  await updateDoc(doc(db, reqCol(), requestId), {
    status: 'approved',
    reviewerId,
    reviewerName,
    reviewNote: reviewNote || '',
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Deny a pending access request.
 */
export async function denyRequest(
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNote?: string,
): Promise<void> {
  await updateDoc(doc(db, reqCol(), requestId), {
    status: 'denied',
    reviewerId,
    reviewerName,
    reviewNote: reviewNote || '',
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Get all pending access requests for the org (admin view).
 */
export async function getPendingRequests(maxResults = 100): Promise<AccessRequest[]> {
  const q = query(
    collection(db, reqCol()),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest));
}

/**
 * Get all access requests for the org (any status).
 */
export async function getAllRequests(maxResults = 200): Promise<AccessRequest[]> {
  const q = query(
    collection(db, reqCol()),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest));
}

/**
 * Get access requests submitted by a specific user.
 */
export async function getMyRequests(userId: string, maxResults = 50): Promise<AccessRequest[]> {
  const q = query(
    collection(db, reqCol()),
    where('requesterId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest));
}
