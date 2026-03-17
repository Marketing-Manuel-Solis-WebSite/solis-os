'use client';

import {
  doc, getDoc, collection, query, where, getDocs, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { createTask, updateTask, softDeleteTask } from '@/lib/db';
import { ORG_ID as ORG } from '@/lib/org';

// ============================================================
// Real Subtask Operations
// Tasks with parentTaskId set, stored as first-class tasks.
// ============================================================

export const MAX_DEPTH = 7;

/** Fetch a single task by ID (local helper, mirrors db.ts getOne). */
async function getTask(id: string): Promise<any | null> {
  const snap = await getDoc(doc(db, `tasks/${id}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---- Create ----

export async function createSubtask(
  parentTaskId: string,
  data: {
    title: string;
    status?: string;
    priority?: string;
    assignees?: string[];
    dueDate?: any;
    teamId: string;
    listId?: string;
    createdBy: string;
  },
): Promise<string> {
  const parent = await getTask(parentTaskId);
  if (!parent) throw new Error('Parent task not found');

  const parentDepth: number = parent.subtaskDepth ?? 0;
  if (parentDepth >= MAX_DEPTH) throw new Error('Maximum subtask depth reached');

  const taskRef = await createTask({
    title: data.title,
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    assignees: data.assignees || [],
    teamId: data.teamId || parent.teamId,
    listId: data.listId || parent.listId || null,
    parentTaskId,
    subtaskDepth: parentDepth + 1,
    subtaskIds: [],
    createdBy: data.createdBy,
    dueDate: data.dueDate || null,
    type: 'task',
    visibility: parent.visibility || 'team',
  });

  // Update parent's subtaskIds array
  const currentIds: string[] = parent.subtaskIds || [];
  await updateTask(parentTaskId, {
    subtaskIds: [...currentIds, taskRef.id],
  });

  return taskRef.id;
}

// ---- Delete ----

export async function deleteSubtask(taskId: string, parentTaskId: string): Promise<void> {
  // Remove from parent's subtaskIds
  const parent = await getTask(parentTaskId);
  if (parent) {
    const currentIds: string[] = parent.subtaskIds || [];
    await updateTask(parentTaskId, {
      subtaskIds: currentIds.filter(id => id !== taskId),
    });
  }

  // Recursively soft-delete children
  const children = await getSubtasks(taskId);
  for (const child of children) {
    await deleteSubtask(child.id, taskId);
  }

  // Soft-delete the subtask itself
  await softDeleteTask(taskId);
}

// ---- Move ----

export async function moveSubtask(taskId: string, newParentId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) return;

  const oldParentId = task.parentTaskId;

  // Remove from old parent
  if (oldParentId) {
    const oldParent = await getTask(oldParentId);
    if (oldParent) {
      const ids: string[] = (oldParent.subtaskIds || []).filter((id: string) => id !== taskId);
      await updateTask(oldParentId, { subtaskIds: ids });
    }
  }

  // Add to new parent
  const newParent = await getTask(newParentId);
  if (newParent) {
    const newDepth: number = (newParent.subtaskDepth ?? 0) + 1;
    if (newDepth > MAX_DEPTH) throw new Error('Maximum subtask depth reached');

    const ids: string[] = newParent.subtaskIds || [];
    await updateTask(newParentId, { subtaskIds: [...ids, taskId] });
    await updateTask(taskId, { parentTaskId: newParentId, subtaskDepth: newDepth });
  }
}

// ---- Query ----

export async function getSubtasks(parentTaskId: string): Promise<any[]> {
  const q = query(
    collection(db, 'tasks'),
    where('orgId', '==', ORG),
    where('parentTaskId', '==', parentTaskId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((t: any) => !t.deleted);
}

export async function getSubtaskTree(rootTaskId: string, maxDepth = MAX_DEPTH): Promise<any> {
  const task = await getTask(rootTaskId);
  if (!task || maxDepth <= 0) return { ...task, children: [] };

  const children = await getSubtasks(rootTaskId);
  const childTrees = await Promise.all(
    children.map(c => getSubtaskTree(c.id, maxDepth - 1)),
  );
  return { ...task, children: childTrees };
}

// ---- Rollup ----

export function rollupProgress(subtasks: any[]): { total: number; done: number; pct: number } {
  const total = subtasks.length;
  const done = subtasks.filter((s: any) => {
    const status = (s.status || '').toLowerCase();
    return status === 'done' || status === 'completed' || status === 'closed';
  }).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ---- Legacy Migration ----

/**
 * Convert legacy embedded subtasks (task.subtasks[]) to real tasks
 * with parentTaskId set. Returns array of newly created task IDs.
 */
export async function convertLegacySubtasks(
  taskId: string,
  teamId: string,
  createdBy: string,
): Promise<string[]> {
  const task = await getTask(taskId);
  if (!task) return [];

  const legacySubtasks: any[] = task.subtasks || [];
  if (!legacySubtasks.length) return [];

  const newIds: string[] = [];
  for (const sub of legacySubtasks) {
    const id = await createSubtask(taskId, {
      title: sub.title,
      status: sub.done ? 'done' : (sub.status || 'todo'),
      priority: sub.priority || 'medium',
      assignees: sub.assigneeId ? [sub.assigneeId] : [],
      dueDate: sub.dueDate,
      teamId,
      createdBy,
    });
    newIds.push(id);
  }

  return newIds;
}
