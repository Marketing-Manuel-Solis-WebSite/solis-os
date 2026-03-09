import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, deleteField,
  getDocs, getDoc, query, where, orderBy, limit, writeBatch, collectionGroup,
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

async function getByOrg(col: string, maxResults = 500) {
  const q = query(collection(db, col), where('orgId', '==', ORG), limit(maxResults));
  const s = await getDocs(q);
  const results = s.docs.map(d => ({ id: d.id, ...d.data() }));
  return results.sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
}

// ===== CASCADE DELETE HELPERS =====

// Delete all documents in a subcollection (batched, max 450 per batch)
async function deleteSubcollectionDocs(parentPath: string, subcollectionName: string): Promise<number> {
  const ref = collection(db, `${parentPath}/${subcollectionName}`);
  const snap = await getDocs(ref);
  if (snap.empty) return 0;
  let deleted = 0;
  const CHUNK = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(CHUNK, snap.docs.length - i);
  }
  return deleted;
}

// Delete all relations where entity is source or target
async function cleanupEntityRelations(entityId: string): Promise<number> {
  const [asSource, asTarget] = await Promise.all([
    getDocs(query(collection(db, 'relations'), where('orgId', '==', ORG), where('sourceId', '==', entityId))),
    getDocs(query(collection(db, 'relations'), where('orgId', '==', ORG), where('targetId', '==', entityId))),
  ]);
  const toDelete = new Map<string, any>();
  for (const snap of [asSource, asTarget]) {
    for (const d of snap.docs) toDelete.set(d.id, d.ref);
  }
  if (toDelete.size === 0) return 0;
  const refs = Array.from(toDelete.values());
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((r: any) => batch.delete(r));
    await batch.commit();
  }
  return toDelete.size;
}

// Remove a task from all goal targets that reference it, then recalculate progress
async function removeTaskFromGoalTargets(taskId: string): Promise<void> {
  try {
    const snap = await getDocs(query(
      collectionGroup(db, 'targets'),
      where('linkedTaskIds', 'array-contains', taskId),
    ));
    const goalIdsToRecalc = new Set<string>();
    for (const d of snap.docs) {
      await updateDoc(d.ref, { linkedTaskIds: arrayRemove(taskId), updatedAt: serverTimestamp() });
      const goalId = d.ref.parent.parent?.id;
      if (goalId) goalIdsToRecalc.add(goalId);
    }
    for (const goalId of goalIdsToRecalc) {
      await recalculateGoalProgress(goalId);
    }
  } catch { /* OK if no targets exist */ }
}

