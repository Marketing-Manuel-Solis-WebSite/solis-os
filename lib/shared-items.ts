'use client';

// ================================================================
// Shared Items — Query items shared with the user but not in their
// primary spaces. This powers the "Shared with me" section.
// ================================================================

import {
  collection, query, where, getDocs, orderBy, limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentOrgId } from '@/lib/org';

export interface SharedItem {
  id: string;
  type: 'task' | 'doc' | 'goal' | 'whiteboard';
  title: string;
  subtitle?: string;
  spaceId?: string;
  spaceName?: string;
  createdBy?: string;
  updatedAt?: any;
  status?: string;
  priority?: string;
}

/**
 * Get tasks where the user is assigned or watching but not a member
 * of the task's space.
 */
export async function getSharedTasks(
  userId: string,
  userTeamIds: string[],
  maxResults = 100,
): Promise<SharedItem[]> {
  const orgId = getCurrentOrgId();
  const results: SharedItem[] = [];
  const seen = new Set<string>();

  // Query tasks where user is an assignee
  const assigneeQuery = query(
    collection(db, 'tasks'),
    where('orgId', '==', orgId),
    where('assignees', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );

  const assigneeSnap = await getDocs(assigneeQuery);
  for (const doc of assigneeSnap.docs) {
    const data = doc.data();
    if (data.archived || data.deleted) continue;
    // Only include if user is NOT in the task's space
    if (data.teamId && userTeamIds.includes(data.teamId)) continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    results.push({
      id: doc.id,
      type: 'task',
      title: data.title || 'Untitled',
      subtitle: data.status,
      spaceId: data.teamId,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
      status: data.status,
      priority: data.priority,
    });
  }

  // Query tasks where user is a watcher
  const watcherQuery = query(
    collection(db, 'tasks'),
    where('orgId', '==', orgId),
    where('watchers', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );

  const watcherSnap = await getDocs(watcherQuery);
  for (const doc of watcherSnap.docs) {
    const data = doc.data();
    if (data.archived || data.deleted) continue;
    if (data.teamId && userTeamIds.includes(data.teamId)) continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    results.push({
      id: doc.id,
      type: 'task',
      title: data.title || 'Untitled',
      subtitle: data.status,
      spaceId: data.teamId,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
      status: data.status,
      priority: data.priority,
    });
  }

  return results;
}

/**
 * Get docs where user is an explicit viewer/editor but not in the doc's space.
 */
export async function getSharedDocs(
  userId: string,
  userTeamIds: string[],
  maxResults = 100,
): Promise<SharedItem[]> {
  const orgId = getCurrentOrgId();
  const results: SharedItem[] = [];
  const seen = new Set<string>();

  // Docs where user is a viewer
  const viewerQuery = query(
    collection(db, 'docs'),
    where('orgId', '==', orgId),
    where('permissions.viewers', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );

  const viewerSnap = await getDocs(viewerQuery);
  for (const doc of viewerSnap.docs) {
    const data = doc.data();
    if (data.archived) continue;
    if (data.teamId && userTeamIds.includes(data.teamId)) continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    results.push({
      id: doc.id,
      type: 'doc',
      title: data.title || 'Untitled',
      subtitle: data.permissions?.visibility,
      spaceId: data.teamId,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
    });
  }

  // Docs where user is an editor
  const editorQuery = query(
    collection(db, 'docs'),
    where('orgId', '==', orgId),
    where('permissions.editors', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );

  const editorSnap = await getDocs(editorQuery);
  for (const doc of editorSnap.docs) {
    const data = doc.data();
    if (data.archived) continue;
    if (data.teamId && userTeamIds.includes(data.teamId)) continue;
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    results.push({
      id: doc.id,
      type: 'doc',
      title: data.title || 'Untitled',
      subtitle: data.permissions?.visibility,
      spaceId: data.teamId,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
    });
  }

  return results;
}

/**
 * Get goals where user is the owner but not a member of the goal's space.
 */
export async function getSharedGoals(
  userId: string,
  userTeamIds: string[],
  maxResults = 100,
): Promise<SharedItem[]> {
  const orgId = getCurrentOrgId();
  const results: SharedItem[] = [];

  const ownerQuery = query(
    collection(db, 'goals'),
    where('orgId', '==', orgId),
    where('ownerId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );

  const snap = await getDocs(ownerQuery);
  for (const d of snap.docs) {
    const data = d.data();
    if (data.teamId && userTeamIds.includes(data.teamId)) continue;
    results.push({
      id: d.id,
      type: 'goal',
      title: data.name || 'Untitled Goal',
      subtitle: data.status,
      spaceId: data.teamId,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
      status: data.status,
    });
  }

  return results;
}

/**
 * Get whiteboards where user is an explicit member but not in the whiteboard's space.
 */
export async function getSharedWhiteboards(
  userId: string,
  userTeamIds: string[],
  maxResults = 100,
): Promise<SharedItem[]> {
  const orgId = getCurrentOrgId();
  const results: SharedItem[] = [];

  const memberQuery = query(
    collection(db, 'whiteboards'),
    where('orgId', '==', orgId),
    where('members', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
    limit(maxResults),
  );

  const snap = await getDocs(memberQuery);
  for (const d of snap.docs) {
    const data = d.data();
    if (data.teamId && userTeamIds.includes(data.teamId)) continue;
    results.push({
      id: d.id,
      type: 'whiteboard',
      title: data.name || data.title || 'Untitled Whiteboard',
      subtitle: 'whiteboard',
      spaceId: data.teamId,
      createdBy: data.createdBy,
      updatedAt: data.updatedAt,
    });
  }

  return results;
}

/**
 * Get all shared items (tasks + docs + goals + whiteboards) for the user, merged and sorted.
 */
export async function getSharedItems(
  userId: string,
  userTeamIds: string[],
  maxResults = 100,
): Promise<SharedItem[]> {
  const [tasks, docs, goals, whiteboards] = await Promise.all([
    getSharedTasks(userId, userTeamIds, maxResults),
    getSharedDocs(userId, userTeamIds, maxResults),
    getSharedGoals(userId, userTeamIds, maxResults),
    getSharedWhiteboards(userId, userTeamIds, maxResults),
  ]);

  const all = [...tasks, ...docs, ...goals, ...whiteboards];
  // Sort by updatedAt descending
  all.sort((a, b) => {
    const ta = a.updatedAt?.seconds || 0;
    const tb = b.updatedAt?.seconds || 0;
    return tb - ta;
  });

  return all.slice(0, maxResults);
}
