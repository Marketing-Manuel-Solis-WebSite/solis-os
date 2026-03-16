import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-role-id' });
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/lib/org', () => ({ ORG_ID: 'test-org' }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  query: vi.fn((...args: any[]) => args),
  orderBy: vi.fn(),
}));

import {
  getCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  emptyPermissions,
  RESOURCE_TYPES,
  PERM_ACTIONS,
  type CustomRole,
} from '../lib/custom-roles';

import { resolveCustomRolePermission } from '../lib/permissions-granular';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Custom Roles — emptyPermissions', () => {
  it('returns all resources with all actions set to false', () => {
    const perms = emptyPermissions();
    for (const resource of RESOURCE_TYPES) {
      for (const action of PERM_ACTIONS) {
        expect(perms[resource][action]).toBe(false);
      }
    }
  });

  it('includes all expected resource types', () => {
    const perms = emptyPermissions();
    expect(Object.keys(perms)).toEqual(expect.arrayContaining([
      'task', 'doc', 'list', 'space', 'goal', 'automation', 'channel',
    ]));
  });

  it('includes all expected actions', () => {
    const perms = emptyPermissions();
    expect(Object.keys(perms.task)).toEqual(expect.arrayContaining([
      'create', 'read', 'update', 'delete', 'manage',
    ]));
  });
});

describe('Custom Roles — CRUD operations', () => {
  it('createCustomRole calls addDoc and returns ID', async () => {
    const id = await createCustomRole({
      name: 'Editor',
      description: 'Can edit tasks and docs',
      permissions: emptyPermissions(),
    });
    expect(id).toBe('new-role-id');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const callData = mockAddDoc.mock.calls[0][1];
    expect(callData.name).toBe('Editor');
    expect(callData.orgId).toBe('test-org');
    expect(callData.createdAt).toBe('SERVER_TS');
    expect(callData.updatedAt).toBe('SERVER_TS');
  });

  it('getCustomRoles returns mapped documents', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'role-1', data: () => ({ name: 'Viewer', orgId: 'test-org', permissions: emptyPermissions() }) },
        { id: 'role-2', data: () => ({ name: 'Editor', orgId: 'test-org', permissions: emptyPermissions() }) },
      ],
    });
    const roles = await getCustomRoles();
    expect(roles).toHaveLength(2);
    expect(roles[0].id).toBe('role-1');
    expect(roles[0].name).toBe('Viewer');
    expect(roles[1].id).toBe('role-2');
    expect(roles[1].name).toBe('Editor');
  });

  it('updateCustomRole calls updateDoc with updated fields', async () => {
    await updateCustomRole('role-1', { name: 'Super Editor' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const callData = mockUpdateDoc.mock.calls[0][1];
    expect(callData.name).toBe('Super Editor');
    expect(callData.updatedAt).toBe('SERVER_TS');
  });

  it('deleteCustomRole calls deleteDoc', async () => {
    await deleteCustomRole('role-1');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('Custom Roles — resolveCustomRolePermission', () => {
  const role: CustomRole = {
    id: 'role-1',
    orgId: 'test-org',
    name: 'Editor',
    permissions: {
      task: { create: true, read: true, update: true, delete: false, manage: false },
      doc: { create: true, read: true, update: true, delete: false, manage: false },
      list: { create: false, read: true, update: false, delete: false, manage: false },
      space: { create: false, read: true, update: false, delete: false, manage: false },
      goal: { create: false, read: true, update: false, delete: false, manage: false },
      automation: { create: false, read: false, update: false, delete: false, manage: false },
      channel: { create: true, read: true, update: false, delete: false, manage: false },
    },
    createdAt: null,
  };

  it('returns true for granted permissions', () => {
    expect(resolveCustomRolePermission(role, 'task', 'create')).toBe(true);
    expect(resolveCustomRolePermission(role, 'task', 'read')).toBe(true);
    expect(resolveCustomRolePermission(role, 'doc', 'update')).toBe(true);
    expect(resolveCustomRolePermission(role, 'channel', 'create')).toBe(true);
  });

  it('returns false for denied permissions', () => {
    expect(resolveCustomRolePermission(role, 'task', 'delete')).toBe(false);
    expect(resolveCustomRolePermission(role, 'task', 'manage')).toBe(false);
    expect(resolveCustomRolePermission(role, 'automation', 'read')).toBe(false);
    expect(resolveCustomRolePermission(role, 'list', 'create')).toBe(false);
  });

  it('returns false for missing resource/action', () => {
    const partial: CustomRole = {
      id: 'role-2',
      orgId: 'test-org',
      name: 'Partial',
      permissions: {} as any,
      createdAt: null,
    };
    expect(resolveCustomRolePermission(partial, 'task', 'create')).toBe(false);
  });
});
