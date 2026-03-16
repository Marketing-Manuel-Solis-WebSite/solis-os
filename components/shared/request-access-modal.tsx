'use client';

// ============================================================
// Request Access Modal — allows users to request access to
// private resources (spaces, folders, lists, docs, channels).
// ============================================================

import { useState } from 'react';
import { X, Loader2, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { requestAccess } from '@/lib/access-requests';

interface Props {
  resourceType: string;
  resourceId: string;
  resourceName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RequestAccessModal({ resourceType, resourceId, resourceName, onClose, onSuccess }: Props) {
  const { t, lang } = useI18n();
  const { user, me } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!user || !me) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestAccess(
        resourceType,
        resourceId,
        resourceName,
        user.uid,
        me.displayName || me.email || '',
        reason,
      );
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      if (err?.message === 'Request already pending') {
        setError(lang === 'es' ? 'Ya tienes una solicitud pendiente para este recurso.' : 'You already have a pending request for this resource.');
      } else {
        setError(lang === 'es' ? 'Error al enviar la solicitud.' : 'Failed to submit request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {lang === 'es' ? 'Solicitar acceso' : 'Request Access'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          /* Success state */
          <div className="px-4 py-8 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-[var(--success)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {lang === 'es' ? 'Solicitud enviada' : 'Request Submitted'}
            </p>
            <p className="text-[12px] text-[var(--text-muted)] text-center max-w-[280px]">
              {lang === 'es'
                ? 'Un administrador revisara tu solicitud pronto.'
                : 'An admin will review your request shortly.'}
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            >
              {lang === 'es' ? 'Cerrar' : 'Close'}
            </button>
          </div>
        ) : (
          /* Form */
          <div className="p-4 space-y-4">
            {/* Resource info */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {lang === 'es' ? 'Recurso' : 'Resource'}
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                <span className="text-[12px] text-[var(--text-muted)] capitalize">{resourceType}</span>
                <span className="text-[12px] text-[var(--text-muted)]">/</span>
                <span className="text-sm text-[var(--text-primary)] font-medium truncate">{resourceName}</span>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {lang === 'es' ? 'Motivo (opcional)' : 'Reason (optional)'}
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={lang === 'es' ? 'Explica por que necesitas acceso...' : 'Explain why you need access...'}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
              />
            </div>

            {error && (
              <p className="text-[12px] text-[var(--error)]">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition disabled:opacity-40 flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {lang === 'es' ? 'Solicitar' : 'Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
