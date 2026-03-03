'use client';
import { useState, useCallback, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { motion } from 'framer-motion';
import { GripVertical, Trash2, Settings, Eye, Pencil, Save, Globe, Share2, Loader2, Pause, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FormDocument, FormField, FieldType } from './constants';
import { FORM_STATUSES, createEmptyField } from './constants';
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
  onShare: (form: FormDocument) => void;
}

export default function FormBuilder({ form, onUpdate, onShare }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [tab, setTab] = useState<'build' | 'preview' | 'settings'>('build');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formData, setFormData] = useState<FormDocument>(form);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for stable callbacks
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const selectedField = fields.find(f => f.id === selectedFieldId) || null;
  const statusInfo = FORM_STATUSES.find(s => s.value === formData.status);
  const statusColor = statusInfo?.color || '#8E8EA8';

  // Save to Firestore
  const doSave = useCallback(async (saveFields: FormField[], saveForm: FormDocument) => {
    try {
      setSaving(true);
      const toSave = { ...saveForm, fields: saveFields };
      await updateForm(form.id, {
        fields: toSave.fields,
        title: toSave.title,
        description: toSave.description,
        successMessage: toSave.successMessage,
        redirectUrl: toSave.redirectUrl,
        layout: toSave.layout,
        logoUrl: toSave.logoUrl,
        responseLimit: toSave.responseLimit,
        openAt: toSave.openAt,
        closeAt: toSave.closeAt,
        captchaEnabled: toSave.captchaEnabled,
        rateLimitPerMinute: toSave.rateLimitPerMinute,
        collectIp: toSave.collectIp,
        collectUserAgent: toSave.collectUserAgent,
        privacyNotice: toSave.privacyNotice,
        consentRequired: toSave.consentRequired,
        retentionDays: toSave.retentionDays,
        status: toSave.status,
      });
      onUpdateRef.current(toSave);
      setDirty(false);
      return true;
    } catch {
      toastRef.current.error('Error saving');
      return false;
    } finally {
      setSaving(false);
    }
  }, [form.id]);

  // Debounced auto-save
  const scheduleSave = useCallback((updatedFields: FormField[], updatedForm: FormDocument) => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave(updatedFields, updatedForm);
    }, 1500);
  }, [doSave]);

  // Explicit save (flush debounce)
  const handleSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const ok = await doSave(fieldsRef.current, formDataRef.current);
    if (ok) toastRef.current.success('Guardado');
  }, [doSave]);

  // Publish
  const handlePublish = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPublishing(true);
    const updated = { ...formDataRef.current, status: 'published' as const };
    setFormData(updated);
    const ok = await doSave(fieldsRef.current, updated);
    if (ok) toastRef.current.success('Formulario publicado');
    setPublishing(false);
  }, [doSave]);

  // Pause
  const handlePause = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const updated = { ...formDataRef.current, status: 'paused' as const };
    setFormData(updated);
    const ok = await doSave(fieldsRef.current, updated);
    if (ok) toastRef.current.success('Formulario pausado');
  }, [doSave]);

  const handleAddField = useCallback((type: FieldType) => {
    setFields(prev => {
      const newField = createEmptyField(type, prev.length);
      const updated = [...prev, newField];
      setSelectedFieldId(newField.id);
      setTab('build');
      setFormData(fd => { scheduleSave(updated, fd); return fd; });
      return updated;
    });
  }, [scheduleSave]);

  const handleFieldChange = useCallback((updatedField: FormField) => {
    setFields(prev => {
      const newFields = prev.map(f => f.id === updatedField.id ? updatedField : f);
      setFormData(fd => { scheduleSave(newFields, fd); return fd; });
      return newFields;
    });
  }, [scheduleSave]);

  const handleRemoveField = useCallback((id: string) => {
    setFields(prev => {
      const newFields = prev.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i }));
      setFormData(fd => { scheduleSave(newFields, fd); return fd; });
      return newFields;
    });
    setSelectedFieldId(prev => prev === id ? null : prev);
  }, [scheduleSave]);

  const handleReorder = useCallback((reordered: FormField[]) => {
    const updated = reordered.map((f, i) => ({ ...f, order: i }));
    setFields(updated);
    setFormData(fd => { scheduleSave(updated, fd); return fd; });
  }, [scheduleSave]);

  const handleFormChange = useCallback((updates: Partial<FormDocument>) => {
    setFormData(prev => {
      const updated = { ...prev, ...updates };
      setFields(cur => { scheduleSave(cur, updated); return cur; });
      return updated;
    });
  }, [scheduleSave]);

  // Preview values
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] gap-3">
        {/* Left: title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-bold text-[var(--text-primary)] truncate max-w-[220px]">
            {formData.title || t('formBuilder.title')}
          </h2>
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
          >
            {t(statusInfo?.labelKey || 'forms.statusDraft')}
          </span>
          {/* Save status indicator */}
          <span className="flex items-center gap-1 text-[12px] shrink-0">
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" /><span className="text-[var(--text-muted)]">{t('formBuilder.saving')}</span></>
            ) : dirty ? (
              <><AlertCircle className="h-3 w-3 text-amber-500" /><span className="text-amber-500">{t('formBuilder.unsaved')}</span></>
            ) : (
              <><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-green-500">{t('formBuilder.saved')}</span></>
            )}
          </span>
        </div>

        {/* Center: tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-xl p-1">
          {[
            { key: 'build' as const, icon: Pencil, label: t('formBuilder.buildTab') },
            { key: 'preview' as const, icon: Eye, label: t('formBuilder.previewTab') },
            { key: 'settings' as const, icon: Settings, label: t('formBuilder.settings') },
          ].map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${tab === tb.key ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            >
              <tb.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {tb.label}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}
          </button>

          {/* Share */}
          <button
            onClick={() => onShare(formData)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <Share2 className="h-3.5 w-3.5" />
            {t('forms.share')}
          </button>

          {/* Publish / Pause — prominent action */}
          {formData.status !== 'published' ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-all disabled:opacity-60 shadow-sm"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {t('forms.publish')}
              <ChevronRight className="h-3.5 w-3.5 -mr-1" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePause}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all shadow-sm"
            >
              <Pause className="h-4 w-4" />
              {t('forms.pause')}
            </motion.button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'build' && (
          <>
            {/* Left: Palette */}
            <div className="w-56 border-r border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 overflow-y-auto shrink-0">
              <FormFieldPalette onAdd={handleAddField} />
            </div>

            {/* Center: Canvas */}
            <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-base)]">
              {fields.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
                      <Pencil className="h-6 w-6 text-[var(--accent)]" />
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{t('formBuilder.emptyCanvas')}</h3>
                    <p className="text-[13px] text-[var(--text-muted)]">{t('formBuilder.emptyCanvasDesc') || 'Arrastra campos del panel izquierdo'}</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <Reorder.Group axis="y" values={fields} onReorder={handleReorder} className="space-y-2.5">
                    {fields.map(field => (
                      <Reorder.Item key={field.id} value={field} className="list-none">
                        <div
                          onClick={() => setSelectedFieldId(field.id)}
                          className={`group relative flex items-start gap-2.5 p-4 rounded-xl border transition-all cursor-pointer ${selectedFieldId === field.id ? 'border-[var(--accent)] bg-[var(--accent-subtle)] shadow-sm ring-1 ring-[var(--accent)]/20' : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-card hover:shadow-card-hover'}`}
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
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/5 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              )}
            </div>

            {/* Right: Field editor */}
            {selectedField && (
              <div className="w-72 border-l border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 overflow-y-auto shrink-0">
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
          <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-base)]">
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
              <button type="button" className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-md">
                {t('publicForm.submit')}
              </button>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-base)]">
            <div className="max-w-lg mx-auto">
              <FormSettingsPanel form={formData} onChange={handleFormChange} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
