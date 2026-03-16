'use client';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import {
  Layers, Zap, CheckSquare, FileText, FolderOpen, List,
  Scale, Code, Megaphone, Briefcase, Hash,
} from 'lucide-react';
import type { UnifiedTemplate, TemplateType } from '@/lib/template-center';

// Map icon string names to components
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Scale, Code, Megaphone, Briefcase, Layers, Zap,
  CheckSquare, FileText, FolderOpen, List, Hash,
};

// Badge colors per type
const TYPE_COLORS: Record<TemplateType, { bg: string; text: string }> = {
  space: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  list: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  task: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  doc: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  automation: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  folder: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
};

const TYPE_LABELS_ES: Record<TemplateType, string> = {
  space: 'Space',
  list: 'Lista',
  task: 'Tarea',
  doc: 'Documento',
  automation: 'Automatizacion',
  folder: 'Carpeta',
};

const TYPE_LABELS_EN: Record<TemplateType, string> = {
  space: 'Space',
  list: 'List',
  task: 'Task',
  doc: 'Document',
  automation: 'Automation',
  folder: 'Folder',
};

interface TemplateCardProps {
  template: UnifiedTemplate;
  onUse: (template: UnifiedTemplate) => void;
  index?: number;
}

export default function TemplateCard({ template, onUse, index = 0 }: TemplateCardProps) {
  const { lang } = useI18n();
  const Icon = ICON_MAP[template.icon] || Hash;
  const colors = TYPE_COLORS[template.type] || TYPE_COLORS.task;
  const typeLabel = lang === 'es' ? TYPE_LABELS_ES[template.type] : TYPE_LABELS_EN[template.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 hover:border-[var(--accent)]/30 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center shrink-0 group-hover:bg-[var(--accent)]/15 transition-colors">
          <Icon className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
            {template.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${colors.bg} ${colors.text}`}>
              {typeLabel}
            </span>
            {template.isBuiltIn && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                {lang === 'es' ? 'Integrada' : 'Built-in'}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed line-clamp-2 mb-4">
        {template.description}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
          {template.usageCount > 0
            ? `${template.usageCount} ${lang === 'es' ? 'usos' : 'uses'}`
            : lang === 'es' ? 'Sin usos' : 'No uses'
          }
        </span>
        <button
          onClick={() => onUse(template)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition opacity-0 group-hover:opacity-100"
        >
          {lang === 'es' ? 'Usar' : 'Use'}
        </button>
      </div>
    </motion.div>
  );
}