// ===== MEMBERS =====
export async function getMembers() {
  const s = await getDocs(collection(db, `orgs/${ORG}/members`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }
export async function updateMember(uid: string, data: any) { return updateAt(`orgs/${ORG}/members/${uid}`, data); }
export async function createMember(uid: string, data: any) {
  return setAt(`orgs/${ORG}/members/${uid}`, {
    userId: uid, orgId: ORG,
    role: data.role || 'member',
    teamId: data.teamId || '',
    teamIds: data.teamId ? [data.teamId] : [],
    displayName: data.displayName || '',
    email: data.email || '',
    title: data.title || '',
    department: data.department || '',
    managerId: data.managerId || '',
    hierarchyLevel: data.hierarchyLevel || 'member',
    photoURL: data.photoURL || '',
    active: true,
  });
}
export async function softDeleteMember(uid: string) { return updateAt(`orgs/${ORG}/members/${uid}`, { active: false }); }
export async function reactivateMember(uid: string) { return updateAt(`orgs/${ORG}/members/${uid}`, { active: true }); }

// ===== ORG =====
export async function getOrg() { return getOne(`orgs/${ORG}`); }
export async function updateOrg(data: any) { return setAt(`orgs/${ORG}`, data); }

// ===== TEAMS / DEPARTMENTS =====
export async function getTeams() {
  const s = await getDocs(collection(db, `orgs/${ORG}/teams`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getActiveTeams() {
  const all = await getTeams();
  return all.filter((t: any) => t.status !== 'archived');
}
export async function createTeam(data: any) {
  const id = data.id || data.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return setAt(`orgs/${ORG}/teams/${id}`, {
    name: data.name, color: data.color || '#6B7280', icon: data.icon || '📁', description: data.description || '',
    status: 'active',
  });
}
export async function updateTeam(id: string, data: any) { return updateAt(`orgs/${ORG}/teams/${id}`, data); }
export async function deleteTeam(id: string) { return deleteAt(`orgs/${ORG}/teams/${id}`); }
export async function archiveTeam(id: string) { return updateAt(`orgs/${ORG}/teams/${id}`, { status: 'archived' }); }
export async function unarchiveTeam(id: string) { return updateAt(`orgs/${ORG}/teams/${id}`, { status: 'active' }); }

// Collections that reference teamId
const TEAM_RESOURCE_COLLECTIONS = ['tasks', 'goals', 'docs', 'channels', 'forms', 'time-entries', 'whiteboards', 'automations'] as const;

// Dry-run: count all resources and members that would be affected by deleting a department
export async function getDepartmentImpact(teamId: string) {
  const counts: Record<string, number> = {};
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', teamId));
    const snap = await getDocs(q_);
    counts[col] = snap.size;
  }
  // Count members with this as primary team
  const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
  const primaryMembers = membersSnap.docs.filter(d => d.data().teamId === teamId);
  const secondaryMembers = membersSnap.docs.filter(d => {
    const tids = d.data().teamIds || [];
    return tids.includes(teamId) && d.data().teamId !== teamId;
  });
  counts['primaryMembers'] = primaryMembers.length;
  counts['secondaryMembers'] = secondaryMembers.length;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}

// Reassign all resources from one team to another
export async function reassignTeamResources(fromTeamId: string, toTeamId: string, toTeamName: string) {
  let moved = 0;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', fromTeamId));
    const snap = await getDocs(q_);
    for (const d of snap.docs) {
      await updateDoc(doc(db, `${col}/${d.id}`), { teamId: toTeamId, updatedAt: serverTimestamp() });
      moved++;
    }
  }
  // Reassign members: primary team
  const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
  for (const d of membersSnap.docs) {
    const data = d.data();
    if (data.teamId === fromTeamId) {
      const newTeamIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newTeamIds.includes(toTeamId)) newTeamIds.push(toTeamId);
      await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamId: toTeamId, teamIds: newTeamIds, department: toTeamName, updatedAt: serverTimestamp(),
      });
      moved++;
    } else if ((data.teamIds || []).includes(fromTeamId)) {
      const newTeamIds = (data.teamIds || []).filter((t: string) => t !== fromTeamId);
      if (!newTeamIds.includes(toTeamId)) newTeamIds.push(toTeamId);
      await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamIds: newTeamIds, updatedAt: serverTimestamp(),
      });
      moved++;
    }
  }
  return moved;
}

// Purge: delete all resources belonging to a team
export async function purgeTeamResources(teamId: string) {
  let deleted = 0;
  for (const col of TEAM_RESOURCE_COLLECTIONS) {
    const q_ = query(collection(db, col), where('orgId', '==', ORG), where('teamId', '==', teamId));
    const snap = await getDocs(q_);
    for (const d of snap.docs) {
      // Use cascade delete for entities with subcollections
      switch (col) {
        case 'tasks': await deleteTask(d.id); break;
        case 'goals': await deleteGoal(d.id); break;
        case 'docs': await deleteDocument(d.id); break;
        case 'channels': await deleteChannel(d.id); break;
        case 'forms': await deleteForm(d.id); break;
        case 'whiteboards': await deleteWhiteboard(d.id); break;
        default: await deleteAt(`${col}/${d.id}`); break;
      }
      deleted++;
    }
  }
  // Unassign members from this team (don't delete members, just clear the teamId)
  const membersSnap = await getDocs(collection(db, `orgs/${ORG}/members`));
  for (const d of membersSnap.docs) {
    const data = d.data();
    if (data.teamId === teamId) {
      await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamId: '', teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), department: '', updatedAt: serverTimestamp(),
      });
    } else if ((data.teamIds || []).includes(teamId)) {
      await updateDoc(doc(db, `orgs/${ORG}/members/${d.id}`), {
        teamIds: (data.teamIds || []).filter((t: string) => t !== teamId), updatedAt: serverTimestamp(),
      });
    }
  }
  return deleted;
}

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
    visibility: data.visibility || 'team',
    description: data.description || '', dueDate: data.dueDate || null, startDate: data.startDate || null,
    timeEstimate: data.timeEstimate || null, timeSpent: data.timeSpent || 0,
    subtasks: data.subtasks || [], checklist: data.checklist || [], attachments: data.attachments || [],
    customFields: data.customFields || {}, type: data.type || 'task', points: data.points || null,
    dependencies: data.dependencies || [], watchers: data.watchers || [], archived: false,
    createdBy: data.createdBy || '',
  });
}
export async function updateTask(id: string, data: any) { return updateAt(`tasks/${id}`, data); }
export async function deleteTask(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`tasks/${id}`, 'comments'),
    deleteSubcollectionDocs(`tasks/${id}`, 'activity'),
    cleanupEntityRelations(id),
    removeTaskFromGoalTargets(id),
  ]);
  return deleteAt(`tasks/${id}`);
}
export async function softDeleteTask(id: string) {
  // Clean up references that would break other entities; keep subcollections for potential restore
  await Promise.allSettled([
    cleanupEntityRelations(id),
    removeTaskFromGoalTargets(id),
  ]);
  return updateAt(`tasks/${id}`, { deleted: true, deletedAt: serverTimestamp() });
}
export async function restoreTask(id: string) { return updateAt(`tasks/${id}`, { deleted: false, deletedAt: null }); }

