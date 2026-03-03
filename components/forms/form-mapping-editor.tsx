'use client';
import { useState } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import type { FormDocument, FormMapping } from './constants';
import { createFormMapping, updateFormMapping, deleteFormMapping } from '@/lib/db';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import { useAuth } from '@/lib/auth';

interface Props {
  form: FormDocument;
  mapping: FormMapping | null;
  onSaved: (mapping: FormMapping) => void;
  onDeleted: () => void;
}

export default function FormMappingEditor({ form, mapping, onSaved, onDeleted }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(mapping?.name || '');
  const [entityType, setEntityType] = useState(mapping?.entityType || 'task');
  const [defaultStatus, setDefaultStatus] = useState(mapping?.defaultStatus || 'todo');
  const [defaultPriority, setDefaultPriority] = useState(mapping?.defaultPriority || 'medium');
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(mapping?.fieldMap || {});
  const [autoSubtasks, setAutoSubtasks] = useState(mapping?.autoSubtasks || []);
  const [autoChecklist, setAutoChecklist] = useState(mapping?.autoChecklist || []);

  const inputCls = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:border-[var(--accent)] outline-none transition-all';
  const labelCls = 'block text-[13px] font-medium text-[var(--text-secondary)] mb-1';

  const entityFields = ['title', 'description', 'priority', 'status', 'tags', 'assignees'];

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        name,
        entityType,
        targetTeamId: '',
        defaultStatus,
        defaultPriority,
        defaultAssignees: [],
        defaultTags: [],
        fieldMap,
        autoSubtasks,
        autoChecklist,
        createdBy: user?.uid || '',
      };
      if (mapping?.id) {
        await updateFormMapping(form.id, mapping.id, data);
        onSaved({ ...mapping, ...data } as FormMapping);
      } else {
        const ref = await createFormMapping(form.id, data);
        onSaved({ id: ref.id, ...data, createdAt: new Date(), updatedAt: new Date() } as FormMapping);
      }
      toast.success(t('tasks.updated'));
    } catch {
      toast.error(t('conversion.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!mapping?.id) return;
    if (!confirm(t('mapping.deleteConfirm'))) return;
    try {
      await deleteFormMapping(form.id, mapping.id);
      toast.success(t('common.delete'));
      onDeleted();
    } catch {
      toast.error(t('conversion.error'));
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('mapping.title')}</h3>

      <div>
        <label className={labelCls}>{t('mapping.name')}</label>
        <input className={inputCls} placeholder={t('mapping.namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('conversion.status')}</label>
          <select className={inputCls} value={defaultStatus} onChange={e => setDefaultStatus(e.target.value)}>
            <option value="todo">{t('status.todo')}</option>
            <option value="in_progress">{t('status.in_progress')}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('conversion.priority')}</label>
          <select className={inputCls} value={defaultPriority} onChange={e => setDefaultPriority(e.target.value)}>
            <option value="urgent">{t('priority.urgent')}</option>
            <option value="high">{t('priority.high')}</option>
            <option value="medium">{t('priority.medium')}</option>
            <option value="low">{t('priority.low')}</option>
          </select>
        </div>
      </div>

      {/* Field mapping */}
      <div className="space-y-2">
        <label className={labelCls}>{t('conversion.fieldMapping')}</label>
        {form.fields.map(field => (
          <div key={field.id} className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-secondary)] w-32 truncate shrink-0">{field.label || field.type}</span>
            <span className="text-[var(--text-muted)]">→</span>
            <select
              className={`${inputCls} flex-1`}
              value={fieldMap[field.id] || ''}
              onChange={e => setFieldMap(prev => ({ ...prev, [field.id]: e.target.value }))}
            >
              <option value="">—</option>
              {entityFields.map(ef => (
                <option key={ef} value={ef}>{ef}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Auto subtasks */}
      <div className="space-y-2">
        <label className={labelCls}>{t('mapping.autoSubtasks')}</label>
        {autoSubtasks.map((st, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={st.title}
              onChange={e => { const n = [...autoSubtasks]; n[i] = { ...n[i], title: e.target.value }; setAutoSubtasks(n); }}
            />
            <button onClick={() => setAutoSubtasks(autoSubtasks.filter((_, j) => j !== i))} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setAutoSubtasks([...autoSubtasks, { title: '', done: false }])}
          className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> {t('mapping.addSubtask')}
        </button>
      </div>

      {/* Auto checklist */}
      <div className="space-y-2">
        <label className={labelCls}>{t('mapping.autoChecklist')}</label>
        {autoChecklist.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={item.text}
              onChange={e => { const n = [...autoChecklist]; n[i] = { ...n[i], text: e.target.value }; setAutoChecklist(n); }}
            />
            <button onClick={() => setAutoChecklist(autoChecklist.filter((_, j) => j !== i))} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setAutoChecklist([...autoChecklist, { text: '', checked: false }])}
          className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> {t('mapping.addCheckItem')}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
        <button
          onClick={handleSave}
          disabled={saving || !name}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('mapping.save')}
        </button>
        {mapping?.id && (
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--bg-hover)] transition-all"
          >
            {t('mapping.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
