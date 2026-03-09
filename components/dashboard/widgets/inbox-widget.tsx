'use client';
import { memo, useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { WidgetShell } from '../widget-shell';
import { Inbox, Clock, AlertTriangle, Target, CheckCircle2, Archive, Bell } from 'lucide-react';
import { getInboxItems, archiveInboxItem, markInboxDone, generateInboxItems, type InboxItem } from '@/lib/inbox-db';
import type { WidgetProps } from '@/lib/dashboard-types';

const TYPE_ICONS: Record<string, any> = {
  overdue_task: AlertTriangle,
  deadline_tomorrow: Clock,
  goal_at_risk: Target,
  mention: Bell,
  approval: CheckCircle2,
};

const TYPE_COLORS: Record<string, string> = {
  overdue_task: '#EF4444',
  deadline_tomorrow: '#F59E0B',
  goal_at_risk: '#F97316',
  mention: '#3B82F6',
  approval: '#22C55E',
};

function InboxWidgetInner({ user, tasks, goals }: WidgetProps) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await generateInboxItems(user.uid, tasks, goals, lang as 'es' | 'en');
      const result = await getInboxItems(user.uid);
      setItems(result.items);
      setHasMore(result.hasMore);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user?.uid, tasks, goals]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDone = async (id: string) => {
    await markInboxDone(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleArchive = async (id: string) => {
    await archiveInboxItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <WidgetShell
      title={t('dashboard.widget.inbox')}
      icon={<Inbox className="h-4 w-4" />}
      loading={loading}
      noPadding
      headerRight={
        items.length > 0 ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">
            {items.length}
          </span>
        ) : null
      }
    >
      <div className="overflow-y-auto h-full scrollbar-thin">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <Inbox className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
            <p className="text-[13px] text-[var(--text-muted)]">{t('dashboard.widget.inboxEmpty')}</p>
          </div>
        ) : (
          items.slice(0, 8).map(item => {
            const Icon = TYPE_ICONS[item.type] || Bell;
            const color = TYPE_COLORS[item.type] || '#3B82F6';
            return (
              <div key={item.id} className="px-4 py-3 flex items-start gap-3 hover:bg-[var(--bg-hover)] transition group border-b border-[var(--border-subtle)]/40">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${color}12` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] leading-snug font-medium">{item.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{item.message}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button
                    onClick={() => handleDone(item.id)}
                    className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-[var(--text-muted)] hover:text-emerald-500 transition"
                    title={t('inbox.done')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchive(item.id)}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                    title={t('inbox.archive')}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
        {hasMore && items.length > 0 && (
          <p className="text-[11px] text-[var(--text-muted)] text-center py-2 border-t border-[var(--border-subtle)]/40">{t('inbox.morePending')}</p>
        )}
      </div>
    </WidgetShell>
  );
}

export const InboxWidget = memo(InboxWidgetInner);
