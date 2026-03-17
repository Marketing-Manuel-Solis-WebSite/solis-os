'use client';

// ============================================================
// Mobile Task Form — Simplified task create/edit for mobile
// wrapped in a bottom sheet with large touch targets.
// ============================================================

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { STATUSES, PRIORITIES } from '@/components/tasks/constants';
import { Plus, Save, Loader2 } from 'lucide-react';

interface Props {
  mode: 'create' | 'edit';
  initialData?: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
  };
  members?: { id: string; displayName?: string; email?: string }[];
  onSave: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

export default function MobileTaskForm({ mode, initialData = {}, members = [], onSave, onCancel }: Props) {
  const { lang } = useI18n();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [status, setStatus] = useState(initialData.status || 'todo');
  const [priority, setPriority] = useState(initialData.priority || 'medium');
  const [dueDate, setDueDate] = useState(initialData.dueDate || '');
  const [assignee, setAssignee] = useState('');

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        dueDate: dueDate || null,
        assignees: assignee ? [assignee] : [],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5 block">
          {lang === 'es' ? 'Título' : 'Title'} *
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={lang === 'es' ? '¿Qué hay que hacer?' : 'What needs to be done?'}
          className="w-full h-12 px-4 rounded-xl bg-[var(--bg-elevated)] text-[15px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5 block">
          {lang === 'es' ? 'Descripción' : 'Description'}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder={lang === 'es' ? 'Detalles opcionales...' : 'Optional details...'}
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-[14px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none resize-none"
        />
      </div>

      {/* Status + Priority row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5 block">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={`h-10 px-3 rounded-xl text-[12px] font-medium flex items-center gap-1.5 transition ${
                  status === s.id
                    ? 'ring-2 ring-offset-1 ring-[var(--accent)] bg-[var(--bg-elevated)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5 block">
            {lang === 'es' ? 'Prioridad' : 'Priority'}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map(p => (
              <button
                key={p.id}
                onClick={() => setPriority(p.id)}
                className={`h-10 px-3 rounded-xl text-[12px] font-medium transition ${
                  priority === p.id
                    ? 'ring-2 ring-offset-1 ring-[var(--accent)] bg-[var(--bg-elevated)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}
              >
                {p.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Due Date */}
      <div>
        <label className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5 block">
          {lang === 'es' ? 'Fecha Límite' : 'Due Date'}
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="w-full h-12 px-4 rounded-xl bg-[var(--bg-elevated)] text-[14px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
        />
      </div>

      {/* Assignee */}
      {members.length > 0 && (
        <div>
          <label className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5 block">
            {lang === 'es' ? 'Asignar a' : 'Assign to'}
          </label>
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-[var(--bg-elevated)] text-[14px] text-[var(--text-primary)] border border-[var(--border)] outline-none"
          >
            <option value="">{lang === 'es' ? 'Sin asignar' : 'Unassigned'}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="flex-1 h-12 rounded-xl text-[14px] font-medium text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition">
          {lang === 'es' ? 'Cancelar' : 'Cancel'}
        </button>
        <button onClick={handleSave} disabled={saving || !title.trim()}
          className="flex-1 h-12 rounded-xl text-[14px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === 'create' ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />)}
          {mode === 'create' ? (lang === 'es' ? 'Crear' : 'Create') : (lang === 'es' ? 'Guardar' : 'Save')}
        </button>
      </div>
    </div>
  );
}
