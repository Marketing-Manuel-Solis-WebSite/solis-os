'use client';

// ================================================================
// InlineCommentSidebar — Right sidebar showing inline comments.
// Each comment shows: quoted text, author, text, resolve/unresolve
// toggle, replies, and a reply input.
// ================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquareText, Check, RotateCcw, Send, ChevronDown,
  ChevronUp, X, MessageSquare,
} from 'lucide-react';
import type { InlineComment } from '@/lib/inline-comments';

interface InlineCommentSidebarProps {
  docId: string;
  comments: InlineComment[];
  onResolve: (commentId: string, resolved: boolean) => void;
  onReply: (commentId: string, text: string) => void;
  onRefresh: () => void;
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate?.() ? ts.toDate() : typeof ts === 'string' ? new Date(ts) : ts?.seconds ? new Date(ts.seconds * 1000) : null;
  if (!d) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CommentThread({
  comment,
  onResolve,
  onReply,
}: {
  comment: InlineComment;
  onResolve: (commentId: string, resolved: boolean) => void;
  onReply: (commentId: string, text: string) => void;
}) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(!comment.resolved);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      onReply(comment.id, replyText.trim());
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      comment.resolved
        ? 'border-[var(--border-subtle)]/50 bg-[var(--bg-base)]/50 opacity-70'
        : 'border-[var(--border-subtle)] bg-[var(--bg-base)]'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
            {comment.authorName || 'Unknown'}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {formatDate(comment.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {comment.resolved && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-semibold">
              Resolved
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Quoted text */}
              {comment.textAnchor?.quotedText && (
                <div className="text-[12px] text-[var(--text-muted)] italic bg-amber-500/5 border-l-2 border-amber-400/50 px-2 py-1 rounded-r-lg">
                  &ldquo;{comment.textAnchor.quotedText.length > 80
                    ? comment.textAnchor.quotedText.slice(0, 80) + '...'
                    : comment.textAnchor.quotedText}&rdquo;
                </div>
              )}

              {/* Comment text */}
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                {comment.text}
              </p>

              {/* Resolve / Unresolve toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onResolve(comment.id, !comment.resolved); }}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition ${
                  comment.resolved
                    ? 'text-amber-400 hover:bg-amber-500/10'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                {comment.resolved ? (
                  <><RotateCcw className="h-3 w-3" /> Reopen</>
                ) : (
                  <><Check className="h-3 w-3" /> Resolve</>
                )}
              </button>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="space-y-1.5 pl-2 border-l border-[var(--border-subtle)]">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="text-[12px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {reply.authorName || 'Unknown'}
                        </span>
                        <span className="text-[var(--text-muted)] text-[11px]">
                          {formatDate(reply.createdAt)}
                        </span>
                      </div>
                      <p className="text-[var(--text-secondary)] mt-0.5 whitespace-pre-wrap">
                        {reply.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {!comment.resolved && (
                <div className="flex items-end gap-1.5 pt-1">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                    placeholder="Reply..."
                    className="flex-1 h-7 px-2 text-[12px] rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-subtle)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-40 shrink-0"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function InlineCommentSidebar({
  docId,
  comments,
  onResolve,
  onReply,
  onRefresh,
}: InlineCommentSidebarProps) {
  const [showResolved, setShowResolved] = useState(false);

  const activeComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);
  const displayedComments = showResolved ? comments : activeComments;

  return (
    <div className="flex flex-col h-full w-72 border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Comments</span>
          {activeComments.length > 0 && (
            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full font-semibold">
              {activeComments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition ${
            showResolved
              ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          {showResolved ? 'Hide resolved' : `Show resolved (${resolvedComments.length})`}
        </button>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        {displayedComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquareText className="h-8 w-8 text-[var(--text-muted)]/40 mb-2" />
            <p className="text-[13px] text-[var(--text-muted)]">No comments yet</p>
            <p className="text-[11px] text-[var(--text-muted)]/60 mt-1">
              Select text and click the comment button to add one
            </p>
          </div>
        ) : (
          displayedComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onResolve={onResolve}
              onReply={onReply}
            />
          ))
        )}
      </div>
    </div>
  );
}
