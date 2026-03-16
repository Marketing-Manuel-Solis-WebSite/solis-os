'use client';

// ============================================================
// Task Template Builder — Create/edit custom task templates
// with all task fields, date offsets, and variables.
// ============================================================

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  createTaskTemplate, updateTaskTemplate,
  type TaskTemplate, type TaskTemplateData, type TaskTemplateVariable,
} from '@/lib/task-templates';
import {
  X, Plus, Trash2, Save, Loader2, LayoutTemplate,
} from 'lucide-react';
import { STATUSES, PRIORITIES, TASK_TYPES } from '@/components/tasks/constants';

interface Props {
  template?: TaskTemplate | null;
  onSave: () => void;
  onClose: () => void;
}

const CATEGORIES = ['general', 'engineering', 'pm', 'marketing', 'legal', 'hr', 'sales'];
const ICONS = ['📝', '🐛', '✨', '🏃', '🤝', '📊', '🎯', '📋', '💡', '🔧', '📦', '🚀'];

export default function TaskTemplateBuilder({ template, onSave, onClose }: Props) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const isEditing = !!template && !template.isBuiltIn;

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template?.name || '');
  const [nameEs, setNameEs] = useState(template?.nameEs || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || 'general');
  const [icon, setIcon] = useState(template?.icon || '📝');

  const [data, setData] = useState<TaskTemplateData>(template?.templateData || {
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    type: 'task',
    tags: [],
    subtasks: [],
    customFields: {},
    checklist: [],
  });

  const [variables, setVariables] = useState<TaskTemplateVariable[]>(template?.variables || []);
  const [tagInput, setTagInput] = useState('');

  const updateData = (patch: Partial<TaskTemplateData>) => setData(prev => ({ ...prev, ...patch }));

  const addVariable = () => {
    setVariables(prev => [...prev, { key: `var_${Date.now()}`, label: '', type: 'text', required: false }]);
  };

  const updateVariable = (index: number, patch: Partial<TaskTemplateVariable>) => {
    setVariables(prev => prev.map((v, i) => i === index ? { ...v, ...patch } : v));
  };

  const removeVariable = (index: number) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
  };

  const addSubtask = () => {
    updateData({ subtasks: [...(data.subtasks || []), { title: '', done: false }] });
  };

  const handleSave = async () => {
    if (!name.trim() || !user?.uid) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nameEs: nameEs.trim() || undefined,
        description: description.trim(),
        category,
        icon,
        templateData: data,
        variables,
        isBuiltIn: false,
        createdBy: user.uid,
      };

      if (isEditing && template) {
        await updateTaskTemplate(template.id, payload);
      } else {
        await createTaskTemplate(payload as any);
      }
      onSave();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] bg-[var(--bg-base)] rounded-2xl shadow-xl border border-[var(--border)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {isEditing
                ? (lang === 'es' ? 'Editar Plantilla' : 'Edit Template')
                : (lang === 'es' ? 'Nueva Plantilla' : 'New Template')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Nombre' : 'Name'} *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder={lang === 'es' ? 'Nombre de la plantilla' : 'Template name'}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Nombre (ES)' : 'Name (ES)'}</label>
              <input type="text" value={nameEs} onChange={e => setNameEs(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Descripción' : 'Description'}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none resize-none" />
          </div>

          {/* Category & Icon */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Categoría' : 'Category'}</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Icono' : 'Icon'}</label>
              <div className="flex flex-wrap gap-1">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setIcon(i)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition ${icon === i ? 'bg-[var(--accent-subtle)] ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--bg-hover)]'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Task defaults */}
          <div className="border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase mb-3">{lang === 'es' ? 'Datos de la tarea' : 'Task Data'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Título' : 'Title'}</label>
                <input type="text" value={data.title} onChange={e => updateData({ title: e.target.value })}
                  placeholder={lang === 'es' ? 'Usa {{variable}} para placeholders' : 'Use {{variable}} for placeholders'}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">Status</label>
                  <select value={data.status} onChange={e => updateData({ status: e.target.value })}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none">
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Prioridad' : 'Priority'}</label>
                  <select value={data.priority} onChange={e => updateData({ priority: e.target.value })}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none">
                    {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Tipo' : 'Type'}</label>
                  <select value={data.type} onChange={e => updateData({ type: e.target.value })}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none">
                    {TASK_TYPES.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                  </select>
                </div>
              </div>

              {/* Date offsets */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Fecha límite (+días)' : 'Due date (+days)'}</label>
                  <input type="number" min={0} value={data.dueDateOffsetDays ?? ''}
                    onChange={e => updateData({ dueDateOffsetDays: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] border border-[var(--border)] outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">{lang === 'es' ? 'Fecha inicio (+días)' : 'Start date (+days)'}</label>
                  <input type="number" min={0} value={data.startDateOffsetDays ?? ''}
                    onChange={e => updateData({ startDateOffsetDays: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] border border-[var(--border)] outline-none" />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">Tags</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {(data.tags || []).map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                      {tag}
                      <button onClick={() => updateData({ tags: data.tags.filter(t => t !== tag) })}><X className="h-2.5 w-2.5" /></button>
                    </span>
                  ))}
                </div>
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { updateData({ tags: [...(data.tags || []), tagInput.trim()] }); setTagInput(''); e.preventDefault(); } }}
                  placeholder={lang === 'es' ? 'Agregar tag...' : 'Add tag...'}
                  className="w-full h-8 px-3 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none" />
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[var(--text-muted)]">{lang === 'es' ? 'Subtareas' : 'Subtasks'}</label>
                  <button onClick={addSubtask} className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> {lang === 'es' ? 'Agregar' : 'Add'}
                  </button>
                </div>
                <div className="space-y-1">
                  {(data.subtasks || []).map((st, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={st.title} onChange={e => {
                        const subs = [...(data.subtasks || [])];
                        subs[i] = { ...subs[i], title: e.target.value };
                        updateData({ subtasks: subs });
                      }}
                        className="flex-1 h-8 px-2.5 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none" />
                      <button onClick={() => updateData({ subtasks: (data.subtasks || []).filter((_, j) => j !== i) })} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Variables */}
          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase">Variables</h3>
              <button onClick={addVariable} className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> {lang === 'es' ? 'Agregar' : 'Add'}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-2">
              {lang === 'es' ? 'Las variables se piden al aplicar la plantilla. Usa {{key}} en título/descripción.' : 'Variables are prompted when applying. Use {{key}} in title/description.'}
            </p>
            {variables.map((v, i) => (
              <div key={v.key} className="flex items-center gap-2 mb-1.5">
                <input type="text" value={v.label} onChange={e => updateVariable(i, { label: e.target.value })}
                  placeholder="Label"
                  className="flex-1 h-8 px-2.5 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none" />
                <input type="text" value={v.key} onChange={e => updateVariable(i, { key: e.target.value.replace(/\s/g, '_') })}
                  placeholder="key"
                  className="w-24 h-8 px-2.5 rounded-lg bg-[var(--bg-elevated)] text-[12px] font-mono border border-[var(--border)] outline-none" />
                <select value={v.type} onChange={e => updateVariable(i, { type: e.target.value as any })}
                  className="w-20 h-8 px-1 rounded-lg bg-[var(--bg-elevated)] text-[11px] border border-[var(--border)] outline-none">
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="user">User</option>
                </select>
                <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <input type="checkbox" checked={v.required} onChange={e => updateVariable(i, { required: e.target.checked })} className="w-3.5 h-3.5 accent-[var(--accent)]" />
                  Req
                </label>
                <button onClick={() => removeVariable(i)} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)] shrink-0">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
            {lang === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="h-9 px-5 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {lang === 'es' ? 'Guardar' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
