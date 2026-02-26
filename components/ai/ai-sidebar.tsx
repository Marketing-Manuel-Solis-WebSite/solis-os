'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Star, StarOff, Edit2, Check, X, MessageSquare, Globe, FileSearch, Sparkles, ChevronLeft, MoreHorizontal, Bot } from 'lucide-react';
import type { AIConversation, AIMode } from '@/lib/ai-db';

const MODE_ICONS: Record<string, { icon: any; color: string }> = {
  chat: { icon: MessageSquare, color: '#D4A843' },
  research: { icon: Globe, color: '#3B82F6' },
  deep: { icon: FileSearch, color: '#A855F7' },
};

interface Props {
  conversations: AIConversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (convo: AIConversation) => void;
  onNew: () => void;
  onNewWithMode: (mode: AIMode) => void;
  onDelete: (id: string) => void;
  onStar: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onToggle: () => void;
}

export default function AISidebar({ conversations, activeId, loading, onSelect, onNew, onNewWithMode, onDelete, onStar, onRename, onToggle }: Props) {
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
    <aside className="w-72 bg-[var(--bg-card)]/50 border-r border-[var(--border)] flex flex-col shrink-0 backdrop-blur-sm">
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D4A843]" />
            <span className="text-sm font-bold text-[var(--text-primary)]">Conversations</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)]">{conversations.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
              onClick={onNew} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#D4A843] hover:bg-[#D4A843]/10 transition" title="New chat">
              <Plus className="h-4 w-4" />
            </motion.button>
            <button onClick={onToggle} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition" title="Hide sidebar">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-2.5">
          {(['chat', 'research', 'deep'] as AIMode[]).map(m => {
            const config = MODE_ICONS[m];
            const Icon = config.icon;
            return (
              <motion.button key={m} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => onNewWithMode(m)}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition"
                title={`New ${m} chat`}>
                <Icon className="h-3 w-3" style={{ color: config.color }} />
                <span className="capitalize">{m === 'deep' ? 'Deep' : m === 'research' ? 'Research' : 'Chat'}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[#D4A843]/40 transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin" onClick={() => setMenuId(null)}>
        {loading ? (
          <div className="p-3 space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-[#D4A843]/10 flex items-center justify-center mx-auto mb-3">
              <Bot className="h-5 w-5 text-[#D4A843]/50" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">{search ? 'No results found' : 'No conversations yet'}</p>
            <button onClick={onNew} className="text-xs text-[#D4A843] mt-2 hover:underline">Start your first chat</button>
          </div>
        ) : (
          <div className="p-2">
            {groups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] text-[var(--text-muted)] uppercase font-semibold tracking-wider px-3 pt-3 pb-1.5">{group.label}</p>
                {group.convos.map((convo, ci) => {
                  const isActive = activeId === convo.id;
                  const mConfig = MODE_ICONS[convo.mode] || MODE_ICONS.chat;
                  const MIcon = mConfig.icon;
                  const isEditing = editId === convo.id;

                  return (
                    <motion.div key={convo.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: ci * 0.02, duration: 0.2 }}
                      className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5 cursor-pointer transition ${
                        isActive ? 'bg-[#D4A843]/10 text-[#D4A843]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                      }`}
                      onClick={() => !isEditing && onSelect(convo)}>
                      {isActive && (
                        <motion.div layoutId="ai-convo-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#D4A843]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                      )}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${mConfig.color}10` }}>
                        <MIcon className="h-3.5 w-3.5" style={{ color: mConfig.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                              className="flex-1 h-6 px-1.5 rounded bg-[var(--bg-base)] border border-[#D4A843]/30 text-xs text-[var(--text-primary)] outline-none"
                              onKeyDown={e => e.key === 'Enter' && saveRename()} autoFocus onClick={e => e.stopPropagation()} />
                            <button onClick={e => { e.stopPropagation(); saveRename(); }} className="p-0.5 text-emerald-400"><Check className="h-3 w-3" /></button>
                            <button onClick={e => { e.stopPropagation(); setEditId(null); }} className="p-0.5 text-[var(--text-muted)]"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1">
                              {convo.starred && <Star className="h-2.5 w-2.5 text-[#D4A843] fill-[#D4A843] shrink-0" />}
                              <p className="text-[12px] font-medium truncate">{convo.title || 'Untitled'}</p>
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">{convo.lastMessage || 'No messages'}</p>
                          </>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button onClick={e => { e.stopPropagation(); setMenuId(menuId === convo.id ? null : convo.id); }}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <AnimatePresence>
                        {menuId === convo.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-2 top-10 z-20 w-36 py-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl"
                            onClick={e => e.stopPropagation()}>
                            <button onClick={() => startRename(convo)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">
                              <Edit2 className="h-3 w-3" /> Rename
                            </button>
                            <button onClick={() => { onStar(convo.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">
                              {convo.starred ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                              {convo.starred ? 'Unstar' : 'Star'}
                            </button>
                            <button onClick={() => { onDelete(convo.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/5">
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
