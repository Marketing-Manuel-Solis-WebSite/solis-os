'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Edit2, Check, X, ChevronLeft, MoreHorizontal, MessageSquare } from 'lucide-react';
import type { AIConversation } from '@/lib/ai-db';

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
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = search
    ? conversations.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()) || c.lastMessage?.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const today = new Date();
  const todayStr = today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const groups: { label: string; convos: AIConversation[] }[] = [];
  const todayConvos: AIConversation[] = [];
  const yesterdayConvos: AIConversation[] = [];
  const thisWeekConvos: AIConversation[] = [];
  const olderConvos: AIConversation[] = [];

  filtered.forEach(c => {
    const d = c.updatedAt?.toDate?.() || c.createdAt?.toDate?.();
    if (!d) { olderConvos.push(c); return; }
    const ds = d.toDateString();
    if (ds === todayStr) todayConvos.push(c);
    else if (ds === yesterdayStr) yesterdayConvos.push(c);
    else if ((today.getTime() - d.getTime()) < 7 * 86400000) thisWeekConvos.push(c);
    else olderConvos.push(c);
  });

  if (todayConvos.length > 0) groups.push({ label: 'Today', convos: todayConvos });
  if (yesterdayConvos.length > 0) groups.push({ label: 'Yesterday', convos: yesterdayConvos });
  if (thisWeekConvos.length > 0) groups.push({ label: 'This Week', convos: thisWeekConvos });
  if (olderConvos.length > 0) groups.push({ label: 'Older', convos: olderConvos });

  const startRename = (c: AIConversation) => { setEditId(c.id); setEditTitle(c.title); setMenuId(null); };
  const saveRename = () => { if (editId && editTitle.trim()) onRename(editId, editTitle.trim()); setEditId(null); };

  return (
    <aside className="w-[260px] bg-[var(--bg-elevated)]/40 shadow-panel flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Conversations</span>
          <div className="flex items-center gap-0.5">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onNew} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition" title="New chat">
              <Plus className="h-3.5 w-3.5" />
            </motion.button>
            <button onClick={onToggle} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition" title="Hide sidebar">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="w-full h-7 pl-7 pr-3 rounded-lg bg-[var(--bg-base)] text-[11px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-all duration-200" />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin" onClick={() => setMenuId(null)}>
        {loading ? (
          <div className="p-2 space-y-1">{[1, 2, 3].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="h-5 w-5 text-[var(--text-muted)]/30 mx-auto mb-2" />
            <p className="text-[11px] text-[var(--text-muted)]">{search ? 'No results' : 'No conversations yet'}</p>
            <button onClick={onNew} className="text-[11px] text-[var(--accent)] mt-1.5 hover:underline">Start a new chat</button>
          </div>
        ) : (
          <div className="p-1.5">
            {groups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] text-[var(--text-muted)] uppercase font-semibold tracking-wider px-2.5 pt-3 pb-1">{group.label}</p>
                {group.convos.map((convo, ci) => {
                  const isActive = activeId === convo.id;
                  const isEditing = editId === convo.id;

                  return (
                    <motion.div key={convo.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: ci * 0.02 }}
                      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg mb-0.5 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      onClick={() => !isEditing && onSelect(convo)}>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                              className="flex-1 h-6 px-1.5 rounded bg-[var(--bg-base)] ring-1 ring-[var(--accent)]/30 text-[11px] text-[var(--text-primary)] outline-none"
                              onKeyDown={e => e.key === 'Enter' && saveRename()} autoFocus onClick={e => e.stopPropagation()} />
                            <button onClick={e => { e.stopPropagation(); saveRename(); }} className="p-0.5 text-emerald-400"><Check className="h-3 w-3" /></button>
                            <button onClick={e => { e.stopPropagation(); setEditId(null); }} className="p-0.5 text-[var(--text-muted)]"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <p className="text-[12px] font-medium truncate leading-tight">{convo.title || 'Untitled'}</p>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button onClick={e => { e.stopPropagation(); setMenuId(menuId === convo.id ? null : convo.id); }}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <AnimatePresence>
                        {menuId === convo.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="absolute right-1 top-9 z-20 w-32 py-1 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown"
                            onClick={e => e.stopPropagation()}>
                            <button onClick={() => startRename(convo)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                              <Edit2 className="h-3 w-3" /> Rename
                            </button>
                            <button onClick={() => { onDelete(convo.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/5">
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
