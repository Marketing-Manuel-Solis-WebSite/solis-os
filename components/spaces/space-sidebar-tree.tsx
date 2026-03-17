'use client';
import { useState, useEffect, useRef, forwardRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronUp, ChevronDown as ChevronDownIcon, FolderOpen, List, Plus, MoreHorizontal,
  Pencil, Trash2, FolderPlus, ListPlus, FolderInput, FileText, PenTool, Home, LayoutTemplate, FileInput,
} from 'lucide-react';
import {
  getFolders, getLists, createFolder, createList, deleteFolder, deleteList,
  updateFolder, updateList, ensureDefaultList,
  getDocsBySpace, getWhiteboardsBySpace, createDocument, createWhiteboard, getForms,
  updateDocument, deleteDocument, updateWhiteboard, deleteWhiteboard, updateForm, deleteForm,
  type FolderData, type ListData,
} from '@/lib/db';
import { SpaceInputDialog, SpaceConfirmDialog } from './space-input-dialog';
import TemplatePickerModal from '@/components/templates/template-picker-modal';
import type { UnifiedTemplate } from '@/lib/template-center';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Props {
  spaceId: string;
  spaceName: string;
  spaceColor?: string;
  spaceIcon?: string;
  userId: string;
  canManage: boolean;
}

type DialogState =
  | null
  | { action: 'createFolder' }
  | { action: 'createSubfolder'; parentFolderId: string }
  | { action: 'createList'; folderId: string | null }
  | { action: 'createDoc'; folderId: string | null }
  | { action: 'createWhiteboard'; folderId: string | null }
  | { action: 'rename'; type: 'folder' | 'list'; id: string; currentName: string }
  | { action: 'delete'; type: 'folder' | 'list'; id: string; name: string }
  | { action: 'moveList'; listId: string; listName: string }
  | { action: 'renameDoc'; docId: string; currentTitle: string }
  | { action: 'renameWhiteboard'; boardId: string; currentName: string }
  | { action: 'deleteDoc'; docId: string; title: string }
  | { action: 'deleteWhiteboard'; boardId: string; name: string }
  | { action: 'moveDoc'; docId: string; docTitle: string }
  | { action: 'moveWhiteboard'; boardId: string; boardName: string }
  | { action: 'renameForm'; formId: string; currentTitle: string }
  | { action: 'deleteForm'; formId: string; title: string }
  | { action: 'moveForm'; formId: string; formTitle: string };

