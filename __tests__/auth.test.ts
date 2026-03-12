import { describe, it, expect } from 'vitest';
import { normalizeRole, DEFAULT_PERMS, isAdmin, isManager } from '../lib/auth-utils';
import type { Role, ResourceType, PermAction } from '../lib/auth-utils';

// ============================================
// normalizeRole
// ============================================
describe('normalizeRole', () => {
  // Canonical English roles
  it('returns "owner" for "owner"', () => {
    expect(normalizeRole('owner')).toBe('owner');
  });

  it('returns "admin" for "admin"', () => {
    expect(normalizeRole('admin')).toBe('admin');
  });

  it('returns "manager" for "manager"', () => {
    expect(normalizeRole('manager')).toBe('manager');
  });

  it('returns "member" for "member"', () => {
    expect(normalizeRole('member')).toBe('member');
  });

  it('returns "guest" for "guest"', () => {
    expect(normalizeRole('guest')).toBe('guest');
  });

  it('returns "readonly" for "readonly"', () => {
    expect(normalizeRole('readonly')).toBe('readonly');
  });

  // Spanish variations
  it('returns "owner" for "dueño" (Spanish)', () => {
    expect(normalizeRole('dueño')).toBe('owner');
  });

  it('returns "admin" for "administrador" (Spanish)', () => {
    expect(normalizeRole('administrador')).toBe('admin');
  });

  it('returns "manager" for "gerente" (Spanish)', () => {
    expect(normalizeRole('gerente')).toBe('manager');
  });

  it('returns "guest" for "invitado" (Spanish)', () => {
    expect(normalizeRole('invitado')).toBe('guest');
  });

  it('returns "readonly" for "solo_lectura" (Spanish)', () => {
    expect(normalizeRole('solo_lectura')).toBe('readonly');
  });

  // Defaults for falsy/unknown input
  it('returns "member" for undefined', () => {
    expect(normalizeRole(undefined)).toBe('member');
  });

  it('returns "member" for null', () => {
    expect(normalizeRole(null)).toBe('member');
  });

  it('returns "member" for empty string', () => {
    expect(normalizeRole('')).toBe('member');
  });

  it('returns "member" for unknown string', () => {
    expect(normalizeRole('random_garbage')).toBe('member');
  });

  // Case insensitive
  it('is case insensitive: "OWNER" returns "owner"', () => {
    expect(normalizeRole('OWNER')).toBe('owner');
  });

  it('is case insensitive: "Admin" returns "admin"', () => {
    expect(normalizeRole('Admin')).toBe('admin');
  });

  // Whitespace trimmed
  it('trims whitespace: " admin " returns "admin"', () => {
    expect(normalizeRole(' admin ')).toBe('admin');
  });

  it('trims whitespace: "  guest  " returns "guest"', () => {
    expect(normalizeRole('  guest  ')).toBe('guest');
  });

  // Additional variations
  it('maps "ceo" to "owner"', () => {
    expect(normalizeRole('ceo')).toBe('owner');
  });

  it('maps "superadmin" to "admin"', () => {
    expect(normalizeRole('superadmin')).toBe('admin');
  });

  it('maps "supervisor" to "manager"', () => {
    expect(normalizeRole('supervisor')).toBe('manager');
  });

  it('maps "viewer" to "readonly"', () => {
    expect(normalizeRole('viewer')).toBe('readonly');
  });
});

