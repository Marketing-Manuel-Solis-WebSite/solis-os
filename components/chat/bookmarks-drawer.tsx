'use client';

// ================================================================
// Chat Bookmarks Drawer — View and manage saved messages
// ================================================================

import { useEffect, useState, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bookmark, Trash2, Hash, MessageSquare } from 'lucide-react';
import { onBookmarksSnapshot, removeBookmark } from '@/lib/db';

interface Props {
  onClose: () => void;
  onJumpToMessage?: (channelId: string, messageId: string) => void;
}

export default function BookmarksDrawer({ onClose, onJumpToMessage }: Props) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
    unsubRef.current = onBookmarksSnapshot(user.uid, (items) => {
      setBookmarks(items);
      setLoading(false);
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [user?.uid]);

  const handleRemove = async (bookmarkId: string) => {
    if (!user) return;
    await removeBookmark(user.uid, bookmarkId);
  };

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-[320px] shrink-0 bg-[var(--bg-elevated)] shadow-panel flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {lang === 'es' ? 'Guardados' : 'Bookmarks'} ({bookmarks.length})
          </h3>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-xl bg-[var(--bg-base)] p-3.5">
                <div className="h-3 w-20 skeleton rounded mb-2" />
                <div className="h-4 skeleton rounded" style={{ width: `${50 + i * 15}%` }} />
              </div>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-md bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
              <Bookmark className="h-5 w-5 text-[var(--accent)]/50" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {lang === 'es' ? 'Sin mensajes guardados' : 'No bookmarked messages'}
            </p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              {lang === 'es'
                ? 'Guarda mensajes importantes para acceder después'
                : 'Save important messages to access later'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {bookmarks.map((bm, i) => {
              const time = bm.createdAt?.toDate?.()
                || (bm.createdAt?.seconds ? new Date(bm.createdAt.seconds * 1000) : null);

              return (
                <motion.div
                  key={bm.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="rounded-xl bg-[var(--bg-base)] shadow-card p-3.5 group hover:shadow-md transition-all duration-200"
                >
                  {/* Channel name + time */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Hash className="h-3 w-3 text-[var(--text-muted)]" />
                    <span className="text-[12px] font-semibold text-[var(--text-muted)]">
                      {bm.channelName || (lang === 'es' ? 'Canal' : 'Channel')}
                    </span>
                    {time && (
                      <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                        {time.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Message preview */}
                  <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                    {bm.preview || (lang === 'es' ? '(sin contenido)' : '(no content)')}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                    {onJumpToMessage && (
                      <button
                        onClick={() => onJumpToMessage(bm.channelId, bm.messageId)}
                        className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {lang === 'es' ? 'Ir al mensaje' : 'Go to message'}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(bm.id)}
                      className="ml-auto text-[12px] text-[var(--text-muted)] hover:text-red-400 flex items-center gap-1 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                      {lang === 'es' ? 'Quitar' : 'Remove'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
