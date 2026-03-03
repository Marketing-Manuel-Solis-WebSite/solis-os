'use client';
import { useState } from 'react';
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

  if (todayConvos.length > 0) groups.push({ label: t('common.today'), convos: todayConvos });
  if (yesterdayConvos.length > 0) groups.push({ label: t('common.yesterday'), convos: yesterdayConvos });
  if (thisWeekConvos.length > 0) groups.push({ label: t('ai.thisWeek'), convos: thisWeekConvos });
  if (olderConvos.length > 0) groups.push({ label: t('ai.older'), convos: olderConvos });

  const startRename = (c: AIConversation) => { setEditId(c.id); setEditTitle(c.title); setMenuId(null); };
  const saveRename = () => { if (editId && editTitle.trim()) onRename(editId, editTitle.trim()); setEditId(null); };

  return (
    <aside className="bg-[var(--bg-elevated)]/40 shadow-panel flex flex-col shrink-0 overflow-hidden" style={{ width: 210, maxWidth: 210, minWidth: 210 }}>
      {/* Header */}
      <div className="px-2.5 pt-2.5 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('ai.conversations')}</span>
          <div className="flex items-center gap-0.5">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onNew} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition" title={t('ai.newChat')}>
              <Plus className="h-3.5 w-3.5" />
            </motion.button>
            <button onClick={onToggle} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition" title={t('ai.hideSidebar')}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t('common.search')}...`}
            className="w-full h-6 pl-6 pr-2 rounded-md bg-[var(--bg-base)] text-[12px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-all duration-200" />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin" onClick={() => setMenuId(null)}>
        {loading ? (
          <div className="p-2 space-y-1">{[1, 2, 3].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-10 px-4">
            <MessageSquare className="h-5 w-5 text-[var(--text-muted)]/30 mx-auto mb-2" />
            <p className="text-[13px] text-[var(--text-muted)]">{search ? t('common.noResults') : t('ai.noConversations')}</p>
            <button onClick={onNew} className="text-[13px] text-[var(--accent)] mt-1.5 hover:underline">{t('ai.startNewChat')}</button>
          </div>
        ) : (
          <div className="px-1.5 pb-1.5">
            {groups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] text-[var(--text-muted)] uppercase font-semibold tracking-wider px-2 pt-3 pb-1">{group.label}</p>
                <div className="space-y-1.5">
                  {group.convos.map((convo, ci) => {
                    const isActive = activeId === convo.id;
                    const isEditing = editId === convo.id;

                    return (
                      <motion.div key={convo.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: ci * 0.03 }}
                        whileHover={{ y: -1 }}
                        className={`group relative flex items-center gap-2 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                          isActive
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                        style={{
                          background: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                          boxShadow: isActive
                            ? '0 4px 12px rgba(123,104,238,0.3), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.15)'
                            : '0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                          border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                        }}
                        onClick={() => !isEditing && onSelect(convo)}>
                        <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white/80' : 'text-[var(--text-muted)]'}`} />
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                className="flex-1 h-6 px-1.5 rounded-lg bg-[var(--bg-base)] ring-1 ring-[var(--accent)]/30 text-[13px] text-[var(--text-primary)] outline-none"
                                onKeyDown={e => e.key === 'Enter' && saveRename()} autoFocus onClick={e => e.stopPropagation()} />
                              <button onClick={e => { e.stopPropagation(); saveRename(); }} className="p-0.5 text-emerald-400"><Check className="h-3 w-3" /></button>
                              <button onClick={e => { e.stopPropagation(); setEditId(null); }} className="p-0.5 text-[var(--text-muted)]"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <p className={`text-[13px] font-semibold truncate leading-snug ${isActive ? 'text-white' : ''}`}>{convo.title || t('ai.untitled')}</p>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button onClick={e => { e.stopPropagation(); setMenuId(menuId === convo.id ? null : convo.id); }}
                              className={`p-0.5 rounded ${isActive ? 'text-white/60 hover:text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
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
                              className="absolute right-1 top-10 z-20 w-32 py-1 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown"
                              style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)' }}
                              onClick={e => e.stopPropagation()}>
                              <button onClick={() => startRename(convo)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg mx-auto">
                                <Edit2 className="h-3 w-3" /> {t('ai.rename')}
                              </button>
                              <button onClick={() => { onDelete(convo.id); setMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/5 rounded-lg mx-auto">
                                <Trash2 className="h-3 w-3" /> {t('common.delete')}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
