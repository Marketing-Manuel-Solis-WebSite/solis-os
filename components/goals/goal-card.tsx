'use client';
import { motion } from 'framer-motion';
import { Target, Calendar, User, MoreHorizontal, FolderOpen } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Goal } from './constants';
import { GOAL_STATUSES } from './constants';

interface Props {
  goal: Goal;
  onClick: () => void;
  onMenu: (e: React.MouseEvent) => void;
}

export default function GoalCard({ goal, onClick, onMenu }: Props) {
  const { t } = useI18n();
  const statusInfo = GOAL_STATUSES.find(s => s.value === goal.status) || GOAL_STATUSES[0];

  const dueInfo = (() => {
    if (!goal.dueDate) return null;
    const due = new Date(goal.dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: t('goals.overdue'), urgent: true };
    return { text: t('goals.daysLeft', { n: diff }), urgent: diff <= 3 };
  })();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="relative rounded-xl cursor-pointer transition-all overflow-hidden group"
      style={{
        background: 'var(--bg-elevated)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
      }}
    >
      {/* Color strip */}
      <div className="h-1.5 w-full" style={{ background: goal.color || '#7B68EE' }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate leading-snug">{goal.name}</h3>
            {goal.description && (
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{goal.description}</p>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onMenu(e); }}
            className="p-1 rounded-md text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-medium text-[var(--text-muted)]">{t('goals.progress')}</span>
            <span className="text-[12px] font-semibold" style={{ color: goal.color || '#7B68EE' }}>{goal.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(goal.progress, 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: goal.color || '#7B68EE' }}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status */}
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: statusInfo.color + '18', color: statusInfo.color }}
          >
            {t(statusInfo.labelKey)}
          </span>

          {/* Owner */}
          {goal.ownerName && (
            <div className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{goal.ownerName}</span>
            </div>
          )}

          {/* Due date */}
          {dueInfo && (
            <div className={`flex items-center gap-1 text-[12px] ${dueInfo.urgent ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
              <Calendar className="h-3 w-3" />
              <span>{dueInfo.text}</span>
            </div>
          )}

          {/* Folder */}
          {goal.goalFolder && (
            <div className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
              <FolderOpen className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{goal.goalFolder}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {goal.tags?.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {goal.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                {tag}
              </span>
            ))}
            {goal.tags.length > 3 && (
              <span className="text-[10px] text-[var(--text-muted)]">+{goal.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
