'use client';
import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { markNotificationRead, markAllRead, type AppNotification } from '@/lib/notifications';
import { useNotifications } from './notification-context';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';

const TYPE_LABEL_KEYS: Record<string, string> = {
  task_assigned: 'notif.typeTask',
  task_mentioned: 'notif.typeMention',
  task_completed: 'notif.typeDone',
  task_due_soon: 'notif.typeDue',
  task_comment: 'notif.typeComment',
  channel_mention: 'notif.typeChannel',
  channel_message: 'notif.typeMessage',
  doc_mentioned: 'notif.typeDoc',
  system: 'notif.typeSystem',
  goal_assigned: 'notif.typeGoalAssigned',
  goal_completed: 'notif.typeGoalCompleted',
  goal_overdue: 'notif.typeGoalOverdue',
  whiteboard_shared: 'notif.typeWhiteboardShared',
  form_submission: 'notif.typeFormSubmission',
  form_converted: 'notif.typeFormConverted',
  form_paused: 'notif.typeFormPaused',
  form_limit_reached: 'notif.typeFormLimitReached',
  integration_connected: 'notif.typeIntegrationConnected',
  integration_error: 'notif.typeIntegrationError',
  integration_disconnected: 'notif.typeIntegrationDisconnected',
  webhook_delivery_failed: 'notif.typeWebhookFailed',
  api_key_created: 'notif.typeApiKeyCreated',
};

function timeAgo(date: any, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date?.seconds ? date.seconds * 1000 : date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notif.justNow');
  if (mins < 60) return t('notif.minutesAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notif.hoursAgo', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('notif.daysAgo', { n: days });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { notifications: notifs } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifs.filter(n => !n.read).length;

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
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-[var(--error)] text-white text-[12px] font-semibold"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] rounded-xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('notif.notifications')}</h3>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="text-sm px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200 font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" /> {t('notif.markAllRead')}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-all duration-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[400px]">
              {notifs.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="h-6 w-6 text-[var(--text-muted)] mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-[var(--text-muted)]">{t('notif.noNotifications')}</p>
                </div>
              ) : (
                <>
                  {grouped.today.length > 0 && <NotifGroup label={t('notif.today')} items={grouped.today} onClick={handleClick} t={t} />}
                  {grouped.yesterday.length > 0 && <NotifGroup label={t('notif.yesterday')} items={grouped.yesterday} onClick={handleClick} t={t} />}
                  {grouped.older.length > 0 && <NotifGroup label={t('notif.earlier')} items={grouped.older} onClick={handleClick} t={t} />}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotifGroup({ label, items, onClick, t }: { label: string; items: AppNotification[]; onClick: (n: AppNotification) => void; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div>
      <div className="px-4 py-2 sticky top-0 bg-[var(--bg-elevated)]">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      </div>
      {items.map(n => (
        <button
          key={n.id}
          onClick={() => onClick(n)}
          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-[var(--bg-hover)] ${!n.read ? 'bg-[var(--accent-subtle)]' : ''}`}
        >
          {/* Type badge */}
          <span className="text-[12px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] shrink-0 mt-0.5">
            {t(TYPE_LABEL_KEYS[n.type] || 'notif.typeDefault')}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm leading-tight ${!n.read ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>
              {n.title}
            </p>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">{n.message}</p>
            <div className="flex items-center gap-2 mt-1">
              {n.actorName && <span className="text-[12px] text-[var(--text-tertiary)] font-medium">{n.actorName}</span>}
              <span className="text-[12px] text-[var(--text-muted)]">{timeAgo(n.createdAt, t)}</span>
            </div>
          </div>
          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-2" />}
        </button>
      ))}
    </div>
  );
}
