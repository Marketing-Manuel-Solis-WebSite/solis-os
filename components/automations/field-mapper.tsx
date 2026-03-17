'use client';

// ============================================================
// Automation Field Mapper — Visual two-column mapping between
// trigger context fields and target action fields.
// ============================================================

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useCustomFieldDefs } from '@/lib/hooks/use-custom-field-defs';
import { ArrowRight, Plus, Trash2, Zap } from 'lucide-react';

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
}

interface Props {
  mappings: FieldMapping[];
  onChange: (mappings: FieldMapping[]) => void;
  triggerType: string;
}

// Context fields available from the trigger (task data)
const TASK_CONTEXT_FIELDS = [
  { id: 'title', label: 'Title', labelEs: 'Título' },
  { id: 'description', label: 'Description', labelEs: 'Descripción' },
  { id: 'status', label: 'Status', labelEs: 'Estado' },
  { id: 'priority', label: 'Priority', labelEs: 'Prioridad' },
  { id: 'type', label: 'Type', labelEs: 'Tipo' },
  { id: 'assignees', label: 'Assignees', labelEs: 'Asignados' },
  { id: 'tags', label: 'Tags', labelEs: 'Etiquetas' },
  { id: 'dueDate', label: 'Due Date', labelEs: 'Fecha Límite' },
  { id: 'startDate', label: 'Start Date', labelEs: 'Fecha Inicio' },
  { id: 'timeEstimate', label: 'Time Estimate', labelEs: 'Estimación' },
  { id: 'points', label: 'Points', labelEs: 'Puntos' },
  { id: 'teamId', label: 'Team', labelEs: 'Equipo' },
  { id: 'listId', label: 'List', labelEs: 'Lista' },
  { id: 'createdBy', label: 'Created By', labelEs: 'Creado Por' },
];

export default function FieldMapper({ mappings, onChange, triggerType }: Props) {
  const { lang } = useI18n();
  const { activeFields } = useCustomFieldDefs();

  // Combine task fields + custom fields as targets
  const allTargetFields = [
    ...TASK_CONTEXT_FIELDS,
    ...activeFields.map(f => ({
      id: `customFields.${f.id}`,
      label: f.name,
      labelEs: f.nameEs,
    })),
  ];

  const allSourceFields = [
    ...TASK_CONTEXT_FIELDS,
    ...activeFields.map(f => ({
      id: `customFields.${f.id}`,
      label: f.name,
      labelEs: f.nameEs,
    })),
  ];

  const addMapping = () => {
    onChange([...mappings, { id: `map_${Date.now()}`, sourceField: '', targetField: '' }]);
  };

  const updateMapping = (index: number, patch: Partial<FieldMapping>) => {
    onChange(mappings.map((m, i) => i === index ? { ...m, ...patch } : m));
  };

  const removeMapping = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
          {lang === 'es' ? 'Mapeo de Campos' : 'Field Mapping'}
        </h4>
        <button onClick={addMapping}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 transition">
          <Plus className="h-3 w-3" /> {lang === 'es' ? 'Agregar' : 'Add'}
        </button>
      </div>

      {mappings.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)] text-center py-4 bg-[var(--bg-elevated)] rounded-xl">
          {lang === 'es' ? 'Sin mapeos. Los campos se copiarán con sus valores originales.' : 'No mappings. Fields will use their original values.'}
        </p>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_24px_1fr_24px] gap-2 px-2">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
              {lang === 'es' ? 'Campo origen' : 'Source field'}
            </span>
            <span />
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">
              {lang === 'es' ? 'Campo destino' : 'Target field'}
            </span>
            <span />
          </div>

          {mappings.map((mapping, i) => (
            <div key={mapping.id} className="grid grid-cols-[1fr_24px_1fr_24px] gap-2 items-center">
              <select
                value={mapping.sourceField}
                onChange={e => updateMapping(i, { sourceField: e.target.value })}
                className="h-8 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
              >
                <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                {allSourceFields.map(f => (
                  <option key={f.id} value={f.id}>{lang === 'es' ? f.labelEs : f.label}</option>
                ))}
              </select>

              <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] mx-auto" />

              <select
                value={mapping.targetField}
                onChange={e => updateMapping(i, { targetField: e.target.value })}
                className="h-8 px-2 rounded-lg bg-[var(--bg-elevated)] text-[12px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
              >
                <option value="">{lang === 'es' ? 'Seleccionar...' : 'Select...'}</option>
                {allTargetFields.map(f => (
                  <option key={f.id} value={f.id}>{lang === 'es' ? f.labelEs : f.label}</option>
                ))}
              </select>

              <button onClick={() => removeMapping(i)}
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[var(--text-muted)]">
        {lang === 'es'
          ? 'Define cómo se copian los valores del trigger a la acción. Los campos no mapeados usan el valor por defecto.'
          : 'Define how trigger values map to action fields. Unmapped fields use their default value.'}
      </p>
    </div>
  );
}
