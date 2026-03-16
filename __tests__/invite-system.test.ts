import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'inv-1' });
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

vi.stubGlobal('crypto', {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
});

import {
  createInvitation,
  validateInvitation,
  validateInviteToken,
  acceptInvitation,
  revokeInvitation,
  cleanupExpiredInvitations,
} from '../lib/invite-system';
import type { Invitation } from '../lib/invite-system';

describe('Invite System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  });

  it('createInvitation returns id and token', async () => {
    const result = await createInvitation({
      email: 'new@test.com',
      role: 'member',
      teamId: 'team-1',
      teamName: 'Engineering',
      invitedBy: 'admin-1',
      invitedByName: 'Admin User',
    });

    expect(result.id).toBe('inv-1');
    expect(result.token).toMatch(/^inv_/);
    expect(result.token.length).toBeGreaterThan(10);
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('createInvitation revokes existing pending invite for same email', async () => {
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'old-inv', data: () => ({ email: 'dup@test.com', status: 'pending' }) }],
    });

    await createInvitation({
      email: 'dup@test.com',
      role: 'member',
      teamId: 'team-1',
      teamName: 'Team',
      invitedBy: 'admin-1',
      invitedByName: 'Admin',
    });

    // Should update old invite to revoked
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ status: 'revoked' }),
    );
  });

  it('validateInvitation returns valid for pending non-expired invite', () => {
    const invite: Invitation = {
      id: 'inv-1', orgId: 'solis-center', email: 'test@test.com',
      role: 'member', teamId: 'team-1', teamName: 'Team',
      token: 'inv_abc', status: 'pending',
      invitedBy: 'admin-1', invitedByName: 'Admin',
      message: '', expiresAt: { seconds: (Date.now() + 86400000) / 1000 },
      acceptedAt: null, acceptedBy: null,
      createdAt: null, updatedAt: null,
    };

    const result = validateInvitation(invite);
    expect(result.valid).toBe(true);
  });

  it('validateInvitation returns expired for past-due invite', () => {
    const invite: Invitation = {
      id: 'inv-1', orgId: 'solis-center', email: 'test@test.com',
      role: 'member', teamId: 'team-1', teamName: 'Team',
      token: 'inv_abc', status: 'pending',
      invitedBy: 'admin-1', invitedByName: 'Admin',
      message: '', expiresAt: { seconds: (Date.now() - 86400000) / 1000 },
      acceptedAt: null, acceptedBy: null,
      createdAt: null, updatedAt: null,
    };

    const result = validateInvitation(invite);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('validateInvitation returns already_accepted for accepted invite', () => {
    const invite: Invitation = {
      id: 'inv-1', orgId: 'solis-center', email: 'test@test.com',
      role: 'member', teamId: 'team-1', teamName: 'Team',
      token: 'inv_abc', status: 'accepted',
      invitedBy: 'admin-1', invitedByName: 'Admin',
      message: '', expiresAt: null,
      acceptedAt: null, acceptedBy: 'user-1',
      createdAt: null, updatedAt: null,
    };

    const result = validateInvitation(invite);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('already_accepted');
  });

  it('validateInvitation returns revoked for revoked invite', () => {
    const invite: Invitation = {
      id: 'inv-1', orgId: 'solis-center', email: 'test@test.com',
      role: 'member', teamId: 'team-1', teamName: 'Team',
      token: 'inv_abc', status: 'revoked',
      invitedBy: 'admin-1', invitedByName: 'Admin',
      message: '', expiresAt: null,
      acceptedAt: null, acceptedBy: null,
      createdAt: null, updatedAt: null,
    };

    const result = validateInvitation(invite);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('revoked');
  });

  it('validateInviteToken returns not_found for unknown token', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    const result = await validateInviteToken('inv_unknown');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('acceptInvitation updates status', async () => {
    await acceptInvitation('inv-1', 'user-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ status: 'accepted', acceptedBy: 'user-1' }),
    );
  });

  it('revokeInvitation updates status', async () => {
    await revokeInvitation('inv-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ status: 'revoked' }),
    );
  });

  it('cleanupExpiredInvitations marks expired invites', async () => {
    const pastDate = new Date(2020, 0, 1);
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        { ref: 'ref-1', data: () => ({ status: 'pending', expiresAt: { seconds: pastDate.getTime() / 1000 } }) },
        { ref: 'ref-2', data: () => ({ status: 'pending', expiresAt: { seconds: (Date.now() + 86400000) / 1000 } }) },
      ],
    });

    const cleaned = await cleanupExpiredInvitations();
    expect(cleaned).toBe(1); // Only the expired one
  });
});
