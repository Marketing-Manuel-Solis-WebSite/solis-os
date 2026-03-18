// ===========================================================
// CHANNELS & MESSAGING — Complete System
// ===========================================================

import {
  addTo, updateAt, deleteAt, getOne, getByOrg, getByTeam,
  deleteSubcollectionDocs,
  db, ORG, serverTimestamp,
  collection, doc, getDocs, getDoc, query, where, orderBy, limit,
  updateDoc, arrayUnion, arrayRemove, runTransaction, onSnapshot,
  deleteField, setDoc, addDoc,
} from './helpers';

export interface ChannelData {
  name: string;
  description: string;
  type: 'public' | 'private' | 'dm';
  teamId: string;
  createdBy: string;
  createdByName: string;
  members: string[];         // User IDs who can access
  admins: string[];          // User IDs who can manage
  pinnedMessages: string[];  // Message IDs
  archived: boolean;
  icon: string;
  color: string;
  lastMessageAt: any;
  lastMessagePreview: string;
  lastMessageBy: string;
  linkedEntityType?: 'space' | 'folder' | 'list';  // Auto-created location channel type
  linkedEntityId?: string;                           // ID of the linked space/folder/list
}

export interface MessageData {
  content: string;
  userId: string;
  displayName: string;
  photoURL: string;
  type: 'text' | 'system' | 'file';
  replyTo: string | null;      // Message ID being replied to
  replyPreview: string | null;  // Preview text of replied message
  replyAuthor: string | null;
  reactions: Record<string, string[]>;  // emoji → [userId]
  pinned: boolean;
  edited: boolean;
  deleted: boolean;
  mentions: string[];          // User IDs mentioned
  attachments: any[];
  readBy: string[];            // User IDs who have read
}

// --- Channels ---
export async function getChannels(teamId?: string, maxResults = 500) {
  if (teamId) return getByTeam('channels', teamId, maxResults);
  return getByOrg('channels', maxResults);
}

export async function getAllUserChannels(userId: string): Promise<{ items: any[]; hasMore: boolean }> {
  // Two targeted queries: channels where user is member + public channels
  const [memberSnap, publicSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'channels'),
      where('orgId', '==', ORG),
      where('members', 'array-contains', userId),
      limit(200),
    )),
    getDocs(query(
      collection(db, 'channels'),
      where('orgId', '==', ORG),
      where('type', '==', 'public'),
      limit(100),
    )),
  ]);
  const seen = new Set<string>();
  const items: any[] = [];
  for (const snap of [memberSnap, publicSnap]) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const ch = { id: d.id, ...d.data() } as any;
      if (!ch.archived) items.push(ch);
    }
  }
  items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return { items, hasMore: false };
}

export async function createChannel(data: Partial<ChannelData>) {
  const doc: any = {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    type: data.type || 'public',
    teamId: data.teamId || '',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    members: data.members || [],
    admins: data.admins || [],
    pinnedMessages: [],
    archived: false,
    icon: data.icon || '',
    color: data.color || '',
    lastMessageAt: null,
    lastMessagePreview: '',
    lastMessageBy: '',
  };
  if (data.linkedEntityType) doc.linkedEntityType = data.linkedEntityType;
  if (data.linkedEntityId) doc.linkedEntityId = data.linkedEntityId;
  return addTo('channels', doc);
}

export async function updateChannel(id: string, data: Partial<ChannelData>) {
  return updateAt(`channels/${id}`, data);
}

export async function deleteChannel(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`channels/${id}`, 'messages'),
    deleteSubcollectionDocs(`channels/${id}`, 'meta'),
  ]);
  return deleteAt(`channels/${id}`);
}

export async function archiveChannel(id: string) {
  return updateAt(`channels/${id}`, { archived: true });
}

