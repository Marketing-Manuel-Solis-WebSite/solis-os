'use client';
import { useState, useEffect, useCallback } from 'react';
import { Link2, Plus, X, Trash2, Loader2, CheckSquare, FileText, Target, AlertCircle } from 'lucide-react';
import {
  getRelationsForEntity, createRelation, deleteRelation,
  type EntityRelation, type EntityType, type RelationType, RELATION_TYPES,
} from '@/lib/relations';
import EntityPickerModal from './entity-picker-modal';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

const ENTITY_ICONS: Record<EntityType, any> = {
  task: CheckSquare,
  doc: FileText,
  goal: Target,
};

const ENTITY_COLORS: Record<EntityType, string> = {
  task: 'var(--accent)',
  doc: '#8B5CF6',
  goal: '#F59E0B',
};

interface Props {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  canEdit?: boolean;
}

export default function EntityRelations({ entityType, entityId, entityName, canEdit = true }: Props) {
  const { t, lang } = useI18n();
  const { user, me } = useAuth();
  const [relations, setRelations] = useState<EntityRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const rels = await getRelationsForEntity(entityId);
      setRelations(rels);
      setError(false);
    } catch (err) {
      console.error('[Relations] Failed to load:', err);
      setRelations([]);
      setError(true);
    }
    setLoading(false);
  }, [entityId]);

  useEffect(() => { load(); }, [load]);

  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async (targetType: EntityType, targetId: string, targetName: string, relationType: RelationType) => {
    if (!user || !me) return;
    setAddError(null);
    try {
      await createRelation({
        sourceType: entityType,
        sourceId: entityId,
        sourceName: entityName,
        targetType,
        targetId,
        targetName,
        relationType,
        createdBy: user.uid,
        createdByName: me.displayName,
      });
      await load();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already exists')) {
        setAddError(t('relations.duplicateError'));
      } else if (msg.includes('itself')) {
        setAddError(t('relations.selfError'));
      } else {
        console.error('[Relations] Failed to create:', err);
        setAddError(t('relations.createError'));
      }
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteRelation(id);
      setRelations(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('[Relations] Failed to delete:', err);
    }
  };

  const getRelationLabel = (rel: EntityRelation) => {
    const rt = RELATION_TYPES.find(r => r.id === rel.relationType);
    return lang === 'es' ? rt?.labelEs || rel.relationType : rt?.labelEn || rel.relationType;
  };

  const getLinkedEntity = (rel: EntityRelation) => {
    if (rel.sourceId === entityId) {
      return { type: rel.targetType, id: rel.targetId, name: rel.targetName };
    }
    return { type: rel.sourceType, id: rel.sourceId, name: rel.sourceName };
  };

  const getHref = (type: EntityType, id: string) => {
    switch (type) {
      case 'task': return `/app/tasks?task=${id}`;
      case 'doc': return `/app/docs?doc=${id}`;
      case 'goal': return `/app/goals?goal=${id}`;
    }
  };

  if (loading) {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[12px]">{t('relations.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left py-1.5"
      >
        <Link2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t('relations.title')}
        </span>
        {relations.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {relations.length}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-1 space-y-1">
          {error && (
            <p className="text-[12px] text-red-400 py-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {t('relations.loadError')}
            </p>
          )}
          {!error && relations.length === 0 && (
            <p className="text-[12px] text-[var(--text-muted)] py-1">
              {t('relations.noRelations')}
            </p>
          )}

          {relations.map(rel => {
            const linked = getLinkedEntity(rel);
            const Icon = ENTITY_ICONS[linked.type];
            const color = ENTITY_COLORS[linked.type];
            return (
              <div key={rel.id} className="flex items-center gap-2 group py-1 px-1 rounded-lg hover:bg-[var(--bg-hover)] transition">
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <a href={getHref(linked.type, linked.id)} className="text-[13px] text-[var(--text-primary)] hover:text-[var(--accent)] truncate block">
                    {linked.name}
                  </a>
                  <span className="text-[10px] text-[var(--text-muted)]">{getRelationLabel(rel)}</span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(rel.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {addError && (
            <p className="text-[11px] text-red-400 py-0.5">{addError}</p>
          )}

          {canEdit && (
            <button
              onClick={() => { setShowPicker(true); setAddError(null); }}
              className="flex items-center gap-1.5 text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] py-1 transition"
            >
              <Plus className="h-3 w-3" /> {t('relations.add')}
            </button>
          )}
        </div>
      )}

      {showPicker && (
        <EntityPickerModal
          excludeId={entityId}
          onSelect={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
