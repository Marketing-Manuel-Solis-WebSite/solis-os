// ================================================================
// Custom Roles — org-level role definitions with permission matrices
// ================================================================
// Stored at: orgs/{orgId}/settings/customRoles/{roleId}
// Admin-only write, org members can read.

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';

// ---- Types ----

export type ResourceType = 'task' | 'doc' | 'list' | 'space' | 'goal' | 'automation' | 'channel';
export type PermAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

export interface CustomRole {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  permissions: Record<ResourceType, Record<PermAction, boolean>>;
  createdAt: any;
  updatedAt?: any;
}

// ---- Constants ----

export const RESOURCE_TYPES: ResourceType[] = ['task', 'doc', 'list', 'space', 'goal', 'automation', 'channel'];
export const PERM_ACTIONS: PermAction[] = ['create', 'read', 'update', 'delete', 'manage'];

/** Default permission matrix for a new custom role — everything off */
export function emptyPermissions(): Record<ResourceType, Record<PermAction, boolean>> {
  return Object.fromEntries(
    RESOURCE_TYPES.map(r => [r, Object.fromEntries(PERM_ACTIONS.map(a => [a, false]))])
  ) as Record<ResourceType, Record<PermAction, boolean>>;
}

// ---- Firestore Path ----

function rolesCol() {
  return collection(db, 'orgs', ORG, 'settings', 'customRoles', 'roles');
}

function roleDoc(roleId: string) {
  return doc(db, 'orgs', ORG, 'settings', 'customRoles', 'roles', roleId);
}

// ---- CRUD ----

export async function getCustomRoles(): Promise<CustomRole[]> {
  const q = query(rolesCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole));
}

export async function getCustomRole(roleId: string): Promise<CustomRole | null> {
  const snap = await getDoc(roleDoc(roleId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CustomRole;
}

export async function createCustomRole(
  data: Omit<CustomRole, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(rolesCol(), {
    ...data,
    orgId: ORG,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomRole(
  roleId: string,
  data: Partial<Omit<CustomRole, 'id' | 'orgId' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(roleDoc(roleId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCustomRole(roleId: string): Promise<void> {
  await deleteDoc(roleDoc(roleId));
}
