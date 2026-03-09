'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ArrowRight } from 'lucide-react';
import type { FormDocument, FormSubmission, FormMapping } from './constants';
import { updateFormSubmission, createTask, getFormMappings } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  submission: FormSubmission;
  form: FormDocument;
  onClose: () => void;
  onConverted: (updated: FormSubmission) => void;
}

// Apply a fieldMap to extract task fields from submission values
function applyFieldMap(
  fieldMap: Record<string, string>,
  values: Record<string, any>,
  fields: FormDocument['fields'],
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [formFieldId, taskField] of Object.entries(fieldMap)) {
    if (!taskField || !formFieldId) continue;
    const val = values[formFieldId];
    if (val !== undefined && val !== null && val !== '') {
      result[taskField] = val;
    }
  }
  return result;
}

export default function FormConversionModal({ submission, form, onClose, onConverted }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, me } = useAuth();
  const [converting, setConverting] = useState(false);
  const [mappings, setMappings] = useState<FormMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>(form.defaultMappingId || '');

  // Load available mappings
  useEffect(() => {
    getFormMappings(form.id).then((m) => {
      setMappings(m as FormMapping[]);
      if (!selectedMappingId && m.length > 0) {
        setSelectedMappingId(m[0].id);
      }
    }).catch(() => {});
  }, [form.id]);

  const selectedMapping = mappings.find(m => m.id === selectedMappingId);

  // Build initial values from mapping or defaults
  const getMappedTitle = () => {
    if (selectedMapping?.fieldMap) {
      const mapped = applyFieldMap(selectedMapping.fieldMap, submission.values || {}, form.fields);
      if (mapped.title) return String(mapped.title);
    }
    const first = form.fields[0];
    return first ? (submission.values?.[first.id] || '') : '';
  };

  const getMappedDesc = () => {
    if (selectedMapping?.fieldMap) {
      const mapped = applyFieldMap(selectedMapping.fieldMap, submission.values || {}, form.fields);
      if (mapped.description) return String(mapped.description);
    }
    return form.fields
      .map(f => `**${f.label || f.type}**: ${submission.values?.[f.id] ?? '—'}`)
      .join('\n');
  };

  const [taskTitle, setTaskTitle] = useState(getMappedTitle);
  const [taskDesc, setTaskDesc] = useState(getMappedDesc);
  const [taskPriority, setTaskPriority] = useState(selectedMapping?.defaultPriority || 'medium');
  const [taskStatus, setTaskStatus] = useState(selectedMapping?.defaultStatus || 'todo');

  // Update fields when mapping changes
  useEffect(() => {
    if (selectedMapping) {
      setTaskTitle(getMappedTitle());
      setTaskDesc(getMappedDesc());
      setTaskPriority(selectedMapping.defaultPriority || 'medium');
      setTaskStatus(selectedMapping.defaultStatus || 'todo');
    }
  }, [selectedMappingId]);

  const inputCls = 'w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3.5 py-2.5 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all';
  const labelCls = 'block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold';

  const handleConvert = async () => {
    if (submission.convertedToId) {
      toast.warning(t('conversion.alreadyConverted'));
      return;
    }
    setConverting(true);
    try {
      // Build task data with mapping defaults
      const taskData: Record<string, any> = {
        title: taskTitle || 'From form submission',
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        type: 'task',
        visibility: 'team',
        createdBy: user?.uid || '',
        createdByName: me?.displayName || '',
        teamId: selectedMapping?.targetTeamId || '',
        assignees: selectedMapping?.defaultAssignees || [],
        tags: [`form:${form.title}`, ...(selectedMapping?.defaultTags || [])],
        subtasks: (selectedMapping?.autoSubtasks || []).map((s, i) => ({
          id: `sub-${Date.now()}-${i}`,
          title: s.title,
          done: s.done ?? false,
        })),
        checklist: (selectedMapping?.autoChecklist || []).map((c, i) => ({
          id: `chk-${Date.now()}-${i}`,
          title: c.text,
          done: c.checked ?? false,
        })),
        customFields: {},
        watchers: [],
        dependencies: [],
        points: 0,
        timeEstimate: 0,
      };

      // Apply remaining mapped fields (e.g., tags, dueDate from form values)
      if (selectedMapping?.fieldMap) {
        const mapped = applyFieldMap(selectedMapping.fieldMap, submission.values || {}, form.fields);
        if (mapped.tags && typeof mapped.tags === 'string') {
          taskData.tags = [...taskData.tags, ...mapped.tags.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)];
        }
        if (mapped.dueDate) {
          const d = new Date(mapped.dueDate);
          if (!isNaN(d.getTime())) taskData.dueDate = d;
        }
      }

      const taskRef = await createTask(taskData);
      const taskId = taskRef.id;

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] shadow-modal overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t('conversion.title')}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Mapping selector */}
            {mappings.length > 0 && (
              <div>
                <label className={labelCls}>{t('conversion.mapping')}</label>
                <select className={inputCls} value={selectedMappingId} onChange={e => setSelectedMappingId(e.target.value)}>
                  <option value="">{t('conversion.noMapping')}</option>
                  {mappings.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>{t('taskCreate.titlePlaceholder')}</label>
              <input className={inputCls} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} autoFocus />
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
            <div className="rounded-xl bg-[var(--bg-tertiary)] p-4 space-y-1.5">
              <p className="text-[12px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{t('conversion.preview')}</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{taskTitle || '—'}</p>
              <p className="text-[12px] text-[var(--text-muted)] line-clamp-3">{taskDesc.slice(0, 200)}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all">
              {t('common.cancel')}
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConvert}
              disabled={converting || !taskTitle}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
            >
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {converting ? t('conversion.converting') : t('conversion.convert')}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
