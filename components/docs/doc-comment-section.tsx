'use client';

// ================================================================
// Doc Comment Section — Collapsible comment thread for documents
// Follows the goal-checkin-section pattern with add form + list.
// ================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, X, ChevronDown, ChevronUp, Send, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/notifications/toast-provider';
import { getDocComments, addDocComment, deleteDocComment } from '@/lib/db';

interface Props {
  docId: string;
}

interface DocComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  mentions: string[];
  createdAt: any;
  updatedAt: any;
}

function formatCommentDate(ts: any, lang: string): string {
  const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : null);
  if (!d) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'es' ? 'ahora' : 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderTextWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-[var(--accent)] font-semibold">
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function DocCommentSection({ docId }: Props) {
  const { lang } = useI18n();
  const { user, me, allMembers } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState<DocComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await getDocComments(docId);
      setComments(items as DocComment[]);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (comments.length > 0 && expanded) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, expanded]);

  // Parse @mentions from text
  const extractMentions = (value: string): string[] => {
    const matches = value.match(/@(\w+)/g);
    return matches ? matches.map(m => m.slice(1)) : [];
  };

  // Handle input changes and detect @mention trigger
  const handleInputChange = (value: string) => {
    setText(value);
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  // Insert mention into text
  const insertMention = (name: string) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx === -1) return;
    const before = text.slice(0, atIdx);
    const after = text.slice(cursorPos);
    const newText = `${before}@${name} ${after}`;
    setText(newText);
    setShowMentions(false);
    setTimeout(() => {
      const newPos = atIdx + name.length + 2;
      inputRef.current?.setSelectionRange(newPos, newPos);
      inputRef.current?.focus();
    }, 0);
  };

  // Filtered member suggestions
  const mentionSuggestions = (allMembers || [])
    .filter((m: any) => {
      const name = (m.displayName || m.email || '').toLowerCase();
      return name.includes(mentionQuery);
    })
    .slice(0, 5);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const mentions = extractMentions(text);
      await addDocComment(docId, {
        text: text.trim(),
        authorId: user?.uid || '',
        authorName: me?.displayName || me?.email || '',
        mentions,
      });
      setText('');
      setShowMentions(false);
      loadComments();
    } catch {
      toast.error(lang === 'es' ? 'Error al comentar' : 'Failed to comment');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(lang === 'es' ? '¿Eliminar este comentario?' : 'Delete this comment?')) return;
    try {
      await deleteDocComment(docId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success(lang === 'es' ? 'Comentario eliminado' : 'Comment deleted');
    } catch {
      toast.error(lang === 'es' ? 'Error al eliminar' : 'Failed to delete');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  return (
    <div className="mt-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]"
        >
          <MessageSquare className="h-3.5 w-3.5 text-[var(--accent)]" />
          {lang === 'es' ? 'Comentarios' : 'Comments'}
          {comments.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)] font-normal">({comments.length})</span>
          )}
          {expanded ? <ChevronUp className="h-3 w-3 text-[var(--text-muted)]" /> : <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Comment list */}
            {loading ? (
              <div className="py-4 text-center text-[12px] text-[var(--text-muted)]">
                {lang === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] py-2 mb-2">
                {lang === 'es' ? 'Sin comentarios aun. Se el primero en comentar.' : 'No comments yet. Be the first to comment.'}
              </p>
            ) : (
              <div className="space-y-1 mb-3 max-h-[320px] overflow-y-auto scrollbar-thin">
                {comments.map(comment => {
                  const isOwn = comment.authorId === user?.uid;
                  return (
                    <div
                      key={comment.id}
                      className="px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] transition group"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                            {comment.authorName || 'Unknown'}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {formatCommentDate(comment.createdAt, lang)}
                          </span>
                        </div>
                        {isOwn && (
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                        {renderTextWithMentions(comment.text)}
                      </p>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            )}

            {/* Add comment input */}
            <div className="relative">
              {/* @mention suggestions */}
              {showMentions && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-elevated)] rounded-xl shadow-dropdown border border-[var(--border-subtle)] py-1 z-20">
                  {mentionSuggestions.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => insertMention(m.displayName || m.email)}
                      className="w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition flex items-center gap-2"
                    >
                      <div className="w-5 h-5 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[var(--accent)]">
                          {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {m.displayName || m.email}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 p-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={lang === 'es' ? 'Escribe un comentario... @mencionar' : 'Write a comment... @mention'}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none leading-relaxed min-h-[28px] max-h-[100px]"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || sending}
                  className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-40 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