export async function getTaskComments(taskId: string, maxResults = 200) {
  const q = query(collection(db, `tasks/${taskId}/comments`), orderBy('createdAt', 'asc'), limit(maxResults));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addTaskComment(taskId: string, data: { text: string; authorId: string; authorName: string; mentions?: string[]; attachments?: any[] }) {
  return addTo(`tasks/${taskId}/comments`, { ...data, mentions: data.mentions || [], attachments: data.attachments || [] });
}
export async function getCustomFieldDefs() {
  const data = await getOne(`orgs/${ORG}/settings/customFields`);
  return (data as any)?.fields || [];
}
export async function saveCustomFieldDefs(fields: any[]) {
  return setAt(`orgs/${ORG}/settings/customFields`, { fields });
}
export async function getTaskActivity(taskId: string, maxResults = 500) {
  const q = query(collection(db, `tasks/${taskId}/activity`), orderBy('createdAt', 'asc'), limit(maxResults));
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
export async function deleteDocument(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`docs/${id}`, 'revisions'),
    cleanupEntityRelations(id),
  ]);
  return deleteAt(`docs/${id}`);
}

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
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'), limit(maxResults));
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
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs.reverse());
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
export async function updateAutomation(id: string, data: any) { return updateAt(`automations/${id}`, data); }
export async function deleteAutomation(id: string) { return deleteAt(`automations/${id}`); }

// ===== AUDIT LOG =====
export async function getAuditLogs() { return getByOrg('auditLogs'); }
export async function logAction(data: { action: string; resource: string; detail: string; actorId: string; actorName: string }) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== SETTINGS =====
export async function getSettings(key: string) { return getOne(`orgs/${ORG}/settings/${key}`); }
export async function saveSettings(key: string, data: any) { return setAt(`orgs/${ORG}/settings/${key}`, data); }

// ===== USER PREFERENCES =====
export async function getUserPreferences(userId: string, key: string) {
  return getOne(`orgs/${ORG}/members/${userId}/preferences/${key}`);
}
export async function saveUserPreferences(userId: string, key: string, data: any) {
  return setAt(`orgs/${ORG}/members/${userId}/preferences/${key}`, data);
}

// ===== WORKSPACES =====
export async function getWorkspaces() { return getByOrg('workspaces'); }
export async function createWorkspace(data: any) { return addTo('workspaces', { ...data, orgId: ORG }); }
export async function deleteWorkspace(id: string) { return deleteAt(`workspaces/${id}`); }

// ===== TEMPLATES =====
export async function getTemplates() { return getByOrg('templates'); }
export async function createTemplate(data: any) { return addTo('templates', { ...data, orgId: ORG }); }
export async function deleteTemplate(id: string) { return deleteAt(`templates/${id}`); }

