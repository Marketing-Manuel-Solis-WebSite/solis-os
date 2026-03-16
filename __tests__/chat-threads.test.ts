import { describe, it, expect, vi } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => true, id: 'test', data: () => ({}) }),
  getCountFromServer: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
  collectionGroup: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  runTransaction: vi.fn().mockResolvedValue(undefined),
  startAfter: vi.fn(),
  deleteField: vi.fn(),
  DocumentData: vi.fn(),
}));

import {
  sendThreadReply,
  getThreadReplies,
  onThreadRepliesSnapshot,
  computeUnreadChannels,
  bookmarkMessage,
  getBookmarks,
  removeBookmark,
  onBookmarksSnapshot,
  searchMessagesInChannel,
} from '../lib/db';

describe('Chat Threads — exports', () => {
  it('sendThreadReply is a function', () => {
    expect(typeof sendThreadReply).toBe('function');
  });

  it('getThreadReplies is a function', () => {
    expect(typeof getThreadReplies).toBe('function');
  });

  it('onThreadRepliesSnapshot is a function', () => {
    expect(typeof onThreadRepliesSnapshot).toBe('function');
  });
});

describe('Chat Unread — computeUnreadChannels', () => {
  it('returns empty for no channels', () => {
    expect(computeUnreadChannels([], {})).toEqual({});
  });

  it('marks channel as unread when lastMessageAt > cursor', () => {
    const channels = [
      { id: 'ch1', lastMessageAt: { seconds: 1000 } },
      { id: 'ch2', lastMessageAt: { seconds: 500 } },
    ];
    const cursors = {
      ch1: { seconds: 800 },
      ch2: { seconds: 600 },
    };
    const result = computeUnreadChannels(channels, cursors);
    expect(result.ch1).toBe(true);  // 1000 > 800
    expect(result.ch2).toBe(false); // 500 < 600
  });

  it('marks channel as read when no lastMessageAt', () => {
    const channels = [{ id: 'ch1' }];
    const result = computeUnreadChannels(channels, {});
    expect(result.ch1).toBe(false);
  });

  it('marks channel as read when cursor is missing (no cursor = never read, but no message)', () => {
    const channels = [{ id: 'ch1', lastMessageAt: { seconds: 100 } }];
    const result = computeUnreadChannels(channels, {});
    expect(result.ch1).toBe(true); // Has message but no cursor → unread
  });

  it('excludes channels where last message is by current user', () => {
    const channels = [{ id: 'ch1', lastMessageAt: { seconds: 1000 }, lastMessageBy: 'user-1' }];
    const cursors = { ch1: { seconds: 800 } };
    const result = computeUnreadChannels(channels, cursors, 'user-1');
    expect(result.ch1).toBe(false); // Last message by self → read
  });
});

describe('Chat Bookmarks — exports', () => {
  it('bookmarkMessage is a function', () => {
    expect(typeof bookmarkMessage).toBe('function');
  });

  it('getBookmarks is a function', () => {
    expect(typeof getBookmarks).toBe('function');
  });

  it('removeBookmark is a function', () => {
    expect(typeof removeBookmark).toBe('function');
  });

  it('onBookmarksSnapshot returns an unsubscribe function', () => {
    const unsub = onBookmarksSnapshot('user-1', () => {});
    expect(typeof unsub).toBe('function');
  });
});

describe('Chat Search — exports', () => {
  it('searchMessagesInChannel is a function', () => {
    expect(typeof searchMessagesInChannel).toBe('function');
  });

  it('returns empty array for empty search text', async () => {
    const results = await searchMessagesInChannel('ch1', '');
    expect(results).toEqual([]);
  });

  it('returns empty array for whitespace-only search', async () => {
    const results = await searchMessagesInChannel('ch1', '   ');
    expect(results).toEqual([]);
  });
});
