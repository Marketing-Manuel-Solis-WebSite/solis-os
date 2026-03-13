'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getTasksByList, getLists, updateList, type ListData } from '@/lib/db';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, ShieldAlert, List, Pencil, MoreHorizontal,
} from 'lucide-react';
import SpaceTasksPanel from '@/components/spaces/space-tasks-panel';

export default function ListPage() {
  const { user, me, teams, allMembers, canSeeAllTeams } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { spaceId, listId } = useParams<{ spaceId: string; listId: string }>();

  const [tasks, setTasks] = useState<any[]>([]);
  const [list, setList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedId = useRef<string | null>(null);

  const team = teams.find(t => t.id === spaceId);

  // Access check
  const hasAccess = useMemo(() => {
    if (canSeeAllTeams) return true;
    if (!me || !spaceId) return false;
    return me.teamId === spaceId || me.teamIds?.includes(spaceId);
  }, [canSeeAllTeams, me, spaceId]);

  const spaceMembers = useMemo(() => {
    return allMembers.filter(m => m.teamId === spaceId || m.teamIds?.includes(spaceId));
  }, [allMembers, spaceId]);

  // Load data
  const loadData = useCallback(async () => {
    if (!user || !spaceId || !listId || !hasAccess) return;
    setLoading(true);
    const [tasksRes, listsRes] = await Promise.all([
      getTasksByList(listId).catch(() => ({ items: [] })),
      getLists(spaceId).catch(() => []),
    ]);
    setTasks(tasksRes.items);
    const found = listsRes.find((l: ListData) => l.id === listId);
    setList(found || null);
    setLoading(false);
  }, [user, spaceId, listId, hasAccess]);

  useEffect(() => {
    if (!user || !spaceId || !listId || !hasAccess) return;
    if (lastFetchedId.current === `${spaceId}:${listId}`) return;
    lastFetchedId.current = `${spaceId}:${listId}`;
    loadData();
  }, [user, spaceId, listId, hasAccess, loadData]);

  const handleReload = useCallback(() => {
    lastFetchedId.current = null;
    loadData();
  }, [loadData]);

  // Rename handler
  const handleRename = async () => {
    if (!list) return;
    const name = prompt(t('spaces.renameList'), list.name);
    if (!name?.trim() || name.trim() === list.name) return;
    await updateList(listId, { name: name.trim() });
    setList(prev => prev ? { ...prev, name: name.trim() } : prev);
  };

  // Loading
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-[var(--error)] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('spaces.noAccess')}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('spaces.noAccessDesc')}</p>
          <button
            onClick={() => router.push(`/app/spaces/${spaceId}`)}
            className="mt-4 px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition"
          >
            {t('spaces.goBack')}
          </button>
        </div>
      </div>
    );
  }

  // List not found
  if (!list) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">List not found</h2>
          <button
            onClick={() => router.push(`/app/spaces/${spaceId}`)}
            className="mt-4 px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition"
          >
            {t('spaces.goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/app/spaces/${spaceId}`)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: team?.color ? `${team.color}20` : 'var(--accent-subtle)' }}
            >
              <List className="h-4 w-4" style={{ color: team?.color || 'var(--accent)' }} />
            </div>
            <div>
              <div className="group flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text-primary)]">{list.name}</h1>
                <button
                  onClick={handleRename}
                  className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                {team?.icon} {team?.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Panel (scoped to this list) */}
      <div className="flex-1 min-h-0">
        <SpaceTasksPanel
          spaceId={spaceId}
          listId={listId}
          tasks={tasks}
          members={spaceMembers}
          teams={teams}
          onReload={handleReload}
        />
      </div>
    </div>
  );
}
