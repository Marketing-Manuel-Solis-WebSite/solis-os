'use client';

// ============================================================
// Formula Field Editor — UI for building formula expressions
// when creating/editing a formula custom field.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { evaluateFormula } from '@/lib/formula-engine';
import { Calculator, HelpCircle, Zap } from 'lucide-react';
import type { CustomFieldDef } from '@/lib/custom-fields';

interface Props {
  expression: string;
  onExpressionChange: (expr: string) => void;
  resultType: 'number' | 'text' | 'boolean' | 'date';
  onResultTypeChange: (type: 'number' | 'text' | 'boolean' | 'date') => void;
  /** Available fields that can be referenced in formulas */
  availableFields: CustomFieldDef[];
}

const FUNCTIONS = [
  { name: 'IF', syntax: 'IF(condition, then, else)', desc: 'Conditional' },
  { name: 'ROUND', syntax: 'ROUND(value, decimals)', desc: 'Round number' },
  { name: 'ABS', syntax: 'ABS(value)', desc: 'Absolute value' },
  { name: 'MIN', syntax: 'MIN(a, b, ...)', desc: 'Minimum' },
  { name: 'MAX', syntax: 'MAX(a, b, ...)', desc: 'Maximum' },
  { name: 'CONCAT', syntax: 'CONCAT(a, b, ...)', desc: 'Join text' },
  { name: 'LEN', syntax: 'LEN(text)', desc: 'Text length' },
  { name: 'UPPER', syntax: 'UPPER(text)', desc: 'Uppercase' },
  { name: 'LOWER', syntax: 'LOWER(text)', desc: 'Lowercase' },
  { name: 'FLOOR', syntax: 'FLOOR(value)', desc: 'Round down' },
  { name: 'CEIL', syntax: 'CEIL(value)', desc: 'Round up' },
  { name: 'COALESCE', syntax: 'COALESCE(a, b, ...)', desc: 'First non-empty' },
  { name: 'DAYS_BETWEEN', syntax: 'DAYS_BETWEEN(d1, d2)', desc: 'Days between dates' },
  { name: 'NOW', syntax: 'NOW()', desc: 'Current timestamp' },
];

export default function FormulaFieldEditor({
  expression,
  onExpressionChange,
  resultType,
  onResultTypeChange,
  availableFields,
}: Props) {
  const { lang } = useI18n();
  const [showHelp, setShowHelp] = useState(false);

  // Live preview with sample values
  const preview = useMemo(() => {
    if (!expression) return null;
    const sampleValues: Record<string, any> = {};
    for (const f of availableFields) {
      if (f.type === 'number' || f.type === 'currency' || f.type === 'percentage') sampleValues[f.id] = 10;
      else if (f.type === 'text') sampleValues[f.id] = 'sample';
      else if (f.type === 'boolean') sampleValues[f.id] = true;
      else sampleValues[f.id] = 0;
    }
    try {
      const result = evaluateFormula(expression, sampleValues);
      return { value: result, error: null };
    } catch (err: any) {
      return { value: null, error: err.message };
    }
  }, [expression, availableFields]);

  const insertField = (fieldId: string) => {
    onExpressionChange(expression + `{${fieldId}}`);
  };

  const insertFunction = (funcName: string) => {
    onExpressionChange(expression + `${funcName}(`);
  };

  return (
    <div className="space-y-3">
      {/* Expression input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-semibold text-[var(--text-muted)]">
            {lang === 'es' ? 'Expresión' : 'Expression'}
          </label>
          <button onClick={() => setShowHelp(!showHelp)} className="text-[var(--accent)] hover:underline flex items-center gap-0.5 text-[11px]">
            <HelpCircle className="h-3 w-3" /> {lang === 'es' ? 'Ayuda' : 'Help'}
          </button>
        </div>
        <div className="relative">
          <Calculator className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <textarea
            value={expression}
            onChange={e => onExpressionChange(e.target.value)}
            placeholder={lang === 'es' ? 'ej: {price} * {qty} * (1 - {discount} / 100)' : 'e.g.: {price} * {qty} * (1 - {discount} / 100)'}
            rows={2}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border)] focus:border-[var(--accent)] outline-none resize-none"
          />
        </div>
      </div>

      {/* Live preview */}
      {expression && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${
          preview?.error ? 'bg-[var(--error)]/5 text-[var(--error)]' : 'bg-[var(--success)]/5 text-[var(--success)]'
        }`}>
          <Zap className="h-3.5 w-3.5 shrink-0" />
          {preview?.error
            ? `Error: ${preview.error}`
            : `${lang === 'es' ? 'Preview' : 'Preview'}: ${preview?.value ?? '—'}`}
        </div>
      )}

      {/* Result type */}
      <div>
        <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">
          {lang === 'es' ? 'Tipo de resultado' : 'Result type'}
        </label>
        <select value={resultType} onChange={e => onResultTypeChange(e.target.value as any)}
          className="w-full h-8 px-2.5 rounded-lg bg-[var(--bg-elevated)] text-[12px] border border-[var(--border)] outline-none">
          <option value="number">{lang === 'es' ? 'Número' : 'Number'}</option>
          <option value="text">{lang === 'es' ? 'Texto' : 'Text'}</option>
          <option value="boolean">{lang === 'es' ? 'Booleano' : 'Boolean'}</option>
        </select>
      </div>

      {/* Field reference buttons */}
      {availableFields.length > 0 && (
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 block">
            {lang === 'es' ? 'Insertar campo' : 'Insert field'}
          </label>
          <div className="flex flex-wrap gap-1">
            {availableFields.filter(f => f.type !== 'formula' && f.type !== 'rollup').map(f => (
              <button key={f.id} onClick={() => insertField(f.id)}
                className="px-2 py-1 rounded-md text-[11px] font-mono bg-[var(--bg-elevated)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition border border-[var(--border)]">
                {`{${f.id}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help: Function reference */}
      {showHelp && (
        <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
          <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-2">
            {lang === 'es' ? 'Funciones disponibles' : 'Available functions'}
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {FUNCTIONS.map(fn => (
              <button key={fn.name} onClick={() => insertFunction(fn.name)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] transition text-left">
                <span className="text-[11px] font-mono text-[var(--accent)]">{fn.syntax}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{fn.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
