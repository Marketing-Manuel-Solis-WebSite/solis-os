'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useFeatureFlag } from '@/lib/feature-flags';
import { getAuditLogs } from '@/lib/db';
import { motion } from 'framer-motion';
import {
  Activity, Filter, CheckSquare, FileText, Target,
  MessageSquare, Users, Zap, Clock, Search,
  Loader2,
} from 'lucide-react';

// ─── Resource icon mapping ──────────────────────────────
const RESOURCE_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare,
  doc: FileText,
  goal: Target,
  channel: MessageSquare,
  member: Users,
  automation: Zap,
  time_entry: Clock,
};

const RESOURCE_COLORS: Record<string, string> = {
  task: 'var(--accent)',
  doc: '#8B5CF6',
  goal: '#F59E0B',
  channel: '#06B6D4',
  member: '#10B981',
  automation: '#F97316',
  time_entry: '#6366F1',
};

// ─── Action labels ──────────────────────────────────────
function actionLabel(action: string, lang: string): string {
  const map: Record<string, [string, string]> = {
    created: ['creó', 'created'],
    updated: ['actualizó', 'updated'],
    deleted: ['eliminó', 'deleted'],
    completed: ['completó', 'completed'],
    archived: ['archivó', 'archived'],
    restored_version: ['restauró versión de', 'restored version of'],
    bulk_updated: ['actualizó en lote', 'bulk updated'],
    assigned: ['asignó', 'assigned'],
    role_changed: ['cambió rol de', 'changed role of'],
  };
  const pair = map[action];
  if (pair) return lang === 'es' ? pair[0] : pair[1];
  return action;
}

function resourceLabel(resource: string, lang: string): string {
  const map: Record<string, [string, string]> = {
    task: ['tarea', 'task'],
    doc: ['documento', 'document'],
    goal: ['meta', 'goal'],
    channel: ['canal', 'channel'],
    member: ['miembro', 'member'],
    automation: ['automatización', 'automation'],
    time_entry: ['registro de tiempo', 'time entry'],
    department: ['departamento', 'department'],
    'org-chart': ['organigrama', 'org chart'],
  };
  const pair = map[resource];
  if (pair) return lang === 'es' ? pair[0] : pair[1];
  return resource;
}

function formatTimestamp(ts: any, lang: string): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : null);
  if (!d) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'es' ? 'ahora' : 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' });
}

// ─── Filters ────────────────────────────────────────────
const RESOURCE_FILTERS = ['all', 'task', 'doc', 'goal', 'channel', 'member'] as const;

export default function ActivityPage() {
  const { t, lang } = useI18n();
  const { user, me, allMembers, canSeeAllTeams, activeTeamId } = useAuth();
  const enabled = useFeatureFlag('activity-feed');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    getAuditLogs()
      .then(({ items }) => setLogs(items))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [user]);

  // Scope logs: admins see all, others see own actions + team actions
  const scopedLogs = useMemo(() => {
    if (canSeeAllTeams) return logs;
    const uid = user?.uid;
    const teamMemberIds = new Set(
      (allMembers || [])
        .filter((m: any) => m.teamId === activeTeamId || m.teamIds?.includes(activeTeamId))
        .map((m: any) => m.userId)
    );
    return logs.filter((log: any) => {
      if (log.actorId === uid) return true;
      if (log.actorId && teamMemberIds.has(log.actorId)) return true;
      if (!log.actorId || log.actorId === 'system') return true;
      return false;
    });
  }, [logs, canSeeAllTeams, user?.uid, allMembers, activeTeamId]);

  // Apply filters
  const filteredLogs = useMemo(() => {
    let result = scopedLogs;
    if (resourceFilter !== 'all') {
      result = result.filter((l: any) => l.resource === resourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l: any) =>
        l.detail?.toLowerCase().includes(q) ||
        l.actorName?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [scopedLogs, resourceFilter, searchQuery]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; items: any[] }[] = [];
    const map = new Map<string, any[]>();

    for (const log of filteredLogs) {
      const d = log.createdAt?.toDate?.() || (log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000) : null);
      if (!d) continue;
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    for (const [key, items] of map) {
      let label = key;
      if (key === today) label = lang === 'es' ? 'Hoy' : 'Today';
      else if (key === yesterday) label = lang === 'es' ? 'Ayer' : 'Yesterday';
      else {
        const d = new Date(key + 'T00:00:00');
        label = d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      }
      groups.push({ date: key, label, items });
    }

    return groups;
  }, [filteredLogs, lang]);

  if (!enabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es' ? 'Función no disponible' : 'Feature not available'}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[900px] mx-auto px-6 pt-5 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--accent)]" />
            {lang === 'es' ? 'Actividad' : 'Activity'}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            {lang === 'es' ? 'Historial de acciones en tu espacio de trabajo' : 'Action history in your workspace'}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === 'es' ? 'Buscar actividad...' : 'Search activity...'}
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
          />
        </div>

        {/* Resource filter pills */}
        <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden">
          {RESOURCE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setResourceFilter(f)}
              className={`px-3 py-1.5 text-[12px] font-medium transition ${
                resourceFilter === f
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {f === 'all'
                ? (lang === 'es' ? 'Todo' : 'All')
                : resourceLabel(f, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* Activity stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-muted)]">{lang === 'es' ? 'Cargando...' : 'Loading...'}</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Activity className="h-10 w-10 text-[var(--text-muted)] opacity-30" />
          <p className="text-sm text-[var(--text-muted)]">
            {searchQuery
              ? (lang === 'es' ? 'Sin resultados' : 'No results')
              : (lang === 'es' ? 'Sin actividad reciente' : 'No recent activity')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                <span className="text-[11px] text-[var(--text-muted)]">
                  {group.items.length} {lang === 'es' ? 'acciones' : 'actions'}
                </span>
              </div>

              {/* Log items */}
              <div className="space-y-1">
                {group.items.map((log: any) => {
                  const Icon = RESOURCE_ICONS[log.resource] || Activity;
                  const color = RESOURCE_COLORS[log.resource] || 'var(--text-muted)';
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-hover)] transition group"
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: color + '15' }}
                      >
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-relaxed">
                          <span className="font-semibold text-[var(--text-primary)]">{log.actorName || 'System'}</span>
                          {' '}
                          <span className="text-[var(--text-muted)]">{actionLabel(log.action, lang)}</span>
                          {' '}
                          <span className="text-[var(--text-secondary)]">{resourceLabel(log.resource, lang)}</span>
                        </p>
                        {log.detail && (
                          <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{log.detail}</p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className="text-[11px] text-[var(--text-muted)] shrink-0 mt-1">
                        {formatTimestamp(log.createdAt, lang)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
