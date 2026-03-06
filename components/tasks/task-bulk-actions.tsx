'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ArrowRight, Flag, UserPlus, Calendar, FolderInput, Archive } from 'lucide-react';
import { STATUSES, PRIORITIES } from './constants';

interface Props {
  count: number;
  members: any[];
  teams: any[];
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
  onAssigneeAdd: (userId: string) => void;
  onTeamChange: (teamId: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}

function DropUp({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl shadow-dropdown p-1.5 min-w-[180px] z-50"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TaskBulkActions({
  count,
  members,
  teams,
  onStatusChange,
  onPriorityChange,
  onAssigneeAdd,
  onTeamChange,
  onArchive,
  onDelete,
  onClear,
}: Props) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="sticky bottom-4 mx-auto w-fit bg-[var(--bg-elevated)] shadow-xl rounded-2xl px-6 py-4 flex items-center gap-4 z-20"
    >
      {/* Count badge */}
      <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[var(--accent)] text-[var(--accent-text)] text-[13px] font-bold">
        {count}
      </span>
      <span className="text-[14px] font-medium text-[var(--text-secondary)]">
        {t('tasks.count', { n: count })}
      </span>

      <div className="h-6 w-px bg-[var(--border)]" />

      {/* Status change */}
      <DropUp icon={<ArrowRight className="h-3.5 w-3.5" />} label={t('taskCreate.status')}>
        {STATUSES.map(s => (
          <button
            key={s.id}
            onClick={() => onStatusChange(s.id)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[13px] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {t(`status.${s.id}`)}
          </button>
        ))}
      </DropUp>

      {/* Priority change */}
      <DropUp icon={<Flag className="h-3.5 w-3.5" />} label={t('taskCreate.priority')}>
        {PRIORITIES.map(p => (
          <button
            key={p.id}
            onClick={() => onPriorityChange(p.id)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[13px] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <span className="text-xs">{p.icon}</span>
            {t(`priority.${p.id}`)}
          </button>
        ))}
      </DropUp>

      {/* Assign to */}
      <DropUp icon={<UserPlus className="h-3.5 w-3.5" />} label={t('taskCreate.assignees')}>
        {members.length > 0 ? (
          members.map(m => (
            <button
              key={m.id}
              onClick={() => onAssigneeAdd(m.id)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[13px] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
            >
              {m.photoURL ? (
                <img src={m.photoURL} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center shrink-0">
                  {(m.displayName || m.email || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="truncate">{m.displayName || m.email}</span>
            </button>
          ))
        ) : (
          <div className="px-3.5 py-2 text-[13px] text-[var(--text-muted)]">
            {t('common.noResults')}
          </div>
        )}
      </DropUp>

      {/* Move to team */}
      <DropUp icon={<FolderInput className="h-3.5 w-3.5" />} label={t('taskCreate.department')}>
        {teams.length > 0 ? (
          teams.map(team => (
            <button
              key={team.id}
              onClick={() => onTeamChange(team.id)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-[13px] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
            >
              <span className="truncate">{team.name || team.id}</span>
            </button>
          ))
        ) : (
          <div className="px-3.5 py-2 text-[13px] text-[var(--text-muted)]">
            {t('common.noResults')}
          </div>
        )}
      </DropUp>

      {/* Archive */}
      <button
        onClick={onArchive}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Archive className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('common.archive')}</span>
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--error)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('common.delete')}</span>
      </button>

      <div className="h-6 w-px bg-[var(--border)]" />

      {/* Clear selection */}
      <button
        onClick={onClear}
        className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        title={t('common.clearSelection')}
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
