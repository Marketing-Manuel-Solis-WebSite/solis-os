'use client';
import { useState, useRef } from 'react';
import { Star, Heart, Upload, X, ChevronDown, Check } from 'lucide-react';
import type { FormField } from './constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  mode: 'preview' | 'interactive';
}

export default function FormFieldRenderer({ field, value, onChange, error, mode }: Props) {
  const { t } = useI18n();
  const disabled = mode === 'preview';
  const id = `field-${field.id}`;

  const base = 'w-full rounded-lg border text-sm transition-all duration-150 outline-none';
  const normal = 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]';
  const errCls = error ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]' : normal;
  const inputCls = `${base} ${errCls} px-3 py-2.5`;

  if (field.type === 'hidden') return null;

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-primary)]">
        {field.label || <span className="text-[var(--text-muted)] italic">{t('fieldConfig.labelPlaceholder')}</span>}
        {field.required && <span className="text-[var(--error)] ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-[13px] text-[var(--text-muted)]">{field.description}</p>
      )}

      {/* Input */}
      {renderInput()}

      {/* Error */}
      {error && <p className="text-[13px] text-[var(--error)]">{error}</p>}
    </div>
  );

  function renderInput() {
    switch (field.type) {
      case 'short_text':
        return <input id={id} type="text" className={inputCls} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />;

      case 'long_text':
        return <textarea id={id} className={`${inputCls} min-h-[80px] resize-y`} placeholder={field.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} rows={3} />;

      case 'number':
        return <input id={id} type="number" className={inputCls} placeholder={field.placeholder} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} min={field.validations.min} max={field.validations.max} disabled={disabled} />;

      case 'email':
        return <input id={id} type="email" className={inputCls} placeholder={field.placeholder || 'email@example.com'} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />;

      case 'phone':
        return <input id={id} type="tel" className={inputCls} placeholder={field.placeholder || '+1 (555) 000-0000'} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />;

      case 'date':
        return <input id={id} type="date" className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />;

      case 'url':
        return <input id={id} type="url" className={inputCls} placeholder={field.placeholder || 'https://'} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />;

      case 'dropdown':
        return <DropdownField field={field} value={value} onChange={onChange} disabled={disabled} inputCls={inputCls} t={t} />;

      case 'multi_select':
        return <MultiSelectField field={field} value={value || []} onChange={onChange} disabled={disabled} />;

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} disabled={disabled} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
            <span className="text-sm text-[var(--text-secondary)]">{field.placeholder || field.label}</span>
          </label>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={id} checked={value === opt.value} onChange={() => onChange(opt.value)} disabled={disabled} className="border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
                <span className="text-sm text-[var(--text-secondary)]">{opt.label || opt.value}</span>
              </label>
            ))}
          </div>
        );

      case 'rating':
        return <RatingField field={field} value={value || 0} onChange={onChange} disabled={disabled} />;

      case 'file':
        return <FileField field={field} value={value || []} onChange={onChange} disabled={disabled} t={t} />;

      default:
        return <input id={id} type="text" className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} />;
    }
  }
}

/* ---- Dropdown ---- */
function DropdownField({ field, value, onChange, disabled, inputCls, t }: { field: FormField; value: any; onChange: (v: any) => void; disabled: boolean; inputCls: string; t: any }) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`${inputCls} appearance-none pr-8`}
      >
        <option value="">{t('publicForm.selectOption')}</option>
        {field.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
    </div>
  );
}

/* ---- Multi-select ---- */
function MultiSelectField({ field, value, onChange, disabled }: { field: FormField; value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const toggle = (optVal: string) => {
    if (disabled) return;
    onChange(value.includes(optVal) ? value.filter(v => v !== optVal) : [...value, optVal]);
  };
  return (
    <div className="space-y-1.5">
      {field.options.map(opt => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
          <span className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${value.includes(opt.value) ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-default)] bg-[var(--bg-base)]'}`}>
            {value.includes(opt.value) && <Check className="h-3 w-3 text-white" strokeWidth={2.5} />}
          </span>
          <span className="text-sm text-[var(--text-secondary)]" onClick={() => toggle(opt.value)}>{opt.label || opt.value}</span>
        </label>
      ))}
    </div>
  );
}

/* ---- Rating ---- */
function RatingField({ field, value, onChange, disabled }: { field: FormField; value: number; onChange: (v: number) => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(0);
  const max = field.ratingMax || 5;
  const icon = field.ratingIcon || 'star';

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map(n => {
        const filled = n <= (hovered || value);
        const Icon = icon === 'heart' ? Heart : Star;
        return icon === 'number' ? (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n === value ? 0 : n)}
            onMouseEnter={() => !disabled && setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${filled ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'}`}
          >
            {n}
          </button>
        ) : (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n === value ? 0 : n)}
            onMouseEnter={() => !disabled && setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Icon className={`h-6 w-6 transition-colors ${filled ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--text-muted)]'}`} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}

/* ---- File ---- */
function FileField({ field, value, onChange, disabled, t }: { field: FormField; value: any[]; onChange: (v: any[]) => void; disabled: boolean; t: any }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const newFiles = Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type, file: f }));
    const max = field.validations.maxFiles || 10;
    onChange([...value, ...newFiles].slice(0, max));
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && fileRef.current?.click()}
        className="border-2 border-dashed border-[var(--border-default)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all"
      >
        <Upload className="h-5 w-5 text-[var(--text-muted)] mx-auto mb-1" />
        <p className="text-sm text-[var(--text-muted)]">{t('publicForm.dragOrClick')}</p>
        {field.validations.fileTypes && field.validations.fileTypes.length > 0 && (
          <p className="text-[12px] text-[var(--text-muted)] mt-1">{field.validations.fileTypes.join(', ')}</p>
        )}
      </div>
      <input ref={fileRef} type="file" className="hidden" multiple={!!(field.validations.maxFiles && field.validations.maxFiles > 1)} accept={field.validations.fileTypes?.map(t => `.${t}`).join(',')} onChange={e => handleFiles(e.target.files)} />
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((f: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded px-2 py-1">
              <span className="truncate flex-1">{f.name}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
