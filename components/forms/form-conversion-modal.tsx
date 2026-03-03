'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ArrowRight } from 'lucide-react';
import type { FormDocument, FormSubmission } from './constants';
import { updateFormSubmission, createTask } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  submission: FormSubmission;
  form: FormDocument;
  onClose: () => void;
  onConverted: (updated: FormSubmission) => void;
}

export default function FormConversionModal({ submission, form, onClose, onConverted }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, me } = useAuth();
  const [converting, setConverting] = useState(false);

  // Simple field mapping: form label → task property
  const [taskTitle, setTaskTitle] = useState(() => {
    const first = form.fields[0];
    return first ? (submission.values?.[first.id] || '') : '';
  });
  const [taskDesc, setTaskDesc] = useState(() => {
    return form.fields
      .map(f => `**${f.label || f.type}**: ${submission.values?.[f.id] ?? '—'}`)
      .join('\n');
  });
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskStatus, setTaskStatus] = useState('todo');

  const inputCls = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all';
  const labelCls = 'block text-[13px] font-medium text-[var(--text-secondary)] mb-1';

  const handleConvert = async () => {
    if (submission.convertedToId) {
      toast.warning(t('conversion.alreadyConverted'));
      return;
    }
    setConverting(true);
    try {
      const taskRef = await createTask({
        title: taskTitle || 'From form submission',
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        type: 'task',
        visibility: 'team',
        createdBy: user?.uid || '',
        createdByName: me?.displayName || '',
        teamId: '',
        assignees: [],
        tags: [`form:${form.title}`],
        subtasks: [],
        customFields: {},
        watchers: [],
        dependencies: [],
        points: 0,
        timeEstimate: 0,
      });

      const taskId = taskRef.id;

      // Mark submission as converted
      await updateFormSubmission(form.id, submission.id, {
        status: 'converted',
        convertedToType: 'task',
        convertedToId: taskId,
        convertedAt: new Date(),
        convertedBy: user?.uid || null,
      });

      toast.success(t('conversion.success'));
      onConverted({
        ...submission,
        status: 'converted',
        convertedToType: 'task',
        convertedToId: taskId,
        convertedAt: new Date() as any,
        convertedBy: user?.uid || null,
      });
    } catch {
      toast.error(t('conversion.error'));
    } finally {
      setConverting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('conversion.title')}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className={labelCls}>{t('taskCreate.titlePlaceholder')}</label>
              <input className={inputCls} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{t('taskCreate.description')}</label>
              <textarea className={`${inputCls} min-h-[80px] resize-y`} value={taskDesc} onChange={e => setTaskDesc(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('conversion.status')}</label>
                <select className={inputCls} value={taskStatus} onChange={e => setTaskStatus(e.target.value)}>
                  <option value="todo">{t('status.todo')}</option>
                  <option value="in_progress">{t('status.in_progress')}</option>
                  <option value="in_review">{t('status.in_review')}</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('conversion.priority')}</label>
                <select className={inputCls} value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                  <option value="urgent">{t('priority.urgent')}</option>
                  <option value="high">{t('priority.high')}</option>
                  <option value="medium">{t('priority.medium')}</option>
                  <option value="low">{t('priority.low')}</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-[var(--bg-tertiary)] p-3 space-y-1">
              <p className="text-[12px] font-semibold text-[var(--text-muted)]">{t('conversion.preview')}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{taskTitle || '—'}</p>
              <p className="text-[12px] text-[var(--text-muted)] truncate">{taskDesc.slice(0, 120)}...</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConvert}
              disabled={converting || !taskTitle}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {converting ? t('conversion.converting') : t('conversion.convert')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
