'use client';

// ============================================================
// Reusable Presence Hook — consolidates the ad-hoc presence
// logic from chat page into a single composable.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { setPresence } from '@/lib/db';

const HEARTBEAT_INTERVAL = 60_000; // 60s

/**
 * Manages user online presence via Firestore.
 * Sets presence on mount, heartbeats every 60s,
 * goes offline on visibility change / unload.
 */
export function usePresence(userId: string | undefined) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goOnline = useCallback(() => {
    if (!userId) return;
    setPresence(userId, true).catch(() => {});
  }, [userId]);

  const goOffline = useCallback(() => {
    if (!userId) return;
    setPresence(userId, false).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Initial online
    goOnline();

    // Heartbeat
    heartbeatRef.current = setInterval(goOnline, HEARTBEAT_INTERVAL);

    // Visibility change (tab switch / minimize)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') goOnline();
      else goOffline();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Unload (close tab)
    const handleUnload = () => goOffline();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      goOffline();
    };
  }, [userId, goOnline, goOffline]);
}
