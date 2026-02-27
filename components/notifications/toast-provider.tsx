'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { onNotificationsSnapshot, type AppNotification } from '@/lib/notifications';

interface Toast {
  id: string;
  notification: AppNotification;
  timestamp: number;
}

const TOAST_DURATION = 5000;
const MAX_TOASTS = 3;

const TYPE_ICONS: Record<string, string> = {
  task_assigned: '📋',
  task_mentioned: '💬',
  task_completed: '✅',
  task_due_soon: '⏰',
  task_comment: '💬',
  channel_mention: '📣',
  channel_message: '📨',
  doc_mentioned: '📄',
  system: '⚙️',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!user) return;
    initialLoadRef.current = true;
    seenIdsRef.current = new Set();

    const unsub = onNotificationsSnapshot(user.uid, (notifs) => {
      if (initialLoadRef.current) {
        notifs.forEach(n => seenIdsRef.current.add(n.id));
        initialLoadRef.current = false;
        return;
      }

      const newOnes = notifs.filter(n => !seenIdsRef.current.has(n.id) && !n.read);
      newOnes.forEach(n => seenIdsRef.current.add(n.id));

      if (newOnes.length > 0) {
        setToasts(prev => {
          const incoming = newOnes.map(n => ({
            id: n.id,
            notification: n,
            timestamp: Date.now(),
          }));
          return [...incoming, ...prev].slice(0, MAX_TOASTS);
        });
      }
    });

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.timestamp < TOAST_DURATION));
    }, 500);
    return () => clearInterval(timer);
  }, [toasts.length]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="pointer-events-auto w-[360px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="text-lg mt-0.5 shrink-0">
                  {TYPE_ICONS[toast.notification.type] || '🔔'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
                    {toast.notification.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                    {toast.notification.message}
                  </p>
                  {toast.notification.actorName && (
                    <p className="text-[10px] text-[#D4A843] mt-1">
                      {toast.notification.actorName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(toast.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg transition shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
                className="h-0.5 bg-[#D4A843]/40 origin-left"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
