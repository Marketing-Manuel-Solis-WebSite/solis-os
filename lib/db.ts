import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  serverTimestamp, onSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

const ORG = 'solis-center';

// ===== GENERIC HELPERS (NO composite indexes!) =====

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

// SIMPLE query — only ONE where clause, NO orderBy combined with where
// Sorting done client-side to avoid index requirement
async function getByOrg(col: string) {
  const q = query(collection(db, col), where('orgId', '==', ORG));
  const s = await getDocs(q);
  const results = s.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort client-side by createdAt descending
  return results.sort((a: any, b: any) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
}

// ===== MEMBERS (subcollection, no orgId filter needed) =====
export async function getMembers() {
  const s = await getDocs(collection(db, `orgs/${ORG}/members`));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getMember(uid: string) { return getOne(`orgs/${ORG}/members/${uid}`); }
export async function updateMember(uid: string, data: any) { return updateAt(`orgs/${ORG}/members/${uid}`, data); }

// ===== ORG =====
export async function getOrg() { return getOne(`orgs/${ORG}`); }
export async function updateOrg(data: any) { return setAt(`orgs/${ORG}`, data); }

// ===== TASKS =====
export async function getTasks() { return getByOrg('tasks'); }
export async function createTask(data: any) {
  return addTo('tasks', { ...data, orgId: ORG, status: data.status || 'todo', priority: data.priority || 'medium', assignees: data.assignees || [], tags: data.tags || [] });
}
export async function updateTask(id: string, data: any) { return updateAt(`tasks/${id}`, data); }
export async function deleteTask(id: string) { return deleteAt(`tasks/${id}`); }

// ===== DOCS =====
export async function getDocuments() { return getByOrg('docs'); }
export async function createDocument(data: any) { return addTo('docs', { ...data, orgId: ORG, content: data.content || '' }); }
export async function updateDocument(id: string, data: any) { return updateAt(`docs/${id}`, data); }
export async function deleteDocument(id: string) { return deleteAt(`docs/${id}`); }

// ===== CHANNELS & MESSAGES =====
export async function getChannels() { return getByOrg('channels'); }
export async function createChannel(data: any) { return addTo('channels', { ...data, orgId: ORG }); }
export async function getMessages(channelId: string) {
  // Simple query - no composite needed, just one orderBy on a single collection
  const q = query(collection(db, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function sendMessage(channelId: string, data: any) {
  return addTo(`channels/${channelId}/messages`, data);
}

// ===== AUTOMATIONS =====
export async function getAutomations() { return getByOrg('automations'); }
export async function createAutomation(data: any) { return addTo('automations', { ...data, orgId: ORG, enabled: true }); }
export async function deleteAutomation(id: string) { return deleteAt(`automations/${id}`); }

// ===== AUDIT LOG =====
export async function getAuditLogs() { return getByOrg('auditLogs'); }
export async function logAction(data: { action: string; resource: string; detail: string; actorId: string; actorName: string }) {
  return addTo('auditLogs', { ...data, orgId: ORG });
}

// ===== SETTINGS (single doc, no query) =====
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
