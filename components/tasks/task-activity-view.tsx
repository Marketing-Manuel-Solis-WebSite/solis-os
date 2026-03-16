'use client';

// ============================================================
// Task Activity View — Full activity stream with filters by
// actor, action type, and date range. Registered in view registry.
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { Task, TaskGroup } from './constants';
import {
  Activity, Plus, Pencil, Trash2, Zap, MessageSquare,
  Filter, Clock, User,
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentOrgId } from '@/lib/org';

// ─── Types ──────────────────────────────────────────────
interface Props {
  groups: TaskGroup[];
  members: any[];
  teams: any[];
  selectedTask: Task | null;
  canUpdate: boolean;
  onSelect: (task: Task) => void;
  onUpdate: (id: string, field: string, value: any, old?: any) => void;
  onDelete: (task: Task) => void;
  onQuickCreate: (data: any) => void;
}

interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string;
  resourceName?: string;
  detail?: string;
  createdAt: any;
}

type DateFilter = '24h' | '7d' | '30d' | 'all';
type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'automation' | 'comment';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="h-3.5 w-3.5 text-[var(--success)]" />,
  update: <Pencil className="h-3.5 w-3.5 text-[var(--info)]" />,
  delete: <Trash2 className="h-3.5 w-3.5 text-[var(--error)]" />,
  automation: <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />,
  comment: <MessageSquare className="h-3.5 w-3.5 text-[var(--warning)]" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: 'var(--success)',
  update: 'var(--info)',
  delete: 'var(--error)',
  automation: 'var(--accent)',
  comment: 'var(--warning)',
};

// ─── Component ──────────────────────────────────────────
export default function TaskActivityView({ members }: Props) {
  const { lang } = useI18n();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  // Compute date threshold
  const dateThreshold = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(0);
    }
  }, [dateFilter]);

  // Real-time listener
  useEffect(() => {
    const orgId = getCurrentOrgId();
    const ref = collection(db, 'orgs', orgId, 'auditLogs');
    const q = query(
      ref,
      where('createdAt', '>=', Timestamp.fromDate(dateThreshold)),
      orderBy('createdAt', 'desc'),
      limit(200),
    );
    setLoading(true);
    const unsub = onSnapshot(q, (snap) => {
      const items: ActivityLog[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
      setLogs(items);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [dateThreshold]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = logs;
    if (actionFilter !== 'all') {
      result = result.filter(l => {
        const act = l.action?.toLowerCase() || '';
        if (actionFilter === 'create') return act.includes('create') || act.includes('created');
        if (actionFilter === 'update') return act.includes('update') || act.includes('changed') || act.includes('moved');
        if (actionFilter === 'delete') return act.includes('delete') || act.includes('removed') || act.includes('archived');
        if (actionFilter === 'automation') return act.includes('automation') || act.includes('triggered');
        if (actionFilter === 'comment') return act.includes('comment');
        return true;
      });
    }
    if (actorFilter !== 'all') {
      result = result.filter(l => l.actorId === actorFilter);
    }
    return result;
  }, [logs, actionFilter, actorFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: ActivityLog[] }[] = [];
    const dayMap = new Map<string, ActivityLog[]>();

    for (const log of filtered) {
      const d = log.createdAt?.toDate?.() || new Date();
      const key = d.toDateString();
      const list = dayMap.get(key);
      if (list) list.push(log);
      else dayMap.set(key, [log]);
    }

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const [key, items] of dayMap) {
      let label = key;
      if (key === today) label = lang === 'es' ? 'Hoy' : 'Today';
      else if (key === yesterday) label = lang === 'es' ? 'Ayer' : 'Yesterday';
      else {
        const d = new Date(key);
        label = d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      }
      groups.push({ label, items });
    }
    return groups;
  }, [filtered, lang]);

  const getActionType = (action: string): string => {
    const a = action?.toLowerCase() || '';
    if (a.includes('create') || a.includes('created')) return 'create';
    if (a.includes('delete') || a.includes('removed') || a.includes('archived')) return 'delete';
    if (a.includes('automation') || a.includes('triggered')) return 'automation';
    if (a.includes('comment')) return 'comment';
    return 'update';
  };

  const formatTime = (ts: any) => {
    const d = ts?.toDate?.();
    if (!d) return '';
    return d.toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const dateOptions: { id: DateFilter; label: string }[] = [
    { id: '24h', label: lang === 'es' ? '24h' : '24h' },
    { id: '7d', label: lang === 'es' ? '7 días' : '7 days' },
    { id: '30d', label: lang === 'es' ? '30 días' : '30 days' },
    { id: 'all', label: lang === 'es' ? 'Todo' : 'All' },
  ];

  const actionOptions: { id: ActionFilter; label: string }[] = [
    { id: 'all', label: lang === 'es' ? 'Todas' : 'All' },
    { id: 'create', label: lang === 'es' ? 'Creación' : 'Created' },
    { id: 'update', label: lang === 'es' ? 'Edición' : 'Updated' },
    { id: 'delete', label: lang === 'es' ? 'Eliminación' : 'Deleted' },
    { id: 'automation', label: lang === 'es' ? 'Automatización' : 'Automation' },
    { id: 'comment', label: lang === 'es' ? 'Comentarios' : 'Comments' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] shrink-0">
        {/* Date filter */}
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <div className="flex rounded-lg bg-[var(--bg-elevated)] shadow-card overflow-hidden">
            {dateOptions.map(o => (
              <button key={o.id} onClick={() => setDateFilter(o.id)}
                className={`px-2.5 py-1 text-[11px] font-medium transition ${
                  dateFilter === o.id
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <div className="flex rounded-lg bg-[var(--bg-elevated)] shadow-card overflow-hidden">
            {actionOptions.map(o => (
              <button key={o.id} onClick={() => setActionFilter(o.id)}
                className={`px-2.5 py-1 text-[11px] font-medium transition ${
                  actionFilter === o.id
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actor filter */}
        <div className="flex items-center gap-1">
          <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="h-7 px-2 rounded-lg bg-[var(--bg-elevated)] shadow-card text-[11px] font-medium text-[var(--text-secondary)] border-0 focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="all">{lang === 'es' ? 'Todos' : 'Everyone'}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
            ))}
          </select>
        </div>

        <span className="text-[11px] text-[var(--text-muted)] ml-auto">
          {filtered.length} {lang === 'es' ? 'eventos' : 'events'}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <Activity className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{lang === 'es' ? 'Sin actividad' : 'No activity yet'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              <h3 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {group.items.map(log => {
                  const actionType = getActionType(log.action);
                  return (
                    <div key={log.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition cursor-default">
                      {/* Action icon */}
                      <div className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (ACTION_COLORS[actionType] || 'var(--accent)') + '15' }}>
                        {ACTION_ICONS[actionType] || <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[var(--text-primary)]">
                          <span className="font-semibold">{log.actorName || lang === 'es' ? 'Sistema' : 'System'}</span>
                          {' '}
                          <span className="text-[var(--text-muted)]">{log.action}</span>
                          {log.resourceName && (
                            <>
                              {' '}
                              <span className="font-medium text-[var(--accent)]">
                                {log.resourceName}
                              </span>
                            </>
                          )}
                        </p>
                        {log.detail && (
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{log.detail}</p>
                        )}
                      </div>
                      {/* Time */}
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