// Channel member management
export async function addChannelMember(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    members: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeChannelMember(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    members: arrayRemove(userId),
    admins: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function addChannelAdmin(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    admins: arrayUnion(userId),
    members: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeChannelAdmin(channelId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}`), {
    admins: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
}

// --- Messages ---
export async function getMessages(channelId: string, maxResults = 200) {
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'), limit(maxResults + 1));
  const s = await getDocs(q);
  const hasMore = s.docs.length > maxResults;
  const docs = hasMore ? s.docs.slice(0, maxResults) : s.docs;
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), hasMore };
}

export async function sendMessage(channelId: string, data: Partial<MessageData>) {
  const msg = await addTo(`channels/${channelId}/messages`, {
    content: data.content || '',
    userId: data.userId || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    type: data.type || 'text',
    replyTo: data.replyTo || null,
    replyPreview: data.replyPreview || null,
    replyAuthor: data.replyAuthor || null,
    reactions: {},
    pinned: false,
    edited: false,
    deleted: false,
    mentions: data.mentions || [],
    attachments: data.attachments || [],
    readBy: [data.userId],
  });

  // Update channel last message
  const preview = (data.content || '').slice(0, 60);
  await updateAt(`channels/${channelId}`, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: preview,
    lastMessageBy: data.displayName || '',
  });

  return msg;
}

export async function editMessage(channelId: string, messageId: string, content: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    content,
    edited: true,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMessage(channelId: string, messageId: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    deleted: true,
    content: 'This message was deleted',
    updatedAt: serverTimestamp(),
  });
}

// Pin / Unpin messages
export async function pinMessage(channelId: string, messageId: string) {
  await updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), { pinned: true });
  return updateDoc(doc(db, `channels/${channelId}`), {
    pinnedMessages: arrayUnion(messageId),
    updatedAt: serverTimestamp(),
  });
}

export async function unpinMessage(channelId: string, messageId: string) {
  await updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), { pinned: false });
  return updateDoc(doc(db, `channels/${channelId}`), {
    pinnedMessages: arrayRemove(messageId),
    updatedAt: serverTimestamp(),
  });
}

// Reactions — use transaction to prevent race conditions
export async function addReaction(channelId: string, messageId: string, emoji: string, userId: string) {
  const msgRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  return runTransaction(db, async (transaction) => {
    const msgSnap = await transaction.get(msgRef);
    if (!msgSnap.exists()) return;
    const reactions = { ...(msgSnap.data().reactions || {}) };
    if (!reactions[emoji]) reactions[emoji] = [];
    if (!reactions[emoji].includes(userId)) reactions[emoji] = [...reactions[emoji], userId];
    transaction.update(msgRef, { reactions });
  });
}

export async function removeReaction(channelId: string, messageId: string, emoji: string, userId: string) {
  const msgRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  return runTransaction(db, async (transaction) => {
    const msgSnap = await transaction.get(msgRef);
    if (!msgSnap.exists()) return;
    const reactions = { ...(msgSnap.data().reactions || {}) };
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    }
    transaction.update(msgRef, { reactions });
  });
}

// Mark as read
export async function markAsRead(channelId: string, messageId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    readBy: arrayUnion(userId),
  });
}

// Real-time listener for messages
export function onMessagesSnapshot(channelId: string, callback: (msgs: any[], hasMore: boolean) => void, maxResults = 100) {
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'desc'), limit(maxResults + 1));
  return onSnapshot(q, (snap) => {
    const hasMore = snap.docs.length > maxResults;
    const docs = hasMore ? snap.docs.slice(0, maxResults) : snap.docs;
    const msgs = docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs.reverse(), hasMore);
  });
}

// DM channel helpers
export async function findOrCreateDM(userId1: string, user1Name: string, userId2: string, user2Name: string) {
  // Targeted query: only fetch DM channels where current user is a member
  const q = query(
    collection(db, 'channels'),
    where('orgId', '==', ORG),
    where('type', '==', 'dm'),
    where('members', 'array-contains', userId1),
    limit(50),
  );
  const snap = await getDocs(q);
  const existingDM = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .find((ch: any) => ch.members?.length === 2 && ch.members?.includes(userId2));
  if (existingDM) return existingDM;

  // Create new DM
  const dmDoc = await createChannel({
    name: `${user1Name}, ${user2Name}`,
    description: 'Direct message',
    type: 'dm',
    createdBy: userId1,
    createdByName: user1Name,
    members: [userId1, userId2],
    admins: [userId1, userId2],
  });
  return { id: dmDoc.id, name: `${user1Name}, ${user2Name}`, type: 'dm', members: [userId1, userId2] };
}

// System message helper
export async function sendSystemMessage(channelId: string, content: string) {
  return addTo(`channels/${channelId}/messages`, {
    content,
    userId: 'system',
    displayName: 'System',
    photoURL: '',
    type: 'system',
    replyTo: null, replyPreview: null, replyAuthor: null,
    reactions: {}, pinned: false, edited: false, deleted: false,
    mentions: [], attachments: [], readBy: [],
  });
}

// ===== TYPING INDICATORS =====
export async function setTyping(channelId: string, userId: string, displayName: string) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return setDoc(ref, { [`users.${userId}`]: { name: displayName, at: serverTimestamp() } }, { merge: true });
}

export async function clearTyping(channelId: string, userId: string) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return updateDoc(ref, { [`users.${userId}`]: deleteField() }).catch((err) => console.error('[DB] clearTyping failed:', err));
}

export function onTypingSnapshot(channelId: string, callback: (users: { id: string; name: string }[]) => void) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    const now = Date.now() / 1000;
    const active: { id: string; name: string }[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (!key.startsWith('users.')) continue;
      const uid = key.replace('users.', '');
      const v = val as any;
      if (v?.at?.seconds && (now - v.at.seconds) < 5) {
        active.push({ id: uid, name: v.name || '' });
      }
    }
    callback(active);
  }, () => callback([]));
}

// ===== PRESENCE =====
export function setPresence(userId: string, online: boolean) {
  return setDoc(doc(db, `orgs/${ORG}/presence/${userId}`), { online, lastSeen: serverTimestamp() }, { merge: true });
}

// Polling-based presence — replaces O(n²) listener with O(n) periodic fetch
/** @deprecated Use getPresenceForUsers() for contextual presence. Kept for backward compat. */
export async function getPresenceMap(): Promise<Record<string, boolean>> {
  const snap = await getDocs(query(collection(db, `orgs/${ORG}/presence`), limit(500)));
  const map: Record<string, boolean> = {};
  const now = Date.now() / 1000;
  snap.docs.forEach(d => {
    const data = d.data();
    const lastSeen = data.lastSeen?.seconds || 0;
    map[d.id] = data.online && (now - lastSeen) < 120;
  });
  return map;
}

// Contextual presence — fetch only for specific users (Phase 7)
// Reads O(userIds.length) docs instead of O(org_size).
// Used to scope presence to DM partners + active channel members.
export async function getPresenceForUsers(userIds: string[]): Promise<Record<string, boolean>> {
  if (userIds.length === 0) return {};
  const now = Date.now() / 1000;
  const map: Record<string, boolean> = {};
  const reads = userIds.map(uid =>
    getDoc(doc(db, `orgs/${ORG}/presence/${uid}`))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          map[uid] = !!(data.online && (now - (data.lastSeen?.seconds || 0)) < 120);
        } else {
          map[uid] = false;
        }
      })
      .catch(() => { map[uid] = false; })
  );
  await Promise.all(reads);
  return map;
}

/** @deprecated Use getPresenceMap() with polling instead. Kept for backward compat. */
export function onPresenceSnapshot(callback: (presence: Record<string, boolean>) => void) {
  // Immediately fetch once, then return a no-op unsubscribe
  getPresenceMap().then(callback).catch(() => callback({}));
  return () => {};
}

// ===== READ CURSORS =====
export async function markChannelRead(userId: string, channelId: string) {
  return setDoc(doc(db, `orgs/${ORG}/readCursors/${userId}`), { [`channels.${channelId}`]: serverTimestamp() }, { merge: true });
}

export function onReadCursorsSnapshot(userId: string, callback: (cursors: Record<string, any>) => void) {
  return onSnapshot(doc(db, `orgs/${ORG}/readCursors/${userId}`), (snap) => {
    const data = snap.data() || {};
    // Flatten "channels.xxx" dot-notation keys
    const cursors: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('channels.')) {
        cursors[key.replace('channels.', '')] = val;
      }
    }
    callback(cursors);
  }, () => callback({}));
}

// ===========================================================
// CHAT THREADS
// ===========================================================
// Thread replies are stored as regular messages with a `threadId`
// field pointing to the parent message ID. The parent message
// tracks replyCount and lastReplyAt for UI display.

export async function sendThreadReply(
  channelId: string,
  parentMessageId: string,
  data: Partial<MessageData>,
) {
  // Create the reply message with threadId
  const msg = await addTo(`channels/${channelId}/messages`, {
    content: data.content || '',
    userId: data.userId || '',
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    type: data.type || 'text',
    threadId: parentMessageId,
    replyTo: null,
    replyPreview: null,
    replyAuthor: null,
    reactions: {},
    pinned: false,
    edited: false,
    deleted: false,
    mentions: data.mentions || [],
    attachments: data.attachments || [],
    readBy: [data.userId],
  });

  // Update parent message with thread metadata
  const parentRef = doc(db, `channels/${channelId}/messages/${parentMessageId}`);
  await runTransaction(db, async (transaction) => {
    const parentSnap = await transaction.get(parentRef);
    if (!parentSnap.exists()) return;
    const parentData = parentSnap.data();
    transaction.update(parentRef, {
      replyCount: (parentData.replyCount || 0) + 1,
      lastReplyAt: serverTimestamp(),
      lastReplyBy: data.displayName || '',
    });
  });

  // Update channel last message
  const preview = (data.content || '').slice(0, 60);
  await updateAt(`channels/${channelId}`, {
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: `🧵 ${preview}`,
    lastMessageBy: data.displayName || '',
  });

  return msg;
}

export function getThreadReplies(channelId: string, parentMessageId: string, maxResults = 100) {
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    where('threadId', '==', parentMessageId),
    orderBy('createdAt', 'asc'),
    limit(maxResults),
  );
  return getDocs(q).then(snap =>
    snap.docs.map(d => ({ id: d.id, ...d.data() })),
  );
}

export function onThreadRepliesSnapshot(
  channelId: string,
  parentMessageId: string,
  callback: (replies: any[]) => void,
  maxResults = 100,
) {
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    where('threadId', '==', parentMessageId),
    orderBy('createdAt', 'asc'),
    limit(maxResults),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// ===========================================================
// CHAT UNREAD HELPERS
// ===========================================================

/**
 * Compute which channels have unread messages.
 * Pure function — works with data already fetched by the chat page.
 *
 * @param channels — array of { id, lastMessageAt } channel docs
 * @param readCursors — Record<channelId, Timestamp> from onReadCursorsSnapshot
 * @param currentUserId — exclude channels created solely by the current user
 * @returns Record<channelId, boolean> — true if channel has unread messages
 */
export function computeUnreadChannels(
  channels: { id: string; lastMessageAt?: any; lastMessageBy?: string }[],
  readCursors: Record<string, any>,
  currentUserId?: string,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const ch of channels) {
    const lastMsg = ch.lastMessageAt?.seconds || ch.lastMessageAt?.toMillis?.() || 0;
    const cursor = readCursors[ch.id]?.seconds || readCursors[ch.id]?.toMillis?.() || 0;
    if (!lastMsg) { result[ch.id] = false; continue; }
    // If the last message was by the current user, it's "read"
    if (currentUserId && ch.lastMessageBy === currentUserId) {
      result[ch.id] = false;
      continue;
    }
    result[ch.id] = lastMsg > cursor;
  }
  return result;
}

// ===========================================================
// CHAT BOOKMARKS
// ===========================================================

export async function bookmarkMessage(
  userId: string,
  channelId: string,
  messageId: string,
  preview: string,
  channelName: string,
) {
  return addDoc(collection(db, `orgs/${ORG}/members/${userId}/bookmarks`), {
    channelId,
    messageId,
    preview: preview.slice(0, 200),
    channelName,
    createdAt: serverTimestamp(),
  });
}

export async function getBookmarks(userId: string, maxResults = 100) {
  const q = query(
    collection(db, `orgs/${ORG}/members/${userId}/bookmarks`),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function removeBookmark(userId: string, bookmarkId: string) {
  return deleteAt(`orgs/${ORG}/members/${userId}/bookmarks/${bookmarkId}`);
}

export function onBookmarksSnapshot(
  userId: string,
  callback: (bookmarks: any[]) => void,
  maxResults = 100,
) {
  const q = query(
    collection(db, `orgs/${ORG}/members/${userId}/bookmarks`),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// ===========================================================
// CHAT MESSAGE SEARCH
// ===========================================================
// Firestore has no native full-text search. This function
// loads recent messages from a channel and filters client-side.
// For production, consider Algolia/Typesense for server-side search.

export async function searchMessagesInChannel(
  channelId: string,
  searchText: string,
  maxResults = 50,
): Promise<any[]> {
  if (!searchText.trim()) return [];
  const lower = searchText.toLowerCase();
  const q = query(
    collection(db, `channels/${channelId}/messages`),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(500), // Scan last 500 messages
  );
  const snap = await getDocs(q);
  const matches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((m: any) =>
      m.content?.toLowerCase().includes(lower) ||
      m.displayName?.toLowerCase().includes(lower),
    )
    .slice(0, maxResults);
  return matches;
}
