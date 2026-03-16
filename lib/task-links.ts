// ============================================================
// Task Links — Link external resources (PRs, commits, branches) to tasks
// ============================================================

import {
  collection, doc, addDoc, deleteDoc, getDocs,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';

// ---- Types ----

export type TaskLinkType = 'pr' | 'commit' | 'branch' | 'issue' | 'check_run';

export type TaskLinkStatus =
  | 'open' | 'closed' | 'merged'      // PRs
  | 'success' | 'failure' | 'pending'  // CI checks
  | 'active';                          // branches, generic

export interface TaskLink {
  id?: string;
  taskId: string;
  type: TaskLinkType;
  provider: 'github' | 'gitlab' | 'bitbucket';
  externalId: string;
  url: string;
  title: string;
  status: TaskLinkStatus;
  repo?: string;
  author?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ---- Extract Task IDs from Text ----

/**
 * Extract SOLIS task references from text.
 * Patterns:
 *   - SOLIS-123 / solis-123
 *   - #123  (only when preceded by whitespace or start of string)
 *   - TASK-abc123 / task-abc123
 */
export function extractTaskIds(text: string): string[] {
  if (!text) return [];

  const ids = new Set<string>();

  // SOLIS-<id> pattern (alphanumeric)
  const solisPattern = /\bSOLIS-([a-zA-Z0-9]+)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = solisPattern.exec(text)) !== null) {
    ids.add(match[1]);
  }

  // TASK-<id> pattern (alphanumeric)
  const taskPattern = /\bTASK-([a-zA-Z0-9]+)\b/gi;
  while ((match = taskPattern.exec(text)) !== null) {
    ids.add(match[1]);
  }

  // #<digits> pattern (only digits, min 3 chars to avoid false positives)
  const hashPattern = /(?:^|\s)#(\d{3,})\b/g;
  while ((match = hashPattern.exec(text)) !== null) {
    ids.add(match[1]);
  }

  return Array.from(ids);
}

// ---- CRUD Operations ----

export async function addTaskLink(link: Omit<TaskLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'taskLinks'), {
    ...link,
    orgId: ORG,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTaskLinks(taskId: string): Promise<TaskLink[]> {
  const q = query(
    collection(db, 'taskLinks'),
    where('taskId', '==', taskId),
    where('orgId', '==', ORG),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskLink));
}

export async function removeTaskLink(linkId: string): Promise<void> {
  await deleteDoc(doc(db, 'taskLinks', linkId));
}

// Server-side helpers are in lib/task-links-admin.ts to avoid bundling
// firebase-admin in client-side code.
