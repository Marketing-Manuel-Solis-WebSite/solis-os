import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const ORG = 'solis-center';

export type AIMode = 'chat' | 'research' | 'deep';

// ====================================================
// AI CONVERSATIONS — Stored per user in Firestore
// Path: orgs/{org}/ai-conversations/{conversationId}
// Subcollection: orgs/{org}/ai-conversations/{conversationId}/messages/{messageId}
// ====================================================

export interface AIConversation {
  id: string;
  userId: string;
  userName: string;
  title: string;
  mode: 'chat' | 'research' | 'deep';
  messageCount: number;
  lastMessage: string;
  starred: boolean;
  archived: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode: 'chat' | 'research' | 'deep';
  tokens: number;
  createdAt: any;
}

const AI_COL = `orgs/${ORG}/ai-conversations`;

// --- Conversations ---

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const q = query(
    collection(db, AI_COL),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  const convos = snap.docs.map(d => ({ id: d.id, ...d.data() } as AIConversation));
  // Sort client-side: starred first, then by updatedAt desc
  return convos.sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
  });
}

export async function createAIConversation(data: {
  userId: string;
  userName: string;
  title: string;
  mode: 'chat' | 'research' | 'deep';
}): Promise<string> {
  const docRef = await addDoc(collection(db, AI_COL), {
    userId: data.userId,
    userName: data.userName,
    title: data.title,
    mode: data.mode,
    messageCount: 0,
    lastMessage: '',
    starred: false,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateAIConversation(id: string, data: Partial<AIConversation>) {
  return updateDoc(doc(db, AI_COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAIConversation(id: string) {
  // Delete all messages first
  const msgsSnap = await getDocs(collection(db, `${AI_COL}/${id}/messages`));
  const deletePromises = msgsSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);
  // Delete conversation
  return deleteDoc(doc(db, AI_COL, id));
}

export async function starAIConversation(id: string, starred: boolean) {
  return updateDoc(doc(db, AI_COL, id), { starred, updatedAt: serverTimestamp() });
}

// --- Messages ---

export async function getAIMessages(conversationId: string): Promise<AIMessage[]> {
  const q = query(
    collection(db, `${AI_COL}/${conversationId}/messages`),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AIMessage));
}

export async function addAIMessage(conversationId: string, data: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode: 'chat' | 'research' | 'deep';
  tokens?: number;
}): Promise<string> {
  const msgRef = await addDoc(collection(db, `${AI_COL}/${conversationId}/messages`), {
    role: data.role,
    content: data.content,
    mode: data.mode,
    tokens: data.tokens || 0,
    createdAt: serverTimestamp(),
  });

  // Update conversation metadata
  const convoRef = doc(db, AI_COL, conversationId);
  const convoSnap = await getDoc(convoRef);
  const currentCount = convoSnap.data()?.messageCount || 0;

  await updateDoc(convoRef, {
    messageCount: currentCount + 1,
    lastMessage: data.content.slice(0, 100),
    updatedAt: serverTimestamp(),
  });

  return msgRef.id;
}

// Auto-generate title from first user message
export async function autoTitleConversation(conversationId: string, firstMessage: string) {
  // Truncate and clean up for title
  let title = firstMessage.slice(0, 60).replace(/\n/g, ' ').trim();
  if (firstMessage.length > 60) title += '...';
  return updateDoc(doc(db, AI_COL, conversationId), {
    title,
    updatedAt: serverTimestamp(),
  });
}