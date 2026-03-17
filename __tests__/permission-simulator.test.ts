import { describe, it, expect } from 'vitest';
import {
  simulateAccess,
  simulateFieldAccess,
  simulateTree,
  withRole,
  withSpaceAccess,
  summarizeTree,
  type SimulationContext,
  type ResourceNode,
} from '../lib/permission-simulator';
import type { PermissionOverride, ScopedPermission, FieldRestriction } from '../lib/permissions-granular';

// ---- Helpers ----

function makeCtx(overrides: Partial<SimulationContext> = {}): SimulationContext {
  return {
    userId: 'user-1',
    role: 'member',
    teamIds: ['space-1'],
    ...overrides,
  };
}

function makeSpace(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    id: 'space-1',
    type: 'space',
    name: 'Engineering',
    privacy: 'public',
    spaceId: 'space-1',
    ...overrides,
  };
}

function makeList(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    id: 'list-1',
    type: 'list',
    name: 'Backlog',
    spaceId: 'space-1',
    ...overrides,
  };
}

function makeTask(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    id: 'task-1',
    type: 'task',
    name: 'Fix bug',
    spaceId: 'space-1',
    ...overrides,
  };
}

function makeDoc(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    id: 'doc-1',
    type: 'doc',
    name: 'API Spec',
    spaceId: 'space-1',
    docVisibility: 'workspace',
    ...overrides,
  };
}

// ============================================================
// ROLE DEFAULT RESOLUTION
// ============================================================

describe('Role default resolution', () => {
  it('owner can do everything', () => {
    const ctx = makeCtx({ role: 'owner' });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('role-default');
  });

  it('admin can do everything', () => {
    const ctx = makeCtx({ role: 'admin' });
    const result = simulateAccess(ctx, makeTask(), 'manage');
    expect(result.granted).toBe(true);
  });

  it('member can create tasks', () => {
    const ctx = makeCtx({ role: 'member' });
    const result = simulateAccess(ctx, makeTask(), 'create');
    expect(result.granted).toBe(true);
  });

  it('member cannot delete tasks', () => {
    const ctx = makeCtx({ role: 'member' });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(false);
  });

  it('guest can read tasks', () => {
    const ctx = makeCtx({ role: 'guest' });
    const result = simulateAccess(ctx, makeTask(), 'read');
    expect(result.granted).toBe(true);
  });

  it('guest cannot update tasks', () => {
    const ctx = makeCtx({ role: 'guest' });
    const result = simulateAccess(ctx, makeTask(), 'update');
    expect(result.granted).toBe(false);
  });

  it('readonly can only read', () => {
    const ctx = makeCtx({ role: 'readonly' });
    expect(simulateAccess(ctx, makeTask(), 'read').granted).toBe(true);
    expect(simulateAccess(ctx, makeTask(), 'create').granted).toBe(false);
    expect(simulateAccess(ctx, makeTask(), 'update').granted).toBe(false);
    expect(simulateAccess(ctx, makeTask(), 'delete').granted).toBe(false);
  });

  it('member cannot access admin resource', () => {
    const ctx = makeCtx({ role: 'member' });
    const node: ResourceNode = { id: 'adm', type: 'automation', name: 'Admin', spaceId: 'space-1' };
    const result = simulateAccess(ctx, node, 'create');
    expect(result.granted).toBe(false);
  });
});

// ============================================================
// USER OVERRIDES
// ============================================================

describe('User override resolution', () => {
  it('user override grants permission despite role default denial', () => {
    const overrides: PermissionOverride[] = [
      { resource: 'task', action: 'delete', granted: true, reason: 'Team lead exception' },
    ];
    const ctx = makeCtx({ role: 'member', userOverrides: overrides });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('user-override');
    expect(result.trace[0].description).toContain('Team lead exception');
  });

  it('user override denies permission despite role default grant', () => {
    const overrides: PermissionOverride[] = [
      { resource: 'task', action: 'create', granted: false, reason: 'Probation' },
    ];
    const ctx = makeCtx({ role: 'member', userOverrides: overrides });
    const result = simulateAccess(ctx, makeTask(), 'create');
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('user-override');
  });

  it('user override takes priority over org matrix', () => {
    const overrides: PermissionOverride[] = [
      { resource: 'task', action: 'delete', granted: true },
    ];
    const orgMatrix = { member: { task: { delete: false } } } as any;
    const ctx = makeCtx({ userOverrides: overrides, orgMatrix });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('user-override');
  });
});

// ============================================================
// ORG MATRIX
// ============================================================

