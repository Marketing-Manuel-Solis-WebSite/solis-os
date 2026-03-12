'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, FolderOpen, List, Plus, MoreHorizontal,
  Pencil, Trash2, FolderPlus, ListPlus,
} from 'lucide-react';
import {
  getFolders, getLists, createFolder, createList, deleteFolder, deleteList,
  updateFolder, updateList, ensureDefaultList,
  type FolderData, type ListData,
} from '@/lib/db';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Props {
  spaceId: string;
  spaceName: string;
  spaceColor?: string;
  spaceIcon?: string;
  userId: string;
  canManage: boolean; // manager+ can delete folders/lists
}

export default function SpaceSidebarTree({ spaceId, spaceName, spaceColor, spaceIcon, userId, canManage }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();

  const [folders, setFolders] = useState<FolderData[]>([]);
  const [lists, setLists] = useState<ListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<{ type: 'folder' | 'list'; id: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load hierarchy
  useEffect(() => {
    if (!spaceId) return;
    setLoading(true);
    Promise.all([getFolders(spaceId), getLists(spaceId)])
      .then(([f, l]) => {
        setFolders(f);
        setLists(l);
        // Auto-expand folders that contain the active list
        const activeListId = extractListId(path, spaceId);
        if (activeListId) {
          const activeList = l.find(li => li.id === activeListId);
          if (activeList?.folderId) {
            setExpandedFolders(prev => new Set([...prev, activeList.folderId!]));
          }
        }
      })
      .catch(err => console.error('[SpaceTree] load failed:', err))
      .finally(() => setLoading(false));
  }, [spaceId, path]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuTarget) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuTarget(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuTarget]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  const folderlessLists = lists.filter(l => !l.folderId);
  const listsByFolder = (folderId: string) => lists.filter(l => l.folderId === folderId);

  // Create handlers
  const handleCreateFolder = async () => {
    const name = prompt(t('spaces.folderName'));
    if (!name?.trim()) return;
    const maxPos = folders.length > 0 ? Math.max(...folders.map(f => f.position)) + 1 : 0;
    const ref = await createFolder({ spaceId, name: name.trim(), position: maxPos, createdBy: userId });
    setFolders(prev => [...prev, { id: ref.id, spaceId, name: name.trim(), position: maxPos, createdBy: userId }]);
  };

  const handleCreateList = async (folderId: string | null) => {
    const name = prompt(t('spaces.listName'));
    if (!name?.trim()) return;
    const siblings = folderId ? listsByFolder(folderId) : folderlessLists;
    const maxPos = siblings.length > 0 ? Math.max(...siblings.map(l => l.position)) + 1 : 0;
    const ref = await createList({ spaceId, folderId, name: name.trim(), position: maxPos, createdBy: userId });
    const newList: ListData = { id: ref.id, spaceId, folderId, name: name.trim(), position: maxPos, createdBy: userId };
    setLists(prev => [...prev, newList]);
    if (folderId) setExpandedFolders(prev => new Set([...prev, folderId]));
    // Navigate to new list
    router.push(`/app/spaces/${spaceId}/list/${ref.id}`);
  };

  const handleRename = async (type: 'folder' | 'list', id: string) => {
    const current = type === 'folder' ? folders.find(f => f.id === id) : lists.find(l => l.id === id);
    const name = prompt(type === 'folder' ? t('spaces.renameFolder') : t('spaces.renameList'), current?.name || '');
    if (!name?.trim()) return;
    if (type === 'folder') {
      await updateFolder(id, { name: name.trim() });
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: name.trim() } : f));
    } else {
      await updateList(id, { name: name.trim() });
      setLists(prev => prev.map(l => l.id === id ? { ...l, name: name.trim() } : l));
    }
    setMenuTarget(null);
  };

  const handleDelete = async (type: 'folder' | 'list', id: string) => {
    const msg = type === 'folder' ? t('spaces.deleteFolderConfirm') : t('spaces.deleteListConfirm');
    if (!confirm(msg)) return;
    if (type === 'folder') {
      await deleteFolder(id);
      setFolders(prev => prev.filter(f => f.id !== id));
      // Lists in this folder become folderless
      setLists(prev => prev.map(l => l.folderId === id ? { ...l, folderId: null } : l));
    } else {
      await deleteList(id);
      setLists(prev => prev.filter(l => l.id !== id));
    }
    setMenuTarget(null);
  };

  const navigateToList = (listId: string) => {
    router.push(`/app/spaces/${spaceId}/list/${listId}`);
  };

  if (loading) return null;

  return (
    <div className="space-y-0.5 mt-0.5">
      {/* Folders */}
      {folders.map(folder => {
        const expanded = expandedFolders.has(folder.id!);
        const fLists = listsByFolder(folder.id!);
        return (
          <div key={folder.id}>
            <div className="group flex items-center">
              <button
                onClick={() => toggleFolder(folder.id!)}
                className="flex items-center gap-1.5 flex-1 px-2 py-1 rounded-lg text-[13px] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all duration-150"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                  strokeWidth={2}
                />
                <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} style={{ color: folder.color || spaceColor || 'var(--text-muted)' }} />
                <span className="truncate">{folder.name}</span>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto mr-1">{fLists.length}</span>
              </button>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCreateList(folder.id!); }}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition"
                  title={t('spaces.newList')}
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuTarget({ type: 'folder', id: folder.id! }); }}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Folder context menu */}
            {menuTarget?.type === 'folder' && menuTarget.id === folder.id && (
              <ContextMenu
                ref={menuRef}
                onRename={() => handleRename('folder', folder.id!)}
                onDelete={canManage ? () => handleDelete('folder', folder.id!) : undefined}
                t={t}
                type="folder"
              />
            )}

            {/* Lists inside folder */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pl-4 space-y-0.5">
                    {fLists.map(list => (
                      <ListItem
                        key={list.id}
                        list={list}
                        active={isListActive(path, spaceId, list.id!)}
                        onClick={() => navigateToList(list.id!)}
                        onMenu={() => setMenuTarget({ type: 'list', id: list.id! })}
                        menuOpen={menuTarget?.type === 'list' && menuTarget.id === list.id}
                        menuRef={menuRef}
                        canManage={canManage}
                        onRename={() => handleRename('list', list.id!)}
                        onDelete={() => handleDelete('list', list.id!)}
                        t={t}
                      />
                    ))}
                    {fLists.length === 0 && (
                      <button
                        onClick={() => handleCreateList(folder.id!)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition w-full"
                      >
                        <Plus className="h-3 w-3" />
                        {t('spaces.newList')}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Folderless lists */}
      {folderlessLists.map(list => (
        <ListItem
          key={list.id}
          list={list}
          active={isListActive(path, spaceId, list.id!)}
          onClick={() => navigateToList(list.id!)}
          onMenu={() => setMenuTarget({ type: 'list', id: list.id! })}
          menuOpen={menuTarget?.type === 'list' && menuTarget.id === list.id}
          menuRef={menuRef}
          canManage={canManage}
          onRename={() => handleRename('list', list.id!)}
          onDelete={() => handleDelete('list', list.id!)}
          t={t}
        />
      ))}

      {/* Create buttons */}
      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={handleCreateFolder}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
          title={t('spaces.newFolder')}
        >
          <FolderPlus className="h-3 w-3" />
        </button>
        <button
          onClick={() => handleCreateList(null)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
          title={t('spaces.newList')}
        >
          <ListPlus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── List Item ───────────────────────────────────
function ListItem({
  list, active, onClick, onMenu, menuOpen, menuRef, canManage, onRename, onDelete, t,
}: {
  list: ListData;
  active: boolean;
  onClick: () => void;
  onMenu: () => void;
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  canManage: boolean;
  onRename: () => void;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[13px] transition-all duration-150 ${
          active
            ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-medium'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
        }`}
      >
        <List className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{list.name}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMenu(); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
      >
        <MoreHorizontal className="h-3 w-3" />
      </button>
      {menuOpen && (
        <ContextMenu
          ref={menuRef}
          onRename={onRename}
          onDelete={canManage ? onDelete : undefined}
          t={t}
          type="list"
        />
      )}
    </div>
  );
}

// ─── Context Menu ────────────────────────────────
import { forwardRef } from 'react';

const ContextMenu = forwardRef<HTMLDivElement, {
  onRename: () => void;
  onDelete?: () => void;
  t: (k: string) => string;
  type: 'folder' | 'list';
}>(({ onRename, onDelete, t, type }, ref) => (
  <div ref={ref} className="absolute left-full top-0 ml-1 w-40 rounded-xl bg-[var(--bg-elevated)] shadow-lg z-50 p-1 anim-slide">
    <button
      onClick={onRename}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
    >
      <Pencil className="h-3 w-3" />
      {t(type === 'folder' ? 'spaces.renameFolder' : 'spaces.renameList')}
    </button>
    {onDelete && (
      <>
        <div className="h-px bg-[var(--border-subtle)] my-0.5 mx-2" />
        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--error)] hover:bg-[var(--error-bg)] transition"
        >
          <Trash2 className="h-3 w-3" />
          {t(type === 'folder' ? 'spaces.deleteFolder' : 'spaces.deleteList')}
        </button>
      </>
    )}
  </div>
));
ContextMenu.displayName = 'ContextMenu';

// ─── Helpers ─────────────────────────────────────
function extractListId(path: string, spaceId: string): string | null {
  const match = path.match(new RegExp(`/app/spaces/${spaceId}/list/([^/]+)`));
  return match ? match[1] : null;
}

function isListActive(path: string, spaceId: string, listId: string): boolean {
  return path === `/app/spaces/${spaceId}/list/${listId}`;
}
