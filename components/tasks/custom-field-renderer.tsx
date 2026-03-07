'use client';
import { useState } from 'react';
import { type CustomFieldDef } from '@/lib/custom-fields';
import { useI18n } from '@/lib/i18n';
import { Star, X } from 'lucide-react';

interface Props {
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  members?: any[];
}

export default function CustomFieldRenderer({ field, value, onChange, readOnly = false, members = [] }: Props) {
  const { lang } = useI18n();
  const label = lang === 'es' ? field.nameEs : field.name;

  const baseInputClass = 'w-full h-8 px-2.5 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none border border-transparent focus:border-[var(--accent)]/30 transition';

  if (readOnly) {
    return (
      <div className="text-sm text-[var(--text-secondary)]">
        {renderReadOnly(field, value, members, lang)}
      </div>
    );
  }

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={label}
          className={baseInputClass}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={label}
          rows={3}
          className={`${baseInputClass} h-auto py-2 resize-none`}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder="0"
          min={field.validation?.min}
          max={field.validation?.max}
          className={baseInputClass}
        />
      );

    case 'currency':
      return (
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">$</span>
          <input
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="0.00"
            step="0.01"
            className={`${baseInputClass} pl-6`}
          />
        </div>
      );

    case 'percentage':
      return (
        <div className="relative">
          <input
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
            min={0}
            max={100}
            className={`${baseInputClass} pr-7`}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
        </div>
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--accent)]"
          />
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        </label>
      );

    case 'date':
    case 'datetime':
      return (
        <input
          type={field.type === 'datetime' ? 'datetime-local' : 'date'}
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className={baseInputClass}
        />
      );

    case 'single_select':
      return (
        <select
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className={`${baseInputClass} cursor-pointer`}
        >
          <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
          {field.options?.map(o => (
            <option key={o.id} value={o.label}>{o.label}</option>
          ))}
        </select>
      );

    case 'multi_select': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div>
          <div className="flex flex-wrap gap-1 mb-1">
            {selected.map((v: string) => (
              <span key={v} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                {v}
                <button onClick={() => onChange(selected.filter(s => s !== v))} className="hover:text-red-400">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <select
            value=""
            onChange={e => {
              if (e.target.value && !selected.includes(e.target.value)) {
                onChange([...selected, e.target.value]);
              }
            }}
            className={`${baseInputClass} cursor-pointer`}
          >
            <option value="">{lang === 'es' ? 'Agregar...' : 'Add...'}</option>
            {field.options?.filter(o => !selected.includes(o.label)).map(o => (
              <option key={o.id} value={o.label}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }

    case 'user':
      return (
        <select
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className={`${baseInputClass} cursor-pointer`}
        >
          <option value="">{lang === 'es' ? 'Seleccionar usuario...' : 'Select user...'}</option>
          {members.filter(m => m.active !== false).map(m => (
            <option key={m.userId || m.id} value={m.userId || m.id}>{m.displayName || m.email}</option>
          ))}
        </select>
      );

    case 'rating': {
      const rating = typeof value === 'number' ? value : 0;
      return (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onChange(n === rating ? 0 : n)}
              className="p-0.5 transition"
            >
              <Star
                className={`h-4 w-4 ${n <= rating ? 'text-[var(--accent)] fill-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
              />
            </button>
          ))}
        </div>
      );
    }

    default:
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={label}
          className={baseInputClass}
        />
      );
  }
}

function renderReadOnly(field: CustomFieldDef, value: unknown, members: any[], lang: string): string {
  if (value === undefined || value === null || value === '') return '—';
  switch (field.type) {
    case 'boolean': return value ? (lang === 'es' ? 'Sí' : 'Yes') : (lang === 'es' ? 'No' : 'No');
    case 'currency': return `$${Number(value).toLocaleString()}`;
    case 'percentage': return `${value}%`;
    case 'rating': return `${'★'.repeat(Number(value) || 0)}${'☆'.repeat(5 - (Number(value) || 0))}`;
    case 'user': {
      const m = members.find(m => (m.userId || m.id) === value);
      return m?.displayName || String(value);
    }
    case 'multi_select': return Array.isArray(value) ? value.join(', ') : String(value);
    default: return String(value);
  }
}
