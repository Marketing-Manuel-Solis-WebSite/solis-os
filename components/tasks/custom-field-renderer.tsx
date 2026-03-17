'use client';
import { useState } from 'react';
import { type CustomFieldDef } from '@/lib/custom-fields';
import { useI18n } from '@/lib/i18n';
import { Star, X, Calculator, Sigma, Link2, Zap, Loader2 } from 'lucide-react';
import { evaluateFormula } from '@/lib/formula-engine';
import RelationshipFieldPicker from './relationship-field-picker';
import { auth } from '@/lib/firebase';

interface Props {
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  members?: any[];
  /** All field values on this task — needed for formula evaluation */
  allFieldValues?: Record<string, any>;
  /** Subtasks/children for rollup computation */
  children?: Record<string, any>[];
  /** Available entities for relationship picker */
  tasks?: { id: string; title: string }[];
  docs?: { id: string; title: string }[];
  goals?: { id: string; name: string }[];
  /** Task ID — needed for button field automation triggers */
  taskId?: string;
}

export default function CustomFieldRenderer({ field, value, onChange, readOnly = false, members = [], allFieldValues = {}, children: childRecords = [], tasks = [], docs = [], goals = [], taskId }: Props) {
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

    case 'formula': {
      const config = field.formulaConfig;
      if (!config) return <span className="text-sm text-[var(--text-muted)]">—</span>;
      const computed = evaluateFormula(config.expression, allFieldValues);
      const display = computed !== null && computed !== undefined
        ? config.resultType === 'number' ? Number(computed).toLocaleString()
        : String(computed)
        : '—';
      return (
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <Calculator className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
          <span className="font-medium">{display}</span>
        </div>
      );
    }

    case 'rollup': {
      const config = field.rollupConfig;
      if (!config) return <span className="text-sm text-[var(--text-muted)]">—</span>;
      const { evaluateRollup } = require('@/lib/formula-engine');
      const computed = evaluateRollup(config, childRecords);
      const display = computed !== null
        ? config.resultType === 'percentage' ? `${computed}%` : Number(computed).toLocaleString()
        : '—';
      return (
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <Sigma className="h-3.5 w-3.5 text-[var(--success)] shrink-0" />
          <span className="font-medium">{display}</span>
        </div>
      );
    }

    case 'relationship': {
      const linkedIds = Array.isArray(value) ? value as string[] : [];
      const allEntities = [
        ...tasks.map(t => ({ id: t.id, title: t.title, type: 'task' as const })),
        ...docs.map(d => ({ id: d.id, title: d.title, type: 'doc' as const })),
        ...goals.map(g => ({ id: g.id, title: g.name, type: 'goal' as const })),
      ];
      const linked = linkedIds.map(id => allEntities.find(e => e.id === id)).filter(Boolean) as { id: string; title: string; type: 'task' | 'doc' | 'goal' }[];

      if (readOnly) {
        return (
          <div className="flex flex-wrap gap-1">
            {linked.map(entity => (
              <span key={entity.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)]">
                <Link2 className="h-2.5 w-2.5" /> {entity.title}
              </span>
            ))}
            {linked.length === 0 && <span className="text-sm text-[var(--text-muted)]">—</span>}
          </div>
        );
      }

      return (
        <RelationshipFieldPicker
          value={linked}
          onChange={(entities) => onChange(entities.map(e => e.id))}
          allowedTypes={field.relationshipConfig?.targetTypes || ['task', 'doc', 'goal']}
          allowMultiple={field.relationshipConfig?.allowMultiple ?? true}
          tasks={tasks}
          docs={docs}
          goals={goals}
        />
      );
    }

    case 'button': {
      const [btnLoading, setBtnLoading] = useState(false);
      const handleButtonClick = async () => {
        onChange(Date.now()); // Record the click timestamp
        if (!taskId) return;
        setBtnLoading(true);
        try {
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) return;
          await fetch('/api/automations/button-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ taskId, buttonFieldId: field.id }),
          });
        } catch (err) {
          console.error('[CustomField:button] automation trigger failed:', err);
        } finally {
          setBtnLoading(false);
        }
      };
      return (
        <button
          onClick={handleButtonClick}
          disabled={btnLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {btnLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {label}
        </button>
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
    case 'formula': return String(value ?? '—');
    case 'rollup': return String(value ?? '—');
    case 'relationship': return Array.isArray(value) ? `${value.length} linked` : '—';
    case 'button': return value ? (lang === 'es' ? 'Ejecutado' : 'Clicked') : '—';
    default: return String(value);
  }
}
