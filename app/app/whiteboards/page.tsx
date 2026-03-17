'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getWhiteboards, createWhiteboard, updateWhiteboard, deleteWhiteboard, createTask } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { useToast } from '@/components/notifications/toast-provider';
import WhiteboardList from '@/components/whiteboards/whiteboard-list';
import WhiteboardCreateModal from '@/components/whiteboards/whiteboard-create-modal';
import WhiteboardCanvas from '@/components/whiteboards/whiteboard-canvas';
import type { Whiteboard } from '@/components/whiteboards/constants';
import HubToolbar from '@/components/shared/hub-toolbar';

export default function WhiteboardsPage() {
  const { user, me, activeTeamId, can } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editBoard, setEditBoard] = useState<Whiteboard | null>(null);
  const [activeBoard, setActiveBoard] = useState<Whiteboard | null>(null);
  const [menuBoard, setMenuBoard] = useState<string | null>(null);

  // Hub toolbar state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadBoards = useCallback(async () => {
    setLoading(true);
    const { items: data, hasMore: more } = await getWhiteboards(activeTeamId === '__all__' ? undefined : activeTeamId);
    setBoards(data as Whiteboard[]);
    setHasMore(more);
    setLoading(false);
  }, [activeTeamId]);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  const handleCreate = async (data: any) => {
    await createWhiteboard({
      ...data,
      createdBy: user?.uid || '',
      createdByName: me?.displayName || '',
      members: [user?.uid || ''],
    });
    loadBoards();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('whiteboards.deleteConfirm'))) return;
    await deleteWhiteboard(id);
    setMenuBoard(null);
    loadBoards();
  };

  const handleEdit = (board: Whiteboard) => {
    setEditBoard(board);
    setShowCreate(true);
    setMenuBoard(null);
  };

  const handleSaveEdit = async (data: any) => {
    if (editBoard) {
      await updateWhiteboard(editBoard.id, data);
      setEditBoard(null);
    } else {
      await handleCreate(data);
    }
    loadBoards();
  };

  // If a board is active, show the canvas
  if (activeBoard) {
    return (
      <WhiteboardCanvas
        boardId={activeBoard.id}
        boardName={activeBoard.name}
        onBack={() => { setActiveBoard(null); loadBoards(); }}
        onConvertToTask={async (text) => {
          const title = text || 'Task from whiteboard';
          try {
            await createTask({
              title,
              description: `Created from whiteboard: ${activeBoard.name}`,
              createdBy: user?.uid || '',
              teamId: activeTeamId === '__all__' ? '' : activeTeamId,
              source: 'whiteboard',
              sourceId: activeBoard.id,
            });
            toast.success(
              t('whiteboards.taskCreated') || 'Task created',
              title,
            );
          } catch (err: any) {
            console.error('[Whiteboard] Failed to convert to task:', err);
            toast.error(
              t('common.error') || 'Error',
              err?.message || 'Failed to create task',
            );
          }
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" onClick={() => setMenuBoard(null)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <PenTool className="h-6 w-6 text-[var(--accent)]" />
            {t('whiteboards.title')}
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-0.5">{t('whiteboards.subtitle')}</p>
        </div>
        {can('whiteboard', 'create') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setEditBoard(null); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-md hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" /> {t('whiteboards.createBoard')}
          </motion.button>
        )}
      </div>

      {/* Toolbar */}
      <HubToolbar
        search={search}
        onSearchChange={setSearch}
        sortOptions={[
          { value: 'updatedAt', label: t('common.lastModified') || 'Last modified' },
          { value: 'createdAt', label: t('common.created') || 'Created' },
          { value: 'name', label: t('common.name') || 'Name' },
        ]}
        activeSort={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={boards.length}
        filteredCount={search ? boards.filter(b => (b.name || '').toLowerCase().includes(search.toLowerCase())).length : boards.length}
      />

      {/* Content */}
      {(() => {
        let filtered = [...boards];
        if (search) filtered = filtered.filter(b => (b.name || '').toLowerCase().includes(search.toLowerCase()));
        filtered.sort((a: any, b: any) => {
          if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
          const ta = a[sortBy]?.seconds || 0;
          const tb = b[sortBy]?.seconds || 0;
          return tb - ta;
        });

        if (loading) return (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          </div>
        );
        if (filtered.length === 0) return (
          <div className="text-center py-20">
            <PenTool className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t('whiteboards.noBoards')}</h3>
            <p className="text-[14px] text-[var(--text-muted)] mb-4">{t('whiteboards.noBoardsDesc')}</p>
            {can('whiteboard', 'create') && (
              <button onClick={() => { setEditBoard(null); setShowCreate(true); }} className="text-[var(--accent)] text-sm font-medium hover:underline">
                {t('whiteboards.createBoard')}
              </button>
            )}
          </div>
        );
        return (
          <WhiteboardList
            boards={filtered as Whiteboard[]}
            onOpen={board => setActiveBoard(board)}
            onMenu={(board, e) => {
              e.stopPropagation();
              setMenuBoard(menuBoard === board.id ? null : board.id);
            }}
          />
        );
      })()}

      {/* Has More indicator */}
      {hasMore && !loading && (
        <div className="text-center py-4 mt-2">
          <span className="text-[13px] text-[var(--text-muted)]">
            {t('common.showingItems', { n: boards.length })} — {t('common.moreAvailable')}
          </span>
        </div>
      )}

      {/* Context menus */}
      {boards.map(board => (
        <AnimatePresence key={board.id}>
          {menuBoard === board.id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 w-36 py-1 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown"
              style={{
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => handleEdit(board)} className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg">
                {t('whiteboards.editBoard')}
              </button>
              <button onClick={() => handleDelete(board.id)} className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/5 rounded-lg">
                {t('whiteboards.deleteBoard')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      ))}

      {/* Create/Edit Modal */}
      <WhiteboardCreateModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditBoard(null); }}
        onSave={handleSaveEdit}
        editBoard={editBoard}
      />
    </div>
  );
}
