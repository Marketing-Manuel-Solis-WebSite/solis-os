'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, ExternalLink, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { onNotificationsSnapshot, markNotificationRead, markAllRead, type AppNotification } from '@/lib/notifications';
import { useRouter } from 'next/navigation';

const TYPE_ICONS: Record<string, string> = {
  task_assigned: '📋',
  task_mentioned: '💬',
  task_completed: '✅',
  task_due_soon: '⏰',
  task_comment: '💬',
  channel_mention: '📣',
  doc_mentioned: '📄',
  system: '⚙️',
};

function timeAgo(date: any): string {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date?.seconds ? date.seconds * 1000 : date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifs.filter(n => !n.read).length;

  // Real-time listener
  useEffect(() => {
    if (!user) return;
    const unsub = onNotificationsSnapshot(user.uid, setNotifs);
    return () => unsub();
  }, [user?.uid]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = useCallback(async (n: AppNotification) => {
    if (!n.read) await markNotificationRead(n.id);
    if (n.entityUrl) {
      router.push(n.entityUrl);
      setOpen(false);
    }
  }, [router]);

  const handleMarkAll = async () => {
    if (!user) return;
    await markAllRead(user.uid);
  };

  // Group by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const grouped = notifs.reduce((acc, n) => {
    const d = n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt?.seconds ? n.createdAt.seconds * 1000 : 0);
    if (d >= today) acc.today.push(n);
    else if (d >= yesterday) acc.yesterday.push(n);
    else acc.older.push(n);
    return acc;
  }, { today: [] as AppNotification[], yesterday: [] as AppNotification[], older: [] as AppNotification[] });

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition"
      >
        <Bell className="h-[18px] w-[18px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#D4A843] text-[#06080F] text-[10px] font-bold shadow-[0_0_8px_rgba(212,168,67,0.5)]"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Notifications</h3>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={handleMarkAll} className="text-[10px] px-2.5 py-1 rounded-lg bg-[#D4A843]/10 text-[#D4A843] hover:bg-[#D4A843]/20 transition font-medium flex items-center gap-1">
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[400px]">
              {notifs.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-[var(--text-muted)]">No notifications yet</p>
                </div>
              ) : (
                <>
                  {grouped.today.length > 0 && <NotifGroup label="Today" items={grouped.today} onClick={handleClick} />}
                  {grouped.yesterday.length > 0 && <NotifGroup label="Yesterday" items={grouped.yesterday} onClick={handleClick} />}
                  {grouped.older.length > 0 && <NotifGroup label="Earlier" items={grouped.older} onClick={handleClick} />}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotifGroup({ label, items, onClick }: { label: string; items: AppNotification[]; onClick: (n: AppNotification) => void }) {
  return (
    <div>
      <div className="px-5 py-2 sticky top-0 bg-[var(--bg-base)]/90 backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      </div>
      {items.map(n => (
        <motion.button
          key={n.id}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
          onClick={() => onClick(n)}
          className={`w-full flex items-start gap-3 px-5 py-3 text-left transition ${!n.read ? 'bg-[#D4A843]/[0.03]' : ''}`}
        >
          <span className="text-base mt-0.5 shrink-0">{TYPE_ICONS[n.type] || '🔔'}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs leading-tight ${!n.read ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>{n.title}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{n.message}</p>
            <div className="flex items-center gap-2 mt-1">
              {n.actorName && <span className="text-[10px] text-[#D4A843]">{n.actorName}</span>}
              <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(n.createdAt)}</span>
            </div>
          </div>
          {!n.read && <span className="w-2 h-2 rounded-full bg-[#D4A843] shrink-0 mt-1.5 shadow-[0_0_6px_rgba(212,168,67,0.5)]" />}
        </motion.button>
      ))}
    </div>
  );
}
