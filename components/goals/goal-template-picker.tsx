'use client';

// ================================================================
// Goal Template Picker — Modal for creating goals from templates
// Shows built-in + custom templates, with name/owner override form.
// ================================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Target, DollarSign, Zap, Heart, TrendingUp,
  FileText, ArrowRight, Check,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/notifications/toast-provider';
import {
  getTemplates, createGoalFromTemplate,
  type GoalTemplate, type TemplateCategory,
} from '@/lib/goal-templates';
import { afterGoalCreated } from '@/lib/goal-side-effects';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void; // refresh goals list after creation
}

// Icon mapping for template icons
const ICON_MAP: Record<string, typeof Target> = {
  DollarSign, Target, Zap, Heart, TrendingUp, FileText,
};

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; labelEs: string; color: string }> = {
  revenue: { label: 'Revenue', labelEs: 'Ingresos', color: '#22C55E' },
  okr: { label: 'OKR', labelEs: 'OKR', color: '#3B82F6' },
  sprint: { label: 'Sprint', labelEs: 'Sprint', color: '#8B5CF6' },
  health: { label: 'Health', labelEs: 'Salud', color: '#EC4899' },
  growth: { label: 'Growth', labelEs: 'Crecimiento', color: '#F59E0B' },
  team: { label: 'Team', labelEs: 'Equipo', color: '#06B6D4' },
  custom: { label: 'Custom', labelEs: 'Personalizado', color: '#64748B' },
};

export default function GoalTemplatePicker({ open, onClose, onCreated }: Props) {
  const { lang } = useI18n();
  const { user, me, activeTeamId } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GoalTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state for creation step
  const [goalName, setGoalName] = useState('');
  const [dueDate, setDueDate] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setSelected(null);
      setGoalName('');
      setDueDate('');
    }
  }, [open, loadTemplates]);

  const handleSelectTemplate = (tmpl: GoalTemplate) => {
    setSelected(tmpl);
    setGoalName(tmpl.name);
    setDueDate('');
  };

  const handleBack = () => {
    setSelected(null);
    setGoalName('');
    setDueDate('');
  };

  const handleCreate = async () => {
    if (!selected || !goalName.trim()) return;
    setCreating(true);
    try {
      const { goalId } = await createGoalFromTemplate(selected, {
        name: goalName.trim(),
        ownerId: user?.uid || '',
        ownerName: me?.displayName || '',
        teamId: activeTeamId === '__all__' ? '' : activeTeamId,
        dueDate: dueDate || undefined,
        createdBy: user?.uid || '',
        createdByName: me?.displayName || '',
      });

      await afterGoalCreated({
        goalId,
        goal: { name: goalName.trim(), status: selected.defaultStatus },
        actor: { actorId: user?.uid || '', actorName: me?.displayName || '' },
      });

      toast.success(lang === 'es' ? 'Meta creada desde plantilla' : 'Goal created from template');
      onCreated();
      onClose();
    } catch {
      toast.error(lang === 'es' ? 'Error al crear meta' : 'Failed to create goal');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--bg-elevated)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[var(--accent)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {selected
                    ? (lang === 'es' ? 'Crear desde plantilla' : 'Create from template')
                    : (lang === 'es' ? 'Plantillas de metas' : 'Goal Templates')
                  }
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
                </div>
              ) : selected ? (
                /* ─── Creation form ─── */
                <div className="space-y-4">
                  {/* Template preview */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: selected.color + '20' }}
                    >
                      {(() => {
                        const Icon = ICON_MAP[selected.icon] || Target;
                        return <Icon className="h-5 w-5" style={{ color: selected.color }} />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.name}</p>
                      <p className="text-[12px] text-[var(--text-muted)] truncate">{selected.description}</p>
                    </div>
                    <button onClick={handleBack} className="text-[12px] text-[var(--accent)] hover:underline shrink-0">
                      {lang === 'es' ? 'Cambiar' : 'Change'}
                    </button>
                  </div>

                  {/* Name input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      {lang === 'es' ? 'Nombre de la meta' : 'Goal name'} *
                    </label>
                    <input
                      value={goalName}
                      onChange={e => setGoalName(e.target.value)}
                      placeholder={lang === 'es' ? 'Ej: Alcanzar $50k MRR en Q2' : 'E.g., Reach $50k MRR in Q2'}
                      className="w-full h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                      autoFocus
                    />
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      {lang === 'es' ? 'Fecha limite' : 'Due date'}
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
                    />
                  </div>

                  {/* Targets preview */}
                  {selected.defaultTargets.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                        {lang === 'es' ? 'Metricas incluidas' : 'Included targets'}
                      </label>
                      <div className="space-y-1">
                        {selected.defaultTargets.map((target, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]/50">
                            <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                            <span className="text-[13px] text-[var(--text-secondary)] flex-1">{target.name}</span>
                            <span className="text-[12px] text-[var(--text-muted)]">
                              {target.targetValue} {target.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags preview */}
                  {selected.defaultTags.length > 0 && (
                    <div className="flex gap-1.5">
                      {selected.defaultTags.map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ─── Template grid ─── */
                <div className="grid grid-cols-2 gap-3">
                  {templates.map(tmpl => {
                    const catCfg = CATEGORY_CONFIG[tmpl.category] || CATEGORY_CONFIG.custom;
                    const Icon = ICON_MAP[tmpl.icon] || Target;
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => handleSelectTemplate(tmpl)}
                        className="text-left p-4 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)] transition group"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: tmpl.color + '20' }}
                          >
                            <Icon className="h-4.5 w-4.5" style={{ color: tmpl.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition">
                              {tmpl.name}
                            </p>
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md inline-block mt-0.5"
                              style={{ backgroundColor: catCfg.color + '20', color: catCfg.color }}
                            >
                              {lang === 'es' ? catCfg.labelEs : catCfg.label}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition shrink-0 mt-1" />
                        </div>
                        <p className="text-[12px] text-[var(--text-muted)] line-clamp-2">{tmpl.description}</p>
                        {tmpl.defaultTargets.length > 0 && (
                          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                            {tmpl.defaultTargets.length} {lang === 'es' ? 'metricas' : 'targets'}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer (only in creation step) */}
            {selected && (
              <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[var(--border-subtle)]">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
                >
                  {lang === 'es' ? 'Volver' : 'Back'}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!goalName.trim() || creating}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  {lang === 'es' ? 'Crear meta' : 'Create goal'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