export default function SpaceSidebarTree({ spaceId, spaceName, spaceColor, spaceIcon, userId, canManage }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const searchParams = useSearchParams();

  const [folders, setFolders] = useState<FolderData[]>([]);
  const [lists, setLists] = useState<ListData[]>([]);
  const [spaceDocs, setSpaceDocs] = useState<{ id: string; title: string; folderId?: string | null }[]>([]);
  const [spaceBoards, setSpaceBoards] = useState<{ id: string; name: string; folderId?: string | null }[]>([]);
  const [spaceForms, setSpaceForms] = useState<{ id: string; title: string; folderId?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<{ type: 'folder' | 'list' | 'doc' | 'whiteboard' | 'form'; id: string } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [templatePicker, setTemplatePicker] = useState<{ folderId: string | null } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load hierarchy + docs + whiteboards
  useEffect(() => {
    if (!spaceId) return;
    setLoading(true);
    Promise.all([
      getFolders(spaceId),
      getLists(spaceId),
      getDocsBySpace(spaceId).catch(() => ({ items: [] })),
      getWhiteboardsBySpace(spaceId).catch(() => ({ items: [] })),
      getForms(spaceId).catch(() => ({ items: [] })),
    ])
      .then(([f, l, docsRes, boardsRes, formsRes]) => {
        setFolders(f);
        setLists(l);
        setSpaceDocs(docsRes.items.map((d: any) => ({ id: d.id, title: d.title || 'Untitled', folderId: d.folderId || null })));
        setSpaceBoards(boardsRes.items.map((b: any) => ({ id: b.id, name: b.name || 'Untitled', folderId: b.folderId || null })));
        setSpaceForms(((formsRes as any).items || formsRes || []).map((fm: any) => ({ id: fm.id, title: fm.title || 'Untitled', folderId: fm.folderId || null })));
        // Auto-expand folder containing active list, doc, whiteboard, or folder route
        const expandIds = new Set<string>();
        const activeListId = extractListId(path, spaceId);
        if (activeListId) {
          const activeList = l.find(li => li.id === activeListId);
          if (activeList?.folderId) expandIds.add(activeList.folderId);
        }
        const qId = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('id') : null;
        if (qId && path.startsWith('/app/docs')) {
          const doc = docsRes.items.find((d: any) => d.id === qId);
          if (doc?.folderId) expandIds.add(doc.folderId);
        }
        if (qId && path.startsWith('/app/whiteboards')) {
          const board = boardsRes.items.find((b: any) => b.id === qId);
          if (board?.folderId) expandIds.add(board.folderId);
        }
        const aFolderId = extractFolderId(path, spaceId);
        if (aFolderId) expandIds.add(aFolderId);
        // Also expand parent folders if any expanded folder is a subfolder
        for (const eid of Array.from(expandIds)) {
          const folder = f.find(fo => fo.id === eid);
          if (folder?.parentFolderId) expandIds.add(folder.parentFolderId);
        }
        if (expandIds.size > 0) {
          setExpandedFolders(prev => new Set([...prev, ...expandIds]));
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

  const rootFolders = folders.filter(f => !f.parentFolderId);
  const subfoldersByParent = (parentId: string) => folders.filter(f => f.parentFolderId === parentId);
  const folderlessLists = lists.filter(l => !l.folderId);
  const docsByFolder = (fid: string) => spaceDocs.filter(d => d.folderId === fid);
  const boardsByFolder = (fid: string) => spaceBoards.filter(b => b.folderId === fid);
  const formsByFolder = (fid: string) => spaceForms.filter(f => f.folderId === fid);
  const folderlessDocs = spaceDocs.filter(d => !d.folderId);
  const folderlessBoards = spaceBoards.filter(b => !b.folderId);
  const folderlessForms = spaceForms.filter(f => !f.folderId);
  const listsByFolder = (folderId: string) => lists.filter(l => l.folderId === folderId);

  // Active state helpers for docs/whiteboards/folders
  const activeDocId = path.startsWith('/app/docs') ? searchParams.get('id') : null;
  const activeBoardId = path.startsWith('/app/whiteboards') ? searchParams.get('id') : null;
  const activeFolderId = extractFolderId(path, spaceId);
  const isDocActive = (docId: string) => activeDocId === docId;
  const isBoardActive = (boardId: string) => activeBoardId === boardId;

  // ─── CRUD handlers ─────────────────────────────────
  const handleCreateFolder = async (name: string, parentFolderId?: string | null) => {
    const siblings = parentFolderId
      ? folders.filter(f => f.parentFolderId === parentFolderId)
      : folders.filter(f => !f.parentFolderId);
    const maxPos = siblings.length > 0 ? Math.max(...siblings.map(f => f.position)) + 1 : 0;
    const ref = await createFolder({ spaceId, name, position: maxPos, parentFolderId: parentFolderId || null, createdBy: userId });
    const newFolder: FolderData = { id: ref.id, spaceId, name, position: maxPos, parentFolderId: parentFolderId || null, createdBy: userId };
    setFolders(prev => [...prev, newFolder]);
    if (parentFolderId) setExpandedFolders(prev => new Set([...prev, parentFolderId]));
    setDialog(null);
  };

  const handleCreateList = async (name: string, folderId: string | null) => {
    const siblings = folderId ? listsByFolder(folderId) : folderlessLists;
    const maxPos = siblings.length > 0 ? Math.max(...siblings.map(l => l.position)) + 1 : 0;
    const ref = await createList({ spaceId, folderId, name, position: maxPos, createdBy: userId });
    setLists(prev => [...prev, { id: ref.id, spaceId, folderId, name, position: maxPos, createdBy: userId }]);
    if (folderId) setExpandedFolders(prev => new Set([...prev, folderId]));
    setDialog(null);
    router.push(`/app/spaces/${spaceId}/list/${ref.id}`);
  };

  const handleTemplateSelect = async (template: UnifiedTemplate) => {
    const folderId = templatePicker?.folderId ?? null;
    const name = template.data?.name || template.name;
    await handleCreateList(name, folderId);
    setTemplatePicker(null);
  };

  const handleCreateDoc = async (title: string, folderId: string | null) => {
    const ref = await createDocument({
      title, teamId: spaceId, spaceId, folderId,
      createdBy: userId, createdByName: '', lastEditedBy: userId, lastEditedByName: '',
      visibility: 'team', starred: false, tags: [], category: '', wordCount: 0, contentHtml: '',
    });
    setSpaceDocs(prev => [...prev, { id: ref.id, title, folderId }]);
    if (folderId) setExpandedFolders(prev => new Set([...prev, folderId]));
    setDialog(null);
    router.push(`/app/docs?id=${ref.id}`);
  };

  const handleCreateWhiteboard = async (name: string, folderId: string | null) => {
    const ref = await createWhiteboard({
      name, teamId: spaceId, spaceId, folderId,
      createdBy: userId, createdByName: '', members: [userId],
    });
    setSpaceBoards(prev => [...prev, { id: ref.id, name, folderId }]);
    if (folderId) setExpandedFolders(prev => new Set([...prev, folderId]));
    setDialog(null);
    router.push(`/app/whiteboards?id=${ref.id}`);
  };

  const handleRename = async (type: 'folder' | 'list', id: string, name: string) => {
    if (type === 'folder') {
      await updateFolder(id, { name });
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    } else {
      await updateList(id, { name });
      setLists(prev => prev.map(l => l.id === id ? { ...l, name } : l));
    }
    setDialog(null);
    setMenuTarget(null);
  };

  const handleDelete = async (type: 'folder' | 'list', id: string) => {
    if (type === 'folder') {
      await deleteFolder(id);
      // Move subfolders to root in local state (server-side deleteFolder handles Firestore)
      setFolders(prev => prev
        .filter(f => f.id !== id)
        .map(f => f.parentFolderId === id ? { ...f, parentFolderId: null } : f)
      );
      setLists(prev => prev.map(l => l.folderId === id ? { ...l, folderId: null } : l));
      setSpaceDocs(prev => prev.map(d => d.folderId === id ? { ...d, folderId: null } : d));
      setSpaceBoards(prev => prev.map(b => b.folderId === id ? { ...b, folderId: null } : b));
      setSpaceForms(prev => prev.map(f => f.folderId === id ? { ...f, folderId: null } : f));
    } else {
      await deleteList(id);
      setLists(prev => prev.filter(l => l.id !== id));
    }
    setDialog(null);
    setMenuTarget(null);
  };

  // ─── Move list to folder ───────────────────────────
  const handleMoveList = async (listId: string, targetFolderId: string | null) => {
    await updateList(listId, { folderId: targetFolderId });
    setLists(prev => prev.map(l => l.id === listId ? { ...l, folderId: targetFolderId } : l));
    if (targetFolderId) setExpandedFolders(prev => new Set([...prev, targetFolderId]));
    setDialog(null);
    setMenuTarget(null);
  };

  // ─── Doc handlers ─────────────────────────────────
  const handleRenameDoc = async (docId: string, title: string) => {
    await updateDocument(docId, { title });
    setSpaceDocs(prev => prev.map(d => d.id === docId ? { ...d, title } : d));
    setDialog(null);
    setMenuTarget(null);
  };

  const handleDeleteDoc = async (docId: string) => {
    await deleteDocument(docId);
    setSpaceDocs(prev => prev.filter(d => d.id !== docId));
    setDialog(null);
    setMenuTarget(null);
  };

  const handleMoveDoc = async (docId: string, targetFolderId: string | null) => {
    await updateDocument(docId, { folderId: targetFolderId });
    setSpaceDocs(prev => prev.map(d => d.id === docId ? { ...d, folderId: targetFolderId } : d));
    if (targetFolderId) setExpandedFolders(prev => new Set([...prev, targetFolderId]));
    setDialog(null);
    setMenuTarget(null);
  };

  // ─── Whiteboard handlers ────────────────────────
  const handleRenameWhiteboard = async (boardId: string, name: string) => {
    await updateWhiteboard(boardId, { name });
    setSpaceBoards(prev => prev.map(b => b.id === boardId ? { ...b, name } : b));
    setDialog(null);
    setMenuTarget(null);
  };

  const handleDeleteWhiteboard = async (boardId: string) => {
    await deleteWhiteboard(boardId);
    setSpaceBoards(prev => prev.filter(b => b.id !== boardId));
    setDialog(null);
    setMenuTarget(null);
  };

  const handleMoveWhiteboard = async (boardId: string, targetFolderId: string | null) => {
    await updateWhiteboard(boardId, { folderId: targetFolderId });
    setSpaceBoards(prev => prev.map(b => b.id === boardId ? { ...b, folderId: targetFolderId } : b));
    if (targetFolderId) setExpandedFolders(prev => new Set([...prev, targetFolderId]));
    setDialog(null);
    setMenuTarget(null);
  };

  // ─── Form handlers ──────────────────────────────
  const handleRenameForm = async (formId: string, title: string) => {
    await updateForm(formId, { title });
    setSpaceForms(prev => prev.map(f => f.id === formId ? { ...f, title } : f));
    setDialog(null);
    setMenuTarget(null);
  };

  const handleDeleteForm = async (formId: string) => {
    await deleteForm(formId);
    setSpaceForms(prev => prev.filter(f => f.id !== formId));
    setDialog(null);
    setMenuTarget(null);
  };

  const handleMoveForm = async (formId: string, targetFolderId: string | null) => {
    await updateForm(formId, { folderId: targetFolderId });
    setSpaceForms(prev => prev.map(f => f.id === formId ? { ...f, folderId: targetFolderId } : f));
    if (targetFolderId) setExpandedFolders(prev => new Set([...prev, targetFolderId]));
    setDialog(null);
    setMenuTarget(null);
  };

  // ─── Reorder ───────────────────────────────────────
  const reorderFolder = async (folderId: string, direction: -1 | 1) => {
    const idx = folders.findIndex(f => f.id === folderId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= folders.length) return;
    const a = folders[idx], b = folders[swapIdx];
    await Promise.all([
      updateFolder(a.id!, { position: b.position }),
      updateFolder(b.id!, { position: a.position }),
    ]);
    setFolders(prev => {
      const next = [...prev];
      next[idx] = { ...a, position: b.position };
      next[swapIdx] = { ...b, position: a.position };
      return next.sort((x, y) => x.position - y.position);
    });
  };

  const reorderList = async (listId: string, direction: -1 | 1) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    const siblings = list.folderId ? listsByFolder(list.folderId) : folderlessLists;
    const idx = siblings.findIndex(l => l.id === listId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapIdx];
    await Promise.all([
      updateList(a.id!, { position: b.position }),
      updateList(b.id!, { position: a.position }),
    ]);
    setLists(prev => {
      return prev.map(l => {
        if (l.id === a.id) return { ...l, position: b.position };
        if (l.id === b.id) return { ...l, position: a.position };
        return l;
      }).sort((x, y) => x.position - y.position);
    });
  };

  const navigateToList = (listId: string) => {
    router.push(`/app/spaces/${spaceId}/list/${listId}`);
  };

  if (loading) return null;

  return (
    <>
      <div className="space-y-0.5 mt-0.5">
        {/* Root Folders (no parentFolderId) */}
        {rootFolders.map((folder, fIdx) => {
          const expanded = expandedFolders.has(folder.id!);
          const fLists = listsByFolder(folder.id!);
          const fSubfolders = subfoldersByParent(folder.id!);
          const isRootFolder = true; // root folders can have subfolders
          return (
            <div key={folder.id}>
              <div className="group flex items-center">
                <div className={`flex items-center flex-1 rounded-lg text-[13px] transition-all duration-150 ${
                  activeFolderId === folder.id
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-medium'
                    : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
                }`}>
                  <button
                    onClick={() => toggleFolder(folder.id!)}
                    className="p-1 pl-2 shrink-0"
                  >
                    <ChevronRight
                      className={`h-3 w-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                      strokeWidth={2}
                    />
                  </button>
                  <button
                    onClick={() => router.push(`/app/spaces/${spaceId}/folder/${folder.id}`)}
                    className="flex items-center gap-1.5 flex-1 py-1 pr-2 min-w-0"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} style={{ color: folder.color || spaceColor || 'var(--text-muted)' }} />
                    <span className="truncate">{folder.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">{fLists.length + docsByFolder(folder.id!).length + boardsByFolder(folder.id!).length + formsByFolder(folder.id!).length + fSubfolders.length}</span>
                  </button>
                </div>
                {canManage && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDialog({ action: 'createList', folderId: folder.id! }); }}
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
                )}
              </div>

              {/* Folder context menu */}
              {menuTarget?.type === 'folder' && menuTarget.id === folder.id && (
                <ContextMenu
                  ref={menuRef}
                  onRename={() => { setDialog({ action: 'rename', type: 'folder', id: folder.id!, currentName: folder.name }); setMenuTarget(null); }}
                  onDelete={canManage ? () => { setDialog({ action: 'delete', type: 'folder', id: folder.id!, name: folder.name }); setMenuTarget(null); } : undefined}
                  onMoveUp={fIdx > 0 ? () => { reorderFolder(folder.id!, -1); setMenuTarget(null); } : undefined}
                  onMoveDown={fIdx < rootFolders.length - 1 ? () => { reorderFolder(folder.id!, 1); setMenuTarget(null); } : undefined}
                  onNewDoc={() => { setDialog({ action: 'createDoc', folderId: folder.id! }); setMenuTarget(null); }}
                  onNewWhiteboard={() => { setDialog({ action: 'createWhiteboard', folderId: folder.id! }); setMenuTarget(null); }}
                  onNewListFromTemplate={canManage ? () => { setTemplatePicker({ folderId: folder.id! }); setMenuTarget(null); } : undefined}
                  onNewSubfolder={canManage && isRootFolder ? () => { setDialog({ action: 'createSubfolder', parentFolderId: folder.id! }); setMenuTarget(null); } : undefined}
                  t={t}
                  type="folder"
                />
              )}

              {/* Contents inside folder */}
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
                      {fLists.map((list, lIdx) => (
                        <ListItem
                          key={list.id}
                          list={list}
                          active={isListActive(path, spaceId, list.id!)}
                          onClick={() => navigateToList(list.id!)}
                          onMenu={() => setMenuTarget({ type: 'list', id: list.id! })}
                          menuOpen={menuTarget?.type === 'list' && menuTarget.id === list.id}
                          menuRef={menuRef}
                          canManage={canManage}
                          onRename={() => { setDialog({ action: 'rename', type: 'list', id: list.id!, currentName: list.name }); setMenuTarget(null); }}
                          onDelete={() => { setDialog({ action: 'delete', type: 'list', id: list.id!, name: list.name }); setMenuTarget(null); }}
                          onMoveToFolder={() => { setDialog({ action: 'moveList', listId: list.id!, listName: list.name }); setMenuTarget(null); }}
                          onMoveUp={lIdx > 0 ? () => { reorderList(list.id!, -1); setMenuTarget(null); } : undefined}
                          onMoveDown={lIdx < fLists.length - 1 ? () => { reorderList(list.id!, 1); setMenuTarget(null); } : undefined}
                          folders={folders}
                          t={t}
                        />
                      ))}
                      {/* Docs in this folder */}
                      {docsByFolder(folder.id!).map(doc => (
                        <ArtifactItem
                          key={`doc-${doc.id}`}
                          icon={<FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
                          label={doc.title}
                          href={`/app/docs?id=${doc.id}`}
                          active={isDocActive(doc.id)}
                          canManage={canManage}
                          menuOpen={menuTarget?.type === 'doc' && menuTarget.id === doc.id}
                          menuRef={menuRef}
                          onMenu={() => setMenuTarget({ type: 'doc', id: doc.id })}
                          onRename={() => { setDialog({ action: 'renameDoc', docId: doc.id, currentTitle: doc.title }); setMenuTarget(null); }}
                          onDelete={canManage ? () => { setDialog({ action: 'deleteDoc', docId: doc.id, title: doc.title }); setMenuTarget(null); } : undefined}
                          onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveDoc', docId: doc.id, docTitle: doc.title }); setMenuTarget(null); } : undefined}
                          t={t}
                          artifactType="doc"
                        />
                      ))}
                      {/* Whiteboards in this folder */}
                      {boardsByFolder(folder.id!).map(b => (
                        <ArtifactItem
                          key={`wb-${b.id}`}
                          icon={<PenTool className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
                          label={b.name}
                          href={`/app/whiteboards?id=${b.id}`}
                          active={isBoardActive(b.id)}
                          canManage={canManage}
                          menuOpen={menuTarget?.type === 'whiteboard' && menuTarget.id === b.id}
                          menuRef={menuRef}
                          onMenu={() => setMenuTarget({ type: 'whiteboard', id: b.id })}
                          onRename={() => { setDialog({ action: 'renameWhiteboard', boardId: b.id, currentName: b.name }); setMenuTarget(null); }}
                          onDelete={canManage ? () => { setDialog({ action: 'deleteWhiteboard', boardId: b.id, name: b.name }); setMenuTarget(null); } : undefined}
                          onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveWhiteboard', boardId: b.id, boardName: b.name }); setMenuTarget(null); } : undefined}
                          t={t}
                          artifactType="whiteboard"
                        />
                      ))}
                      {/* Forms in this folder */}
                      {formsByFolder(folder.id!).map(fm => (
                        <ArtifactItem
                          key={`form-${fm.id}`}
                          icon={<FileInput className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
                          label={fm.title}
                          href={`/app/forms?id=${fm.id}`}
                          active={false}
                          canManage={canManage}
                          menuOpen={menuTarget?.type === 'form' && menuTarget.id === fm.id}
                          menuRef={menuRef}
                          onMenu={() => setMenuTarget({ type: 'form', id: fm.id })}
                          onRename={() => { setDialog({ action: 'renameForm', formId: fm.id, currentTitle: fm.title }); setMenuTarget(null); }}
                          onDelete={canManage ? () => { setDialog({ action: 'deleteForm', formId: fm.id, title: fm.title }); setMenuTarget(null); } : undefined}
                          onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveForm', formId: fm.id, formTitle: fm.title }); setMenuTarget(null); } : undefined}
                          t={t}
                          artifactType="form"
                        />
                      ))}
                      {/* Subfolders inside this root folder (1 level only) */}
                      {fSubfolders.map((sub) => {
                        const subExpanded = expandedFolders.has(sub.id!);
                        const subLists = listsByFolder(sub.id!);
                        const subDocs = docsByFolder(sub.id!);
                        const subBoards = boardsByFolder(sub.id!);
                        const subForms = formsByFolder(sub.id!);
                        return (
                          <div key={sub.id}>
                            <div className="group flex items-center">
                              <div className={`flex items-center flex-1 rounded-lg text-[13px] transition-all duration-150 ${
                                activeFolderId === sub.id
                                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-medium'
                                  : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
                              }`}>
                                <button
                                  onClick={() => toggleFolder(sub.id!)}
                                  className="p-1 pl-2 shrink-0"
                                >
                                  <ChevronRight
                                    className={`h-3 w-3 transition-transform duration-150 ${subExpanded ? 'rotate-90' : ''}`}
                                    strokeWidth={2}
                                  />
                                </button>
                                <button
                                  onClick={() => router.push(`/app/spaces/${spaceId}/folder/${sub.id}`)}
                                  className="flex items-center gap-1.5 flex-1 py-1 pr-2 min-w-0"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} style={{ color: sub.color || spaceColor || 'var(--text-muted)' }} />
                                  <span className="truncate">{sub.name}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] ml-auto">{subLists.length + subDocs.length + subBoards.length + subForms.length}</span>
                                </button>
                              </div>
                              {canManage && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDialog({ action: 'createList', folderId: sub.id! }); }}
                                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition"
                                    title={t('spaces.newList')}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setMenuTarget({ type: 'folder', id: sub.id! }); }}
                                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Subfolder context menu — no onNewSubfolder (1 level limit) */}
                            {menuTarget?.type === 'folder' && menuTarget.id === sub.id && (
                              <ContextMenu
                                ref={menuRef}
                                onRename={() => { setDialog({ action: 'rename', type: 'folder', id: sub.id!, currentName: sub.name }); setMenuTarget(null); }}
                                onDelete={canManage ? () => { setDialog({ action: 'delete', type: 'folder', id: sub.id!, name: sub.name }); setMenuTarget(null); } : undefined}
                                onNewDoc={() => { setDialog({ action: 'createDoc', folderId: sub.id! }); setMenuTarget(null); }}
                                onNewWhiteboard={() => { setDialog({ action: 'createWhiteboard', folderId: sub.id! }); setMenuTarget(null); }}
                                onNewListFromTemplate={canManage ? () => { setTemplatePicker({ folderId: sub.id! }); setMenuTarget(null); } : undefined}
                                t={t}
                                type="folder"
                              />
                            )}

                            {/* Subfolder contents */}
                            <AnimatePresence>
                              {subExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15, ease: EASE }}
                                  className="overflow-hidden"
                                >
                                  <div className="pl-4 space-y-0.5">
                                    {subLists.map((list, lIdx) => (
                                      <ListItem
                                        key={list.id}
                                        list={list}
                                        active={isListActive(path, spaceId, list.id!)}
                                        onClick={() => navigateToList(list.id!)}
                                        onMenu={() => setMenuTarget({ type: 'list', id: list.id! })}
                                        menuOpen={menuTarget?.type === 'list' && menuTarget.id === list.id}
                                        menuRef={menuRef}
                                        canManage={canManage}
                                        onRename={() => { setDialog({ action: 'rename', type: 'list', id: list.id!, currentName: list.name }); setMenuTarget(null); }}
                                        onDelete={() => { setDialog({ action: 'delete', type: 'list', id: list.id!, name: list.name }); setMenuTarget(null); }}
                                        onMoveToFolder={() => { setDialog({ action: 'moveList', listId: list.id!, listName: list.name }); setMenuTarget(null); }}
                                        onMoveUp={lIdx > 0 ? () => { reorderList(list.id!, -1); setMenuTarget(null); } : undefined}
                                        onMoveDown={lIdx < subLists.length - 1 ? () => { reorderList(list.id!, 1); setMenuTarget(null); } : undefined}
                                        folders={folders}
                                        t={t}
                                      />
                                    ))}
                                    {subDocs.map(doc => (
                                      <ArtifactItem
                                        key={`doc-${doc.id}`}
                                        icon={<FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
                                        label={doc.title}
                                        href={`/app/docs?id=${doc.id}`}
                                        active={isDocActive(doc.id)}
                                        canManage={canManage}
                                        menuOpen={menuTarget?.type === 'doc' && menuTarget.id === doc.id}
                                        menuRef={menuRef}
                                        onMenu={() => setMenuTarget({ type: 'doc', id: doc.id })}
                                        onRename={() => { setDialog({ action: 'renameDoc', docId: doc.id, currentTitle: doc.title }); setMenuTarget(null); }}
                                        onDelete={canManage ? () => { setDialog({ action: 'deleteDoc', docId: doc.id, title: doc.title }); setMenuTarget(null); } : undefined}
                                        onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveDoc', docId: doc.id, docTitle: doc.title }); setMenuTarget(null); } : undefined}
                                        t={t}
                                        artifactType="doc"
                                      />
                                    ))}
                                    {subBoards.map(b => (
                                      <ArtifactItem
                                        key={`wb-${b.id}`}
                                        icon={<PenTool className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
                                        label={b.name}
                                        href={`/app/whiteboards?id=${b.id}`}
                                        active={isBoardActive(b.id)}
                                        canManage={canManage}
                                        menuOpen={menuTarget?.type === 'whiteboard' && menuTarget.id === b.id}
                                        menuRef={menuRef}
                                        onMenu={() => setMenuTarget({ type: 'whiteboard', id: b.id })}
                                        onRename={() => { setDialog({ action: 'renameWhiteboard', boardId: b.id, currentName: b.name }); setMenuTarget(null); }}
                                        onDelete={canManage ? () => { setDialog({ action: 'deleteWhiteboard', boardId: b.id, name: b.name }); setMenuTarget(null); } : undefined}
                                        onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveWhiteboard', boardId: b.id, boardName: b.name }); setMenuTarget(null); } : undefined}
                                        t={t}
                                        artifactType="whiteboard"
                                      />
                                    ))}
                                    {subForms.map(fm => (
                                      <ArtifactItem
                                        key={`form-${fm.id}`}
                                        icon={<FileInput className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
                                        label={fm.title}
                                        href={`/app/forms?id=${fm.id}`}
                                        active={false}
                                        canManage={canManage}
                                        menuOpen={menuTarget?.type === 'form' && menuTarget.id === fm.id}
                                        menuRef={menuRef}
                                        onMenu={() => setMenuTarget({ type: 'form', id: fm.id })}
                                        onRename={() => { setDialog({ action: 'renameForm', formId: fm.id, currentTitle: fm.title }); setMenuTarget(null); }}
                                        onDelete={canManage ? () => { setDialog({ action: 'deleteForm', formId: fm.id, title: fm.title }); setMenuTarget(null); } : undefined}
                                        onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveForm', formId: fm.id, formTitle: fm.title }); setMenuTarget(null); } : undefined}
                                        t={t}
                                        artifactType="form"
                                      />
                                    ))}
                                    {subLists.length === 0 && subDocs.length === 0 && subBoards.length === 0 && subForms.length === 0 && (
                                      canManage ? (
                                        <button
                                          onClick={() => setDialog({ action: 'createList', folderId: sub.id! })}
                                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition w-full"
                                        >
                                          <Plus className="h-3 w-3" />
                                          {t('spaces.newList')}
                                        </button>
                                      ) : (
                                        <span className="px-2 py-1 text-[11px] text-[var(--text-muted)] opacity-60">
                                          {t('spaces.emptyFolder')}
                                        </span>
                                      )
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                      {fLists.length === 0 && docsByFolder(folder.id!).length === 0 && boardsByFolder(folder.id!).length === 0 && formsByFolder(folder.id!).length === 0 && fSubfolders.length === 0 && (
                        canManage ? (
                          <button
                            onClick={() => setDialog({ action: 'createList', folderId: folder.id! })}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition w-full"
                          >
                            <Plus className="h-3 w-3" />
                            {t('spaces.newList')}
                          </button>
                        ) : (
                          <span className="px-2 py-1 text-[11px] text-[var(--text-muted)] opacity-60">
                            {t('spaces.emptyFolder')}
                          </span>
                        )
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Folderless lists */}
        {folderlessLists.map((list, lIdx) => (
          <ListItem
            key={list.id}
            list={list}
            active={isListActive(path, spaceId, list.id!)}
            onClick={() => navigateToList(list.id!)}
            onMenu={() => setMenuTarget({ type: 'list', id: list.id! })}
            menuOpen={menuTarget?.type === 'list' && menuTarget.id === list.id}
            menuRef={menuRef}
            canManage={canManage}
            onRename={() => { setDialog({ action: 'rename', type: 'list', id: list.id!, currentName: list.name }); setMenuTarget(null); }}
            onDelete={() => { setDialog({ action: 'delete', type: 'list', id: list.id!, name: list.name }); setMenuTarget(null); }}
            onMoveToFolder={() => { setDialog({ action: 'moveList', listId: list.id!, listName: list.name }); setMenuTarget(null); }}
            onMoveUp={lIdx > 0 ? () => { reorderList(list.id!, -1); setMenuTarget(null); } : undefined}
            onMoveDown={lIdx < folderlessLists.length - 1 ? () => { reorderList(list.id!, 1); setMenuTarget(null); } : undefined}
            folders={folders}
            t={t}
          />
        ))}

        {/* Folderless docs */}
        {folderlessDocs.map(doc => (
          <ArtifactItem
            key={`doc-${doc.id}`}
            icon={<FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
            label={doc.title}
            href={`/app/docs?id=${doc.id}`}
            active={isDocActive(doc.id)}
            canManage={canManage}
            menuOpen={menuTarget?.type === 'doc' && menuTarget.id === doc.id}
            menuRef={menuRef}
            onMenu={() => setMenuTarget({ type: 'doc', id: doc.id })}
            onRename={() => { setDialog({ action: 'renameDoc', docId: doc.id, currentTitle: doc.title }); setMenuTarget(null); }}
            onDelete={canManage ? () => { setDialog({ action: 'deleteDoc', docId: doc.id, title: doc.title }); setMenuTarget(null); } : undefined}
            onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveDoc', docId: doc.id, docTitle: doc.title }); setMenuTarget(null); } : undefined}
            t={t}
            artifactType="doc"
          />
        ))}
        {/* Folderless whiteboards */}
        {folderlessBoards.map(b => (
          <ArtifactItem
            key={`wb-${b.id}`}
            icon={<PenTool className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
            label={b.name}
            href={`/app/whiteboards?id=${b.id}`}
            active={isBoardActive(b.id)}
            canManage={canManage}
            menuOpen={menuTarget?.type === 'whiteboard' && menuTarget.id === b.id}
            menuRef={menuRef}
            onMenu={() => setMenuTarget({ type: 'whiteboard', id: b.id })}
            onRename={() => { setDialog({ action: 'renameWhiteboard', boardId: b.id, currentName: b.name }); setMenuTarget(null); }}
            onDelete={canManage ? () => { setDialog({ action: 'deleteWhiteboard', boardId: b.id, name: b.name }); setMenuTarget(null); } : undefined}
            onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveWhiteboard', boardId: b.id, boardName: b.name }); setMenuTarget(null); } : undefined}
            t={t}
            artifactType="whiteboard"
          />
        ))}
        {/* Folderless forms */}
        {folderlessForms.map(fm => (
          <ArtifactItem
            key={`form-${fm.id}`}
            icon={<FileInput className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />}
            label={fm.title}
            href={`/app/forms?id=${fm.id}`}
            active={false}
            canManage={canManage}
            menuOpen={menuTarget?.type === 'form' && menuTarget.id === fm.id}
            menuRef={menuRef}
            onMenu={() => setMenuTarget({ type: 'form', id: fm.id })}
            onRename={() => { setDialog({ action: 'renameForm', formId: fm.id, currentTitle: fm.title }); setMenuTarget(null); }}
            onDelete={canManage ? () => { setDialog({ action: 'deleteForm', formId: fm.id, title: fm.title }); setMenuTarget(null); } : undefined}
            onMoveToFolder={canManage && folders.length > 0 ? () => { setDialog({ action: 'moveForm', formId: fm.id, formTitle: fm.title }); setMenuTarget(null); } : undefined}
            t={t}
            artifactType="form"
          />
        ))}

        {/* Create buttons — structure (manager+), artifacts (any member) */}
        <div className="flex items-center gap-1 pt-1">
          {canManage && (
            <>
              <button
                onClick={() => setDialog({ action: 'createFolder' })}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
                title={t('spaces.newFolder')}
              >
                <FolderPlus className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDialog({ action: 'createList', folderId: null })}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
                title={t('spaces.newList')}
              >
                <ListPlus className="h-3 w-3" />
              </button>
              <button
                onClick={() => setTemplatePicker({ folderId: null })}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
                title={t('spaces.fromTemplate')}
              >
                <LayoutTemplate className="h-3 w-3" />
              </button>
            </>
          )}
          <button
            onClick={() => setDialog({ action: 'createDoc', folderId: null })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
            title={t('spaces.newDoc')}
          >
            <FileText className="h-3 w-3" />
          </button>
          <button
            onClick={() => setDialog({ action: 'createWhiteboard', folderId: null })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition"
            title={t('spaces.newWhiteboard')}
          >
            <PenTool className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ─── Dialogs ──────────────────────────────────── */}
      <SpaceInputDialog
        open={dialog?.action === 'createFolder'}
        title={t('spaces.newFolder')}
        placeholder={t('spaces.folderName')}
        confirmLabel={t('common.save')}
        onConfirm={name => handleCreateFolder(name)}
        onCancel={() => setDialog(null)}
      />

      <SpaceInputDialog
        open={dialog?.action === 'createSubfolder'}
        title={t('spaces.newSubfolder')}
        placeholder={t('spaces.folderName')}
        confirmLabel={t('common.save')}
        onConfirm={name => {
          if (dialog?.action === 'createSubfolder') handleCreateFolder(name, dialog.parentFolderId);
        }}
        onCancel={() => setDialog(null)}
      />

      <SpaceInputDialog
        open={dialog?.action === 'createList'}
        title={t('spaces.newList')}
        placeholder={t('spaces.listName')}
        confirmLabel={t('common.save')}
        onConfirm={name => {
          if (dialog?.action === 'createList') handleCreateList(name, dialog.folderId);
        }}
        onCancel={() => setDialog(null)}
      />

      <SpaceInputDialog
        open={dialog?.action === 'createDoc'}
        title={t('spaces.newDoc')}
        placeholder={t('spaces.docTitle')}
        confirmLabel={t('common.save')}
        onConfirm={title => {
          if (dialog?.action === 'createDoc') handleCreateDoc(title, dialog.folderId);
        }}
        onCancel={() => setDialog(null)}
      />

      <SpaceInputDialog
        open={dialog?.action === 'createWhiteboard'}
        title={t('spaces.newWhiteboard')}
        placeholder={t('spaces.whiteboardName')}
        confirmLabel={t('common.save')}
        onConfirm={name => {
          if (dialog?.action === 'createWhiteboard') handleCreateWhiteboard(name, dialog.folderId);
        }}
        onCancel={() => setDialog(null)}
      />

      <SpaceInputDialog
        open={dialog?.action === 'rename'}
        title={dialog?.action === 'rename' ? t(dialog.type === 'folder' ? 'spaces.renameFolder' : 'spaces.renameList') : ''}
        defaultValue={dialog?.action === 'rename' ? dialog.currentName : ''}
        confirmLabel={t('common.save')}
        onConfirm={name => {
          if (dialog?.action === 'rename') handleRename(dialog.type, dialog.id, name);
        }}
        onCancel={() => setDialog(null)}
      />

      <SpaceConfirmDialog
        open={dialog?.action === 'delete'}
        title={dialog?.action === 'delete' ? t(dialog.type === 'folder' ? 'spaces.deleteFolder' : 'spaces.deleteList') : ''}
        description={dialog?.action === 'delete' ? t(dialog.type === 'folder' ? 'spaces.deleteFolderConfirm' : 'spaces.deleteListConfirm') : ''}
        onConfirm={() => {
          if (dialog?.action === 'delete') handleDelete(dialog.type, dialog.id);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Move list to folder dialog */}
      {dialog?.action === 'moveList' && (
        <MoveToFolderDialog
          open
          itemName={dialog.listName}
          folders={folders}
          currentFolderId={lists.find(l => l.id === dialog.listId)?.folderId || null}
          onMove={(folderId) => handleMoveList(dialog.listId, folderId)}
          onCancel={() => setDialog(null)}
          t={t}
        />
      )}

      {/* Rename doc */}
      <SpaceInputDialog
        open={dialog?.action === 'renameDoc'}
        title={t('spaces.renameDoc')}
        defaultValue={dialog?.action === 'renameDoc' ? dialog.currentTitle : ''}
        confirmLabel={t('common.save')}
        onConfirm={title => {
          if (dialog?.action === 'renameDoc') handleRenameDoc(dialog.docId, title);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Rename whiteboard */}
      <SpaceInputDialog
        open={dialog?.action === 'renameWhiteboard'}
        title={t('spaces.renameWhiteboard')}
        defaultValue={dialog?.action === 'renameWhiteboard' ? dialog.currentName : ''}
        confirmLabel={t('common.save')}
        onConfirm={name => {
          if (dialog?.action === 'renameWhiteboard') handleRenameWhiteboard(dialog.boardId, name);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Delete doc */}
      <SpaceConfirmDialog
        open={dialog?.action === 'deleteDoc'}
        title={dialog?.action === 'deleteDoc' ? t('spaces.deleteDoc') : ''}
        description={dialog?.action === 'deleteDoc' ? t('spaces.deleteDocConfirm') : ''}
        onConfirm={() => {
          if (dialog?.action === 'deleteDoc') handleDeleteDoc(dialog.docId);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Delete whiteboard */}
      <SpaceConfirmDialog
        open={dialog?.action === 'deleteWhiteboard'}
        title={dialog?.action === 'deleteWhiteboard' ? t('spaces.deleteWhiteboard') : ''}
        description={dialog?.action === 'deleteWhiteboard' ? t('spaces.deleteWhiteboardConfirm') : ''}
        onConfirm={() => {
          if (dialog?.action === 'deleteWhiteboard') handleDeleteWhiteboard(dialog.boardId);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Move doc to folder */}
      {dialog?.action === 'moveDoc' && (
        <MoveToFolderDialog
          open
          itemName={dialog.docTitle}
          folders={folders}
          currentFolderId={spaceDocs.find(d => d.id === dialog.docId)?.folderId || null}
          onMove={(folderId) => handleMoveDoc(dialog.docId, folderId)}
          onCancel={() => setDialog(null)}
          t={t}
        />
      )}

      {/* Move whiteboard to folder */}
      {dialog?.action === 'moveWhiteboard' && (
        <MoveToFolderDialog
          open
          itemName={dialog.boardName}
          folders={folders}
          currentFolderId={spaceBoards.find(b => b.id === dialog.boardId)?.folderId || null}
          onMove={(folderId) => handleMoveWhiteboard(dialog.boardId, folderId)}
          onCancel={() => setDialog(null)}
          t={t}
        />
      )}

      {/* Rename form */}
      <SpaceInputDialog
        open={dialog?.action === 'renameForm'}
        title={t('spaces.renameForm')}
        defaultValue={dialog?.action === 'renameForm' ? dialog.currentTitle : ''}
        confirmLabel={t('common.save')}
        onConfirm={title => {
          if (dialog?.action === 'renameForm') handleRenameForm(dialog.formId, title);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Delete form */}
      <SpaceConfirmDialog
        open={dialog?.action === 'deleteForm'}
        title={dialog?.action === 'deleteForm' ? t('spaces.deleteForm') : ''}
        description={dialog?.action === 'deleteForm' ? t('spaces.deleteFormConfirm') : ''}
        onConfirm={() => {
          if (dialog?.action === 'deleteForm') handleDeleteForm(dialog.formId);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Move form to folder */}
      {dialog?.action === 'moveForm' && (
        <MoveToFolderDialog
          open
          itemName={dialog.formTitle}
          folders={folders}
          currentFolderId={spaceForms.find(f => f.id === dialog.formId)?.folderId || null}
          onMove={(folderId) => handleMoveForm(dialog.formId, folderId)}
          onCancel={() => setDialog(null)}
          t={t}
        />
      )}

      {/* Template picker for creating lists from templates */}
      <TemplatePickerModal
        open={templatePicker !== null}
        onClose={() => setTemplatePicker(null)}
        onSelect={handleTemplateSelect}
        filterType="list"
        title={t('spaces.fromTemplate')}
      />
    </>
  );
}

// ─── List Item ───────────────────────────────────
function ListItem({
  list, active, onClick, onMenu, menuOpen, menuRef, canManage, onRename, onDelete, onMoveToFolder, onMoveUp, onMoveDown, folders, t,
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
  onMoveToFolder: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  folders: FolderData[];
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
      {canManage && (
        <button
          onClick={(e) => { e.stopPropagation(); onMenu(); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}
      {menuOpen && canManage && (
        <ContextMenu
          ref={menuRef}
          onRename={onRename}
          onDelete={onDelete}
          onMoveToFolder={folders.length > 0 ? onMoveToFolder : undefined}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          t={t}
          type="list"
        />
      )}
    </div>
  );
}

// ─── Context Menu ────────────────────────────────
const ContextMenu = forwardRef<HTMLDivElement, {
  onRename: () => void;
  onDelete?: () => void;
  onMoveToFolder?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onNewDoc?: () => void;
  onNewWhiteboard?: () => void;
  onNewListFromTemplate?: () => void;
  onNewSubfolder?: () => void;
  t: (k: string) => string;
  type: 'folder' | 'list';
}>(({ onRename, onDelete, onMoveToFolder, onMoveUp, onMoveDown, onNewDoc, onNewWhiteboard, onNewListFromTemplate, onNewSubfolder, t, type }, ref) => (
  <div ref={ref} className="absolute left-full top-0 ml-1 w-44 rounded-xl bg-[var(--bg-elevated)] shadow-lg z-50 p-1 border border-[var(--border-subtle)]">
    {(onNewDoc || onNewWhiteboard || onNewListFromTemplate || onNewSubfolder) && (
      <>
        {onNewSubfolder && (
          <button onClick={onNewSubfolder} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <FolderPlus className="h-3 w-3" />
            {t('spaces.newSubfolder')}
          </button>
        )}
        {onNewListFromTemplate && (
          <button onClick={onNewListFromTemplate} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <LayoutTemplate className="h-3 w-3" />
            {t('spaces.fromTemplate')}
          </button>
        )}
        {onNewDoc && (
          <button onClick={onNewDoc} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <FileText className="h-3 w-3" />
            {t('spaces.newDoc')}
          </button>
        )}
        {onNewWhiteboard && (
          <button onClick={onNewWhiteboard} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            <PenTool className="h-3 w-3" />
            {t('spaces.newWhiteboard')}
          </button>
        )}
        <div className="h-px bg-[var(--border-subtle)] my-0.5 mx-2" />
      </>
    )}
    <button
      onClick={onRename}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
    >
      <Pencil className="h-3 w-3" />
      {t(type === 'folder' ? 'spaces.renameFolder' : 'spaces.renameList')}
    </button>
    {onMoveToFolder && (
      <button
        onClick={onMoveToFolder}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
      >
        <FolderInput className="h-3 w-3" />
        {t('spaces.moveToFolder')}
      </button>
    )}
    {(onMoveUp || onMoveDown) && (
      <>
        <div className="h-px bg-[var(--border-subtle)] my-0.5 mx-2" />
        {onMoveUp && (
          <button
            onClick={onMoveUp}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            <ChevronUp className="h-3 w-3" />
            {t('common.moveUp')}
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={onMoveDown}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            <ChevronDownIcon className="h-3 w-3" />
            {t('common.moveDown')}
          </button>
        )}
      </>
    )}
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

// ─── Move to Folder Dialog ───────────────────────
function MoveToFolderDialog({
  open, itemName, folders, currentFolderId, onMove, onCancel, t,
}: {
  open: boolean;
  itemName: string;
  folders: FolderData[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs bg-[var(--bg-elevated)] rounded-xl shadow-modal p-5 z-[100]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
          {t('spaces.moveToFolder')} &ldquo;{itemName}&rdquo;
        </h3>
        <p className="text-[12px] text-[var(--text-muted)] mb-4">
          {t('spaces.selectDestinationFolder')}
        </p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => onMove(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--bg-hover)] transition ${
              !currentFolderId ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            {t('spaces.noFolder')}
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => onMove(f.id!)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--bg-hover)] transition ${
                currentFolderId === f.id ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)]'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" style={{ color: f.color || 'var(--text-muted)' }} />
              {f.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Artifact Item (Doc / Whiteboard) ────────────
function ArtifactItem({ icon, label, href, active, canManage, menuOpen, menuRef, onMenu, onRename, onDelete, onMoveToFolder, t, artifactType }: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
  canManage?: boolean;
  menuOpen?: boolean;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  onMenu?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onMoveToFolder?: () => void;
  t?: (k: string) => string;
  artifactType?: 'doc' | 'whiteboard' | 'form';
}) {
  return (
    <div className="relative group">
      <a
        href={href}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[13px] transition-all duration-150 ${
          active
            ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-medium'
            : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
      </a>
      {onMenu && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onMenu(); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}
      {menuOpen && menuRef && t && artifactType && (
        <div ref={menuRef} className="absolute left-full top-0 ml-1 w-44 rounded-xl bg-[var(--bg-elevated)] shadow-lg z-50 p-1 border border-[var(--border-subtle)]">
          {onRename && (
            <button onClick={onRename} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              <Pencil className="h-3 w-3" />
              {t(artifactType === 'doc' ? 'spaces.renameDoc' : artifactType === 'form' ? 'spaces.renameForm' : 'spaces.renameWhiteboard')}
            </button>
          )}
          {onMoveToFolder && (
            <button onClick={onMoveToFolder} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              <FolderInput className="h-3 w-3" />
              {t('spaces.moveToFolder')}
            </button>
          )}
          {onDelete && (
            <>
              <div className="h-px bg-[var(--border-subtle)] my-0.5 mx-2" />
              <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-[var(--error)] hover:bg-[var(--error-bg)] transition">
                <Trash2 className="h-3 w-3" />
                {t(artifactType === 'doc' ? 'spaces.deleteDoc' : artifactType === 'form' ? 'spaces.deleteForm' : 'spaces.deleteWhiteboard')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────
function extractListId(path: string, spaceId: string): string | null {
  const match = path.match(new RegExp(`/app/spaces/${spaceId}/list/([^/]+)`));
  return match ? match[1] : null;
}

function isListActive(path: string, spaceId: string, listId: string): boolean {
  return path === `/app/spaces/${spaceId}/list/${listId}`;
}

function extractFolderId(path: string, spaceId: string): string | null {
  const match = path.match(new RegExp(`/app/spaces/${spaceId}/folder/([^/]+)`));
  return match ? match[1] : null;
}
