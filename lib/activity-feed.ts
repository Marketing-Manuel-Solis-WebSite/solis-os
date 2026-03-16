// ================================================================
// Activity Feed — Unified cross-entity activity stream
// ================================================================
// Aggregates events from all entity types into a single,
// filterable activity feed with pagination.

import {
  collection, getDocs, query, where, orderBy, limit, startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ORG_ID as ORG } from '@/lib/org';



// ---- Types ----

export type ActivityEntityType =
  | 'task' | 'goal' | 'doc' | 'channel' | 'form'
  | 'automation' | 'whiteboard' | 'member' | 'integration';

export type ActivityAction =
  | 'created' | 'updated' | 'deleted' | 'completed' | 'assigned'
  | 'commented' | 'mentioned' | 'archived' | 'restored' | 'shared';

export interface ActivityItem {
  id: string;
  action: ActivityAction;
  resource: ActivityEntityType;
  resourceId: string;
  detail: string;
  actorId: string;
  actorName: string;
  actorPhotoURL?: string;
  teamId?: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

export interface ActivityFeedOptions {
  entityType?: ActivityEntityType;
  actorId?: string;
  teamId?: string;
  actions?: ActivityAction[];
  maxResults?: number;
  afterCursor?: any; // Firestore document snapshot for pagination
}

export interface ActivityFeedResult {
  items: ActivityItem[];
  hasMore: boolean;
  lastCursor: any;
}

// ---- Feed Fetching ----

/**
 * Fetch the unified activity feed with optional filters.
 */
export async function getActivityFeed(
  options: ActivityFeedOptions = {},
): Promise<ActivityFeedResult> {
  const max = Math.min(options.maxResults || 50, 200);

  // Base query on eventLogs collection
  let constraints: any[] = [
    orderBy('createdAt', 'desc'),
    limit(max + 1),
  ];

  if (options.afterCursor) {
    constraints.push(startAfter(options.afterCursor));
  }

  const q = query(
    collection(db, `orgs/${ORG}/eventLogs`),
    ...constraints,
  );

  const snap = await getDocs(q);
  const hasMore = snap.docs.length > max;
  const docs = hasMore ? snap.docs.slice(0, max) : snap.docs;

  let items: ActivityItem[] = docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as ActivityItem));

  // Client-side filters (Firestore compound index limitations)
  if (options.entityType) {
    items = items.filter(i => i.resource === options.entityType);
  }
  if (options.actorId) {
    items = items.filter(i => i.actorId === options.actorId);
  }
  if (options.teamId) {
    items = items.filter(i => i.teamId === options.teamId);
  }
  if (options.actions?.length) {
    const actionSet = new Set(options.actions);
    items = items.filter(i => actionSet.has(i.action as ActivityAction));
  }

  return {
    items,
    hasMore,
    lastCursor: docs.length > 0 ? docs[docs.length - 1] : null,
  };
}

// ---- Grouping Utilities (Pure Functions) ----

export interface ActivityGroup {
  label: string;
  date: string;
  items: ActivityItem[];
}

/**
 * Group activity items by date (Today, Yesterday, This Week, Older).
 */
export function groupByDate(items: ActivityItem[]): ActivityGroup[] {
  const now = new Date();
  const today = toDateStr(now);
  const yesterday = toDateStr(new Date(now.getTime() - 86_400_000));
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const groups: Record<string, ActivityItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const item of items) {
    const d = extractDate(item.createdAt);
    if (!d) { groups.older.push(item); continue; }
    const ds = toDateStr(d);
    if (ds === today) groups.today.push(item);
    else if (ds === yesterday) groups.yesterday.push(item);
    else if (d >= weekAgo) groups.thisWeek.push(item);
    else groups.older.push(item);
  }

  const result: ActivityGroup[] = [];
  if (groups.today.length) result.push({ label: 'Today', date: today, items: groups.today });
  if (groups.yesterday.length) result.push({ label: 'Yesterday', date: yesterday, items: groups.yesterday });
  if (groups.thisWeek.length) result.push({ label: 'This Week', date: '', items: groups.thisWeek });
  if (groups.older.length) result.push({ label: 'Older', date: '', items: groups.older });
  return result;
}

/**
 * Group activity items by actor.
 */
export function groupByActor(items: ActivityItem[]): Record<string, ActivityItem[]> {
  const groups: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const key = item.actorName || item.actorId || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

/**
 * Summarize activity into counts per action type.
 */
export function summarizeActivity(items: ActivityItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = `${item.resource}.${item.action}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// ---- Helpers ----

function extractDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}
