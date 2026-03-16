'use client';
import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import {
  SearchResult, SearchEntityType, searchQuickActions, QuickAction,
} from '@/lib/search-utils';
import { auth } from '@/lib/firebase';

const MAX_PER_GROUP = 5;
const DEBOUNCE_MS = 200;

export function useGlobalSearch() {
  const { allMembers } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string, lang: 'es' | 'en') => {
    // Clear debounce timer
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setActions([]);
      return;
    }

    // Quick actions are client-side (only ~26 hardcoded items)
    setActions(searchQuickActions(query, lang));

    // Debounce server search
    debounceRef.current = setTimeout(async () => {
      // Cancel previous request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setResults([]);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/search/global?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          setResults([]);
          setLoading(false);
          return;
        }

        const data = await res.json();
        const hits: SearchResult[] = (data.results || []).map((h: any) => ({
          id: h.id,
          type: h.type as SearchEntityType,
          title: h.title || '',
          subtitle: h.subtitle || '',
          href: h.href || '',
          score: 1,
          raw: h,
        }));

        // Limit per group (server already limits, but enforce client-side too)
        const grouped: Record<SearchEntityType, SearchResult[]> = {
          task: [], doc: [], channel: [], goal: [], member: [], form: [],
        };
        for (const r of hits) {
          if (grouped[r.type] && grouped[r.type].length < MAX_PER_GROUP) {
            grouped[r.type].push(r);
          }
        }

        setResults(Object.values(grouped).flat());
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('[GlobalSearch] server search failed:', err);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const invalidateCache = useCallback(() => {
    // No client-side cache anymore — server handles everything
  }, []);

  return { results, actions, loading, search, invalidateCache };
}
