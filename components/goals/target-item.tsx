'use client';
import { motion } from 'framer-motion';
import { Trash2, Edit2, Link, CheckSquare } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { GoalTarget } from './constants';
import { TARGET_TYPES } from './constants';

interface Props {
  target: GoalTarget;
  goalColor: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function TargetItem({ target, goalColor, onEdit, onDelete }: Props) {
  const { t } = useI18n();
  const typeInfo = TARGET_TYPES.find(tt => tt.value === target.type) || TARGET_TYPES[0];
  const progress = target.targetValue > 0 ? Math.min(Math.round((target.currentValue / target.targetValue) * 100), 100) : 0;

  const formatValue = (val: number) => {
    if (target.type === 'currency') return `$${val.toLocaleString()}`;
    if (target.type === 'percentage') return `${val}%`;
    return val.toLocaleString();
  };

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-base)] hover:bg-[var(--bg-hover)] transition-all">
      {/* Type icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: goalColor + '18', color: goalColor }}
      >
        {target.type === 'tasks' ? <CheckSquare className="h-4 w-4" /> : <span className="text-sm font-bold">#</span>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{target.name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] uppercase">
            {t(typeInfo.labelKey)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: goalColor }}
            />
          </div>
          <span className="text-[12px] font-medium text-[var(--text-secondary)] shrink-0">
            {formatValue(target.currentValue)} / {formatValue(target.targetValue)}
            {target.unit && ` ${target.unit}`}
          </span>
        </div>
        {target.linkedTaskIds?.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-[var(--text-muted)]">
            <Link className="h-3 w-3" />
            <span>{target.linkedTaskIds.length} {t('goals.linkedTasks').toLowerCase()}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button onClick={onEdit} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