// ============================================
// DEFAULT_PERMS correctness
// ============================================
describe('DEFAULT_PERMS', () => {
  const actions: PermAction[] = ['create', 'read', 'update', 'delete', 'manage'];
  const allResources: ResourceType[] = [
    'workspace', 'task', 'doc', 'channel', 'automation', 'analytics',
    'admin', 'user', 'org', 'goal', 'timesheet', 'whiteboard', 'form', 'integration',
  ];

  // owner has ALL permissions on ALL resources
  it('owner has all permissions on every resource', () => {
    for (const resource of allResources) {
      for (const action of actions) {
        expect(DEFAULT_PERMS.owner[resource][action]).toBe(true);
      }
    }
  });

  // admin has ALL permissions on ALL resources (same as owner)
  it('admin has all permissions on every resource', () => {
    for (const resource of allResources) {
      for (const action of actions) {
        expect(DEFAULT_PERMS.admin[resource][action]).toBe(true);
      }
    }
  });

  // manager cannot access admin resource
  it('manager has no permissions on admin resource', () => {
    for (const action of actions) {
      expect(DEFAULT_PERMS.manager.admin[action]).toBe(false);
    }
  });

  // manager can create/read/update tasks
  it('manager can create, read, update tasks', () => {
    expect(DEFAULT_PERMS.manager.task.create).toBe(true);
    expect(DEFAULT_PERMS.manager.task.read).toBe(true);
    expect(DEFAULT_PERMS.manager.task.update).toBe(true);
  });

  // manager can also delete and manage tasks
  it('manager can delete and manage tasks', () => {
    expect(DEFAULT_PERMS.manager.task.delete).toBe(true);
    expect(DEFAULT_PERMS.manager.task.manage).toBe(true);
  });

  // member cannot delete tasks
  it('member cannot delete tasks', () => {
    expect(DEFAULT_PERMS.member.task.delete).toBe(false);
  });

  // member can create tasks
  it('member can create tasks', () => {
    expect(DEFAULT_PERMS.member.task.create).toBe(true);
  });

  // guest can only read most resources (spot check)
  it('guest can read tasks but cannot create/update/delete/manage', () => {
    expect(DEFAULT_PERMS.guest.task.read).toBe(true);
    expect(DEFAULT_PERMS.guest.task.update).toBe(false);
    expect(DEFAULT_PERMS.guest.task.delete).toBe(false);
    expect(DEFAULT_PERMS.guest.task.manage).toBe(false);
  });

  // guest can create tasks (special case)
  it('guest can create tasks', () => {
    expect(DEFAULT_PERMS.guest.task.create).toBe(true);
  });

  // readonly cannot create/update/delete anything
  it('readonly cannot create, update, or delete any resource', () => {
    for (const resource of allResources) {
      expect(DEFAULT_PERMS.readonly[resource].create).toBe(false);
      expect(DEFAULT_PERMS.readonly[resource].update).toBe(false);
      expect(DEFAULT_PERMS.readonly[resource].delete).toBe(false);
    }
  });

  // readonly can read tasks, docs, goals
  it('readonly can read tasks, docs, and goals', () => {
    expect(DEFAULT_PERMS.readonly.task.read).toBe(true);
    expect(DEFAULT_PERMS.readonly.doc.read).toBe(true);
    expect(DEFAULT_PERMS.readonly.goal.read).toBe(true);
  });

  // guest cannot access admin, analytics, automation
  it('guest has no permissions on admin, analytics, and automation', () => {
    for (const action of actions) {
      expect(DEFAULT_PERMS.guest.admin[action]).toBe(false);
      expect(DEFAULT_PERMS.guest.analytics[action]).toBe(false);
      expect(DEFAULT_PERMS.guest.automation[action]).toBe(false);
    }
  });

  // member has no access to admin
  it('member has no permissions on admin resource', () => {
    for (const action of actions) {
      expect(DEFAULT_PERMS.member.admin[action]).toBe(false);
    }
  });

  // every role has an entry for every resource
  it('every role has entries for all 14 resources', () => {
    const roles: Role[] = ['owner', 'admin', 'manager', 'member', 'guest', 'readonly'];
    for (const role of roles) {
      for (const resource of allResources) {
        expect(DEFAULT_PERMS[role][resource]).toBeDefined();
        for (const action of actions) {
          expect(typeof DEFAULT_PERMS[role][resource][action]).toBe('boolean');
        }
      }
    }
  });
});

// ============================================
// Role hierarchy helpers
// ============================================
describe('Role hierarchy', () => {
  it('owner is admin', () => {
    expect(isAdmin('owner')).toBe(true);
  });

  it('admin is admin', () => {
    expect(isAdmin('admin')).toBe(true);
  });

  it('manager is manager but not admin', () => {
    expect(isManager('manager')).toBe(true);
    expect(isAdmin('manager')).toBe(false);
  });

  it('member is neither admin nor manager', () => {
    expect(isAdmin('member')).toBe(false);
    expect(isManager('member')).toBe(false);
  });

  it('readonly is neither admin nor manager', () => {
    expect(isAdmin('readonly')).toBe(false);
    expect(isManager('readonly')).toBe(false);
  });

  it('guest is neither admin nor manager', () => {
    expect(isAdmin('guest')).toBe(false);
    expect(isManager('guest')).toBe(false);
  });

  it('owner and admin also qualify as manager (hierarchy includes admin)', () => {
    expect(isManager('owner')).toBe(true);
    expect(isManager('admin')).toBe(true);
  });
});
