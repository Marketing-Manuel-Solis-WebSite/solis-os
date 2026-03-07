'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Archive, Edit2, GripVertical, X, Save, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  loadFieldDefs, saveFieldDefs, generateFieldId,
  FIELD_TYPE_OPTIONS,
  type CustomFieldDef, type CustomFieldGroupDef, type CustomFieldSettings,
} from '@/lib/custom-fields';
import { useToast } from '@/components/notifications/toast-provider';

export default function CustomFieldManager() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<CustomFieldSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editField, setEditField] = useState<CustomFieldDef | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadFieldDefs().then(s => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const { fields, groups, version } = settings;
  const activeFields = fields.filter(f => !f.archived).sort((a, b) => a.order - b.order);
  const archivedFields = fields.filter(f => f.archived);

  const handleSave = async (newFields: CustomFieldDef[], newGroups?: CustomFieldGroupDef[]) => {
    if (!user) return;
    setSaving(true);
    try {
      await saveFieldDefs(newFields, newGroups || groups, user.uid, version);
      const refreshed = await loadFieldDefs();
      setSettings(refreshed);
      toast.success(t('customFields.saved'), '');
    } catch {
      toast.error(t('customFields.saveError'), '');
    }
    setSaving(false);
  };

  const handleArchive = async (fieldId: string) => {
    const newFields = fields.map(f => f.id === fieldId ? { ...f, archived: true } : f);
    await handleSave(newFields);
  };

  const handleUnarchive = async (fieldId: string) => {
    const newFields = fields.map(f => f.id === fieldId ? { ...f, archived: false } : f);
    await handleSave(newFields);
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm(t('customFields.deleteConfirm'))) return;
    const newFields = fields.filter(f => f.id !== fieldId);
    await handleSave(newFields);
  };

  const handleSaveField = async (field: CustomFieldDef) => {
    const idx = fields.findIndex(f => f.id === field.id);
    let newFields: CustomFieldDef[];
    if (idx >= 0) {
      newFields = [...fields];
      newFields[idx] = field;
    } else {
      newFields = [...fields, field];
    }
    await handleSave(newFields);
    setEditField(null);
    setShowCreate(false);
  };

  const getGroupName = (groupId: string) => {
    const g = groups.find(g => g.id === groupId);
    if (!g) return groupId;
    return lang === 'es' ? g.nameEs : g.name;
  };

  const getFieldTypeName = (type: string) => {
    const ft = FIELD_TYPE_OPTIONS.find(f => f.type === type);
    if (!ft) return type;
    return lang === 'es' ? ft.labelEs : ft.labelEn;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('customFields.title')}</h3>
          <p className="text-sm text-[var(--text-muted)]">{t('customFields.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditField({
              id: '',
              name: '',
              nameEs: '',
              type: 'text',
              group: groups[0]?.id || 'general',
              required: false,
              order: activeFields.length,
              archived: false,
              isLegacy: false,
            });
          }}
          className="flex items-center gap-2 px-4 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" /> {t('customFields.addField')}
        </button>
      </div>

      {/* Groups */}
      {groups.map(group => {
        const groupFields = activeFields.filter(f => f.group === group.id);
        if (groupFields.length === 0) return null;
        return (
          <div key={group.id}>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {lang === 'es' ? group.nameEs : group.name} ({groupFields.length})
            </h4>
            <div className="space-y-1">
              {groupFields.map(field => (
                <div key={field.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition group">
                  <GripVertical className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {lang === 'es' ? field.nameEs : field.name}
                    </span>
                    {field.isLegacy && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                        legacy
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] px-2 py-0.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                    {getFieldTypeName(field.type)}
                  </span>
                  {field.required && (
                    <span className="text-[10px] text-red-400 font-medium">*</span>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditField({ ...field }); setShowCreate(false); }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--accent)] transition">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleArchive(field.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-amber-400 transition">
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Archived */}
      {archivedFields.length > 0 && (
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {t('customFields.archived')} ({archivedFields.length})
          </h4>
          <div className="space-y-1 opacity-60">
            {archivedFields.map(field => (
              <div key={field.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] group">
                <span className="flex-1 text-sm text-[var(--text-muted)] line-through">
                  {lang === 'es' ? field.nameEs : field.name}
                </span>
                <button onClick={() => handleUnarchive(field.id)}
                  className="text-[12px] text-[var(--accent)] hover:underline opacity-0 group-hover:opacity-100">
                  {t('customFields.unarchive')}
                </button>
                <button onClick={() => handleDelete(field.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit / Create modal */}
      {(editField || showCreate) && editField && (
        <FieldEditor
          field={editField}
          groups={groups}
          isNew={showCreate}
          onSave={handleSaveField}
          onCancel={() => { setEditField(null); setShowCreate(false); }}
          saving={saving}
        />
      )}
    </div>
  );
}

function FieldEditor({ field, groups, isNew, onSave, onCancel, saving }: {
  field: CustomFieldDef;
  groups: CustomFieldGroupDef[];
  isNew: boolean;
  onSave: (field: CustomFieldDef) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t, lang } = useI18n();
  const [data, setData] = useState(field);
  const [newOption, setNewOption] = useState('');

  const handleSubmit = () => {
    if (!data.name.trim() || !data.nameEs.trim()) return;
    const id = isNew ? generateFieldId(data.name) : data.id;
    onSave({ ...data, id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isNew ? t('customFields.createField') : t('customFields.editField')}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customFields.nameEn')}
              </label>
              <input
                value={data.name}
                onChange={e => setData({ ...data, name: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none"
                placeholder="Field name"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customFields.nameEs')}
              </label>
              <input
                value={data.nameEs}
                onChange={e => setData({ ...data, nameEs: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none"
                placeholder="Nombre del campo"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customFields.fieldType')}
              </label>
              <select
                value={data.type}
                onChange={e => setData({ ...data, type: e.target.value as any })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none"
              >
                {FIELD_TYPE_OPTIONS.map(ft => (
                  <option key={ft.type} value={ft.type}>
                    {lang === 'es' ? ft.labelEs : ft.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customFields.group')}
              </label>
              <select
                value={data.group}
                onChange={e => setData({ ...data, group: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {lang === 'es' ? g.nameEs : g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.required}
              onChange={e => setData({ ...data, required: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">{t('customFields.required')}</span>
          </label>

          {/* Options for select fields */}
          {(data.type === 'single_select' || data.type === 'multi_select') && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customFields.options')}
              </label>
              <div className="space-y-1 mb-2">
                {(data.options || []).map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={opt.color}
                      onChange={e => {
                        const opts = [...(data.options || [])];
                        opts[i] = { ...opts[i], color: e.target.value };
                        setData({ ...data, options: opts });
                      }}
                      className="w-6 h-6 rounded cursor-pointer border-0"
                    />
                    <span className="flex-1 text-sm text-[var(--text-primary)]">{opt.label}</span>
                    <button
                      onClick={() => {
                        const opts = (data.options || []).filter((_, j) => j !== i);
                        setData({ ...data, options: opts });
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  placeholder={t('customFields.addOption')}
                  className="flex-1 h-8 px-2.5 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newOption.trim()) {
                      const id = newOption.toLowerCase().replace(/\s+/g, '_').slice(0, 30);
                      setData({
                        ...data,
                        options: [...(data.options || []), { id, label: newOption.trim(), color: '#6B7280' }],
                      });
                      setNewOption('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!newOption.trim()) return;
                    const id = newOption.toLowerCase().replace(/\s+/g, '_').slice(0, 30);
                    setData({
                      ...data,
                      options: [...(data.options || []), { id, label: newOption.trim(), color: '#6B7280' }],
                    });
                    setNewOption('');
                  }}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onCancel} className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !data.name.trim() || !data.nameEs.trim()}
            className="px-4 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
