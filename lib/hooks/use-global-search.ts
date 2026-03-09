'use client';
import { useState, useCallback, useRef } from 'react';
import { getTasks } from '@/lib/db';
import { getDocuments } from '@/lib/db';
import { getChannels } from '@/lib/db';
import { getGoals } from '@/lib/db';
import { getForms } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import {
  SearchResult, SearchEntityType, scoreMatch, searchQuickActions, QuickAction,
} from '@/lib/search-utils';

interface SearchCache {
  tasks: any[];
  docs: any[];
  channels: any[];
  goals: any[];
  members: any[];
  forms: any[];
  loadedAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_PER_GROUP = 5;

export function useGlobalSearch() {
  const { allMembers, can, canSeeResource, canSeeAllTeams } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<SearchCache | null>(null);

  const loadData = useCallback(async (): Promise<SearchCache> => {
    const now = Date.now();
    if (cacheRef.current && now - cacheRef.current.loadedAt < CACHE_TTL) {
      return cacheRef.current;
    }

    const empty = { items: [] as any[], hasMore: false };
    const [tasksR, docsR, channelsR, goalsR, formsR] = await Promise.all([
      can('task', 'read') ? getTasks() : Promise.resolve(empty),
      can('doc', 'read') ? getDocuments() : Promise.resolve(empty),
      can('channel', 'read') ? getChannels() : Promise.resolve(empty),
      can('goal', 'read') ? getGoals() : Promise.resolve(empty),
      can('form', 'read') ? getForms() : Promise.resolve(empty),
    ]);

    // Apply RBAC visibility filtering — only include resources the user can see
    const filterVisible = (items: any[]) => {
      if (canSeeAllTeams) return items;
      return items.filter((item: any) => canSeeResource({
        teamId: item.teamId,
        createdBy: item.createdBy,
        visibility: item.visibility,
      }));
    };

    const cache: SearchCache = {
      tasks: filterVisible(tasksR.items),
      docs: filterVisible(docsR.items),
      channels: filterVisible(channelsR.items),
      goals: filterVisible(goalsR.items),
      members: (allMembers || []).filter((m: any) => m.active !== false),
      forms: filterVisible(formsR.items),
      loadedAt: now,
    };
    cacheRef.current = cache;
    return cache;
  }, [allMembers, can, canSeeResource, canSeeAllTeams]);

  const search = useCallback(async (query: string, lang: 'es' | 'en') => {
    if (!query.trim()) {
      setResults([]);
      setActions([]);
      return;
    }

    setLoading(true);
    try {
      let data: SearchCache;
      try {
        data = await loadData();
      } catch (err) {
        console.error('[GlobalSearch] Failed to load data:', err);
        setResults([]);
        setActions([]);
        setLoading(false);
        return;
      }
      const all: SearchResult[] = [];

      // Tasks
      for (const t of data.tasks) {
        const score = scoreMatch(query, t.title || '', t.description || '');
        if (score > 0) {
          all.push({
            id: t.id,
            type: 'task',
            title: t.title || 'Sin título',
            subtitle: t.status,
            status: t.status,
            href: `/app/tasks?task=${t.id}`,
            score,
            raw: t,
          });
        }
      }

      // Docs
      for (const d of data.docs) {
        const score = scoreMatch(query, d.title || '', d.content?.slice(0, 200) || '');
        if (score > 0) {
          all.push({
            id: d.id,
            type: 'doc',
            title: d.title || 'Sin título',
            subtitle: d.category || '',
            href: `/app/docs?doc=${d.id}`,
            score,
            raw: d,
          });
        }
      }

      // Channels
      for (const c of data.channels) {
        const score = scoreMatch(query, c.name || '', c.description || '');
        if (score > 0) {
          all.push({
            id: c.id,
            type: 'channel',
            title: c.name || '',
            subtitle: c.privacy === 'dm' ? 'DM' : (c.privacy || ''),
            href: `/app/chat?channel=${c.id}`,
            score,
            raw: c,
          });
        }
      }

      // Goals
      for (const g of data.goals) {
        const score = scoreMatch(query, g.title || '', g.description || '');
        if (score > 0) {
          all.push({
            id: g.id,
            type: 'goal',
            title: g.title || '',
            subtitle: g.status,
            status: g.status,
            href: `/app/goals?goal=${g.id}`,
            score,
            raw: g,
          });
        }
      }

      // Members
      for (const m of data.members) {
        const score = scoreMatch(query, m.displayName || '', `${m.email || ''} ${m.title || ''}`);
        if (score > 0) {
          all.push({
            id: m.userId || m.id,
            type: 'member',
            title: m.displayName || m.email || '',
            subtitle: m.title || m.role || '',
            href: `/app/org-chart`,
            score,
            raw: m,
          });
        }
      }

      // Forms
      for (const f of data.forms) {
        const score = scoreMatch(query, f.title || f.name || '', f.description || '');
        if (score > 0) {
          all.push({
            id: f.id,
            type: 'form',
            title: f.title || f.name || '',
            subtitle: f.status || '',
            href: `/app/forms?form=${f.id}`,
            score,
            raw: f,
          });
        }
      }

      // Sort by score descending, then limit per group
      all.sort((a, b) => b.score - a.score);

      const grouped: Record<SearchEntityType, SearchResult[]> = {
        task: [], doc: [], channel: [], goal: [], member: [], form: [],
      };
      for (const r of all) {
        if (grouped[r.type].length < MAX_PER_GROUP) {
          grouped[r.type].push(r);
        }
      }

      const final = Object.values(grouped).flat();
      setResults(final);
      setActions(searchQuickActions(query, lang));
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return { results, actions, loading, search, invalidateCache };
}
