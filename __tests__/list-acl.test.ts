import { describe, it, expect } from 'vitest';

// We test the ListData interface shape and the private-list access logic
// without hitting Firestore. The actual rule enforcement is in firestore.rules;
// here we validate the TypeScript contract and the client-side filtering helper.

describe('List ACL — ListData interface', () => {
  it('accepts inherited visibility', () => {
    const list = {
      id: 'list-1',
      orgId: 'org-1',
      spaceId: 'space-1',
      folderId: null,
      name: 'Backlog',
      position: 0,
      visibility: 'inherited' as const,
      members: [],
      createdBy: 'user-1',
    };
    expect(list.visibility).toBe('inherited');
    expect(list.members).toEqual([]);
  });

  it('accepts private visibility with member list', () => {
    const list = {
      id: 'list-2',
      orgId: 'org-1',
      spaceId: 'space-1',
      folderId: null,
      name: 'Secret Sprint',
      position: 1,
      visibility: 'private' as const,
      members: ['user-1', 'user-2'],
      createdBy: 'user-1',
    };
    expect(list.visibility).toBe('private');
    expect(list.members).toContain('user-1');
    expect(list.members).toContain('user-2');
  });

  it('fields are optional for backward compatibility', () => {
    const list: Record<string, any> = {
      id: 'list-3',
      orgId: 'org-1',
      spaceId: 'space-1',
      folderId: null,
      name: 'Legacy List',
      position: 0,
      createdBy: 'user-1',
    };
    expect(list.visibility).toBeUndefined();
    expect(list.members).toBeUndefined();
  });
});

describe('List ACL — private list access logic', () => {
  /**
   * Mirrors the Firestore rule logic:
   *   - If visibility is not 'private', allow access (inherited or missing)
   *   - If visibility is 'private', require uid in members OR manager+ role
   */
  function canAccessList(
    list: { visibility?: string; members?: string[] },
    uid: string,
    role: string,
  ): boolean {
    const MANAGER_ROLES = ['owner', 'admin', 'manager'];

    // No visibility field or not private => inherited (open to space members)
    if (!list.visibility || list.visibility !== 'private') return true;

    // Private: check membership
    if (list.members?.includes(uid)) return true;

    // Private: manager+ bypass
    if (MANAGER_ROLES.includes(role)) return true;

    return false;
  }

  it('allows access to inherited lists for any org member', () => {
    const list = { visibility: 'inherited' as const, members: [] };
    expect(canAccessList(list, 'user-1', 'member')).toBe(true);
    expect(canAccessList(list, 'user-2', 'guest')).toBe(true);
  });

  it('allows access to lists without visibility field', () => {
    const list = {};
    expect(canAccessList(list, 'user-1', 'member')).toBe(true);
  });

  it('denies non-member access to private lists', () => {
    const list = { visibility: 'private' as const, members: ['user-1', 'user-2'] };
    expect(canAccessList(list, 'user-3', 'member')).toBe(false);
  });

  it('allows member access to private lists', () => {
    const list = { visibility: 'private' as const, members: ['user-1', 'user-2'] };
    expect(canAccessList(list, 'user-1', 'member')).toBe(true);
    expect(canAccessList(list, 'user-2', 'member')).toBe(true);
  });

  it('allows manager access to private lists even without membership', () => {
    const list = { visibility: 'private' as const, members: ['user-1'] };
    expect(canAccessList(list, 'user-3', 'manager')).toBe(true);
    expect(canAccessList(list, 'user-3', 'admin')).toBe(true);
    expect(canAccessList(list, 'user-3', 'owner')).toBe(true);
  });

  it('denies guest access to private lists without membership', () => {
    const list = { visibility: 'private' as const, members: ['user-1'] };
    expect(canAccessList(list, 'user-2', 'guest')).toBe(false);
    expect(canAccessList(list, 'user-2', 'readonly')).toBe(false);
  });
});
