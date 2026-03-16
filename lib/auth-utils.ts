// ============================================
// Pure auth utilities — extracted for testability
// ============================================

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'guest' | 'readonly';

export type ResourceType =
  | 'workspace' | 'task' | 'doc' | 'channel'
  | 'automation' | 'analytics' | 'admin' | 'user' | 'org'
  | 'goal' | 'timesheet' | 'whiteboard' | 'form' | 'integration';

export type PermAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

// ============================================
// ROLE NORMALIZATION — maps any variation to canonical role
// ============================================
export function normalizeRole(raw: string | undefined | null): Role {
  if (!raw) return 'member';
  const r = raw.toLowerCase().trim();
  // Owner variations
  if (['owner', 'dueño', 'dueña', 'propietario', 'ceo', 'fundador'].includes(r)) return 'owner';
  // Admin variations
  if (['admin', 'administrador', 'administradora', 'administrator', 'superadmin', 'super_admin', 'super-admin'].includes(r)) return 'admin';
  // Manager variations
  if (['manager', 'gerente', 'supervisor', 'lead', 'líder', 'lider', 'jefe', 'jefa', 'coordinador', 'coordinadora'].includes(r)) return 'manager';
  // Guest variations
  if (['guest', 'invitado', 'invitada', 'visitante', 'externo', 'externa'].includes(r)) return 'guest';
  // Readonly variations
  if (['readonly', 'read-only', 'read_only', 'solo_lectura', 'lectura', 'viewer', 'observador'].includes(r)) return 'readonly';
  // If it's already a valid canonical role, return it
  if (['owner', 'admin', 'manager', 'member', 'guest', 'readonly'].includes(r)) return r as Role;
  // Default
  return 'member';
}

// ============================================
// DEFAULT PERMISSIONS MATRIX
// ============================================
const ALL_RESOURCES: ResourceType[] = [
  'workspace', 'task', 'doc', 'channel', 'automation', 'analytics',
  'admin', 'user', 'org', 'goal', 'timesheet', 'whiteboard', 'form', 'integration',
];

export const DEFAULT_PERMS: Record<Role, Record<ResourceType, Record<PermAction, boolean>>> = {
  owner: Object.fromEntries(
    ALL_RESOURCES.map(r => [r, { create: true, read: true, update: true, delete: true, manage: true }])
  ) as any,
  admin: Object.fromEntries(
    ALL_RESOURCES.map(r => [r, { create: true, read: true, update: true, delete: true, manage: true }])
  ) as any,
  manager: {
    workspace: { create: true, read: true, update: true, delete: false, manage: false },
    task: { create: true, read: true, update: true, delete: true, manage: true },
    doc: { create: true, read: true, update: true, delete: true, manage: true },
    channel: { create: true, read: true, update: true, delete: false, manage: true },
    automation: { create: true, read: true, update: true, delete: true, manage: false },
    analytics: { create: false, read: true, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: true, update: false, delete: false, manage: false },
    goal: { create: true, read: true, update: true, delete: true, manage: true },
    timesheet: { create: true, read: true, update: true, delete: true, manage: true },
    whiteboard: { create: true, read: true, update: true, delete: true, manage: true },
    form: { create: true, read: true, update: true, delete: true, manage: false },
    integration: { create: false, read: true, update: false, delete: false, manage: false },
  },
  member: {
    workspace: { create: false, read: true, update: false, delete: false, manage: false },
    task: { create: true, read: true, update: true, delete: false, manage: false },
    doc: { create: true, read: true, update: true, delete: false, manage: false },
    channel: { create: true, read: true, update: false, delete: false, manage: false },
    automation: { create: false, read: true, update: false, delete: false, manage: false },
    analytics: { create: false, read: true, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: true, update: false, delete: false, manage: false },
    goal: { create: true, read: true, update: true, delete: false, manage: false },
    timesheet: { create: true, read: true, update: true, delete: false, manage: false },
    whiteboard: { create: true, read: true, update: true, delete: false, manage: false },
    form: { create: false, read: false, update: false, delete: false, manage: false },
    integration: { create: false, read: false, update: false, delete: false, manage: false },
  },
  guest: {
    workspace: { create: false, read: true, update: false, delete: false, manage: false },
    task: { create: true, read: true, update: false, delete: false, manage: false },
    doc: { create: false, read: true, update: false, delete: false, manage: false },
    channel: { create: false, read: true, update: false, delete: false, manage: false },
    automation: { create: false, read: false, update: false, delete: false, manage: false },
    analytics: { create: false, read: false, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: false, update: false, delete: false, manage: false },
    goal: { create: false, read: true, update: false, delete: false, manage: false },
    timesheet: { create: false, read: true, update: false, delete: false, manage: false },
    whiteboard: { create: false, read: true, update: false, delete: false, manage: false },
    form: { create: false, read: false, update: false, delete: false, manage: false },
    integration: { create: false, read: false, update: false, delete: false, manage: false },
  },
  readonly: {
    workspace: { create: false, read: true, update: false, delete: false, manage: false },
    task: { create: false, read: true, update: false, delete: false, manage: false },
    doc: { create: false, read: true, update: false, delete: false, manage: false },
    channel: { create: false, read: true, update: false, delete: false, manage: false },
    automation: { create: false, read: false, update: false, delete: false, manage: false },
    analytics: { create: false, read: true, update: false, delete: false, manage: false },
    admin: { create: false, read: false, update: false, delete: false, manage: false },
    user: { create: false, read: true, update: false, delete: false, manage: false },
    org: { create: false, read: false, update: false, delete: false, manage: false },
    goal: { create: false, read: true, update: false, delete: false, manage: false },
    timesheet: { create: false, read: true, update: false, delete: false, manage: false },
    whiteboard: { create: false, read: true, update: false, delete: false, manage: false },
    form: { create: false, read: false, update: false, delete: false, manage: false },
    integration: { create: false, read: false, update: false, delete: false, manage: false },
  },
};

// ============================================
// ROLE HIERARCHY HELPERS
// ============================================
export function isAdmin(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}

export function isManager(role: Role): boolean {
  return isAdmin(role) || role === 'manager';
}

export function isGuest(role: Role): boolean {
  return role === 'guest';
}

export function isReadonly(role: Role): boolean {
  return role === 'readonly';
}

/** Returns true if the role has at least member-level access (not guest/readonly) */
export function isFullMember(role: Role): boolean {
  return !isGuest(role) && !isReadonly(role);
}
