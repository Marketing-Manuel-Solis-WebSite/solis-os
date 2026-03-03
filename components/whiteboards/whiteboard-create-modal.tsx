'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import type { Whiteboard } from './constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editBoard?: Whiteboard | null;
}

export default function WhiteboardCreateModal({ open, onClose, onSave, editBoard }: Props) {
  const { t } = useI18n();
  const { me, teams, activeTeamId } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editBoard) {
      setName(editBoard.name);
      setDescription(editBoard.description || '');
      setTeamId(editBoard.teamId);
    } else {
      setName('');
      setDescription('');
      setTeamId(activeTeamId === '__all__' ? '' : activeTeamId);
    }
  }, [editBoard, open, activeTeamId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: description.trim(), teamId });
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editBoard ? t('whiteboards.editBoard') : t('whiteboards.createBoard')}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('whiteboards.name')}</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('whiteboards.namePlaceholder')}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.description')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('whiteboards.descPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition resize-none"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('goals.team')}</label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
              >
                <option value="">{t('common.general')}</option>
                {teams.map(tm => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
