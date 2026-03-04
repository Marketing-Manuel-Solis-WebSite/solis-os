'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Webhook, Key, Link2, Plug, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { onWebhookEventsSnapshot } from '@/lib/integrations-db';

const EVENT_ICONS: Record<string, any> = {
  'task.created': Zap,
  'task.updated': Zap,
  'task.deleted': Zap,
  'task.status_changed': Zap,
  'goal.created': Zap,
  'goal.updated': Zap,
  'goal.progress_changed': Zap,
  'form.submitted': Zap,
  'member.added': Zap,
  'member.updated': Zap,
};

const EVENT_COLORS: Record<string, string> = {
  'task.created': '#22C55E',
  'task.updated': '#3B82F6',
  'task.deleted': '#EF4444',
  'task.status_changed': '#F59E0B',
  'goal.created': '#8B5CF6',
  'goal.updated': '#8B5CF6',
  'goal.progress_changed': '#8B5CF6',
  'form.submitted': '#EC4899',
  'member.added': '#06B6D4',
  'member.updated': '#06B6D4',
};

export default function ActivityLog() {
  const { t } = useI18n();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onWebhookEventsSnapshot((items) => {
      setEvents(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const formatDate = (d: any) => {
    if (!d) return '';
    const date = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return date.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-5">{t('integ.activity.title')}</h2>

      {events.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-3">
            <Zap className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-[var(--text-muted)]">{t('integ.activity.noActivity')}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-[var(--border-subtle)]" />

          <div className="space-y-1">
            {events.map((event: any, i: number) => {
              const color = EVENT_COLORS[event.eventType] || '#7B68EE';
              const Icon = EVENT_ICONS[event.eventType] || Zap;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-3 py-3 pl-1"
                >
                  <div
                    className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 relative z-10"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {event.eventType}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatDate(event.createdAt)}</span>
                      {event.processed && (
                        <span className="text-[11px] text-green-500 font-medium">processed</span>
                      )}
                    </div>
                    {event.payload && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                        {typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload).slice(0, 120)}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
