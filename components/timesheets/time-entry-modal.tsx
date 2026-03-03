'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { TimeEntry } from './constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  tasks: any[];
  editEntry?: TimeEntry | null;
  defaultDate?: string;
}

export default function TimeEntryModal({ open, onClose, onSave, tasks, editEntry, defaultDate }: Props) {
  const { t } = useI18n();
  const [taskId, setTaskId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [date, setDate] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [notes, setNotes] = useState('');
  const [billable, setBillable] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editEntry) {
      setTaskId(editEntry.taskId);
      setTaskTitle(editEntry.taskTitle);
      setDate(editEntry.date);
      setHours(editEntry.hours);
      setMinutes(editEntry.minutes);
      setNotes(editEntry.notes || '');
      setBillable(editEntry.billable);
    } else {
      setTaskId('');
      setTaskTitle('');
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setHours(0);
      setMinutes(30);
      setNotes('');
      setBillable(false);
    }
    setTaskSearch('');
    setShowTaskDropdown(false);
  }, [editEntry, open, defaultDate]);

  const filteredTasks = tasks.filter(task => {
    if (!taskSearch) return true;
    return task.title?.toLowerCase().includes(taskSearch.toLowerCase());
  }).slice(0, 15);

  const handleSave = async () => {
    if (!taskId || (hours === 0 && minutes === 0)) return;
    setSaving(true);
    await onSave({ taskId, taskTitle, date, hours, minutes, notes: notes.trim(), billable });
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
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editEntry ? t('timesheets.editEntry') : t('timesheets.logTime')}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Task selector */}
            <div className="relative">
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('timesheets.task')}</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                <input
                  value={taskTitle || taskSearch}
                  onChange={e => { setTaskSearch(e.target.value); setTaskId(''); setTaskTitle(''); setShowTaskDropdown(true); }}
                  onFocus={() => setShowTaskDropdown(true)}
                  placeholder={t('timesheets.taskPlaceholder')}
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                />
              </div>
              {showTaskDropdown && !taskId && (
                <div className="absolute z-10 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-xl bg-[var(--bg-elevated)] shadow-dropdown ring-1 ring-[var(--border-subtle)]">
                  {filteredTasks.length === 0 ? (
                    <p className="px-3 py-2 text-[13px] text-[var(--text-muted)]">{t('common.noResults')}</p>
                  ) : (
                    filteredTasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => { setTaskId(task.id); setTaskTitle(task.title); setShowTaskDropdown(false); setTaskSearch(''); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition truncate"
                      >
                        {task.title}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('timesheets.date')}</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
              />
            </div>

            {/* Hours + Minutes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('timesheets.hours')}</label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={hours}
                  onChange={e => setHours(Math.max(0, Number(e.target.value)))}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('timesheets.minutes')}</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={e => setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[13px] font-medium text-[var(--text-secondary)] block mb-1">{t('timesheets.notes')}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('timesheets.notesPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ring-1 ring-[var(--border-subtle)] focus:ring-[var(--accent)] transition resize-none"
              />
            </div>

            {/* Billable */}
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} className="rounded" />
              {t('timesheets.billable')}
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!taskId || (hours === 0 && minutes === 0) || saving}
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
