'use client';

// ============================================================
// Live Analytics Badge — Shows refresh status indicator
// ============================================================

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { RefreshCw } from 'lucide-react';

interface Props {
  lastUpdated: Date | null;
  isStale: boolean;
  onRefresh: () => void;
  loading: boolean;
}

export default function LiveAnalyticsBadge({ lastUpdated, isStale, onRefresh, loading }: Props) {
  const { lang } = useI18n();

  const getRelativeTime = (): string => {
    if (!lastUpdated) return lang === 'es' ? 'Cargando...' : 'Loading...';
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 10) return lang === 'es' ? 'Ahora' : 'Just now';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  const dotColor = !lastUpdated ? 'bg-[var(--text-muted)]' :
    isStale ? 'bg-[var(--error)]' :
    'bg-[var(--success)]';

  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--bg-elevated)] shadow-card text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition disabled:opacity-50"
      title={lang === 'es' ? 'Actualizar' : 'Refresh'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {loading ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <span>{getRelativeTime()}</span>
      )}
    </button>
  );
}
