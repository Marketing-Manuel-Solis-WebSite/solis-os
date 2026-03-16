import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: vi.fn() },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: vi.fn(), increment: vi.fn(), arrayUnion: vi.fn() },
}));

vi.mock('@/lib/org', () => ({
  getCurrentOrgId: () => 'test-org',
  ORG_ID: 'test-org',
}));

import { matchesChatTrigger } from '../lib/chat-automation-trigger';

describe('matchesChatTrigger', () => {
  it('matches contains pattern', () => {
    expect(matchesChatTrigger('This is urgent please', { matchType: 'contains', pattern: 'urgent' })).toBe(true);
  });

  it('does not match contains when absent', () => {
    expect(matchesChatTrigger('This is normal', { matchType: 'contains', pattern: 'urgent' })).toBe(false);
  });

  it('matches exact pattern', () => {
    expect(matchesChatTrigger('deploy now', { matchType: 'exact', pattern: 'deploy now' })).toBe(true);
  });

  it('does not match exact when different', () => {
    expect(matchesChatTrigger('deploy now please', { matchType: 'exact', pattern: 'deploy now' })).toBe(false);
  });

  it('matches starts_with pattern', () => {
    expect(matchesChatTrigger('/create task Fix login', { matchType: 'starts_with', pattern: '/create' })).toBe(true);
  });

  it('does not match starts_with when not at start', () => {
    expect(matchesChatTrigger('please /create task', { matchType: 'starts_with', pattern: '/create' })).toBe(false);
  });

  it('matches regex pattern', () => {
    expect(matchesChatTrigger('BUG-123: Fix it', { matchType: 'regex', pattern: 'BUG-\\d+' })).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    expect(matchesChatTrigger('test', { matchType: 'regex', pattern: '[invalid' })).toBe(false);
  });

  it('is case-insensitive for contains', () => {
    expect(matchesChatTrigger('This is URGENT', { matchType: 'contains', pattern: 'urgent' })).toBe(true);
  });

  it('returns false for empty message', () => {
    expect(matchesChatTrigger('', { matchType: 'contains', pattern: 'test' })).toBe(false);
  });

  it('returns false for empty pattern', () => {
    expect(matchesChatTrigger('test message', { matchType: 'contains', pattern: '' })).toBe(false);
  });
});