describe('Org matrix resolution', () => {
  it('org matrix grants permission when role default denies', () => {
    const orgMatrix = { member: { task: { delete: true } } } as any;
    const ctx = makeCtx({ orgMatrix });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('org-matrix');
  });

  it('org matrix denies permission when role default grants', () => {
    const orgMatrix = { member: { task: { create: false } } } as any;
    const ctx = makeCtx({ orgMatrix });
    const result = simulateAccess(ctx, makeTask(), 'create');
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('org-matrix');
  });
});

// ============================================================
// SCOPED PERMISSIONS
// ============================================================

describe('Scoped permission resolution', () => {
  it('scoped permission grants access for specific space', () => {
    const scopedPermissions: ScopedPermission[] = [
      { resource: 'task', action: 'delete', scope: 'space', scopeId: 'space-1', granted: true },
    ];
    const ctx = makeCtx({ scopedPermissions });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('scoped-permission');
  });

  it('scoped permission does not apply to different space', () => {
    const scopedPermissions: ScopedPermission[] = [
      { resource: 'task', action: 'delete', scope: 'space', scopeId: 'space-2', granted: true },
    ];
    const ctx = makeCtx({ scopedPermissions });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    // Falls through to role default (member can't delete)
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('role-default');
  });

  it('scoped permission takes priority over org matrix', () => {
    const scopedPermissions: ScopedPermission[] = [
      { resource: 'task', action: 'delete', scope: 'space', scopeId: 'space-1', granted: true },
    ];
    const orgMatrix = { member: { task: { delete: false } } } as any;
    const ctx = makeCtx({ scopedPermissions, orgMatrix });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('scoped-permission');
  });
});

// ============================================================
// SPACE PRIVACY
// ============================================================

describe('Space privacy', () => {
  it('public space allows everyone', () => {
    const ctx = makeCtx({ teamIds: [] }); // not a member
    const space = makeSpace({ privacy: 'public' });
    const result = simulateAccess(ctx, space, 'read');
    expect(result.granted).toBe(true);
  });

  it('private space blocks non-members', () => {
    const ctx = makeCtx({ role: 'member', teamIds: [] });
    const space = makeSpace({ id: 'space-private', privacy: 'private' });
    const result = simulateAccess(ctx, space, 'read');
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('space-privacy');
  });

  it('private space allows explicit viewers', () => {
    const ctx = makeCtx({ role: 'member', teamIds: [] });
    const space = makeSpace({
      id: 'space-private',
      privacy: 'private',
      viewers: ['user-1'],
    });
    const result = simulateAccess(ctx, space, 'read');
    expect(result.granted).toBe(true);
  });

  it('private space allows admins even without membership', () => {
    const ctx = makeCtx({ role: 'admin', teamIds: [] });
    const space = makeSpace({ id: 'space-private', privacy: 'private' });
    const result = simulateAccess(ctx, space, 'read');
    expect(result.granted).toBe(true);
  });

  it('child of private space is blocked for non-members', () => {
    const ctx = makeCtx({ role: 'member', teamIds: ['space-other'] });
    const task = makeTask({ spaceId: 'space-private' });
    const result = simulateAccess(ctx, task, 'read');
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('space-privacy');
  });
});

// ============================================================
// LIST ACL
// ============================================================

describe('List ACL', () => {
  it('inherited list allows space members', () => {
    const ctx = makeCtx({ teamIds: ['space-1'] });
    const list = makeList({ aclMode: 'inherited' });
    const result = simulateAccess(ctx, list, 'read');
    expect(result.granted).toBe(true);
  });

  it('private list blocks non-ACL members', () => {
    const ctx = makeCtx({ role: 'member', teamIds: ['space-1'] });
    const list = makeList({ aclMode: 'private', aclMembers: ['user-other'] });
    const result = simulateAccess(ctx, list, 'read');
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('list-acl');
  });

  it('private list allows ACL members', () => {
    const ctx = makeCtx({ teamIds: ['space-1'] });
    const list = makeList({ aclMode: 'private', aclMembers: ['user-1'] });
    const result = simulateAccess(ctx, list, 'read');
    expect(result.granted).toBe(true);
    expect(result.trace.some(s => s.source === 'list-acl')).toBe(true);
  });

  it('admin overrides private list', () => {
    const ctx = makeCtx({ role: 'admin', teamIds: ['space-1'] });
    const list = makeList({ aclMode: 'private', aclMembers: [] });
    const result = simulateAccess(ctx, list, 'read');
    expect(result.granted).toBe(true);
  });
});

