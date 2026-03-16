'use client';

import { useState } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  RESOURCE_TYPES, PERM_ACTIONS, emptyPermissions,
  type CustomRole, type ResourceType, type PermAction,
} from '@/lib/custom-roles';

interface CustomRoleEditorProps {
  role?: CustomRole;
  onSave: (data: { name: string; description?: string; permissions: Record<ResourceType, Record<PermAction, boolean>> }) => Promise<void>;
  onCancel: () => void;
}

const RESOURCE_LABELS: Record<ResourceType, { en: string; es: string }> = {
  task: { en: 'Tasks', es: 'Tareas' },
  doc: { en: 'Documents', es: 'Documentos' },
  list: { en: 'Lists', es: 'Listas' },
  space: { en: 'Spaces', es: 'Espacios' },
  goal: { en: 'Goals', es: 'Objetivos' },
  automation: { en: 'Automations', es: 'Automatizaciones' },
  channel: { en: 'Channels', es: 'Canales' },
};

const ACTION_LABELS: Record<PermAction, { en: string; es: string }> = {
  create: { en: 'Create', es: 'Crear' },
  read: { en: 'Read', es: 'Leer' },
  update: { en: 'Update', es: 'Editar' },
  delete: { en: 'Delete', es: 'Eliminar' },
  manage: { en: 'Manage', es: 'Gestionar' },
};

export default function CustomRoleEditor({ role, onSave, onCancel }: CustomRoleEditorProps) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [permissions, setPermissions] = useState<Record<ResourceType, Record<PermAction, boolean>>>(
    role?.permissions || emptyPermissions()
  );
  const [saving, setSaving] = useState(false);

  const togglePerm = (resource: ResourceType, action: PermAction) => {
    setPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: !prev[resource][action],
      },
    }));
  };

  const toggleResourceRow = (resource: ResourceType) => {
    const allOn = PERM_ACTIONS.every(a => permissions[resource][a]);
    setPermissions(prev => ({
      ...prev,
      [resource]: Object.fromEntries(PERM_ACTIONS.map(a => [a, !allOn])) as Record<PermAction, boolean>,
    }));
  };

  const toggleActionColumn = (action: PermAction) => {
    const allOn = RESOURCE_TYPES.every(r => permissions[r][action]);
    setPermissions(prev => {
      const next = { ...prev };
      for (const r of RESOURCE_TYPES) {
        next[r] = { ...next[r], [action]: !allOn };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      });
    } catch {
      // Error handled by caller
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!role;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {isEditing ? t('customRoles.editRole') : t('customRoles.createRole')}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Name & description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customRoles.roleName')}
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={lang === 'es' ? 'Nombre del rol' : 'Role name'}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 block">
                {t('customRoles.description')}
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={lang === 'es' ? 'Descripcion opcional' : 'Optional description'}
                className="w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* Permission matrix */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3 block">
              {t('customRoles.permissions')}
            </label>
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--bg-secondary)]">
                    <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold w-40">
                      {t('customRoles.resource')}
                    </th>
                    {PERM_ACTIONS.map(action => (
                      <th key={action} className="text-center px-2 py-2.5">
                        <button
                          onClick={() => toggleActionColumn(action)}
                          className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold hover:text-[var(--accent)] transition"
                          title={lang === 'es' ? 'Alternar columna' : 'Toggle column'}
                        >
                          {lang === 'es' ? ACTION_LABELS[action].es : ACTION_LABELS[action].en}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCE_TYPES.map((resource, idx) => (
                    <tr
                      key={resource}
                      className={idx % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-secondary)]/50'}
                    >
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleResourceRow(resource)}
                          className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition"
                          title={lang === 'es' ? 'Alternar fila' : 'Toggle row'}
                        >
                          {lang === 'es' ? RESOURCE_LABELS[resource].es : RESOURCE_LABELS[resource].en}
                        </button>
                      </td>
                      {PERM_ACTIONS.map(action => (
                        <td key={action} className="text-center px-2 py-2">
                          <input
                            type="checkbox"
                            checked={permissions[resource][action]}
                            onChange={() => togglePerm(resource, action)}
                            className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={onCancel}
            className="px-4 h-9 rounded-xl bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 h-9 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
