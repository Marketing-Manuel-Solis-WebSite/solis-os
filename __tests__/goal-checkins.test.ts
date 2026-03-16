import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'checkin-1' });
const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(),
}));

import {
  createCheckin,
  getCheckins,
  getLatestCheckin,
  updateCheckin,
  deleteCheckin,
  getCheckinStats,
} from '../lib/goal-checkins';

describe('Goal Check-ins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createCheckin returns check-in ID', async () => {
    const id = await createCheckin('goal-1', {
      authorId: 'user-1',
      authorName: 'John',
      confidence: 'on_track',
      progressSnapshot: 45,
      statusSnapshot: 'on_track',
      summary: 'Good progress this week',
    });

    expect(id).toBe('checkin-1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        goalId: 'goal-1',
        confidence: 'on_track',
        summary: 'Good progress this week',
      }),
    );
  });

  it('getCheckins returns empty array when none exist', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await getCheckins('goal-1');
    expect(result).toEqual([]);
  });

  it('getCheckins returns formatted check-ins', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'c1', data: () => ({ confidence: 'on_track', summary: 'Week 1' }) },
        { id: 'c2', data: () => ({ confidence: 'at_risk', summary: 'Week 2' }) },
      ],
    });

    const result = await getCheckins('goal-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c1');
    expect(result[1].confidence).toBe('at_risk');
  });

  it('getLatestCheckin returns null when no check-ins', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await getLatestCheckin('goal-1');
    expect(result).toBeNull();
  });

  it('updateCheckin calls updateDoc', async () => {
    await updateCheckin('goal-1', 'checkin-1', { summary: 'Updated summary' });
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('deleteCheckin calls deleteDoc', async () => {
    await deleteCheckin('goal-1', 'checkin-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('getCheckinStats returns zeros for no check-ins', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const stats = await getCheckinStats('goal-1');

    expect(stats.totalCheckins).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.lastCheckinDate).toBeNull();
    expect(stats.avgConfidence).toBe(0);
    expect(stats.confidenceDistribution).toEqual({ on_track: 0, at_risk: 0, off_track: 0 });
  });

  it('getCheckinStats computes confidence distribution', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'c1', data: () => ({ confidence: 'on_track', createdAt: { toDate: () => new Date() } }) },
        { id: 'c2', data: () => ({ confidence: 'on_track', createdAt: { toDate: () => new Date() } }) },
        { id: 'c3', data: () => ({ confidence: 'at_risk', createdAt: { toDate: () => new Date() } }) },
      ],
    });

    const stats = await getCheckinStats('goal-1');
    expect(stats.totalCheckins).toBe(3);
    expect(stats.confidenceDistribution.on_track).toBe(2);
    expect(stats.confidenceDistribution.at_risk).toBe(1);
    expect(stats.confidenceDistribution.off_track).toBe(0);
  });

  it('exports required types', async () => {
    const mod = await import('../lib/goal-checkins');
    expect(typeof mod.createCheckin).toBe('function');
    expect(typeof mod.getCheckins).toBe('function');
    expect(typeof mod.getLatestCheckin).toBe('function');
    expect(typeof mod.getCheckinStats).toBe('function');
    expect(typeof mod.saveCheckinSchedule).toBe('function');
  });
});
