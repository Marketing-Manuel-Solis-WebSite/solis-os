import { describe, it, expect, vi } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(),
}));

import {
  resolvePermission,
  canEditField,
  checkScopedPermission,
  DEFAULT_FIELD_RESTRICTIONS,
} from '../lib/permissions-granular';
import type { PermissionOverride, ScopedPermission } from '../lib/permissions-granular';

describe('Granular Permissions — resolvePermission', () => {
  it('uses default matrix when no overrides', () => {
    expect(resolvePermission('member', 'task', 'create')).toBe(true);
    expect(resolvePermission('member', 'task', 'delete')).toBe(false);
    expect(resolvePermission('guest', 'doc', 'create')).toBe(false);
    expect(resolvePermission('owner', 'admin', 'manage')).toBe(true);
  });

  it('org matrix overrides default', () => {
    const orgMatrix = {
      member: { task: { create: true, read: true, update: true, delete: true, manage: false } },
    };
    // Default says member can't delete tasks, org matrix says they can
    expect(resolvePermission('member', 'task', 'delete', orgMatrix)).toBe(true);
  });

  it('per-user override takes highest priority', () => {
    const overrides: PermissionOverride[] = [
      { resource: 'task', action: 'delete', granted: true },
    ];
    // Even if default and org say no, user override says yes
    expect(resolvePermission('member', 'task', 'delete', null, overrides)).toBe(true);
  });

  it('per-user override can deny what role allows', () => {
    const overrides: PermissionOverride[] = [
      { resource: 'task', action: 'create', granted: false },
    ];
    // Manager can normally create tasks, but override denies
    expect(resolvePermission('manager', 'task', 'create', null, overrides)).toBe(false);
  });

  it('returns false for unknown role/resource', () => {
    expect(resolvePermission('member', 'admin', 'manage')).toBe(false);
  });
});

describe('Granular Permissions — canEditField', () => {
  it('allows when no restriction exists for the field', () => {
    expect(canEditField('member', 'user-1', 'task', 'title')).toBe(true);
  });

  it('restricts field based on allowed roles', () => {
    // 'priority' restricted to owner/admin/manager
    expect(canEditField('owner', 'user-1', 'task', 'priority')).toBe(true);
    expect(canEditField('manager', 'user-1', 'task', 'priority')).toBe(true);
    expect(canEditField('member', 'user-1', 'task', 'priority')).toBe(false);
    expect(canEditField('guest', 'user-1', 'task', 'priority')).toBe(false);
  });

  it('allows specifically listed users', () => {
    const restrictions = [
      { resource: 'task' as const, field: 'priority', allowedRoles: ['owner' as const], allowedUsers: ['special-user'] },
    ];
    // member normally can't edit priority, but this user is specifically allowed
    expect(canEditField('member', 'special-user', 'task', 'priority', restrictions)).toBe(true);
    expect(canEditField('member', 'other-user', 'task', 'priority', restrictions)).toBe(false);
  });

  it('default restrictions cover expected fields', () => {
    expect(DEFAULT_FIELD_RESTRICTIONS.length).toBeGreaterThanOrEqual(4);
    const fields = DEFAULT_FIELD_RESTRICTIONS.map(r => `${r.resource}.${r.field}`);
    expect(fields).toContain('task.priority');
    expect(fields).toContain('task.assignees');
    expect(fields).toContain('goal.status');
    expect(fields).toContain('automation.enabled');
  });
});

describe('Granular Permissions — checkScopedPermission', () => {
  it('falls back to org-level when no scoped permission', () => {
    expect(checkScopedPermission('member', 'task', 'create', 'team', 'team-1')).toBe(true);
    expect(checkScopedPermission('guest', 'doc', 'create', 'team', 'team-1')).toBe(false);
  });

  it('uses scoped permission when available', () => {
    const scoped: ScopedPermission[] = [
      { resource: 'task', action: 'delete', scope: 'team', scopeId: 'team-1', granted: true },
    ];
    // Member normally can't delete tasks, but in team-1 they can
    expect(checkScopedPermission('member', 'task', 'delete', 'team', 'team-1', scoped)).toBe(true);
    // Different team — falls back to default
    expect(checkScopedPermission('member', 'task', 'delete', 'team', 'team-2', scoped)).toBe(false);
  });

  it('scoped permission can restrict what role allows', () => {
    const scoped: ScopedPermission[] = [
      { resource: 'task', action: 'create', scope: 'space', scopeId: 'space-1', granted: false },
    ];
    expect(checkScopedPermission('manager', 'task', 'create', 'space', 'space-1', scoped)).toBe(false);
  });
});
