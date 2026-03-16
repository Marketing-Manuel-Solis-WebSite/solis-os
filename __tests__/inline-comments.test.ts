import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'ic-1' });
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockServerTimestamp = vi.fn().mockReturnValue('SERVER_TS');
const mockArrayUnion = vi.fn((...args: any[]) => ({ __type: 'arrayUnion', values: args }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => mockServerTimestamp(),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
}));

import {
  getInlineComments,
  addInlineComment,
  resolveInlineComment,
  addInlineCommentReply,
} from '../lib/inline-comments';

describe('Inline Comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getInlineComments returns mapped docs', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'ic-1',
          data: () => ({
            docId: 'doc-1',
            text: 'Nice paragraph',
            authorId: 'user-1',
            authorName: 'Alice',
            resolved: false,
            replies: [],
            textAnchor: { from: 10, to: 20, quotedText: 'some text' },
          }),
        },
        {
          id: 'ic-2',
          data: () => ({
            docId: 'doc-1',
            text: 'Needs revision',
            authorId: 'user-2',
            authorName: 'Bob',
            resolved: true,
            replies: [{ id: 'r1', text: 'Fixed', authorId: 'user-1', createdAt: '2024-01-01' }],
            textAnchor: { from: 30, to: 40, quotedText: 'other text' },
          }),
        },
      ],
    });

    const result = await getInlineComments('doc-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ic-1');
    expect(result[0].text).toBe('Nice paragraph');
    expect(result[0].resolved).toBe(false);
    expect(result[1].id).toBe('ic-2');
    expect(result[1].resolved).toBe(true);
    expect(result[1].replies).toHaveLength(1);
  });

  it('getInlineComments returns empty array when none exist', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await getInlineComments('doc-1');
    expect(result).toEqual([]);
  });

  it('addInlineComment sets correct defaults (resolved: false, replies: [])', async () => {
    const id = await addInlineComment('doc-1', {
      docId: 'doc-1',
      text: 'Great work',
      authorId: 'user-1',
      authorName: 'Alice',
      textAnchor: { from: 5, to: 15, quotedText: 'hello world' },
    });

    expect(id).toBe('ic-1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      undefined, // collection reference (mocked)
      expect.objectContaining({
        docId: 'doc-1',
        text: 'Great work',
        authorId: 'user-1',
        resolved: false,
        replies: [],
        createdAt: 'SERVER_TS',
      }),
    );
  });

  it('resolveInlineComment calls updateDoc with the right args', async () => {
    await resolveInlineComment('doc-1', 'ic-1', true);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined, // doc reference (mocked)
      expect.objectContaining({
        resolved: true,
        updatedAt: 'SERVER_TS',
      }),
    );
  });

  it('resolveInlineComment can unresolve a comment', async () => {
    await resolveInlineComment('doc-1', 'ic-1', false);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        resolved: false,
        updatedAt: 'SERVER_TS',
      }),
    );
  });

  it('addInlineCommentReply uses arrayUnion', async () => {
    await addInlineCommentReply('doc-1', 'ic-1', {
      text: 'I agree!',
      authorId: 'user-2',
      authorName: 'Bob',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      undefined, // doc reference (mocked)
      expect.objectContaining({
        updatedAt: 'SERVER_TS',
      }),
    );

    // Verify arrayUnion was called with a reply object containing the required fields
    expect(mockArrayUnion).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'I agree!',
        authorId: 'user-2',
        authorName: 'Bob',
      }),
    );
  });

  it('addInlineCommentReply generates unique reply ID', async () => {
    await addInlineCommentReply('doc-1', 'ic-1', {
      text: 'Reply 1',
      authorId: 'user-1',
    });

    const replyArg = mockArrayUnion.mock.calls[0][0];
    expect(replyArg.id).toMatch(/^reply_\d+_[a-z0-9]+$/);
    expect(typeof replyArg.createdAt).toBe('string');
  });

  it('exports required types and functions', async () => {
    const mod = await import('../lib/inline-comments');
    expect(typeof mod.getInlineComments).toBe('function');
    expect(typeof mod.addInlineComment).toBe('function');
    expect(typeof mod.resolveInlineComment).toBe('function');
    expect(typeof mod.addInlineCommentReply).toBe('function');
  });
});
