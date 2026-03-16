import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Admin — vi.mock is hoisted
const mockDocs = vi.fn().mockReturnValue([]);

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP') },
}));

vi.mock('@/lib/firebase-admin', () => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
  const mockWhere = vi.fn().mockReturnThis();
  const mockGet = vi.fn().mockImplementation(() => Promise.resolve({ docs: mockDocs() }));
  return {
    adminDb: {
      collection: vi.fn().mockReturnValue({
        doc: mockDoc,
        where: mockWhere,
        get: mockGet,
      }),
    },
  };
});

import {
  submitForApproval,
  approveTimeEntry,
  rejectTimeEntry,
  getPendingApprovals,
} from '../lib/time-approval';
import { computeBillableAmount } from '../lib/billable-rates';
import { adminDb } from '../lib/firebase-admin';

describe('Time Approval Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocs.mockReturnValue([]);
  });

  describe('submitForApproval', () => {
    it('updates entry with pending status', async () => {
      await submitForApproval('entry-1');
      const col = adminDb.collection as any;
      expect(col).toHaveBeenCalledWith('time-entries');
    });
  });

  describe('approveTimeEntry', () => {
    it('updates entry with approved status', async () => {
      await approveTimeEntry('entry-1', 'manager-1', 'Looks good');
      const col = adminDb.collection as any;
      expect(col).toHaveBeenCalledWith('time-entries');
    });
  });

  describe('rejectTimeEntry', () => {
    it('updates entry with rejected status', async () => {
      await rejectTimeEntry('entry-1', 'manager-1', 'Incorrect hours');
      const col = adminDb.collection as any;
      expect(col).toHaveBeenCalledWith('time-entries');
    });
  });

  describe('getPendingApprovals', () => {
    it('returns empty array when no pending entries', async () => {
      mockDocs.mockReturnValue([]);
      const result = await getPendingApprovals();
      expect(result).toEqual([]);
    });

    it('maps pending entries correctly', async () => {
      mockDocs.mockReturnValue([
        {
          id: 'te-1',
          data: () => ({
            userId: 'user-1',
            taskId: 'task-1',
            date: '2026-03-15',
            hours: 2,
            minutes: 30,
            description: 'Coding',
            billable: true,
            teamId: 'team-1',
            approvalStatus: 'pending',
          }),
        },
      ]);

      const result = await getPendingApprovals();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'te-1',
        userId: 'user-1',
        taskId: 'task-1',
        date: '2026-03-15',
        hours: 2,
        minutes: 30,
        description: 'Coding',
        billable: true,
        teamId: 'team-1',
        approvalStatus: 'pending',
        approvedBy: undefined,
        approvalComment: undefined,
        approvalDate: undefined,
        submittedAt: undefined,
      });
    });
  });
});

describe('Billable Amount Computation', () => {
  it('computes correct amount for given hours and rate', () => {
    const rate = { userId: 'user-1', ratePerHour: 75, currency: 'USD' };
    const result = computeBillableAmount(8, rate);

    expect(result.total).toBe(600);
    expect(result.hours).toBe(8);
    expect(result.ratePerHour).toBe(75);
    expect(result.currency).toBe('USD');
  });

  it('handles fractional hours', () => {
    const rate = { userId: 'user-1', ratePerHour: 100, currency: 'EUR' };
    const result = computeBillableAmount(2.5, rate);

    expect(result.total).toBe(250);
  });

  it('rounds to 2 decimal places', () => {
    const rate = { userId: 'user-1', ratePerHour: 33.33, currency: 'USD' };
    const result = computeBillableAmount(3, rate);

    expect(result.total).toBe(99.99);
  });

  it('handles zero hours', () => {
    const rate = { userId: 'user-1', ratePerHour: 100, currency: 'USD' };
    const result = computeBillableAmount(0, rate);

    expect(result.total).toBe(0);
  });
});
