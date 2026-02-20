import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  serverTimestamp, onSnapshot, DocumentData, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';

const ORG = 'solis-center';

// ===== GENERIC HELPERS =====

async function addTo(path: string, data: any) {
  return addDoc(collection(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

async function setAt(path: string, data: any) {
  return setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

async function updateAt(path: string, data: any) {
  return updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
}

async function deleteAt(path: string) { return deleteDoc(doc(db, path)); }

async function getOne(path: string) {
  const s = await getDoc(doc(db, path));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

async function getByOrg(col: string) {
  const q = query(collection(db, col), where('orgId', '==', ORG));
  const s = await getDocs(q);
  const results = s.docs.map(d => ({ id: d.id, ...d.data() }));
  return results.sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
}

// ===== MEMBERS =====
export async function getMembers() {
  const s = await getDocs(collection(db, `orgs/${ORG}/members`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }
export async function updateMember(uid: string, data: any) { return updateAt(`orgs/${ORG}/members/${uid}`, data); }

// ===== ORG =====
export async function getOrg() { return getOne(`orgs/${ORG}`); }
export async function updateOrg(data: any) { return setAt(`orgs/${ORG}`, data); }

// ===== TEAMS / DEPARTMENTS =====
export async function getTeams() {
  const s = await getDocs(collection(db, `orgs/${ORG}/teams`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function createTeam(data: any) {
  const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name, color: data.color || '#6B7280', icon: data.icon || '📁', description: data.description || '',
  });
}
export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }
export async function deleteTeam(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }

// ===== TEAM-FILTERED GETTER =====
async function getByTeam(col: string, teamId: string) {
  const all = await getByOrg(col);
  if (teamId === '__all__') return all;
  return all.filter((d: any) => d.teamId === teamId);
}

// ===== TASKS =====
export async function getTasks(teamId?: string) {
  if (teamId) return getByTeam('tasks', teamId);
  return getByOrg('tasks');
}
export async function createTask(data: any) {
  return addTo('tasks', {
    ...data, orgId: ORG, status: data.status || 'todo', priority: data.priority || 'medium',
    assignees: data.assignees || [], tags: data.tags || [], teamId: data.teamId || '',
    description: data.description || '', dueDate: data.dueDate || null, startDate: data.startDate || null,
    timeEstimate: data.timeEstimate || null, timeSpent: data.timeSpent || 0,
    subtasks: data.subtasks || [], checklist: data.checklist || [], attachments: data.attachments || [],
    customFields: data.customFields || {}, type: data.type || 'task', points: data.points || null,
    dependencies: data.dependencies || [], watchers: data.watchers || [], archived: false,
    createdBy: data.createdBy || '',
  });
}
export async function updateTask(id: string, data: any) { return updateAt(`tasks/${id}`, data); }
export async function deleteTask(id: string) { return deleteAt(`tasks/${id}`); }

export async function getTaskComments(taskId: string) {
  const q = query(collection(db, `tasks/${taskId}/comments`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addTaskComment(taskId: string, data: { text: string; authorId: string; authorName: string }) {
  return addTo(`tasks/${taskId}/comments`, data);
}
export async function getTaskActivity(taskId: string) {
  const q = query(collection(db, `tasks/${taskId}/activity`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addTaskActivity(taskId: string, data: { action: string; field?: string; from?: string; to?: string; actorId: string; actorName: string }) {
  return addTo(`tasks/${taskId}/activity`, data);
}

// ===== DOCS =====
export async function getDocuments(teamId?: string) { if (teamId) return getByTeam('docs', teamId); return getByOrg('docs'); }
export async function createDocument(data: any) { return addTo('docs', { ...data, orgId: ORG, content: data.content || '', teamId: data.teamId || '' }); }
export async function updateDocument(id: string, data: any) { return updateAt(`docs/${id}`, data); }
export async function deleteDocument(id: string) { return deleteAt(`docs/${id}`); }

// ===========================================================
// CHANNELS & MESSAGING — Complete System
// ===========================================================

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
export async function getChannels(teamId?: string) {
  if (teamId) return getByTeam('channels', teamId);
  return getByOrg('channels');
}

export async function getAllUserChannels(userId: string) {
  // Get all channels where user is a member OR channel is public
  const allChannels = await getByOrg('channels');
  return allChannels.filter((ch: any) => {
    if (ch.archived) return false;
    if (ch.type === 'public') return true;
    if (ch.members?.includes(userId)) return true;
    if (ch.createdBy === userId) return true;
    return false;
  });
}

export async function createChannel(data: Partial<ChannelData>) {
  return addTo('channels', {
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
  });
}

export async function updateChannel(id: string, data: Partial<ChannelData>) {
  return updateAt(`channels/${id}`, data);
}

export async function deleteChannel(id: string) {
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
export async function getMessages(channelId: string) {
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
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

// Reactions
export async function addReaction(channelId: string, messageId: string, emoji: string, userId: string) {
  const msgRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;
  const reactions = msgSnap.data().reactions || {};
  if (!reactions[emoji]) reactions[emoji] = [];
  if (!reactions[emoji].includes(userId)) reactions[emoji].push(userId);
  return updateDoc(msgRef, { reactions });
}

export async function removeReaction(channelId: string, messageId: string, emoji: string, userId: string) {
  const msgRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;
  const reactions = msgSnap.data().reactions || {};
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  }
  return updateDoc(msgRef, { reactions });
}

// Mark as read
export async function markAsRead(channelId: string, messageId: string, userId: string) {
  return updateDoc(doc(db, `channels/${channelId}/messages/${messageId}`), {
    readBy: arrayUnion(userId),
  });
}

// Real-time listener for messages
export function onMessagesSnapshot(channelId: string, callback: (msgs: any[]) => void) {
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// DM channel helpers
export async function findOrCreateDM(userId1: string, user1Name: string, userId2: string, user2Name: string) {
  // Look for existing DM between these two users
  const allChannels = await getByOrg('channels');
  const existingDM = allChannels.find((ch: any) =>
    ch.type === 'dm' &&
    ch.members?.length === 2 &&
    ch.members?.includes(userId1) &&
    ch.members?.includes(userId2)
  );
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

// ===========================================================
// AUTOMATIONS
// ===========================================================
export async function getAutomations(teamId?: string) { if (teamId) return getByTeam('automations', teamId); return getByOrg('automations'); }
export async function createAutomation(data: any) { return addTo('automations', { ...data, orgId: ORG, enabled: true, teamId: data.teamId || '' }); }
export async function deleteAutomation(id: string) { return deleteAt(`automations/${id}`); }

// ===== AUDIT LOG =====
export async function getAuditLogs() { return getByOrg('auditLogs'); }
export async function logAction(data: { action: string; resource: string; detail: string; actorId: string; actorName: string }) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== SETTINGS =====
export async function getSettings(key: string) { return getOne(`orgs/${ORG}/settings/${key}`); }
export async function saveSettings(key: string, data: any) { return setAt(`orgs/${ORG}/settings/${key}`, data); }

// ===== WORKSPACES =====
export async function getWorkspaces() { return getByOrg('workspaces'); }
export async function createWorkspace(data: any) { return addTo('workspaces', { ...data, orgId: ORG }); }
export async function deleteWorkspace(id: string) { return deleteAt(`workspaces/${id}`); }

// ===== TEMPLATES =====
export async function getTemplates() { return getByOrg('templates'); }
export async function createTemplate(data: any) { return addTo('templates', { ...data, orgId: ORG }); }
export async function deleteTemplate(id: string) { return deleteAt(`templates/${id}`); }

export { ORG, serverTimestamp };