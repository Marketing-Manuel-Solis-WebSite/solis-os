'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Search, CheckSquare, FileText, Target, Loader2 } from 'lucide-react';
import { getTasks, getDocuments, getGoals } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { type EntityType, type RelationType, RELATION_TYPES } from '@/lib/relations';
import { normalize } from '@/lib/search-utils';

interface Props {
  excludeId: string;
  onSelect: (type: EntityType, id: string, name: string, relationType: RelationType) => void;
  onClose: () => void;
}

const TABS: { type: EntityType; icon: any; labelEs: string; labelEn: string }[] = [
  { type: 'task', icon: CheckSquare, labelEs: 'Tareas', labelEn: 'Tasks' },
  { type: 'doc', icon: FileText, labelEs: 'Documentos', labelEn: 'Documents' },
  { type: 'goal', icon: Target, labelEs: 'Metas', labelEn: 'Goals' },
];

export default function EntityPickerModal({ excludeId, onSelect, onClose }: Props) {
  const { t, lang } = useI18n();
  const { can, canSeeAllTeams, activeTeamId, me } = useAuth();
  const [tab, setTab] = useState<EntityType>('task');
  const [query, setQuery] = useState('');
  const [relationType, setRelationType] = useState<RelationType>('related_to');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const teamScope = canSeeAllTeams ? undefined : (activeTeamId !== '__all__' ? activeTeamId : me?.teamId);
      let data: any[] = [];
      switch (tab) {
        case 'task':
          data = can('task', 'read') ? (await getTasks(teamScope)).items as any[] : [];
          break;
        case 'doc':
          data = can('doc', 'read') ? (await getDocuments(teamScope)).items as any[] : [];
          break;
        case 'goal':
          data = can('goal', 'read') ? (await getGoals(teamScope)).items as any[] : [];
          break;
      }
      setItems(data.filter(d => d.id !== excludeId));
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [tab, excludeId, can]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter(item => {
    if (!query.trim()) return true;
    const q = normalize(query);
    const name = normalize(item.title || item.name || '');
    return name.includes(q);
  }).slice(0, 20);

  const handleSelect = (item: any) => {
    const name = item.title || item.name || 'Untitled';
    onSelect(tab, item.id, name, relationType);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('relations.addRelation')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Relation type selector */}
        <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
            {t('relations.type')}
          </label>
          <select
            value={relationType}
            onChange={e => setRelationType(e.target.value as RelationType)}
            className="w-full h-8 px-2 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] border border-[var(--border-subtle)] outline-none"
          >
            {RELATION_TYPES.map(rt => (
              <option key={rt.id} value={rt.id}>
                {lang === 'es' ? rt.labelEs : rt.labelEn}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex px-4 border-b border-[var(--border-subtle)]">
          {TABS.map(t => (
            <button
              key={t.type}
              onClick={() => setTab(t.type)}
              className={`flex items-center gap-1.5 h-9 px-3 text-[12px] font-medium border-b-2 transition ${
                tab === t.type
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {lang === 'es' ? t.labelEs : t.labelEn}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('relations.searchEntity')}
              autoFocus
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">{t('common.noResults')}</p>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--text-primary)] truncate block">
                    {item.title || item.name || 'Untitled'}
                  </span>
                  {item.status && (
                    <span className="text-[11px] text-[var(--text-muted)]">{item.status}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
