import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for Firebase
const { mockAddDoc, mockGetDocs, mockDeleteDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'link-1' }),
  mockGetDocs: vi.fn().mockResolvedValue({ docs: [] }),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: mockAddDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TS'),
}));

vi.mock('@/lib/firebase', () => ({
  db: {},
}));

import { extractTaskIds, addTaskLink, getTaskLinks, removeTaskLink } from '../lib/task-links';

describe('Task Links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- extractTaskIds ----

  describe('extractTaskIds', () => {
    it('extracts SOLIS-123 patterns', () => {
      const ids = extractTaskIds('Fixed bug in SOLIS-123 and SOLIS-456');
      expect(ids).toContain('123');
      expect(ids).toContain('456');
    });

    it('extracts case-insensitive SOLIS patterns', () => {
      const ids = extractTaskIds('Refs solis-abc123');
      expect(ids).toContain('abc123');
    });

    it('extracts TASK-xxx patterns', () => {
      const ids = extractTaskIds('Closes TASK-789');
      expect(ids).toContain('789');
    });

    it('extracts #123 patterns (min 3 digits)', () => {
      const ids = extractTaskIds('Fixed #123 and #45678');
      expect(ids).toContain('123');
      expect(ids).toContain('45678');
    });

    it('ignores #12 (too short)', () => {
      const ids = extractTaskIds('Ref #12');
      expect(ids).not.toContain('12');
    });

    it('deduplicates results', () => {
      const ids = extractTaskIds('SOLIS-123 SOLIS-123');
      expect(ids).toEqual(['123']);
    });

    it('returns empty array for empty text', () => {
      expect(extractTaskIds('')).toEqual([]);
      expect(extractTaskIds(undefined as any)).toEqual([]);
    });

    it('handles mixed patterns', () => {
      const ids = extractTaskIds('Fix SOLIS-100, refs TASK-200, see #300');
      expect(ids).toContain('100');
      expect(ids).toContain('200');
      expect(ids).toContain('300');
    });
  });

  // ---- CRUD ----

  describe('addTaskLink', () => {
    it('creates a task link document', async () => {
      const id = await addTaskLink({
        taskId: 'task-1',
        type: 'pr',
        provider: 'github',
        externalId: 'pr-42',
        url: 'https://github.com/org/repo/pull/42',
        title: 'Fix login bug',
        status: 'open',
        repo: 'org/repo',
      });

      expect(id).toBe('link-1');
      expect(mockAddDoc).toHaveBeenCalled();
    });
  });

  describe('getTaskLinks', () => {
    it('returns empty array when no links', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      const links = await getTaskLinks('task-1');
      expect(links).toEqual([]);
    });

    it('returns mapped links', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'link-1',
            data: () => ({
              taskId: 'task-1',
              type: 'pr',
              provider: 'github',
              externalId: '42',
              url: 'https://github.com/org/repo/pull/42',
              title: 'PR #42',
              status: 'open',
            }),
          },
        ],
      });

      const links = await getTaskLinks('task-1');
      expect(links).toHaveLength(1);
      expect(links[0].title).toBe('PR #42');
    });
  });

  describe('removeTaskLink', () => {
    it('deletes a task link', async () => {
      await removeTaskLink('link-1');
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
