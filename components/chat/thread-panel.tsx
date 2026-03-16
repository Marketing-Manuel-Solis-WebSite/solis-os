'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Reply, SmilePlus, Send } from 'lucide-react';
import { onThreadRepliesSnapshot, sendThreadReply } from '@/lib/db';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '💯'];

interface Props {
  channelId: string;
  parentMessage: any;
  members: any[];
  userId: string;
  displayName: string;
  photoURL?: string;
  onClose: () => void;
  onReaction: (msgId: string, emoji: string) => void;
}

export default function ThreadPanel({
  channelId,
  parentMessage,
  members,
  userId,
  displayName,
  photoURL,
  onClose,
  onReaction,
}: Props) {
  const { t } = useI18n();
  const [replies, setReplies] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to thread replies
  useEffect(() => {
    const unsub = onThreadRepliesSnapshot(channelId, parentMessage.id, (newReplies) => {
      setReplies(newReplies);
    });
    return () => unsub();
  }, [channelId, parentMessage.id]);

  // Auto-scroll on new replies
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  // Focus input on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendThreadReply(channelId, parentMessage.id, {
        content: text,
        userId,
        displayName,
        photoURL: photoURL || '',
        mentions: [],
      });
      setInput('');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, channelId, parentMessage.id, userId, displayName, photoURL]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const parentTime = parentMessage.createdAt?.toDate?.();
  const replyCount = replies.length;

  return (
    <motion.div
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-[380px] shrink-0 bg-[var(--bg-elevated)] shadow-panel flex flex-col h-full overflow-hidden border-l border-[var(--border)]"
      onClick={() => setShowEmoji(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {t('chat.thread') || 'Thread'}
          </h3>
          {replyCount > 0 && (
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
              {replyCount} {replyCount === 1 ? (t('chat.reply') || 'reply') : (t('chat.replies') || 'replies')}
            </span>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Scrollable area: parent + replies */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Parent message */}
        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-base)]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-[var(--bg-elevated)] text-[var(--accent)]">
              {(parentMessage.displayName || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {parentMessage.displayName}
                </span>
                {parentTime && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {parentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {parentTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-[15px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
            {parentMessage.content}
          </p>
          {/* Parent reactions */}
          {parentMessage.reactions && Object.keys(parentMessage.reactions).length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {Object.entries(parentMessage.reactions).map(([emoji, users]: [string, any]) => {
                const reacted = users.includes(userId);
                return (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); onReaction(parentMessage.id, emoji); }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition ${
                      reacted
                        ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/20 text-[var(--accent)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="font-semibold">{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Reply count divider */}
        {replyCount > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs font-semibold text-[var(--accent)]">
              {replyCount} {replyCount === 1 ? (t('chat.reply') || 'reply') : (t('chat.replies') || 'replies')}
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
        )}

        {/* Thread replies */}
        <div className="px-3 py-2 space-y-0.5">
          {replies.map((reply) => {
            const time = reply.createdAt?.toDate?.();
            const isMine = reply.userId === userId;
            return (
              <div
                key={reply.id}
                className={`group/reply flex gap-2.5 py-2 px-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors relative ${isMine ? 'bg-[var(--accent)]/[0.02]' : ''}`}
                onMouseEnter={() => setHoverId(reply.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {(reply.displayName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {reply.displayName}
                    </span>
                    {time && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
                    {reply.content}
                  </p>
                  {/* Reply reactions */}
                  {reply.reactions && Object.keys(reply.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {Object.entries(reply.reactions).map(([emoji, users]: [string, any]) => (
                        <button
                          key={emoji}
                          onClick={(e) => { e.stopPropagation(); onReaction(reply.id, emoji); }}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition ${
                            users.includes(userId)
                              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-semibold">{users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover emoji picker */}
                <AnimatePresence>
                  {hoverId === reply.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute -top-2 right-1 flex gap-0.5 p-1 rounded-lg bg-[var(--bg-elevated)] shadow-dropdown z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setShowEmoji(showEmoji === reply.id ? null : reply.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] rounded transition"
                      >
                        <SmilePlus className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showEmoji === reply.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute -top-8 right-1 flex gap-0.5 p-1 rounded-lg bg-[var(--bg-elevated)] shadow-dropdown z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {QUICK_EMOJIS.map((em) => (
                        <button
                          key={em}
                          onClick={() => { onReaction(reply.id, em); setShowEmoji(null); }}
                          className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-sm transition"
                        >
                          {em}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Thread reply input */}
      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-end gap-2 bg-[var(--bg-base)] rounded-xl px-3 py-2 ring-1 ring-[var(--border)] focus-within:ring-[var(--accent)] transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.replyInThread') || 'Reply in thread...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none max-h-[120px] leading-relaxed"
            style={{ height: Math.min(120, Math.max(24, input.split('\n').length * 24)) }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={`p-2 rounded-lg transition-all duration-200 shrink-0 ${
              input.trim()
                ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm'
                : 'text-[var(--text-muted)] cursor-not-allowed'
            }`}
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5 px-1">
          Enter ↵ {t('chat.toSend') || 'to send'} · Shift+Enter {t('chat.newLine') || 'new line'}
        </p>
      </div>
    </motion.div>
  );
}
