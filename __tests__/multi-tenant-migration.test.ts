import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase before importing anything that depends on it
vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

import {
  ORG_ID,
  getCurrentOrgId,
  setCurrentOrgId,
  getOrgIdFromRequest,
  getOrgIdFromContext,
  getOrgId,
} from '@/lib/org';

// ---- Defaults ----

describe('Multi-tenant org resolution', () => {
  beforeEach(() => {
    // Reset to default between tests
    setCurrentOrgId(ORG_ID);
  });

  it('ORG_ID constant is solis-center', () => {
    expect(ORG_ID).toBe('solis-center');
  });

  it('getCurrentOrgId returns solis-center by default', () => {
    // Reset the internal state by setting to the default
    setCurrentOrgId('solis-center');
    expect(getCurrentOrgId()).toBe('solis-center');
  });

  it('getOrgId() returns the same as getCurrentOrgId()', () => {
    expect(getOrgId()).toBe(getCurrentOrgId());
  });

  it('getOrgIdFromContext() returns the same as getCurrentOrgId()', () => {
    expect(getOrgIdFromContext()).toBe(getCurrentOrgId());
  });
});

// ---- setCurrentOrgId ----

describe('setCurrentOrgId', () => {
  beforeEach(() => {
    setCurrentOrgId(ORG_ID);
  });

  it('changes the value returned by getCurrentOrgId', () => {
    setCurrentOrgId('acme-corp');
    expect(getCurrentOrgId()).toBe('acme-corp');
  });

  it('changes the value returned by getOrgIdFromContext', () => {
    setCurrentOrgId('other-org');
    expect(getOrgIdFromContext()).toBe('other-org');
  });

  it('does not change ORG_ID constant', () => {
    setCurrentOrgId('new-org');
    expect(ORG_ID).toBe('solis-center');
  });
});

// ---- getOrgIdFromRequest ----

describe('getOrgIdFromRequest', () => {
  it('returns x-org-id header value when present', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'x-org-id': 'tenant-abc' },
    });
    expect(getOrgIdFromRequest(req)).toBe('tenant-abc');
  });

  it('trims whitespace from x-org-id header', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'x-org-id': '  tenant-xyz  ' },
    });
    expect(getOrgIdFromRequest(req)).toBe('tenant-xyz');
  });

  it('falls back to ORG_ID when header is missing', () => {
    const req = new Request('https://example.com/api/test');
    expect(getOrgIdFromRequest(req)).toBe('solis-center');
  });

  it('falls back to ORG_ID when header is empty string', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'x-org-id': '' },
    });
    expect(getOrgIdFromRequest(req)).toBe('solis-center');
  });

  it('falls back to ORG_ID when header is whitespace only', () => {
    const req = new Request('https://example.com/api/test', {
      headers: { 'x-org-id': '   ' },
    });
    expect(getOrgIdFromRequest(req)).toBe('solis-center');
  });
});

// ---- Integration: auth context flow ----

describe('Auth context orgId propagation flow', () => {
  beforeEach(() => {
    setCurrentOrgId(ORG_ID);
  });

  it('simulates login flow: default -> setCurrentOrgId -> modules pick it up', () => {
    // Before login, should be default
    expect(getCurrentOrgId()).toBe('solis-center');

    // Auth context calls setCurrentOrgId after login
    setCurrentOrgId('law-firm-123');

    // All modules using getCurrentOrgId() now return the new value
    expect(getCurrentOrgId()).toBe('law-firm-123');
    expect(getOrgIdFromContext()).toBe('law-firm-123');
    expect(getOrgId()).toBe('law-firm-123');
  });

  it('simulates logout flow: reset to default', () => {
    setCurrentOrgId('tenant-x');
    expect(getCurrentOrgId()).toBe('tenant-x');

    // On logout, reset to default
    setCurrentOrgId(ORG_ID);
    expect(getCurrentOrgId()).toBe('solis-center');
  });
});
