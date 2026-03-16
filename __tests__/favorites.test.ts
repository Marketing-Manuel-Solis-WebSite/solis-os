import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false });

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

import { toggleFavorite, getFavorites, isFavorite } from '../lib/favorites';

describe('Favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleFavorite', () => {
    it('adds a favorite when it does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const added = await toggleFavorite('user-1', {
        entityType: 'task',
        entityId: 'task-1',
        entityTitle: 'My Task',
      });
      expect(added).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledWith(
        undefined, // doc ref (mocked)
        expect.objectContaining({
          entityType: 'task',
          entityId: 'task-1',
          entityTitle: 'My Task',
          userId: 'user-1',
        }),
      );
    });

    it('removes a favorite when it already exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });
      const added = await toggleFavorite('user-1', {
        entityType: 'task',
        entityId: 'task-1',
        entityTitle: 'My Task',
      });
      expect(added).toBe(false);
      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe('getFavorites', () => {
    it('returns empty array when no favorites', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      const result = await getFavorites('user-1');
      expect(result).toEqual([]);
    });

    it('returns mapped favorites from Firestore docs', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              userId: 'user-1',
              entityType: 'task',
              entityId: 'task-1',
              entityTitle: 'My Task',
              pinnedAt: { seconds: 1000 },
            }),
          },
          {
            data: () => ({
              userId: 'user-1',
              entityType: 'doc',
              entityId: 'doc-1',
              entityTitle: 'My Doc',
              pinnedAt: { seconds: 900 },
            }),
          },
        ],
      });
      const result = await getFavorites('user-1');
      expect(result).toHaveLength(2);
      expect(result[0].entityType).toBe('task');
      expect(result[1].entityType).toBe('doc');
    });
  });

  describe('isFavorite', () => {
    it('returns false when favorite does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const result = await isFavorite('user-1', 'task', 'task-1');
      expect(result).toBe(false);
    });

    it('returns true when favorite exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });
      const result = await isFavorite('user-1', 'task', 'task-1');
      expect(result).toBe(true);
    });
  });
});
