'use client';

// ============================================================
// Task Template Picker — Modal for browsing and applying
// task templates with variable fill-in.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { getTaskTemplates, applyTaskTemplate, type TaskTemplate } from '@/lib/task-templates';
import { X, Search, LayoutTemplate, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (taskData: Record<string, any>) => void;
  teamId: string;
  spaceId: string;
  listId: string;
}

export default function TaskTemplatePicker({ open, onOpenChange, onApply, teamId, spaceId, listId }: Props) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TaskTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getTaskTemplates().then(t => { setTemplates(t); setLoading(false); }).catch(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.nameEs || '').toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const handleApply = async () => {
    if (!selected || !user?.uid) return;
    setApplying(true);
    try {
      const taskData = await applyTaskTemplate(selected.id, {
        teamId, spaceId, listId,
        createdBy: user.uid,
        variableValues,
      });
      onApply(taskData);
      onOpenChange(false);
      setSelected(null);
      setVariableValues({});
    } catch (err) {
      console.error('Failed to apply template:', err);
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-lg mx-4 bg-[var(--bg-base)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {lang === 'es' ? 'Plantillas de Tareas' : 'Task Templates'}
            </h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {selected ? (
          /* Variable fill-in view */
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{selected.icon}</span>
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                {lang === 'es' ? selected.nameEs || selected.name : selected.name}
              </h3>
            </div>
            <p className="text-[13px] text-[var(--text-muted)]">
              {lang === 'es' ? selected.descriptionEs || selected.description : selected.description}
            </p>

            {selected.variables.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase">
                  {lang === 'es' ? 'Variables' : 'Variables'}
                </h4>
                {selected.variables.map(v => (
                  <div key={v.key}>
                    <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1 block">
                      {lang === 'es' ? v.labelEs || v.label : v.label}
                      {v.required && <span className="text-[var(--error)] ml-0.5">*</span>}
                    </label>
                    <input
                      type={v.type === 'date' ? 'date' : 'text'}
                      value={variableValues[v.key] || ''}
                      onChange={e => setVariableValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] border border-[var(--border)] focus:ring-1 focus:ring-[var(--accent)] outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => { setSelected(null); setVariableValues({}); }}
                className="flex-1 h-9 rounded-lg text-[13px] font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
                {lang === 'es' ? 'Atrás' : 'Back'}
              </button>
              <button onClick={handleApply} disabled={applying}
                className="flex-1 h-9 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
                {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {lang === 'es' ? 'Aplicar' : 'Apply'}
              </button>
            </div>
          </div>
        ) : (
          /* Template list */
          <>
            <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'es' ? 'Buscar plantilla...' : 'Search templates...'}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-0 focus:ring-1 focus:ring-[var(--accent)] outline-none"
                  autoFocus />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-3 space-y-1.5">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-[13px] text-[var(--text-muted)] py-8">
                  {lang === 'es' ? 'Sin plantillas' : 'No templates'}
                </p>
              ) : (
                filtered.map(t => (
                  <button key={t.id} onClick={() => setSelected(t)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition text-left">
                    <span className="text-xl">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {lang === 'es' ? t.nameEs || t.name : t.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {lang === 'es' ? t.descriptionEs || t.description : t.description}
                      </p>
                    </div>
                    {t.isBuiltIn && (
                      <span className="text-[9px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-md uppercase">
                        {lang === 'es' ? 'Base' : 'Built-in'}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
