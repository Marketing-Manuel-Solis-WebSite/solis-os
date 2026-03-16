'use client';

// ================================================================
// Automation Template Picker — Modal for creating automations
// from predefined templates. Grouped by category with preview.
// ================================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Users, CheckSquare, Bell, FolderOpen,
  ArrowRight, ClipboardList, Tag, Copy, Shield,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  AUTOMATION_TEMPLATES,
  getTemplateCategories,
  type AutomationTemplate,
  type AutomationTemplateCategory,
} from '@/lib/automation-templates';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (template: AutomationTemplate) => void;
}

// ---- Category display config ----
const CATEGORY_CONFIG: Record<AutomationTemplateCategory, { label: string; labelEs: string; icon: typeof Zap; color: string }> = {
  assignment: { label: 'Assignment', labelEs: 'Asignacion', icon: Users, color: '#A855F7' },
  status: { label: 'Status', labelEs: 'Estado', icon: CheckSquare, color: '#3B82F6' },
  notification: { label: 'Notification', labelEs: 'Notificacion', icon: Bell, color: '#EC4899' },
  organization: { label: 'Organization', labelEs: 'Organizacion', icon: FolderOpen, color: '#22C55E' },
  review: { label: 'Review', labelEs: 'Revision', icon: Shield, color: '#F59E0B' },
};

// ---- Trigger label mapping ----
const TRIGGER_LABELS: Record<string, { en: string; es: string }> = {
  task_created: { en: 'Task Created', es: 'Tarea creada' },
  task_status_changed: { en: 'Status Changed', es: 'Estado cambiado' },
  task_assigned: { en: 'Task Assigned', es: 'Tarea asignada' },
  task_priority_changed: { en: 'Priority Changed', es: 'Prioridad cambiada' },
  task_due_date_changed: { en: 'Due Date Changed', es: 'Fecha limite cambiada' },
  task_custom_field_changed: { en: 'Custom Field Changed', es: 'Campo personalizado cambiado' },
};

// ---- Action label mapping ----
const ACTION_LABELS: Record<string, { en: string; es: string }> = {
  change_status: { en: 'Change Status', es: 'Cambiar estado' },
  set_priority: { en: 'Set Priority', es: 'Establecer prioridad' },
  assign_user: { en: 'Assign User', es: 'Asignar usuario' },
  add_tag: { en: 'Add Tag', es: 'Agregar etiqueta' },
  remove_tag: { en: 'Remove Tag', es: 'Quitar etiqueta' },
  post_comment: { en: 'Post Comment', es: 'Publicar comentario' },
  send_notification: { en: 'Send Notification', es: 'Enviar notificacion' },
  call_webhook: { en: 'Call Webhook', es: 'Llamar webhook' },
  create_subtask: { en: 'Create Subtask', es: 'Crear subtarea' },
  archive_task: { en: 'Archive Task', es: 'Archivar tarea' },
  duplicate_task: { en: 'Duplicate Task', es: 'Duplicar tarea' },
  move_to_list: { en: 'Move to List', es: 'Mover a lista' },
};

export default function AutomationTemplatePicker({ open, onClose, onSelect }: Props) {
  const { t, lang } = useI18n();
  const [activeCategory, setActiveCategory] = useState<AutomationTemplateCategory | 'all'>('all');
  const categories = useMemo(() => getTemplateCategories(), []);

  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'all') return AUTOMATION_TEMPLATES;
    return AUTOMATION_TEMPLATES.filter(tmpl => tmpl.category === activeCategory);
  }, [activeCategory]);

  // Group templates by category for display
  const grouped = useMemo(() => {
    const map = new Map<AutomationTemplateCategory, AutomationTemplate[]>();
    for (const tmpl of filteredTemplates) {
      const existing = map.get(tmpl.category) || [];
      existing.push(tmpl);
      map.set(tmpl.category, existing);
    }
    return map;
  }, [filteredTemplates]);

  const getTriggerLabel = (trigger: string) => {
    const labels = TRIGGER_LABELS[trigger];
    return labels ? (lang === 'es' ? labels.es : labels.en) : trigger;
  };

  const getActionLabel = (type: string) => {
    const labels = ACTION_LABELS[type];
    return labels ? (lang === 'es' ? labels.es : labels.en) : type;
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
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl max-h-[80vh] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {lang === 'es' ? 'Plantillas de automatizacion' : 'Automation Templates'}
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {lang === 'es' ? 'Selecciona una plantilla para empezar rapidamente' : 'Select a template to get started quickly'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Category filter tabs */}
            <div className="flex gap-1.5 px-6 py-3 border-b border-[var(--border)] overflow-x-auto scrollbar-thin">
              <button
                onClick={() => setActiveCategory('all')}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeCategory === 'all'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {lang === 'es' ? 'Todas' : 'All'}
              </button>
              {categories.map(cat => {
                const cfg = CATEGORY_CONFIG[cat];
                const CatIcon = cfg.icon;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                      activeCategory === cat
                        ? 'text-[var(--accent-text)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                    style={activeCategory === cat ? { backgroundColor: cfg.color } : undefined}
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                    {lang === 'es' ? cfg.labelEs : cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {Array.from(grouped.entries()).map(([category, templates]) => {
                const cfg = CATEGORY_CONFIG[category];
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <cfg.icon className="h-4 w-4" style={{ color: cfg.color }} />
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
                        {lang === 'es' ? cfg.labelEs : cfg.label}
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">({templates.length})</span>
                    </div>

                    <div className="space-y-2">
                      {templates.map(tmpl => (
                        <motion.div
                          key={tmpl.id}
                          whileHover={{ scale: 1.005 }}
                          className="p-4 rounded-xl bg-[var(--bg-elevated)] shadow-card hover:shadow-md transition-all duration-200 group cursor-pointer"
                          onClick={() => onSelect(tmpl)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition">
                                {tmpl.name}
                              </h4>
                              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                                {tmpl.description}
                              </p>

                              {/* Trigger + Actions preview */}
                              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                {/* Trigger badge */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                                  <Zap className="h-3 w-3" />
                                  {getTriggerLabel(tmpl.trigger)}
                                </span>

                                <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />

                                {/* Action badges */}
                                {tmpl.actions.map((action, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-semibold"
                                  >
                                    {getActionLabel(action.type)}
                                  </span>
                                ))}

                                {/* Conditions count */}
                                {tmpl.conditions.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[11px] font-semibold">
                                    {tmpl.conditions.length} {tmpl.conditions.length === 1 ? (lang === 'es' ? 'condicion' : 'condition') : (lang === 'es' ? 'condiciones' : 'conditions')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Use Template button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(tmpl);
                              }}
                              className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)] hover:text-[var(--accent-text)] transition-all duration-200 opacity-0 group-hover:opacity-100"
                            >
                              {lang === 'es' ? 'Usar' : 'Use Template'}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--text-muted)]">
                    {lang === 'es' ? 'No hay plantillas en esta categoria' : 'No templates in this category'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
