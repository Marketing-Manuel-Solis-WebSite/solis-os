'use client';

import { collection, query, where, getDocs, orderBy, doc, deleteDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';
import type { ViewDefinition, ViewScopeType } from '@/types';

function viewsCol() {
  const orgId = getCurrentOrgId();
  return collection(db, 'orgs', orgId, 'views');
}

export async function getViewsForScope(
  scopeType: ViewScopeType,
  scopeId: string,
  userId: string
): Promise<ViewDefinition[]> {
  const col = viewsCol();
  const q = query(col, where('scopeType', '==', scopeType), where('scopeId', '==', scopeId), orderBy('position', 'asc'));
  const snap = await getDocs(q);
  const views = snap.docs.map(d => ({ id: d.id, ...d.data() } as ViewDefinition));
  // Filter: show private only if owned by user, plus public/protected/required
  return views.filter(v =>
    v.visibility !== 'private' || v.createdBy === userId
  );
}

export async function createView(
  data: Omit<ViewDefinition, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = viewsCol();
  const ref = await addDoc(col, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateView(
  viewId: string,
  data: Partial<ViewDefinition>
): Promise<void> {
  const col = viewsCol();
  const ref = doc(col, viewId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteView(viewId: string): Promise<void> {
  const col = viewsCol();
  const ref = doc(col, viewId);
  await deleteDoc(ref);
}

export async function pinView(viewId: string, isPinned: boolean): Promise<void> {
  await updateView(viewId, { isPinned } as any);
}

export async function setDefaultView(viewId: string, isDefault: boolean): Promise<void> {
  await updateView(viewId, { isDefault } as any);
}

export async function shareViewByLink(viewId: string): Promise<string> {
  const token = crypto.randomUUID();
  await updateView(viewId, { shareToken: token } as any);
  return token;
}

export async function getViewByShareToken(token: string): Promise<ViewDefinition | null> {
  const col = viewsCol();
  const q = query(col, where('shareToken', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ViewDefinition;
}

export async function createArtifactView(
  scopeType: ViewScopeType,
  scopeId: string,
  artifactType: string,
  artifactId: string,
  name: string,
  createdBy: string,
  orgId: string
): Promise<string> {
  return createView({
    orgId,
    scopeType,
    scopeId,
    name,
    viewType: artifactType,
    artifactType: artifactType as any,
    artifactId,
    visibility: 'public',
    isDefault: false,
    isPinned: false,
    position: 999,
    config: {},
    sharedWith: [],
    createdBy,
  });
}
