'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Edit2, Check, X, ChevronLeft, MoreHorizontal, MessageSquare } from 'lucide-react';
import type { AIConversation } from '@/lib/ai-db';
import { useI18n } from '@/lib/i18n';

interface Props {
  conversations: AIConversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (convo: AIConversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onToggle: () => void;
}

export default function AISidebar({ conversations, activeId, loading, onSelect, onNew, onDelete, onRename, onToggle }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click — check refs so clicking the dropdown itself doesn't close it
  useEffect(() => {
    if (!menuId) return;
    const handleClose = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the dropdown
      if (dropdownRef.current?.contains(target)) return;
      // Don't close if clicking the trigger button that opened it
      const trigger = menuTriggerRefs.current[menuId];
      if (trigger?.contains(target)) return;
      setMenuId(null);
    };
    // Use a small delay so the current click finishes before we start listening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClose);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClose);
    };
  }, [menuId]);

  const openMenu = useCallback((convoId: string) => {
    if (menuId === convoId) { setMenuId(null); return; }
    const btn = menuTriggerRefs.current[convoId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      // Position to the right of the sidebar, aligned with the button
      setMenuPos({ top: rect.top - 4, left: rect.right + 8 });
    }
    setMenuId(convoId);
  }, [menuId]);

  const filtered = search
    ? conversations.filter(c =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  // Group by date
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const groups: { label: string; convos: AIConversation[] }[] = [];
  const buckets: Record<string, AIConversation[]> = { today: [], yesterday: [], week: [], older: [] };

  filtered.forEach(c => {
    const d = c.updatedAt?.toDate?.() || c.createdAt?.toDate?.();
    if (!d) { buckets.older.push(c); return; }
    const ds = d.toDateString();
    if (ds === todayStr) buckets.today.push(c);
    else if (ds === yesterdayStr) buckets.yesterday.push(c);
    else if ((today.getTime() - d.getTime()) < 7 * 86400000) buckets.week.push(c);
    else buckets.older.push(c);
  });

  if (buckets.today.length > 0) groups.push({ label: t('common.today'), convos: buckets.today });
  if (buckets.yesterday.length > 0) groups.push({ label: t('common.yesterday'), convos: buckets.yesterday });
  if (buckets.week.length > 0) groups.push({ label: t('ai.thisWeek'), convos: buckets.week });
  if (buckets.older.length > 0) groups.push({ label: t('ai.older'), convos: buckets.older });

  const startRename = (c: AIConversation) => {
    setEditId(c.id);
    setEditTitle(c.title);
    setMenuId(null);
  };

  const saveRename = () => {
    if (editId && editTitle.trim()) onRename(editId, editTitle.trim());
    setEditId(null);
  };

  // Dropdown rendered via portal so it escapes sidebar overflow
  const activeConvo = menuId ? conversations.find(c => c.id === menuId) : null;
  const dropdownPortal = menuId && menuPos && activeConvo && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-40 py-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] overflow-hidden"
          style={{ top: menuPos.top, left: menuPos.left, boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}
        >
          <button
            onClick={() => startRename(activeConvo)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" /> {t('ai.rename')}
          </button>
          <div className="h-px bg-[var(--border-subtle)] mx-2 my-0.5" />
          <button
            onClick={() => { onDelete(activeConvo.id); setMenuId(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <aside className="flex flex-col shrink-0 overflow-hidden bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)]" style={{ width: 280 }}>
        {/* Header */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] pl-1">Solis AI</span>
            <div className="flex items-center gap-0.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={onNew}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
                title={t('ai.newChat')}
              >
                <Plus className="h-4 w-4" />
              </motion.button>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`${t('common.search')}...`}
              className="w-full h-9 pl-10 pr-3 rounded-lg bg-[var(--bg-input)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none border border-transparent focus:border-[var(--accent)]/30 focus:ring-1 focus:ring-[var(--accent)]/15 transition-all duration-200"
            />
          </div>
        </div>

        {/* New chat button */}
        <div className="px-3 pb-2">
          <button
            onClick={onNew}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors border border-dashed border-[var(--accent)]/25 hover:border-[var(--accent)]/50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('ai.newChat')}
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="space-y-1.5 px-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 skeleton rounded-lg" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <p className="text-[13px] text-[var(--text-muted)] mb-1">
                {search ? t('common.noResults') : t('ai.noConversations')}
              </p>
              {!search && (
                <button onClick={onNew} className="text-[13px] text-[var(--accent)] hover:underline">
                  {t('ai.startNewChat')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {groups.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wider px-3 pt-3 pb-1.5">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.convos.map(convo => {
                      const isActive = activeId === convo.id;
                      const isEditing = editId === convo.id;

                      return (
                        <div
                          key={convo.id}
                          className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                            isActive
                              ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                          }`}
                          onClick={() => !isEditing && onSelect(convo)}
                        >
                          <MessageSquare className={`h-4 w-4 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />

                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  value={editTitle}
                                  onChange={e => setEditTitle(e.target.value)}
                                  className="flex-1 h-7 px-2 rounded-md bg-[var(--bg-input)] ring-1 ring-[var(--accent)]/30 text-[13px] text-[var(--text-primary)] outline-none"
                                  onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditId(null); }}
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                />
                                <button onClick={e => { e.stopPropagation(); saveRename(); }} className="p-1 text-[var(--success)] hover:bg-[var(--bg-hover)] rounded">
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); setEditId(null); }} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p className={`text-[13px] truncate leading-snug ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                {convo.title || t('ai.untitled')}
                              </p>
                            )}
                          </div>

                          {/* Menu trigger */}
                          {!isEditing && (
                            <div className={`shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <button
                                ref={el => { menuTriggerRefs.current[convo.id] = el; }}
                                onClick={e => { e.stopPropagation(); openMenu(convo.id); }}
                                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition-colors"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {dropdownPortal}
    </>
  );
}
