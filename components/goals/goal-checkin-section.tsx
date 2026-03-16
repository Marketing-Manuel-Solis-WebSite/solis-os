'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronDown, ChevronUp, MessageCircle, Flame, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/notifications/toast-provider';
import {
  createCheckin, getCheckins, deleteCheckin,
  type GoalCheckin, type ConfidenceLevel,
} from '@/lib/goal-checkins';
import type { Goal } from './constants';

interface Props {
  goal: Goal;
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; labelEs: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  on_track: { label: 'On Track', labelEs: 'En curso', color: '#22C55E', bg: '#22C55E20', Icon: CheckCircle2 },
  at_risk: { label: 'At Risk', labelEs: 'En riesgo', color: '#F59E0B', bg: '#F59E0B20', Icon: AlertTriangle },
  off_track: { label: 'Off Track', labelEs: 'Fuera de curso', color: '#EF4444', bg: '#EF444420', Icon: AlertTriangle },
};

function formatCheckinDate(ts: any, lang: string): string {
  const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : null);
  if (!d) return '';
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GoalCheckinSection({ goal }: Props) {
  const { t, lang } = useI18n();
  const { user, me } = useAuth();
  const toast = useToast();
  const [checkins, setCheckins] = useState<GoalCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [confidence, setConfidence] = useState<ConfidenceLevel>('on_track');
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  const loadCheckins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCheckins(goal.id, 10);
      setCheckins(data);
    } catch {
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  }, [goal.id]);

  useEffect(() => {
    loadCheckins();
  }, [loadCheckins]);

  const resetForm = () => {
    setConfidence('on_track');
    setSummary('');
    setBlockers('');
    setNextSteps('');
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await createCheckin(goal.id, {
        authorId: user?.uid || '',
        authorName: me?.displayName || '',
        confidence,
        progressSnapshot: goal.progress || 0,
        statusSnapshot: goal.status,
        summary: summary.trim(),
        blockers: blockers.trim(),
        nextSteps: nextSteps.trim(),
      });
      toast.success(lang === 'es' ? 'Check-in registrado' : 'Check-in submitted');
      resetForm();
      loadCheckins();
    } catch {
      toast.error(lang === 'es' ? 'Error al guardar' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (checkinId: string) => {
    if (!confirm(lang === 'es' ? '¿Eliminar este check-in?' : 'Delete this check-in?')) return;
    try {
      await deleteCheckin(goal.id, checkinId);
      setCheckins(prev => prev.filter(c => c.id !== checkinId));
      toast.success(lang === 'es' ? 'Check-in eliminado' : 'Check-in deleted');
    } catch {
      toast.error(lang === 'es' ? 'Error al eliminar' : 'Failed to delete');
    }
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]"
        >
          <MessageCircle className="h-3.5 w-3.5 text-[var(--accent)]" />
          Check-ins
          {checkins.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)] font-normal">({checkins.length})</span>
          )}
          {expanded ? <ChevronUp className="h-3 w-3 text-[var(--text-muted)]" /> : <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />}
        </button>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setExpanded(true); }}
            className="flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            <Plus className="h-3 w-3" /> {lang === 'es' ? 'Nuevo' : 'New'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Add form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-3 p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] space-y-3"
                >
                  {/* Confidence selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      {lang === 'es' ? 'Confianza' : 'Confidence'}
                    </label>
                    <div className="flex gap-1.5">
                      {(Object.entries(CONFIDENCE_CONFIG) as [ConfidenceLevel, typeof CONFIDENCE_CONFIG['on_track']][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setConfidence(key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                            confidence === key
                              ? 'ring-2 ring-offset-1 ring-offset-[var(--bg-base)]'
                              : 'opacity-50 hover:opacity-80'
                          }`}
                          style={{
                            backgroundColor: cfg.bg,
                            color: cfg.color,
                            ...(confidence === key ? { ringColor: cfg.color } : {}),
                          }}
                        >
                          <cfg.Icon className="h-3 w-3" />
                          {lang === 'es' ? cfg.labelEs : cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      {lang === 'es' ? 'Resumen' : 'Summary'} *
                    </label>
                    <textarea
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      placeholder={lang === 'es' ? '¿Qué progreso hubo desde el último check-in?' : 'What progress was made since last check-in?'}
                      rows={2}
                      className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]/30 resize-none"
                    />
                  </div>

                  {/* Blockers */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      {lang === 'es' ? 'Bloqueadores' : 'Blockers'}
                    </label>
                    <input
                      value={blockers}
                      onChange={e => setBlockers(e.target.value)}
                      placeholder={lang === 'es' ? 'Obstáculos actuales...' : 'Current blockers...'}
                      className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                    />
                  </div>

                  {/* Next steps */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      {lang === 'es' ? 'Próximos pasos' : 'Next Steps'}
                    </label>
                    <input
                      value={nextSteps}
                      onChange={e => setNextSteps(e.target.value)}
                      placeholder={lang === 'es' ? 'Plan para el siguiente periodo...' : 'Plan for next period...'}
                      className="w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={resetForm} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition">
                      {lang === 'es' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!summary.trim() || saving}
                      className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
                    >
                      {saving ? '...' : (lang === 'es' ? 'Enviar check-in' : 'Submit check-in')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Check-in list */}
            {loading ? (
              <div className="py-4 text-center text-[12px] text-[var(--text-muted)]">
                {lang === 'es' ? 'Cargando...' : 'Loading...'}
              </div>
            ) : checkins.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] py-2">
                {lang === 'es' ? 'No hay check-ins aún. Registra el primero.' : 'No check-ins yet. Submit the first one.'}
              </p>
            ) : (
              <div className="space-y-2">
                {checkins.map(checkin => {
                  const cfg = CONFIDENCE_CONFIG[checkin.confidence] || CONFIDENCE_CONFIG.on_track;
                  const isOwn = checkin.authorId === user?.uid;
                  return (
                    <div
                      key={checkin.id}
                      className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] group"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            <cfg.Icon className="h-2.5 w-2.5" />
                            {lang === 'es' ? cfg.labelEs : cfg.label}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">{checkin.progressSnapshot}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatCheckinDate(checkin.createdAt, lang)}
                          </span>
                          {isOwn && (
                            <button
                              onClick={() => handleDelete(checkin.id)}
                              className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Author */}
                      <p className="text-[11px] text-[var(--text-muted)] mb-1">{checkin.authorName}</p>

                      {/* Summary */}
                      <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{checkin.summary}</p>

                      {/* Blockers & next steps */}
                      {checkin.blockers && (
                        <p className="text-[12px] text-red-400 mt-1">
                          <span className="font-semibold">{lang === 'es' ? 'Bloqueadores:' : 'Blockers:'}</span> {checkin.blockers}
                        </p>
                      )}
                      {checkin.nextSteps && (
                        <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                          <span className="font-semibold">{lang === 'es' ? 'Próximos pasos:' : 'Next steps:'}</span> {checkin.nextSteps}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
