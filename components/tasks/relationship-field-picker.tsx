'use client';

// ============================================================
// Relationship Field Picker — Entity search & selection for
// relationship custom field type.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { X, Search, Link2, FileText, Target, CheckSquare } from 'lucide-react';

type EntityType = 'task' | 'doc' | 'goal';

interface LinkedEntity {
  id: string;
  type: EntityType;
  title: string;
}

interface Props {
  value: LinkedEntity[];
  onChange: (entities: LinkedEntity[]) => void;
  allowedTypes?: EntityType[];
  allowMultiple?: boolean;
  tasks?: { id: string; title: string }[];
  docs?: { id: string; title: string }[];
  goals?: { id: string; name: string }[];
}

const TYPE_ICONS: Record<EntityType, React.ReactNode> = {
  task: <CheckSquare className="h-3.5 w-3.5 text-[var(--info)]" />,
  doc: <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />,
  goal: <Target className="h-3.5 w-3.5 text-[var(--success)]" />,
};

const TYPE_COLORS: Record<EntityType, string> = {
  task: 'var(--info)',
  doc: 'var(--accent)',
  goal: 'var(--success)',
};

export default function RelationshipFieldPicker({
  value = [],
  onChange,
  allowedTypes = ['task', 'doc', 'goal'],
  allowMultiple = true,
  tasks = [],
  docs = [],
  goals = [],
}: Props) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<EntityType>(allowedTypes[0] || 'task');

  const selectedIds = new Set(value.map(v => v.id));

  const searchResults = useMemo(() => {
    const q = search.toLowerCase();
    let items: { id: string; title: string; type: EntityType }[] = [];

    if (activeType === 'task') {
      items = tasks.filter(t => t.title.toLowerCase().includes(q)).map(t => ({ ...t, type: 'task' as EntityType }));
    } else if (activeType === 'doc') {
      items = docs.filter(d => d.title.toLowerCase().includes(q)).map(d => ({ ...d, type: 'doc' as EntityType }));
    } else if (activeType === 'goal') {
      items = goals.filter(g => g.name.toLowerCase().includes(q)).map(g => ({ id: g.id, title: g.name, type: 'goal' as EntityType }));
    }

    return items.filter(i => !selectedIds.has(i.id)).slice(0, 20);
  }, [search, activeType, tasks, docs, goals, selectedIds]);

  const handleAdd = (item: { id: string; title: string; type: EntityType }) => {
    if (!allowMultiple) {
      onChange([{ id: item.id, type: item.type, title: item.title }]);
      setOpen(false);
    } else {
      onChange([...value, { id: item.id, type: item.type, title: item.title }]);
    }
    setSearch('');
  };

  const handleRemove = (id: string) => {
    onChange(value.filter(v => v.id !== id));
  };

  const typeLabels: Record<EntityType, string> = {
    task: lang === 'es' ? 'Tareas' : 'Tasks',
    doc: lang === 'es' ? 'Documentos' : 'Docs',
    goal: lang === 'es' ? 'Objetivos' : 'Goals',
  };

  return (
    <div>
      {/* Selected chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(entity => (
          <span
            key={entity.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)]"
          >
            {TYPE_ICONS[entity.type]}
            <span className="truncate max-w-[150px]">{entity.title}</span>
            <button onClick={() => handleRemove(entity.id)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 transition"
      >
        <Link2 className="h-3.5 w-3.5" />
        {lang === 'es' ? 'Vincular entidad' : 'Link entity'}
      </button>

      {/* Picker dropdown */}
      {open && (
        <div className="mt-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl shadow-dropdown p-3 max-w-sm">
          {/* Type tabs */}
          <div className="flex rounded-lg bg-[var(--bg-elevated)] overflow-hidden mb-2">
            {allowedTypes.map(type => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex-1 px-2.5 py-1.5 text-[11px] font-medium transition ${
                  activeType === type
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'es' ? 'Buscar...' : 'Search...'}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-elevated)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-0 focus:ring-1 focus:ring-[var(--accent)] outline-none"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {searchResults.length === 0 ? (
              <p className="text-center text-[12px] text-[var(--text-muted)] py-3">
                {lang === 'es' ? 'Sin resultados' : 'No results'}
              </p>
            ) : (
              searchResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleAdd(item)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] hover:bg-[var(--bg-hover)] transition text-left"
                >
                  {TYPE_ICONS[item.type]}
                  <span className="truncate text-[var(--text-primary)]">{item.title}</span>
                </button>
              ))
            )}
          </div>

          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            className="w-full mt-2 py-1.5 text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>
      )}
    </div>
  );
}
