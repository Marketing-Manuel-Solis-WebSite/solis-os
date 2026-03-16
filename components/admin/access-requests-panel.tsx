'use client';

// ============================================================
// Access Requests Panel — admin panel showing pending requests
// with approve/deny actions. Designed for the admin settings area.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldX, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  getPendingRequests,
  getAllRequests,
  approveRequest,
  denyRequest,
  type AccessRequest,
} from '@/lib/access-requests';

type Tab = 'pending' | 'all';

export default function AccessRequestsPanel() {
  const { t, lang } = useI18n();
  const { user, me, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === 'pending' ? await getPendingRequests() : await getAllRequests();
      setRequests(data);
    } catch {
      setRequests([]);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = async (req: AccessRequest) => {
    if (!user || !me) return;
    setActionLoading(req.id);
    try {
      await approveRequest(req.id, user.uid, me.displayName || me.email || '', reviewNotes[req.id]);
      await loadRequests();
    } catch {
      // silent
    }
    setActionLoading(null);
  };

  const handleDeny = async (req: AccessRequest) => {
    if (!user || !me) return;
    setActionLoading(req.id);
    try {
      await denyRequest(req.id, user.uid, me.displayName || me.email || '', reviewNotes[req.id]);
      await loadRequests();
    } catch {
      // silent
    }
    setActionLoading(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)]">
            <Clock className="h-3 w-3" />
            {lang === 'es' ? 'Pendiente' : 'Pending'}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--success)]/10 text-[var(--success)]">
            <CheckCircle className="h-3 w-3" />
            {lang === 'es' ? 'Aprobado' : 'Approved'}
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)]">
            <XCircle className="h-3 w-3" />
            {lang === 'es' ? 'Denegado' : 'Denied'}
          </span>
        );
      default:
        return null;
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
        <ShieldX className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">{lang === 'es' ? 'Acceso denegado' : 'Access denied'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {lang === 'es' ? 'Solicitudes de acceso' : 'Access Requests'}
          </h3>
        </div>
        <button
          onClick={loadRequests}
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          title={lang === 'es' ? 'Actualizar' : 'Refresh'}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden w-fit">
        {(['pending', 'all'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t === 'pending'
              ? (lang === 'es' ? 'Pendientes' : 'Pending')
              : (lang === 'es' ? 'Todas' : 'All')}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
          <ShieldCheck className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">
            {tab === 'pending'
              ? (lang === 'es' ? 'No hay solicitudes pendientes' : 'No pending requests')
              : (lang === 'es' ? 'No hay solicitudes' : 'No requests')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <div key={req.id} className="rounded-xl bg-[var(--bg-elevated)] shadow-card p-4 space-y-3">
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {req.requesterName}
                    </span>
                    {statusBadge(req.status)}
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    <span className="capitalize">{req.resourceType}</span>
                    <span className="mx-1">/</span>
                    <span className="font-medium text-[var(--text-secondary)]">{req.resourceName}</span>
                  </p>
                  {req.reason && (
                    <p className="text-[12px] text-[var(--text-muted)] mt-1 italic">
                      &quot;{req.reason}&quot;
                    </p>
                  )}
                  {req.createdAt?.toDate && (
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      {req.createdAt.toDate().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Review note + actions (only for pending) */}
              {req.status === 'pending' && (
                <div className="space-y-2">
                  <input
                    value={reviewNotes[req.id] || ''}
                    onChange={e => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    placeholder={lang === 'es' ? 'Nota de revision (opcional)' : 'Review note (optional)'}
                    className="w-full h-8 px-3 rounded-lg bg-[var(--bg-tertiary)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-[12px] font-medium hover:bg-[var(--success)]/20 transition disabled:opacity-40"
                    >
                      {actionLoading === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      {lang === 'es' ? 'Aprobar' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDeny(req)}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--error)]/10 text-[var(--error)] text-[12px] font-medium hover:bg-[var(--error)]/20 transition disabled:opacity-40"
                    >
                      {actionLoading === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      {lang === 'es' ? 'Denegar' : 'Deny'}
                    </button>
                  </div>
                </div>
              )}

              {/* Review info (for reviewed requests) */}
              {req.status !== 'pending' && req.reviewerName && (
                <div className="text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-2">
                  {lang === 'es' ? 'Revisado por' : 'Reviewed by'}{' '}
                  <span className="font-medium text-[var(--text-secondary)]">{req.reviewerName}</span>
                  {req.reviewNote && <span className="ml-1">— {req.reviewNote}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
