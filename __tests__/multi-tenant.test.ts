import { describe, it, expect } from 'vitest';
import { ORG_ID, getOrgId, getOrgIdFromRequest, getOrgIdFromContext } from '../lib/org';

describe('Multi-tenant — org resolution', () => {
  it('ORG_ID is solis-center', () => {
    expect(ORG_ID).toBe('solis-center');
  });

  it('getOrgId() returns solis-center', () => {
    expect(getOrgId()).toBe('solis-center');
  });

  it('getOrgIdFromContext() returns solis-center by default', () => {
    expect(getOrgIdFromContext()).toBe('solis-center');
  });

  it('getOrgIdFromRequest returns header value when present', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-org-id': 'acme-corp' },
    });
    expect(getOrgIdFromRequest(req)).toBe('acme-corp');
  });

  it('getOrgIdFromRequest falls back to ORG_ID when header missing', () => {
    const req = new Request('https://example.com');
    expect(getOrgIdFromRequest(req)).toBe('solis-center');
  });

  it('getOrgIdFromRequest falls back when header is empty string', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-org-id': '' },
    });
    expect(getOrgIdFromRequest(req)).toBe('solis-center');
  });

  it('getOrgIdFromRequest trims whitespace from header', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-org-id': '  my-org  ' },
    });
    expect(getOrgIdFromRequest(req)).toBe('my-org');
  });
});