// ============================================================
// DOC VISIBILITY
// ============================================================

describe('Doc visibility', () => {
  it('workspace-visible doc is readable by all members', () => {
    const ctx = makeCtx();
    const d = makeDoc({ docVisibility: 'workspace' });
    const result = simulateAccess(ctx, d, 'read');
    expect(result.granted).toBe(true);
  });

  it('private doc blocks non-viewer members', () => {
    const ctx = makeCtx({ role: 'member' });
    const d = makeDoc({ docVisibility: 'private', docViewers: [], docEditors: [] });
    const result = simulateAccess(ctx, d, 'read');
    expect(result.granted).toBe(false);
    expect(result.resolvedVia).toBe('doc-visibility');
  });

  it('private doc allows explicit viewers', () => {
    const ctx = makeCtx();
    const d = makeDoc({ docVisibility: 'private', docViewers: ['user-1'] });
    const result = simulateAccess(ctx, d, 'read');
    expect(result.granted).toBe(true);
  });

  it('private doc allows creator', () => {
    const ctx = makeCtx();
    const d = makeDoc({ docVisibility: 'private', docViewers: [], createdBy: 'user-1' });
    const result = simulateAccess(ctx, d, 'read');
    expect(result.granted).toBe(true);
  });
});

// ============================================================
// FIELD RESTRICTIONS
// ============================================================

describe('Field-level access', () => {
  it('unrestricted field allows everyone', () => {
    const ctx = makeCtx();
    const result = simulateFieldAccess(ctx, 'task', 'title');
    expect(result.canEdit).toBe(true);
  });

  it('restricted field blocks non-allowed roles', () => {
    const restrictions: FieldRestriction[] = [
      { resource: 'task', field: 'priority', allowedRoles: ['owner', 'admin', 'manager'] },
    ];
    const ctx = makeCtx({ role: 'member', fieldRestrictions: restrictions });
    const result = simulateFieldAccess(ctx, 'task', 'priority');
    expect(result.canEdit).toBe(false);
    expect(result.trace[0].description).toContain('member');
  });

  it('restricted field allows allowed roles', () => {
    const restrictions: FieldRestriction[] = [
      { resource: 'task', field: 'priority', allowedRoles: ['owner', 'admin', 'manager'] },
    ];
    const ctx = makeCtx({ role: 'manager', fieldRestrictions: restrictions });
    const result = simulateFieldAccess(ctx, 'task', 'priority');
    expect(result.canEdit).toBe(true);
  });

  it('restricted field allows explicitly listed users', () => {
    const restrictions: FieldRestriction[] = [
      { resource: 'task', field: 'priority', allowedRoles: ['owner'], allowedUsers: ['user-1'] },
    ];
    const ctx = makeCtx({ role: 'member', fieldRestrictions: restrictions });
    const result = simulateFieldAccess(ctx, 'task', 'priority');
    expect(result.canEdit).toBe(true);
  });
});

// ============================================================
// TREE SIMULATION
// ============================================================

describe('Tree simulation', () => {
  it('simulates a full tree recursively', () => {
    const tree: ResourceNode[] = [
      {
        id: 'space-1',
        type: 'space',
        name: 'Engineering',
        privacy: 'public',
        spaceId: 'space-1',
        children: [
          {
            id: 'list-1',
            type: 'list',
            name: 'Backlog',
            spaceId: 'space-1',
            children: [
              { id: 'task-1', type: 'task', name: 'Fix bug', spaceId: 'space-1' },
              { id: 'task-2', type: 'task', name: 'Add feature', spaceId: 'space-1' },
            ],
          },
          {
            id: 'doc-1',
            type: 'doc',
            name: 'RFC',
            spaceId: 'space-1',
            docVisibility: 'private',
            docViewers: [],
            docEditors: [],
          },
        ],
      },
    ];

    const ctx = makeCtx({ role: 'member' });
    const results = simulateTree(ctx, tree);

    expect(results).toHaveLength(1);
    expect(results[0].read.granted).toBe(true); // space
    expect(results[0].children).toHaveLength(2); // list + doc
    expect(results[0].children[0].read.granted).toBe(true); // list
    expect(results[0].children[0].children).toHaveLength(2); // tasks
    expect(results[0].children[0].children[0].read.granted).toBe(true); // task
    expect(results[0].children[1].read.granted).toBe(false); // private doc
  });

  it('summarizes tree correctly', () => {
    const tree: ResourceNode[] = [
      {
        id: 'space-1', type: 'space', name: 'S', privacy: 'public', spaceId: 'space-1',
        children: [
          { id: 't1', type: 'task', name: 'T1', spaceId: 'space-1' },
          { id: 't2', type: 'task', name: 'T2', spaceId: 'space-1' },
        ],
      },
    ];
    const ctx = makeCtx({ role: 'member' });
    const results = simulateTree(ctx, tree);
    const summary = summarizeTree(results);

    expect(summary.total).toBe(3); // space + 2 tasks
    expect(summary.readable).toBe(3);
    expect(summary.denied).toBe(0);
  });
});

