import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  isAdmin,
  isManager,
  isGuest,
  isReadonly,
  isFullMember,
  DEFAULT_PERMS,
} from '../lib/auth-utils';

describe('Guest Role — normalizeRole', () => {
  it('normalizes guest variations', () => {
    expect(normalizeRole('guest')).toBe('guest');
    expect(normalizeRole('invitado')).toBe('guest');
    expect(normalizeRole('invitada')).toBe('guest');
    expect(normalizeRole('visitante')).toBe('guest');
    expect(normalizeRole('externo')).toBe('guest');
    expect(normalizeRole('externa')).toBe('guest');
  });

  it('normalizes readonly variations', () => {
    expect(normalizeRole('readonly')).toBe('readonly');
    expect(normalizeRole('read-only')).toBe('readonly');
    expect(normalizeRole('solo_lectura')).toBe('readonly');
    expect(normalizeRole('viewer')).toBe('readonly');
    expect(normalizeRole('observador')).toBe('readonly');
  });
});

describe('Guest Role — hierarchy helpers', () => {
  it('isGuest returns true only for guest', () => {
    expect(isGuest('guest')).toBe(true);
    expect(isGuest('member')).toBe(false);
    expect(isGuest('readonly')).toBe(false);
  });

  it('isReadonly returns true only for readonly', () => {
    expect(isReadonly('readonly')).toBe(true);
    expect(isReadonly('guest')).toBe(false);
    expect(isReadonly('member')).toBe(false);
  });

  it('isFullMember excludes guest and readonly', () => {
    expect(isFullMember('owner')).toBe(true);
    expect(isFullMember('admin')).toBe(true);
    expect(isFullMember('manager')).toBe(true);
    expect(isFullMember('member')).toBe(true);
    expect(isFullMember('guest')).toBe(false);
    expect(isFullMember('readonly')).toBe(false);
  });

  it('guest is not admin or manager', () => {
    expect(isAdmin('guest')).toBe(false);
    expect(isManager('guest')).toBe(false);
  });
});

describe('Guest Role — permissions matrix', () => {
  const guestPerms = DEFAULT_PERMS.guest;

  it('can read tasks, docs, channels', () => {
    expect(guestPerms.task.read).toBe(true);
    expect(guestPerms.doc.read).toBe(true);
    expect(guestPerms.channel.read).toBe(true);
  });

  it('can create tasks only', () => {
    expect(guestPerms.task.create).toBe(true);
    expect(guestPerms.doc.create).toBe(false);
    expect(guestPerms.channel.create).toBe(false);
    expect(guestPerms.automation.create).toBe(false);
  });

  it('cannot update or delete anything', () => {
    for (const [, perms] of Object.entries(guestPerms)) {
      expect(perms.update).toBe(false);
      expect(perms.delete).toBe(false);
      expect(perms.manage).toBe(false);
    }
  });

  it('cannot access admin, org, analytics, forms, integrations', () => {
    expect(guestPerms.admin.read).toBe(false);
    expect(guestPerms.org.read).toBe(false);
    expect(guestPerms.analytics.read).toBe(false);
    expect(guestPerms.form.read).toBe(false);
    expect(guestPerms.integration.read).toBe(false);
  });
});

describe('Readonly Role — permissions matrix', () => {
  const readonlyPerms = DEFAULT_PERMS.readonly;

  it('can read most resources', () => {
    expect(readonlyPerms.task.read).toBe(true);
    expect(readonlyPerms.doc.read).toBe(true);
    expect(readonlyPerms.analytics.read).toBe(true);
  });

  it('cannot create, update, delete, or manage anything', () => {
    for (const [, perms] of Object.entries(readonlyPerms)) {
      expect(perms.create).toBe(false);
      expect(perms.update).toBe(false);
      expect(perms.delete).toBe(false);
      expect(perms.manage).toBe(false);
    }
  });
});
