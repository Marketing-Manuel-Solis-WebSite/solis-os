'use client';

// ============================================================
// useRealtimeDoc — live Firestore subscription for a document
// with advisory edit-lock awareness.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORG_ID as ORG } from '@/lib/org';


const LOCK_EXPIRY = 300; // 5 minutes — locks auto-expire

export interface EditLock {
  userId: string;
  userName: string;
  lockedAt: number; // epoch seconds
}

export interface RealtimeDocState {
  /** Latest document data (null if not found). */
  data: Record<string, any> | null;
  /** True while initial load is pending. */
  loading: boolean;
  /** Current edit lock holder (null if unlocked or expired). */
  editLock: EditLock | null;
  /** Whether the current user holds the edit lock. */
  isLockedByMe: boolean;
  /** Acquire the edit lock for this doc. */
  acquireLock: () => Promise<void>;
  /** Release the edit lock. */
  releaseLock: () => Promise<void>;
}

function lockDocPath(docId: string) {
  return `orgs/${ORG}/editLocks/${docId}`;
}

/**
 * Subscribe to a Firestore document in real-time.
 * Also monitors the advisory edit-lock for concurrent editing awareness.
 *
 * @param collectionPath — e.g. 'docs' or 'tasks'
 * @param docId — document ID
 * @param userId — current user ID (for lock ownership)
 * @param userName — current user display name
 */
export function useRealtimeDoc(
  collectionPath: string,
  docId: string | undefined,
  userId: string | undefined,
  userName: string = '',
): RealtimeDocState {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editLock, setEditLock] = useState<EditLock | null>(null);

  // Subscribe to document changes
  useEffect(() => {
    if (!docId) { setData(null); setLoading(false); return; }

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, `${collectionPath}/${docId}`),
      (snap) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...snap.data() });
        } else {
          setData(null);
        }
        setLoading(false);
      },
      () => { setData(null); setLoading(false); },
    );

    return () => unsub();
  }, [collectionPath, docId]);

  // Subscribe to edit lock
  useEffect(() => {
    if (!docId) { setEditLock(null); return; }

    const unsub = onSnapshot(
      doc(db, lockDocPath(docId)),
      (snap) => {
        if (!snap.exists()) { setEditLock(null); return; }
        const d = snap.data();
        const lockedAt = d.lockedAt?.seconds || 0;
        const now = Date.now() / 1000;

        // Expired lock — ignore
        if (lockedAt && (now - lockedAt) > LOCK_EXPIRY) {
          setEditLock(null);
          return;
        }

        setEditLock({
          userId: d.userId || '',
          userName: d.userName || '',
          lockedAt,
        });
      },
      () => setEditLock(null),
    );

    return () => unsub();
  }, [docId]);

  const acquireLock = useCallback(async () => {
    if (!docId || !userId) return;
    await setDoc(doc(db, lockDocPath(docId)), {
      userId,
      userName,
      lockedAt: serverTimestamp(),
    });
  }, [docId, userId, userName]);

  const releaseLock = useCallback(async () => {
    if (!docId || !userId) return;
    // Only release if we own the lock
    await setDoc(doc(db, lockDocPath(docId)), {
      userId: deleteField(),
      userName: deleteField(),
      lockedAt: deleteField(),
    }, { merge: true }).catch(() => {});
  }, [docId, userId]);

  const isLockedByMe = !!(editLock && userId && editLock.userId === userId);

  return { data, loading, editLock, isLockedByMe, acquireLock, releaseLock };
}
