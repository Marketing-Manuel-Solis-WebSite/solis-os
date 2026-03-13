'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  getFolders, getLists, getDocsBySpace, getWhiteboardsBySpace,
  type FolderData, type ListData,
} from '@/lib/db';
import { ArrowLeft, Loader2, ShieldAlert, FolderOpen, List, FileText, PenTool } from 'lucide-react';

export default function FolderPage() {
  const { user, me, teams, canSeeAllTeams } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { spaceId, folderId } = useParams<{ spaceId: string; folderId: string }>();

  const [folder, setFolder] = useState<FolderData | null>(null);
  const [lists, setLists] = useState<ListData[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string; folderId?: string | null; updatedAt?: any }[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string; folderId?: string | null; updatedAt?: any }[]>([]);
  const [loading, setLoading] = useState(true);

  const team = teams.find(t => t.id === spaceId);
  const hasAccess = useMemo(() => {
    if (canSeeAllTeams) return true;
    if (!me || !spaceId) return false;
    return me.teamId === spaceId || me.teamIds?.includes(spaceId);
  }, [canSeeAllTeams, me, spaceId]);

  useEffect(() => {
    if (!user || !spaceId || !folderId || !hasAccess) return;
    setLoading(true);
    Promise.all([
      getFolders(spaceId),
      getLists(spaceId),
      getDocsBySpace(spaceId).catch(() => ({ items: [] })),
      getWhiteboardsBySpace(spaceId).catch(() => ({ items: [] })),
    ]).then(([allFolders, allLists, docsRes, boardsRes]) => {
      setFolder(allFolders.find(f => f.id === folderId) || null);
      setLists(allLists.filter(l => l.folderId === folderId));
      setDocs(docsRes.items
        .filter((d: any) => d.folderId === folderId)
        .map((d: any) => ({ id: d.id, title: d.title || 'Untitled', folderId: d.folderId, updatedAt: d.updatedAt })));
      setBoards(boardsRes.items
        .filter((b: any) => b.folderId === folderId)
        .map((b: any) => ({ id: b.id, name: b.name || 'Untitled', folderId: b.folderId, updatedAt: b.updatedAt })));
    }).finally(() => setLoading(false));
  }, [user, spaceId, folderId, hasAccess]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        <ShieldAlert className="h-5 w-5 mr-2" /> {t('common.noAccess')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        {t('common.notFound')}
      </div>
    );
  }

  const totalItems = lists.length + docs.length + boards.length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push(`/app/spaces/${spaceId}`)}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <FolderOpen className="h-5 w-5" strokeWidth={1.75} style={{ color: folder.color || 'var(--accent)' }} />
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{folder.name}</h1>
          <p className="text-[12px] text-[var(--text-muted)]">
            {team?.name || spaceId} &middot; {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {/* Lists section */}
      {lists.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
            {t('spaces.lists')}
          </h2>
          <div className="space-y-1">
            {lists.map(list => (
              <a
                key={list.id}
                href={`/app/spaces/${spaceId}/list/${list.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition group"
              >
                <List className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]" strokeWidth={1.75} />
                <span className="text-[14px] font-medium text-[var(--text-primary)]">{list.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Docs section */}
      {docs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
            {t('nav.docs')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {docs.map(doc => (
              <a
                key={doc.id}
                href={`/app/docs?id=${doc.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition group"
              >
                <FileText className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]" strokeWidth={1.75} />
                <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">{doc.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Whiteboards section */}
      {boards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
            {t('nav.whiteboards')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {boards.map(board => (
              <a
                key={board.id}
                href={`/app/whiteboards?id=${board.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition group"
              >
                <PenTool className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]" strokeWidth={1.75} />
                <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">{board.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {totalItems === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-[14px]">{t('common.noResults')}</p>
        </div>
      )}
    </div>
  );
}
