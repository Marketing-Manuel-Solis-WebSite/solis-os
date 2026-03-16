// ================================================================
// Granular Permissions — Per-user overrides & field-level control
// ================================================================
// Extends the default role-based matrix with:
//   1. Per-user permission overrides (grant/deny specific actions)
//   2. Field-level permissions (restrict who can edit specific fields)
//   3. Resource-scoped permissions (per-team, per-space overrides)

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_PERMS } from './auth-utils';
import type { Role, ResourceType, PermAction } from './auth-utils';
import { ORG_ID as ORG } from '@/lib/org';
import type { CustomRole, ResourceType as CRResourceType, PermAction as CRPermAction } from './custom-roles';



// ---- Types ----

export interface PermissionOverride {
  resource: ResourceType;
  action: PermAction;
  granted: boolean;
  reason?: string;
}

export interface UserPermissionProfile {
  userId: string;
  overrides: PermissionOverride[];
  fieldRestrictions: FieldRestriction[];
  scopedPermissions: ScopedPermission[];
  updatedAt: any;
  updatedBy: string;
}

export interface FieldRestriction {
  resource: ResourceType;
  field: string;          // e.g. 'priority', 'assignees', 'dueDate'
  allowedRoles: Role[];   // roles that CAN edit this field
  allowedUsers?: string[]; // specific user IDs that can also edit
}

export interface ScopedPermission {
  resource: ResourceType;
  action: PermAction;
  scope: 'team' | 'space';
  scopeId: string;        // teamId or spaceId
  granted: boolean;
}

// ---- Default Field Restrictions ----

export const DEFAULT_FIELD_RESTRICTIONS: FieldRestriction[] = [
  // Only managers+ can change task priority to urgent
  { resource: 'task', field: 'priority', allowedRoles: ['owner', 'admin', 'manager'], allowedUsers: [] },
  // Only managers+ can reassign tasks
  { resource: 'task', field: 'assignees', allowedRoles: ['owner', 'admin', 'manager'], allowedUsers: [] },
  // Only managers+ can change goal status
  { resource: 'goal', field: 'status', allowedRoles: ['owner', 'admin', 'manager'], allowedUsers: [] },
  // Only admins can change automation enabled state
  { resource: 'automation', field: 'enabled', allowedRoles: ['owner', 'admin'], allowedUsers: [] },
];

// ---- Permission Resolution ----

/**
 * Resolve effective permission for a user, merging:
 *   1. Role-based defaults (DEFAULT_PERMS)
 *   2. Org-level custom matrix (from settings/permissions)
 *   3. Per-user overrides (from settings/userPermissions/{userId})
 */
export function resolvePermission(
  role: Role,
  resource: ResourceType,
  action: PermAction,
  orgMatrix?: Record<string, Record<string, Record<string, boolean>>> | null,
  userOverrides?: PermissionOverride[],
): boolean {
  // 1. Per-user override takes highest priority
  if (userOverrides?.length) {
    const override = userOverrides.find(o => o.resource === resource && o.action === action);
    if (override !== undefined) return override.granted;
  }

  // 2. Org-level custom matrix
  if (orgMatrix?.[role]?.[resource]?.[action] !== undefined) {
    return !!orgMatrix[role][resource][action];
  }

  // 3. Default role matrix
  return DEFAULT_PERMS[role]?.[resource]?.[action] ?? false;
}

/**
 * Check if a user can edit a specific field on a resource.
 */
export function canEditField(
  role: Role,
  userId: string,
  resource: ResourceType,
  field: string,
  fieldRestrictions?: FieldRestriction[],
): boolean {
  const restrictions = fieldRestrictions || DEFAULT_FIELD_RESTRICTIONS;
  const restriction = restrictions.find(r => r.resource === resource && r.field === field);

  // No restriction on this field → anyone who can update the resource can edit
  if (!restriction) return true;

  // Check if role is allowed
  if (restriction.allowedRoles.includes(role)) return true;

  // Check if user is specifically allowed
  if (restriction.allowedUsers?.includes(userId)) return true;

  return false;
}

/**
 * Check scoped permission (team/space level).
 */
export function checkScopedPermission(
  role: Role,
  resource: ResourceType,
  action: PermAction,
  scopeType: 'team' | 'space',
  scopeId: string,
  scopedPermissions?: ScopedPermission[],
  orgMatrix?: Record<string, Record<string, Record<string, boolean>>> | null,
): boolean {
  // Check for scoped override first
  if (scopedPermissions?.length) {
    const scoped = scopedPermissions.find(
      s => s.resource === resource && s.action === action && s.scope === scopeType && s.scopeId === scopeId,
    );
    if (scoped !== undefined) return scoped.granted;
  }

  // Fall back to org-level resolution
  return resolvePermission(role, resource, action, orgMatrix);
}

// ---- Custom Role Resolution ----

/**
 * Resolve whether a custom role grants a specific permission.
 * Returns false if the resource/action combination doesn't exist in the matrix.
 */
export function resolveCustomRolePermission(
  role: CustomRole,
  resource: CRResourceType,
  action: CRPermAction,
): boolean {
  return role.permissions?.[resource]?.[action] ?? false;
}

// ---- Firestore CRUD ----

export async function getUserPermissionProfile(userId: string): Promise<UserPermissionProfile | null> {
  const ref = doc(db, 'orgs', ORG, 'settings', 'userPermissions', 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserPermissionProfile;
}

export async function saveUserPermissionProfile(
  userId: string,
  profile: Partial<UserPermissionProfile>,
  updatedBy: string,
): Promise<void> {
  const ref = doc(db, 'orgs', ORG, 'settings', 'userPermissions', 'users', userId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      ...profile,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  } else {
    await setDoc(ref, {
      userId,
      overrides: [],
      fieldRestrictions: [],
      scopedPermissions: [],
      ...profile,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  }
}

export async function getFieldRestrictions(): Promise<FieldRestriction[]> {
  const ref = doc(db, 'orgs', ORG, 'settings', 'fieldRestrictions');
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_FIELD_RESTRICTIONS;
  return snap.data()?.restrictions || DEFAULT_FIELD_RESTRICTIONS;
}

export async function saveFieldRestrictions(
  restrictions: FieldRestriction[],
  updatedBy: string,
): Promise<void> {
  const ref = doc(db, 'orgs', ORG, 'settings', 'fieldRestrictions');
  await setDoc(ref, {
    restrictions,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}
