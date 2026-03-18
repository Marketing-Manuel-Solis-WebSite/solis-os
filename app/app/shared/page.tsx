'use client';

import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState, useMemo } from 'react';
import { getSharedItems, type SharedItem } from '@/lib/shared-items';
import { useRouter } from 'next/navigation';
import {
  Share2, CheckCircle2, FileText, Target, Search, Filter,
  Loader2, Inbox, ChevronRight, PenTool,
} from 'lucide-react';

const TYPE_ICONS: Record<string, any> = {
  task: CheckCircle2,
  doc: FileText,
  goal: Target,
  whiteboard: PenTool,
};

const TYPE_COLORS: Record<string, string> = {
  task: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  doc: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  goal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  whiteboard: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

export default function SharedWithMePage() {
  const { user, me, teams, getMemberById } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Compute user's team IDs
  const userTeamIds = useMemo(() => {
    if (!me) return [];
    const ids: string[] = [];
    if (me.teamId) ids.push(me.teamId);
    if (me.teamIds) ids.push(...me.teamIds);
    return ids;
  }, [me]);

  // Load shared items
  useEffect(() => {
    if (!user?.uid || !me) return;
    setLoading(true);
    getSharedItems(user.uid, userTeamIds)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user?.uid, me, userTeamIds]);

  // Resolve space names
  const spaceNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (teams || []).forEach((t: any) => { map[t.id] = t.name; });
    return map;
  }, [teams]);

  // Filter items
  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter !== 'all') {
      result = result.filter(i => i.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.subtitle || '').toLowerCase().includes(q) ||
        (spaceNameMap[i.spaceId || ''] || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, typeFilter, search, spaceNameMap]);

  // Counts per type
  const counts = useMemo(() => {
    const c = { all: items.length, task: 0, doc: 0, goal: 0, whiteboard: 0 };
    items.forEach(i => { if (i.type in c) (c as any)[i.type]++; });
    return c;
  }, [items]);

  // Navigate to item — deep-link to specific entity
  const goToItem = (item: SharedItem) => {
    switch (item.type) {
      case 'task': router.push(`/app/tasks?taskId=${item.id}`); break;
      case 'doc': router.push(`/app/docs?id=${item.id}`); break;
      case 'goal': router.push(`/app/goals?goalId=${item.id}`); break;
      case 'whiteboard': router.push(`/app/whiteboards?id=${item.id}`); break;
    }
  };

  const getCreatorName = (id?: string) => {
    if (!id) return '';
    const m = getMemberById(id);
    return m?.displayName || m?.email || '';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
          <Share2 className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('shared.title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('shared.description')}</p>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'task', 'doc', 'goal', 'whiteboard'] as const).map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition border ${
              typeFilter === type
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]/30'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {type === 'all' ? t('common.all') : type === 'task' ? t('nav.tasks') : type === 'doc' ? t('nav.docs') : type === 'goal' ? t('nav.goals') : 'Whiteboards'}
            <span className="ml-1.5 text-[11px] opacity-70">{(counts as any)[type]}</span>
          </button>
        ))}

        {/* Search */}
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="input-dark pl-10 w-64"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-[var(--accent)] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-[var(--bg-secondary)] shadow-card p-12 text-center">
          <Inbox className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">
            {items.length === 0
              ? t('shared.empty')
              : t('shared.noResults')}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(item => {
            const Icon = TYPE_ICONS[item.type] || CheckCircle2;
            const colors = TYPE_COLORS[item.type] || '';
            const spaceName = spaceNameMap[item.spaceId || ''];
            const creator = getCreatorName(item.createdBy);
            const time = item.updatedAt?.toDate?.()?.toLocaleDateString?.() || '';

            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => goToItem(item)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] shadow-card hover:bg-[var(--bg-elevated)] transition group text-left"
              >
                {/* Type icon */}
                <div className={`p-2 rounded-lg border shrink-0 ${colors}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                    {spaceName && <span className="truncate">{spaceName}</span>}
                    {spaceName && creator && <span>·</span>}
                    {creator && <span>{creator}</span>}
                    {time && <span>· {time}</span>}
                    {item.status && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[10px]">
                        {item.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
