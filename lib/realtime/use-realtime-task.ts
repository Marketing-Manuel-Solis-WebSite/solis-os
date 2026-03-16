'use client';

// ============================================================
// useRealtimeTask — live Firestore subscription for a task
// ============================================================

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface RealtimeTaskState {
  /** Latest task data (null if not found or loading). */
  task: Record<string, any> | null;
  /** True while initial load is pending. */
  loading: boolean;
  /** Increments on every remote change — useful to trigger effects. */
  version: number;
}

/**
 * Subscribe to a single task in real-time via Firestore onSnapshot.
 * Returns the latest data plus a loading/version counter.
 *
 * @param taskId — Firestore task document ID (null/undefined to skip)
 */
export function useRealtimeTask(taskId: string | undefined): RealtimeTaskState {
  const [task, setTask] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      doc(db, `tasks/${taskId}`),
      (snap) => {
        if (snap.exists()) {
          setTask({ id: snap.id, ...snap.data() });
        } else {
          setTask(null);
        }
        setLoading(false);
        setVersion(v => v + 1);
      },
      () => {
        setTask(null);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [taskId]);

  return { task, loading, version };
}
