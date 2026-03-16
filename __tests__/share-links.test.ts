import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'link-1' });
const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] });
const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(),
}));

// Mock crypto.getRandomValues
vi.stubGlobal('crypto', {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
});

import {
  createShareLink,
  validateShareLink,
  getShareLinkByToken,
  revokeShareLink,
  recordShareLinkAccess,
} from '../lib/share-links';

describe('Share Links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createShareLink returns id and token', async () => {
    const result = await createShareLink({
      resourceType: 'task',
      resourceId: 'task-1',
      resourceTitle: 'Test Task',
      permission: 'view',
      createdBy: 'user-1',
      createdByName: 'John',
    });

    expect(result.id).toBe('link-1');
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(24);
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('getShareLinkByToken returns null when not found', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    const result = await getShareLinkByToken('invalid-token');
    expect(result).toBeNull();
  });

  it('validateShareLink returns not_found for invalid token', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    const result = await validateShareLink('bad-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('validateShareLink returns expired when past expiration', async () => {
    const pastDate = new Date(2020, 0, 1);
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'link-1',
        data: () => ({
          token: 'test-token',
          active: true,
          expiresAt: { seconds: pastDate.getTime() / 1000 },
          maxUses: null,
          useCount: 0,
          allowedEmails: [],
        }),
      }],
    });

    const result = await validateShareLink('test-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('validateShareLink returns max_uses when limit reached', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'link-1',
        data: () => ({
          token: 'test-token',
          active: true,
          expiresAt: null,
          maxUses: 5,
          useCount: 5,
          allowedEmails: [],
        }),
      }],
    });

    const result = await validateShareLink('test-token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('max_uses');
  });

  it('validateShareLink returns email_restricted for unauthorized email', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'link-1',
        data: () => ({
          token: 'test-token',
          active: true,
          expiresAt: null,
          maxUses: null,
          useCount: 0,
          allowedEmails: ['allowed@test.com'],
        }),
      }],
    });

    const result = await validateShareLink('test-token', 'other@test.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('email_restricted');
  });

  it('validateShareLink returns valid for good link', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'link-1',
        data: () => ({
          token: 'good-token',
          active: true,
          expiresAt: null,
          maxUses: null,
          useCount: 0,
          allowedEmails: [],
        }),
      }],
    });

    const result = await validateShareLink('good-token');
    expect(result.valid).toBe(true);
    expect(result.link).toBeDefined();
  });

  it('revokeShareLink sets active to false', async () => {
    await revokeShareLink('link-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined, // doc ref (mocked)
      expect.objectContaining({ active: false }),
    );
  });

  it('recordShareLinkAccess increments useCount', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ useCount: 3 }),
    });

    await recordShareLinkAccess('link-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ useCount: 4 }),
    );
  });
});