// ============================================================
// WHAT-IF HELPERS
// ============================================================

describe('What-if helpers', () => {
  it('withRole changes role in context', () => {
    const ctx = makeCtx({ role: 'member' });
    const newCtx = withRole(ctx, 'manager');
    expect(newCtx.role).toBe('manager');
    expect(newCtx.userId).toBe('user-1'); // rest unchanged
  });

  it('withSpaceAccess adds space to teamIds', () => {
    const ctx = makeCtx({ teamIds: ['space-1'] });
    const newCtx = withSpaceAccess(ctx, 'space-2');
    expect(newCtx.teamIds).toContain('space-2');
    expect(newCtx.teamIds).toContain('space-1');
  });

  it('withSpaceAccess is idempotent', () => {
    const ctx = makeCtx({ teamIds: ['space-1'] });
    const newCtx = withSpaceAccess(ctx, 'space-1');
    expect(newCtx.teamIds).toHaveLength(1);
  });

  it('what-if role change unlocks previously denied action', () => {
    const ctx = makeCtx({ role: 'member' });
    const task = makeTask();

    expect(simulateAccess(ctx, task, 'delete').granted).toBe(false);
    expect(simulateAccess(withRole(ctx, 'manager'), task, 'delete').granted).toBe(true);
  });

  it('what-if space access unlocks private space', () => {
    const ctx = makeCtx({ role: 'member', teamIds: [] });
    const space = makeSpace({ id: 'space-private', privacy: 'private' });

    expect(simulateAccess(ctx, space, 'read').granted).toBe(false);
    expect(simulateAccess(withSpaceAccess(ctx, 'space-private'), space, 'read').granted).toBe(true);
  });
});

// ============================================================
// TRACE QUALITY
// ============================================================

describe('Trace quality', () => {
  it('every result has at least one trace step', () => {
    const ctx = makeCtx();
    const result = simulateAccess(ctx, makeTask(), 'read');
    expect(result.trace.length).toBeGreaterThanOrEqual(1);
  });

  it('trace describes the resolution path accurately', () => {
    const ctx = makeCtx({ role: 'guest' });
    const result = simulateAccess(ctx, makeTask(), 'update');
    expect(result.granted).toBe(false);
    const lastStep = result.trace[result.trace.length - 1];
    expect(lastStep.description).toContain('guest');
    expect(lastStep.description).toContain('update');
  });

  it('multiple layers produce multiple trace steps', () => {
    // Non-empty overrides that don't match trigger "no match" trace + fallthrough
    const overrides: PermissionOverride[] = [
      { resource: 'doc', action: 'delete', granted: false }, // doesn't match task:read
    ];
    const ctx = makeCtx({ userOverrides: overrides });
    const result = simulateAccess(ctx, makeTask(), 'read');
    // Should have: skip override step + role-default step
    expect(result.trace.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// PRIORITY ORDER VERIFICATION
// ============================================================

describe('Resolution priority order', () => {
  it('user-override > scoped > org-matrix > role-default', () => {
    const ctx = makeCtx({
      role: 'member',
      userOverrides: [{ resource: 'task', action: 'delete', granted: true }],
      scopedPermissions: [{ resource: 'task', action: 'delete', scope: 'space', scopeId: 'space-1', granted: false }],
      orgMatrix: { member: { task: { delete: false } } } as any,
    });
    // User override should win
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('user-override');
  });

  it('scoped > org-matrix when no user override', () => {
    const ctx = makeCtx({
      role: 'member',
      scopedPermissions: [{ resource: 'task', action: 'delete', scope: 'space', scopeId: 'space-1', granted: true }],
      orgMatrix: { member: { task: { delete: false } } } as any,
    });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('scoped-permission');
  });

  it('org-matrix > role-default when no scoped', () => {
    const ctx = makeCtx({
      role: 'member',
      orgMatrix: { member: { task: { delete: true } } } as any,
    });
    const result = simulateAccess(ctx, makeTask(), 'delete');
    expect(result.granted).toBe(true);
    expect(result.resolvedVia).toBe('org-matrix');
  });
});
