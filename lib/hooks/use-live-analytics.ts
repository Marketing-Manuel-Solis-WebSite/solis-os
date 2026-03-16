'use client';

// ============================================================
// Live Analytics Hook — Periodic polling of dashboard stats
// with staleness tracking and manual refresh.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseLiveAnalyticsOptions {
  teamId?: string;
  scope?: 'global' | 'space' | 'folder' | 'list';
  scopeId?: string;
  refreshIntervalMs?: number;
  enabled?: boolean;
}

interface AnalyticsStats {
  totalTasks: number;
  completed: number;
  inProgress: number;
  overdue: number;
  totalGoals: number;
}

interface LiveAnalyticsState {
  stats: AnalyticsStats | null;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
  isStale: boolean;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function useLiveAnalytics({
  teamId,
  refreshIntervalMs = 60000,
  enabled = true,
}: UseLiveAnalyticsOptions = {}): LiveAnalyticsState {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    if (!enabled) return;

    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(prev => stats === null ? true : prev); // Only show loading on first fetch
      const params = new URLSearchParams();
      if (teamId && teamId !== '__all__') params.set('teamId', teamId);

      const res = await fetch(`/api/dashboard/stats?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Failed to fetch stats');

      const data = await res.json();
      setStats({
        totalTasks: data.totalTasks ?? 0,
        completed: data.completed ?? 0,
        inProgress: data.inProgress ?? 0,
        overdue: data.overdue ?? 0,
        totalGoals: data.totalGoals ?? 0,
      });
      setLastUpdated(new Date());
      setIsStale(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[useLiveAnalytics] Fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, enabled]);

  // Initial fetch + interval
  useEffect(() => {
    if (!enabled) return;

    fetchStats();
    const interval = setInterval(fetchStats, refreshIntervalMs);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStats, refreshIntervalMs, enabled]);

  // Staleness checker
  useEffect(() => {
    if (!lastUpdated) return;
    const checkStale = () => {
      const elapsed = Date.now() - lastUpdated.getTime();
      setIsStale(elapsed > STALE_THRESHOLD_MS);
    };
    checkStale();
    const interval = setInterval(checkStale, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return { stats, loading, lastUpdated, refresh: fetchStats, isStale };
}