// ===== TYPING INDICATORS =====
export async function setTyping(channelId: string, userId: string, displayName: string) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return setDoc(ref, { [`users.${userId}`]: { name: displayName, at: serverTimestamp() } }, { merge: true });
}

export async function clearTyping(channelId: string, userId: string) {
  const ref = doc(db, `channels/${channelId}/meta/typing`);
  return updateDoc(ref, { [`users.${userId}`]: deleteField() }).catch(() => {});
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

export function onPresenceSnapshot(callback: (presence: Record<string, boolean>) => void) {
  return onSnapshot(collection(db, `orgs/${ORG}/presence`), (snap) => {
    const map: Record<string, boolean> = {};
    const now = Date.now() / 1000;
    snap.docs.forEach(d => {
      const data = d.data();
      const lastSeen = data.lastSeen?.seconds || 0;
      map[d.id] = data.online && (now - lastSeen) < 120;
    });
    callback(map);
  }, () => callback({}));
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
// GOALS
// ===========================================================
export async function getGoals(teamId?: string) {
  if (teamId) return getByTeam('goals', teamId);
  return getByOrg('goals');
}

export async function getGoal(id: string) { return getOne(`goals/${id}`); }

export async function createGoal(data: any) {
  return addTo('goals', {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    dueDate: data.dueDate || null,
    ownerId: data.ownerId || '',
    ownerName: data.ownerName || '',
    teamId: data.teamId || '',
    status: data.status || 'on_track',
    progress: 0,
    tags: data.tags || [],
    color: data.color || '#7B68EE',
    visibility: data.visibility || 'team',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
  });
}

export async function updateGoal(id: string, data: any) { return updateAt(`goals/${id}`, data); }
export async function deleteGoal(id: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`goals/${id}`, 'targets'),
    cleanupEntityRelations(id),
  ]);
  return deleteAt(`goals/${id}`);
}

