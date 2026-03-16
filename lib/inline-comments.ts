import { collection, doc, addDoc, updateDoc, getDocs, query, where, orderBy, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORG_ID as ORG } from '@/lib/org';

export interface InlineCommentReply {
  id: string;
  text: string;
  authorId: string;
  authorName?: string;
  createdAt: any;
}

export interface InlineComment {
  id: string;
  docId: string;
  textAnchor: {
    from: number;
    to: number;
    quotedText: string;
  };
  text: string;
  authorId: string;
  authorName?: string;
  resolved: boolean;
  replies: InlineCommentReply[];
  createdAt: any;
  updatedAt?: any;
}

// Collection path: orgs/{orgId}/docs/{docId}/inlineComments
function commentsCol(docId: string) {
  return collection(db, 'orgs', ORG, 'docs', docId, 'inlineComments');
}

export async function getInlineComments(docId: string): Promise<InlineComment[]> {
  const q = query(commentsCol(docId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InlineComment));
}

export async function addInlineComment(docId: string, comment: Omit<InlineComment, 'id' | 'createdAt' | 'replies' | 'resolved'>): Promise<string> {
  const ref = await addDoc(commentsCol(docId), {
    ...comment,
    resolved: false,
    replies: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function resolveInlineComment(docId: string, commentId: string, resolved: boolean): Promise<void> {
  const ref = doc(db, 'orgs', ORG, 'docs', docId, 'inlineComments', commentId);
  await updateDoc(ref, { resolved, updatedAt: serverTimestamp() });
}

export async function addInlineCommentReply(docId: string, commentId: string, reply: Omit<InlineCommentReply, 'id' | 'createdAt'>): Promise<void> {
  const ref = doc(db, 'orgs', ORG, 'docs', docId, 'inlineComments', commentId);
  const replyData = {
    ...reply,
    id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await updateDoc(ref, { replies: arrayUnion(replyData), updatedAt: serverTimestamp() });
}
