'use client';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { X, Pin } from 'lucide-react';

interface Props {
  messages: any[];
  members: any[];
  onClose: () => void;
  onUnpin: (msgId: string) => void;
}

export default function PinnedDrawer({ messages, members, onClose, onUnpin }: Props) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-[320px] shrink-0 bg-[var(--bg-elevated)] shadow-panel flex flex-col h-full overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('chat.pinnedMessages')} ({messages.length})</h3>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition">
          <X className="h-4 w-4" />
        </motion.button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-md bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
              <Pin className="h-5 w-5 text-[var(--accent)]/50" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">{t('chat.noPinnedMessages')}</p>
          </div>
        ) : messages.map((msg, i) => {
          const time = msg.createdAt?.toDate?.();
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="rounded-xl bg-[var(--bg-base)] shadow-card p-3.5 group hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">
                  {msg.displayName?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{msg.displayName}</span>
                {time && <span className="text-[12px] text-[var(--text-muted)] ml-auto">{time.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{msg.content}</p>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => onUnpin(msg.id)}
                className="mt-2 text-[12px] text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                <Pin className="h-3 w-3" /> {t('chat.unpinAction')}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