// Goal Targets (subcollection)
export async function getGoalTargets(goalId: string) {
  const q = query(collection(db, `goals/${goalId}/targets`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createGoalTarget(goalId: string, data: any) {
  return addTo(`goals/${goalId}/targets`, {
    name: data.name || '',
    type: data.type || 'number',
    currentValue: data.currentValue || 0,
    targetValue: data.targetValue || 100,
    unit: data.unit || '',
    linkedTaskIds: data.linkedTaskIds || [],
    autoSync: data.autoSync ?? true,
  });
}

export async function updateGoalTarget(goalId: string, targetId: string, data: any) {
  return updateAt(`goals/${goalId}/targets/${targetId}`, data);
}

export async function deleteGoalTarget(goalId: string, targetId: string) {
  return deleteAt(`goals/${goalId}/targets/${targetId}`);
}

// Recalculate goal progress from targets
export async function recalculateGoalProgress(goalId: string) {
  const targets = await getGoalTargets(goalId);
  if (targets.length === 0) {
    await updateAt(`goals/${goalId}`, { progress: 0 });
    return 0;
  }
  let totalProgress = 0;
  for (const t of targets) {
    const target = t as any;
    const tv = Math.max(target.targetValue || 1, 1); // Guard: never divide by zero
    const cv = Math.min(Math.max(target.currentValue || 0, 0), tv);
    totalProgress += (cv / tv) * 100;
  }
  const progress = Math.round(totalProgress / targets.length);
  await updateAt(`goals/${goalId}`, { progress });
  return progress;
}

// Sync goal targets when a task status changes
// Uses collectionGroup query to find only targets that reference this task (O(1) lookup)
export async function syncGoalTargetsForTask(taskId: string) {
  try {
    // Find only targets that link to this task (instead of loading ALL goals)
    const snap = await getDocs(query(
      collectionGroup(db, 'targets'),
      where('linkedTaskIds', 'array-contains', taskId),
    ));
    if (snap.empty) return;

    const goalIdsToRecalc = new Set<string>();

    for (const targetDoc of snap.docs) {
      const t = targetDoc.data();
      if (t.type !== 'tasks' || !t.autoSync) continue;

      // Count completed tasks among linked (batch-safe: limited by linkedTaskIds length)
      const linkedIds: string[] = t.linkedTaskIds || [];
      let completed = 0;
      for (const tid of linkedIds) {
        const task = await getOne(`tasks/${tid}`);
        if ((task as any)?.status === 'done' && !(task as any)?.deleted) completed++;
      }

      if (completed !== t.currentValue) {
        await updateDoc(targetDoc.ref, { currentValue: completed, updatedAt: serverTimestamp() });
        const goalId = targetDoc.ref.parent.parent?.id;
        if (goalId) goalIdsToRecalc.add(goalId);
      }
    }

    // Recalculate progress for affected goals only
    for (const goalId of goalIdsToRecalc) {
      await recalculateGoalProgress(goalId);
    }
  } catch (err) {
    console.error('[syncGoalTargetsForTask] Error:', err);
  }
}

// ===========================================================
// TIME ENTRIES (Timesheets)
// ===========================================================
export async function getTimeEntries(teamId?: string) {
  if (teamId) return getByTeam('time-entries', teamId);
  return getByOrg('time-entries');
}

export async function getTimeEntriesByDateRange(startDate: string, endDate: string, userId?: string) {
  let q;
  if (userId) {
    q = query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('userId', '==', userId)
    );
  } else {
    q = query(
      collection(db, 'time-entries'),
      where('orgId', '==', ORG),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
  }
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTimeEntriesByTask(taskId: string) {
  const q = query(
    collection(db, 'time-entries'),
    where('orgId', '==', ORG),
    where('taskId', '==', taskId)
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createTimeEntry(data: any) {
  return addTo('time-entries', {
    orgId: ORG,
    userId: data.userId || '',
    userName: data.userName || '',
    taskId: data.taskId || '',
    taskTitle: data.taskTitle || '',
    date: data.date || '',
    hours: data.hours || 0,
    minutes: data.minutes || 0,
    notes: data.notes || '',
    billable: data.billable ?? false,
    teamId: data.teamId || '',
    createdBy: data.createdBy || '',
  });
}

export async function updateTimeEntry(id: string, data: any) { return updateAt(`time-entries/${id}`, data); }
export async function deleteTimeEntry(id: string) { return deleteAt(`time-entries/${id}`); }

// ===========================================================
// WHITEBOARDS
// ===========================================================
export async function getWhiteboards(teamId?: string) {
  if (teamId) return getByTeam('whiteboards', teamId);
  return getByOrg('whiteboards');
}

export async function getWhiteboard(id: string) { return getOne(`whiteboards/${id}`); }

export async function createWhiteboard(data: any) {
  return addTo('whiteboards', {
    orgId: ORG,
    name: data.name || '',
    description: data.description || '',
    teamId: data.teamId || '',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    members: data.members || [],
    thumbnail: '',
    visibility: data.visibility || 'team',
  });
}

export async function updateWhiteboard(id: string, data: any) { return updateAt(`whiteboards/${id}`, data); }
export async function deleteWhiteboard(id: string) {
  await deleteSubcollectionDocs(`whiteboards/${id}`, 'elements').catch(() => {});
  return deleteAt(`whiteboards/${id}`);
}

// Whiteboard Elements (subcollection)
export async function getWhiteboardElements(boardId: string) {
  const q = query(collection(db, `whiteboards/${boardId}/elements`), orderBy('zIndex', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createWhiteboardElement(boardId: string, data: any) {
  return addTo(`whiteboards/${boardId}/elements`, {
    type: data.type || 'sticky',
    x: data.x || 0,
    y: data.y || 0,
    width: data.width || 200,
    height: data.height || 150,
    content: data.content || '',
    color: data.color || '#FBBF24',
    style: data.style || {},
    linkedTaskId: data.linkedTaskId || '',
    createdBy: data.createdBy || '',
    zIndex: data.zIndex || 0,
  });
}

export async function updateWhiteboardElement(boardId: string, elementId: string, data: any) {
  return updateAt(`whiteboards/${boardId}/elements/${elementId}`, data);
}

export async function deleteWhiteboardElement(boardId: string, elementId: string) {
  return deleteAt(`whiteboards/${boardId}/elements/${elementId}`);
}

// Real-time listener for whiteboard elements (collaboration)
export function onWhiteboardElementsSnapshot(boardId: string, callback: (elements: any[]) => void) {
  const q = query(collection(db, `whiteboards/${boardId}/elements`), orderBy('zIndex', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// ===========================================================
// FORMS
// ===========================================================
export async function getForms(teamId?: string) {
  if (teamId) return getByTeam('forms', teamId);
  return getByOrg('forms');
}

export async function getForm(id: string) { return getOne(`forms/${id}`); }

export async function getFormByToken(token: string) {
  const q = query(collection(db, 'forms'), where('publicToken', '==', token), limit(1));
  const s = await getDocs(q);
  if (s.empty) return null;
  return { id: s.docs[0].id, ...s.docs[0].data() };
}

export async function createForm(data: any) {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  return addTo('forms', {
    orgId: ORG,
    title: data.title || '',
    description: data.description || '',
    status: 'draft',
    publicToken: token,
    responseLimit: null,
    responseCount: 0,
    openAt: null,
    closeAt: null,
    logoUrl: '',
    layout: '1col',
    successMessage: data.successMessage || '',
    redirectUrl: '',
    fields: data.fields || [],
    captchaEnabled: false,
    rateLimitPerMinute: 5,
    collectIp: true,
    collectUserAgent: true,
    privacyNotice: '',
    consentRequired: false,
    retentionDays: null,
    defaultMappingId: '',
    autoConvert: false,
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    teamId: data.teamId || '',
  });
}

export async function updateForm(formId: string, data: any) { return updateAt(`forms/${formId}`, data); }
export async function deleteForm(formId: string) {
  await Promise.allSettled([
    deleteSubcollectionDocs(`forms/${formId}`, 'submissions'),
    deleteSubcollectionDocs(`forms/${formId}`, 'mappings'),
  ]);
  return deleteAt(`forms/${formId}`);
}

export async function regenerateFormToken(formId: string): Promise<string> {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  await updateAt(`forms/${formId}`, { publicToken: token });
  return token;
}

// Form Submissions (subcollection)
export async function getFormSubmissions(formId: string, maxResults = 500) {
  const q = query(collection(db, `forms/${formId}/submissions`), orderBy('createdAt', 'desc'), limit(maxResults));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getFormSubmission(formId: string, submissionId: string) {
  return getOne(`forms/${formId}/submissions/${submissionId}`);
}

export async function createFormSubmission(formId: string, data: any) {
  return addTo(`forms/${formId}/submissions`, {
    values: data.values || {},
    ip: data.ip || null,
    userAgent: data.userAgent || null,
    utmSource: data.utmSource || '',
    utmMedium: data.utmMedium || '',
    utmCampaign: data.utmCampaign || '',
    referrer: data.referrer || '',
    attachments: data.attachments || [],
    status: 'new',
    reviewedBy: '',
    reviewedAt: null,
    notes: '',
    assignedTo: '',
    convertedToType: null,
    convertedToId: null,
    convertedAt: null,
    convertedBy: null,
    consentGiven: data.consentGiven ?? false,
  });
}

export async function updateFormSubmission(formId: string, submissionId: string, data: any) {
  return updateAt(`forms/${formId}/submissions/${submissionId}`, data);
}

export function onFormSubmissionsSnapshot(formId: string, callback: (subs: any[]) => void) {
  const q = query(collection(db, `forms/${formId}/submissions`), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// Form Mappings (subcollection)
export async function getFormMappings(formId: string) {
  const q = query(collection(db, `forms/${formId}/mappings`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFormMapping(formId: string, data: any) {
  return addTo(`forms/${formId}/mappings`, {
    name: data.name || '',
    entityType: data.entityType || 'task',
    targetTeamId: data.targetTeamId || '',
    defaultStatus: data.defaultStatus || 'todo',
    defaultPriority: data.defaultPriority || 'medium',
    defaultAssignees: data.defaultAssignees || [],
    defaultTags: data.defaultTags || [],
    fieldMap: data.fieldMap || {},
    autoSubtasks: data.autoSubtasks || [],
    autoChecklist: data.autoChecklist || [],
    createdBy: data.createdBy || '',
  });
}

export async function updateFormMapping(formId: string, mappingId: string, data: any) {
  return updateAt(`forms/${formId}/mappings/${mappingId}`, data);
}

export async function deleteFormMapping(formId: string, mappingId: string) {
  return deleteAt(`forms/${formId}/mappings/${mappingId}`);
}

export { ORG, serverTimestamp };