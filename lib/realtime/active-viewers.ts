'use client';

// ============================================================
// Active Viewers — track who is currently viewing a resource
// (doc, task, whiteboard). Enables "Carlos is viewing" badges.
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORG_ID as ORG } from '@/lib/org';


const STALE_THRESHOLD = 120; // seconds — ignore entries older than 2 min
const HEARTBEAT_INTERVAL = 50_000; // 50s — well under stale threshold

export interface ActiveViewer {
  userId: string;
  displayName: string;
  photoURL?: string;
  joinedAt: number; // epoch seconds
}

/**
 * Returns the Firestore doc path for active viewers of a resource.
 * Format: orgs/{orgId}/activeViewers/{resourceType}:{resourceId}
 */
function viewersDocPath(resourceType: string, resourceId: string) {
  return `orgs/${ORG}/activeViewers/${resourceType}:${resourceId}`;
}

/** Join as an active viewer of a resource. */
export function joinViewing(
  resourceType: string,
  resourceId: string,
  userId: string,
  displayName: string,
  photoURL?: string,
) {
  const ref = doc(db, viewersDocPath(resourceType, resourceId));
  return setDoc(ref, {
    [`viewers.${userId}`]: {
      displayName,
      photoURL: photoURL || '',
      joinedAt: serverTimestamp(),
    },
  }, { merge: true });
}

/** Leave viewing — remove yourself from the viewer map. */
export function leaveViewing(
  resourceType: string,
  resourceId: string,
  userId: string,
) {
  const ref = doc(db, viewersDocPath(resourceType, resourceId));
  return setDoc(ref, {
    [`viewers.${userId}`]: deleteField(),
  }, { merge: true }).catch(() => {});
}

/** Real-time listener for active viewers. Filters stale entries client-side. */
export function onActiveViewersSnapshot(
  resourceType: string,
  resourceId: string,
  currentUserId: string,
  callback: (viewers: ActiveViewer[]) => void,
) {
  const ref = doc(db, viewersDocPath(resourceType, resourceId));
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    const now = Date.now() / 1000;
    const viewers: ActiveViewer[] = [];

    for (const [key, val] of Object.entries(data)) {
      if (!key.startsWith('viewers.')) continue;
      const userId = key.replace('viewers.', '');
      if (userId === currentUserId) continue; // exclude self
      const v = val as any;
      const joinedAt = v?.joinedAt?.seconds || 0;
      if (joinedAt && (now - joinedAt) < STALE_THRESHOLD) {
        viewers.push({
          userId,
          displayName: v.displayName || '',
          photoURL: v.photoURL || '',
          joinedAt,
        });
      }
    }

    callback(viewers);
  }, () => callback([]));
}

/**
 * Hook: track and display active viewers of a resource.
 * Auto-joins on mount, heartbeats, and leaves on unmount.
 */
export function useActiveViewers(
  resourceType: string,
  resourceId: string | undefined,
  userId: string | undefined,
  displayName: string,
  photoURL?: string,
): ActiveViewer[] {
  const [viewers, setViewers] = useState<ActiveViewer[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const join = useCallback(() => {
    if (!resourceId || !userId) return;
    joinViewing(resourceType, resourceId, userId, displayName, photoURL).catch(() => {});
  }, [resourceType, resourceId, userId, displayName, photoURL]);

  const leave = useCallback(() => {
    if (!resourceId || !userId) return;
    leaveViewing(resourceType, resourceId, userId).catch(() => {});
  }, [resourceType, resourceId, userId]);

  useEffect(() => {
    if (!resourceId || !userId) return;

    // Join + subscribe
    join();
    heartbeatRef.current = setInterval(join, HEARTBEAT_INTERVAL);

    const unsub = onActiveViewersSnapshot(resourceType, resourceId, userId, setViewers);

    // Cleanup
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      unsub();
      leave();
    };
  }, [resourceType, resourceId, userId, join, leave]);

  return viewers;
}
