'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical, Trash2, Settings, Eye, Pencil } from 'lucide-react';
import type { FormDocument, FormField, FieldType } from './constants';
import { createEmptyField } from './constants';
import FormFieldPalette from './form-field-palette';
import FormFieldEditor from './form-field-editor';
import FormFieldRenderer from './form-field-renderer';
import FormSettingsPanel from './form-settings-panel';
import { useI18n } from '@/lib/i18n';
import { updateForm } from '@/lib/db';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  form: FormDocument;
  onUpdate: (form: FormDocument) => void;
}

export default function FormBuilder({ form, onUpdate }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [tab, setTab] = useState<'build' | 'preview' | 'settings'>('build');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formData, setFormData] = useState<FormDocument>(form);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedField = fields.find(f => f.id === selectedFieldId) || null;

  // Auto-save debounced
  const scheduleSave = useCallback((updatedFields: FormField[], updatedForm: FormDocument) => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        const toSave = { ...updatedForm, fields: updatedFields };
        await updateForm(form.id, { fields: toSave.fields, title: toSave.title, description: toSave.description, successMessage: toSave.successMessage, redirectUrl: toSave.redirectUrl, layout: toSave.layout, logoUrl: toSave.logoUrl, responseLimit: toSave.responseLimit, openAt: toSave.openAt, closeAt: toSave.closeAt, captchaEnabled: toSave.captchaEnabled, rateLimitPerMinute: toSave.rateLimitPerMinute, collectIp: toSave.collectIp, collectUserAgent: toSave.collectUserAgent, privacyNotice: toSave.privacyNotice, consentRequired: toSave.consentRequired, retentionDays: toSave.retentionDays });
        onUpdate(toSave);
        setDirty(false);
      } catch {
        toast.error(t('docEditor.saveError'));
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, [form.id, onUpdate, toast, t]);

  const handleAddField = useCallback((type: FieldType) => {
    const newField = createEmptyField(type, fields.length);
    const updated = [...fields, newField];
    setFields(updated);
    setSelectedFieldId(newField.id);
    setTab('build');
    scheduleSave(updated, formData);
  }, [fields, formData, scheduleSave]);

  const handleFieldChange = useCallback((updated: FormField) => {
    const newFields = fields.map(f => f.id === updated.id ? updated : f);
    setFields(newFields);
    scheduleSave(newFields, formData);
  }, [fields, formData, scheduleSave]);

  const handleRemoveField = useCallback((id: string) => {
    const newFields = fields.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i }));
    setFields(newFields);
    if (selectedFieldId === id) setSelectedFieldId(null);
    scheduleSave(newFields, formData);
  }, [fields, selectedFieldId, formData, scheduleSave]);

  const handleReorder = useCallback((reordered: FormField[]) => {
    const updated = reordered.map((f, i) => ({ ...f, order: i }));
    setFields(updated);
    scheduleSave(updated, formData);
  }, [formData, scheduleSave]);

  const handleFormChange = useCallback((updates: Partial<FormDocument>) => {
    const updated = { ...formData, ...updates };
    setFormData(updated);
    scheduleSave(fields, updated);
  }, [formData, fields, scheduleSave]);

  // Preview values
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
            {formData.title || t('formBuilder.title')}
          </h2>
          <span className="text-[12px] text-[var(--text-muted)]">
            {saving ? t('formBuilder.saving') : dirty ? t('formBuilder.unsaved') : t('formBuilder.saved')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {[
            { key: 'build' as const, icon: Pencil, label: t('formBuilder.buildTab') },
            { key: 'preview' as const, icon: Eye, label: t('formBuilder.previewTab') },
            { key: 'settings' as const, icon: Settings, label: t('formBuilder.settings') },
          ].map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === tb.key ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              <tb.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'build' && (
          <>
            {/* Left: Palette */}
            <div className="w-56 border-r border-[var(--border-subtle)] p-3 overflow-y-auto shrink-0">
              <FormFieldPalette onAdd={handleAddField} />
            </div>

            {/* Center: Canvas */}
            <div className="flex-1 overflow-y-auto p-4">
              {fields.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-[var(--text-muted)]">{t('formBuilder.emptyCanvas')}</p>
                </div>
              ) : (
                <Reorder.Group axis="y" values={fields} onReorder={handleReorder} className="space-y-2">
                  {fields.map(field => (
                    <Reorder.Item key={field.id} value={field} className="list-none">
                      <div
                        onClick={() => setSelectedFieldId(field.id)}
                        className={`group relative flex items-start gap-2 p-3 rounded-xl border transition-all cursor-pointer ${selectedFieldId === field.id ? 'border-[var(--accent)] bg-[var(--accent-subtle)] shadow-sm' : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--bg-base)]'}`}
                      >
                        <div className="pt-1 cursor-grab active:cursor-grabbing text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <FormFieldRenderer field={field} value={undefined} onChange={() => {}} mode="preview" />
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleRemoveField(field.id); }}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>

            {/* Right: Field editor */}
            {selectedField && (
              <div className="w-72 border-l border-[var(--border-subtle)] p-3 overflow-y-auto shrink-0">
                <FormFieldEditor
                  field={selectedField}
                  allFields={fields}
                  onChange={handleFieldChange}
                  onClose={() => setSelectedFieldId(null)}
                />
              </div>
            )}
          </>
        )}

        {tab === 'preview' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto space-y-5">
              {formData.logoUrl && <img src={formData.logoUrl} alt="Logo" className="h-10 object-contain" />}
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{formData.title || t('formBuilder.title')}</h1>
                {formData.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{formData.description}</p>}
              </div>
              <div className={formData.layout === '2col' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
                {fields.map(field => (
                  <FormFieldRenderer
                    key={field.id}
                    field={field}
                    value={previewValues[field.id]}
                    onChange={v => setPreviewValues(prev => ({ ...prev, [field.id]: v }))}
                    mode="interactive"
                  />
                ))}
              </div>
              <button type="button" className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity">
                {t('publicForm.submit')}
              </button>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-lg mx-auto">
              <FormSettingsPanel form={formData} onChange={handleFormChange} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
