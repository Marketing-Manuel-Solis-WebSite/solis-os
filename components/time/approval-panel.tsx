'use client';

// ================================================================
// Time Approval Panel — Review pending time entries
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import {
  Clock, CheckCircle2, XCircle, Loader2, MessageSquare,
  User, Calendar, Timer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeEntry {
  id: string;
  userId: string;
  taskId: string;
  date: string;
  hours: number;
  minutes: number;
  description: string;
  billable: boolean;
  teamId: string;
  approvalStatus: string;
}

interface Props {
  teamId?: string;
}

export default function ApprovalPanel({ teamId }: Props) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [commentId, setCommentId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const fetchEntries = useCallback(async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams();
      if (teamId) params.set('teamId', teamId);

      const res = await fetch(`/api/time/approvals?${params}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });

      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      toast.error(
        lang === 'es' ? 'Error al cargar' : 'Failed to load',
        lang === 'es' ? 'No se pudieron cargar las aprobaciones' : 'Could not load pending approvals',
      );
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleAction = async (entryId: string, action: 'approve' | 'reject') => {
    setProcessingId(entryId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/time/approvals', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          entryId,
          action,
          comment: commentId === entryId ? comment : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      toast.success(
        action === 'approve'
          ? (lang === 'es' ? 'Aprobado' : 'Approved')
          : (lang === 'es' ? 'Rechazado' : 'Rejected'),
      );

      // Remove from list
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setCommentId(null);
      setComment('');
    } catch {
      toast.error(lang === 'es' ? 'Error' : 'Error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">
          {lang === 'es' ? 'No hay entradas pendientes de aprobacion' : 'No pending time entries'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          {lang === 'es' ? 'Aprobaciones pendientes' : 'Pending Approvals'}
        </h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">
          {entries.length}
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {entries.map(entry => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.userId}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-2">{entry.description || (lang === 'es' ? 'Sin descripcion' : 'No description')}</p>
                <div className="flex items-center gap-4 text-[12px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {entry.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {entry.hours}h {entry.minutes}m
                  </span>
                  {entry.billable && (
                    <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-semibold">
                      {lang === 'es' ? 'Facturable' : 'Billable'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCommentId(commentId === entry.id ? null : entry.id)}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
                  title={lang === 'es' ? 'Agregar comentario' : 'Add comment'}
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleAction(entry.id, 'reject')}
                  disabled={processingId === entry.id}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                  title={lang === 'es' ? 'Rechazar' : 'Reject'}
                >
                  {processingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleAction(entry.id, 'approve')}
                  disabled={processingId === entry.id}
                  className="p-2 rounded-lg text-green-500 hover:bg-green-500/10 transition disabled:opacity-50"
                  title={lang === 'es' ? 'Aprobar' : 'Approve'}
                >
                  {processingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Comment input */}
            {commentId === entry.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-[var(--border-subtle)]"
              >
                <input
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={lang === 'es' ? 'Comentario opcional...' : 'Optional comment...'}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                />
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
