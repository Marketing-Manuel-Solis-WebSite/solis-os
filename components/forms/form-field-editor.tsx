'use client';
import { X, Plus, GripVertical } from 'lucide-react';
import type { FormField } from './constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  field: FormField;
  allFields: FormField[];
  onChange: (updated: FormField) => void;
  onClose: () => void;
}

export default function FormFieldEditor({ field, allFields, onChange, onClose }: Props) {
  const { t } = useI18n();
  const hasOptions = ['dropdown', 'multi_select', 'radio'].includes(field.type);
  const isText = ['short_text', 'long_text'].includes(field.type);
  const isNumber = field.type === 'number';
  const isRating = field.type === 'rating';
  const isFile = field.type === 'file';

  const up = (partial: Partial<FormField>) => onChange({ ...field, ...partial });
  const upVal = (key: string, val: any) => onChange({ ...field, validations: { ...field.validations, [key]: val } });

  const inputCls = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all';
  const labelCls = 'block text-[13px] font-medium text-[var(--text-secondary)] mb-1';

  return (
    <div className="space-y-4 h-full overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t(`field.${camel(field.type)}`)}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Label */}
      <div>
        <label className={labelCls}>{t('fieldConfig.label')}</label>
        <input className={inputCls} placeholder={t('fieldConfig.labelPlaceholder')} value={field.label} onChange={e => up({ label: e.target.value })} />
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>{t('fieldConfig.description')}</label>
        <input className={inputCls} placeholder={t('fieldConfig.descPlaceholder')} value={field.description} onChange={e => up({ description: e.target.value })} />
      </div>

      {/* Placeholder */}
      {field.type !== 'checkbox' && field.type !== 'radio' && field.type !== 'file' && field.type !== 'rating' && (
        <div>
          <label className={labelCls}>{t('fieldConfig.placeholder')}</label>
          <input className={inputCls} placeholder={t('fieldConfig.placeholderPlaceholder')} value={field.placeholder} onChange={e => up({ placeholder: e.target.value })} />
        </div>
      )}

      {/* Required */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={field.required} onChange={e => up({ required: e.target.checked })} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
        <span className="text-sm text-[var(--text-secondary)]">{t('fieldConfig.required')}</span>
      </label>

      {/* Options (dropdown/radio/multi) */}
      {hasOptions && (
        <div>
          <label className={labelCls}>{t('fieldConfig.options')}</label>
          <div className="space-y-1.5">
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <GripVertical className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder={t('fieldConfig.optionLabel', { n: i + 1 })}
                  value={opt.label}
                  onChange={e => {
                    const opts = [...field.options];
                    opts[i] = { ...opts[i], label: e.target.value };
                    up({ options: opts });
                  }}
                />
                {field.options.length > 1 && (
                  <button type="button" onClick={() => up({ options: field.options.filter((_, j) => j !== i) })} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => up({ options: [...field.options, { label: '', value: `opt${Date.now().toString(36)}` }] })}
              className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> {t('fieldConfig.addOption')}
            </button>
          </div>
        </div>
      )}

      {/* Rating config */}
      {isRating && (
        <>
          <div>
            <label className={labelCls}>{t('fieldConfig.ratingMax')}</label>
            <input type="number" className={inputCls} min={1} max={10} value={field.ratingMax || 5} onChange={e => up({ ratingMax: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>{t('fieldConfig.ratingIcon')}</label>
            <div className="flex gap-2">
              {(['star', 'heart', 'number'] as const).map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => up({ ratingIcon: icon })}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${field.ratingIcon === icon ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  {t(`fieldConfig.ratingIcon${icon.charAt(0).toUpperCase() + icon.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Validations */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <label className={`${labelCls} mb-2`}>{t('fieldConfig.validations')}</label>

        {isText && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.minLength')}</label>
              <input type="number" className={inputCls} min={0} value={field.validations.minLength ?? ''} onChange={e => upVal('minLength', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <div>
              <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.maxLength')}</label>
              <input type="number" className={inputCls} min={0} value={field.validations.maxLength ?? ''} onChange={e => upVal('maxLength', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
          </div>
        )}

        {isNumber && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.min')}</label>
              <input type="number" className={inputCls} value={field.validations.min ?? ''} onChange={e => upVal('min', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
            <div>
              <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.max')}</label>
              <input type="number" className={inputCls} value={field.validations.max ?? ''} onChange={e => upVal('max', e.target.value ? Number(e.target.value) : undefined)} />
            </div>
          </div>
        )}

        {isText && (
          <div className="mt-2">
            <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.pattern')}</label>
            <input className={inputCls} placeholder="^[A-Z].*" value={field.validations.pattern ?? ''} onChange={e => upVal('pattern', e.target.value || undefined)} />
          </div>
        )}

        {isFile && (
          <div className="space-y-2">
            <div>
              <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.fileTypes')}</label>
              <input className={inputCls} placeholder={t('fieldConfig.fileTypesPlaceholder')} value={(field.validations.fileTypes || []).join(', ')} onChange={e => upVal('fileTypes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.maxFileSize')}</label>
                <input type="number" className={inputCls} min={1} value={field.validations.maxFileSize ?? ''} onChange={e => upVal('maxFileSize', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <label className="text-[12px] text-[var(--text-muted)]">{t('fieldConfig.maxFiles')}</label>
                <input type="number" className={inputCls} min={1} value={field.validations.maxFiles ?? ''} onChange={e => upVal('maxFiles', e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conditional visibility */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <label className={labelCls}>{t('fieldConfig.conditional')}</label>
        <div className="space-y-2">
          <select
            className={inputCls}
            value={field.conditionalOn?.fieldId || ''}
            onChange={e => {
              if (!e.target.value) { up({ conditionalOn: null }); return; }
              up({ conditionalOn: { fieldId: e.target.value, operator: 'not_empty', value: '' } });
            }}
          >
            <option value="">{t('fieldConfig.noCondition')}</option>
            {allFields.filter(f => f.id !== field.id).map(f => (
              <option key={f.id} value={f.id}>{f.label || f.type}</option>
            ))}
          </select>

          {field.conditionalOn && (
            <div className="flex gap-2">
              <select
                className={`${inputCls} flex-1`}
                value={field.conditionalOn.operator}
                onChange={e => up({ conditionalOn: { ...field.conditionalOn!, operator: e.target.value as any } })}
              >
                <option value="equals">{t('fieldConfig.conditionEquals')}</option>
                <option value="not_equals">{t('fieldConfig.conditionNotEquals')}</option>
                <option value="contains">{t('fieldConfig.conditionContains')}</option>
                <option value="not_empty">{t('fieldConfig.conditionNotEmpty')}</option>
              </select>
              {field.conditionalOn.operator !== 'not_empty' && (
                <input
                  className={`${inputCls} flex-1`}
                  placeholder={t('fieldConfig.conditionValue')}
                  value={field.conditionalOn.value || ''}
                  onChange={e => up({ conditionalOn: { ...field.conditionalOn!, value: e.target.value } })}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function camel(snake: string) {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
