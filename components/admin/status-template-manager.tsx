'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, Save, Loader2, ChevronUp, ChevronDown, Users, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/notifications/toast-provider';
import { getTeams } from '@/lib/db';
import {
  getStatusTemplates, createStatusTemplate, updateStatusTemplate,
  deleteStatusTemplate, unsubscribeSpaceFromTemplate, previewBlastRadius,
  type StatusTemplate,
} from '@/lib/status-templates';
import { type StatusDef, type StatusCategory, generateStatusId, DEFAULT_STATUSES } from '@/lib/status-config';

const PRESET_COLORS = ['#64748B', '#3B82F6', '#22C55E', '#A855F7', '#EF4444', '#F59E0B', '#EC4899', '#14B8A6'];
const CATEGORIES: StatusCategory[] = ['not_started', 'active', 'done', 'closed'];
const CATEGORY_LABELS: Record<StatusCategory, { en: string; es: string }> = {
  not_started: { en: 'Not Started', es: 'No iniciado' },
  active: { en: 'Active', es: 'Activo' },
  done: { en: 'Done', es: 'Completado' },
  closed: { en: 'Closed', es: 'Cerrado' },
};
const CATEGORY_COLORS: Record<StatusCategory, string> = {
  not_started: '#64748B',
  active: '#3B82F6',
  done: '#22C55E',
  closed: '#94A3B8',
};

export default function StatusTemplateManager() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();

  const [templates, setTemplates] = useState<StatusTemplate[]>([]);
  const [teamsMap, setTeamsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StatusTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSubscribers, setShowSubscribers] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatuses, setFormStatuses] = useState<StatusDef[]>([]);

  // Blast radius confirmation
  const [blastCount, setBlastCount] = useState<number | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, allTeams] = await Promise.all([getStatusTemplates(), getTeams()]);
      setTemplates(tpls);
      const map: Record<string, string> = {};
      for (const t of allTeams) map[t.id] = (t as any).name || t.id;
      setTeamsMap(map);
    } catch (err) {
      console.error('[StatusTemplateManager] load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- Form helpers ----

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormStatuses([]);
    setEditing(null);
    setCreating(false);
    setBlastCount(null);
    setPendingUpdate(false);
  };

  const openCreate = () => {
    setFormName('');
    setFormDesc('');
    setFormStatuses(DEFAULT_STATUSES.map((s, i) => ({ ...s, order: i })));
    setCreating(true);
    setEditing(null);
    setBlastCount(null);
  };

  const openEdit = (tpl: StatusTemplate) => {
    setFormName(tpl.name);
    setFormDesc(tpl.description);
    setFormStatuses(tpl.statuses.map((s, i) => ({ ...s, order: i })));
    setEditing(tpl);
    setCreating(false);
    setBlastCount(null);
  };

  const addStatus = () => {
    setFormStatuses(prev => [
      ...prev,
      {
        id: `status_${Date.now()}`,
        name: '',
        nameEs: '',
        color: PRESET_COLORS[prev.length % PRESET_COLORS.length],
        category: 'active' as StatusCategory,
        order: prev.length,
      },
    ]);
  };

  const removeStatus = (idx: number) => {
    setFormStatuses(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const moveStatus = (idx: number, dir: -1 | 1) => {
    setFormStatuses(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  };

  const updateStatus = (idx: number, patch: Partial<StatusDef>) => {
    setFormStatuses(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const updated = { ...s, ...patch };
      // Auto-generate ID from name if name changed
      if (patch.name !== undefined && !editing) {
        updated.id = generateStatusId(patch.name) || s.id;
      }
      return updated;
    }));
  };

  const validate = (): boolean => {
    const hasStart = formStatuses.some(s => s.category === 'not_started');
    const hasDone = formStatuses.some(s => s.category === 'done');
    if (!hasStart || !hasDone) {
      toast.error(t('statusTemplates.validation'), '');
      return false;
    }
    if (!formName.trim()) {
      toast.error(t('statusTemplates.name'), '');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;

    // If editing and has subscribers, show blast radius first
    if (editing && editing.subscribedSpaces.length > 0 && blastCount === null) {
      try {
        const br = await previewBlastRadius(editing.id);
        setBlastCount(br.affectedSpaceCount);
        setPendingUpdate(true);
        return;
      } catch (err) {
        console.error('[StatusTemplateManager] blast radius error:', err);
      }
    }

    setSaving(true);
    try {
      if (editing) {
        await updateStatusTemplate(editing.id, {
          name: formName.trim(),
          description: formDesc.trim(),
          statuses: formStatuses,
        }, user.uid);
        toast.success(t('statusTemplates.updated'), '');
      } else {
        await createStatusTemplate({
          name: formName.trim(),
          description: formDesc.trim(),
          statuses: formStatuses,
          createdBy: user.uid,
        });
        toast.success(t('statusTemplates.created'), '');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Error', '');
    }
    setSaving(false);
  };

  const handleDelete = async (tpl: StatusTemplate) => {
    if (!confirm(t('statusTemplates.deleteConfirm'))) return;
    try {
      await deleteStatusTemplate(tpl.id);
      toast.success(t('statusTemplates.deleted'), '');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Error', '');
    }
  };

  const handleUnsubscribe = async (spaceId: string, templateId: string) => {
    try {
      await unsubscribeSpaceFromTemplate(spaceId, templateId);
      toast.success(t('statusTemplates.unsubscribed'), '');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Error', '');
    }
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const isEditorOpen = creating || !!editing;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('admin.statusTemplates')}</h2>
          <p className="text-[13px] text-[var(--text-muted)]">{t('admin.statusTemplatesDesc')}</p>
        </div>
        {!isEditorOpen && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" />
            {t('statusTemplates.create')}
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditorOpen && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              {editing ? t('statusTemplates.edit') : t('statusTemplates.create')}
            </h3>
            <button onClick={resetForm} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                {t('statusTemplates.name')}
              </label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder={lang === 'es' ? 'Ej: Flujo de desarrollo' : 'E.g. Development Flow'}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1">
                {t('statusTemplates.description')}
              </label>
              <input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder={lang === 'es' ? 'Descripción opcional' : 'Optional description'}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Status table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[12px] font-medium text-[var(--text-muted)]">
                {t('statusTemplates.statuses')}
              </label>
              <button
                onClick={addStatus}
                className="flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
              >
                <Plus className="h-3 w-3" />
                {t('statusTemplates.addStatus')}
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_1fr_80px_100px_auto] gap-2 items-center text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 px-1">
              <div className="w-12"></div>
              <div>{lang === 'es' ? 'Nombre (EN)' : 'Name (EN)'}</div>
              <div>{lang === 'es' ? 'Nombre (ES)' : 'Name (ES)'}</div>
              <div>{lang === 'es' ? 'Color' : 'Color'}</div>
              <div>{t('statusTemplates.category')}</div>
              <div className="w-8"></div>
            </div>

            {/* Status rows */}
            <div className="space-y-1">
              {formStatuses.map((s, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[auto_1fr_1fr_80px_100px_auto] gap-2 items-center bg-[var(--bg-tertiary)]/50 rounded-lg px-1 py-1.5"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 w-12 items-center">
                    <button
                      onClick={() => moveStatus(idx, -1)}
                      disabled={idx === 0}
                      className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => moveStatus(idx, 1)}
                      disabled={idx === formStatuses.length - 1}
                      className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Name EN */}
                  <input
                    value={s.name}
                    onChange={e => updateStatus(idx, { name: e.target.value })}
                    placeholder="Name"
                    className="px-2 py-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />

                  {/* Name ES */}
                  <input
                    value={s.nameEs}
                    onChange={e => updateStatus(idx, { nameEs: e.target.value })}
                    placeholder="Nombre"
                    className="px-2 py-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />

                  {/* Color picker */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => updateStatus(idx, { color: c })}
                        className={`w-4 h-4 rounded-full border-2 transition ${
                          s.color === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  {/* Category dropdown */}
                  <select
                    value={s.category}
                    onChange={e => updateStatus(idx, { category: e.target.value as StatusCategory })}
                    className="px-2 py-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat][lang === 'es' ? 'es' : 'en']}
                      </option>
                    ))}
                  </select>

                  {/* Remove */}
                  <button
                    onClick={() => removeStatus(idx)}
                    className="text-[var(--text-muted)] hover:text-red-400 transition w-8 flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Blast radius warning */}
          {pendingUpdate && blastCount !== null && blastCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-[13px] text-amber-300 flex-1">
                {t('statusTemplates.blastRadius').replace('{n}', String(blastCount))}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {pendingUpdate ? t('statusTemplates.confirmUpdate') : t('common.save')}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !isEditorOpen ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] opacity-40">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-[13px] text-[var(--text-muted)]">{t('statusTemplates.noTemplates')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{tpl.name}</h3>
                  {tpl.description && (
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{tpl.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => openEdit(tpl)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tpl.statuses.map(s => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: s.color + '20', color: s.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {lang === 'es' ? s.nameEs || s.name : s.name}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                <span>{tpl.statuses.length} {lang === 'es' ? 'estados' : 'statuses'}</span>
                <span>{t('statusTemplates.version').replace('{n}', String(tpl.version))}</span>
                <button
                  onClick={() => setShowSubscribers(showSubscribers === tpl.id ? null : tpl.id)}
                  className="flex items-center gap-1 hover:text-[var(--accent)] transition"
                >
                  <Users className="h-3 w-3" />
                  {t('statusTemplates.subscriberCount').replace('{n}', String(tpl.subscribedSpaces.length))}
                </button>
              </div>

              {/* Subscriber panel */}
              {showSubscribers === tpl.id && tpl.subscribedSpaces.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <p className="text-[12px] font-medium text-[var(--text-muted)] mb-2">
                    {t('statusTemplates.subscribers')}
                  </p>
                  <div className="space-y-1.5">
                    {tpl.subscribedSpaces.map(sid => (
                      <div key={sid} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50">
                        <span className="text-[12px] text-[var(--text-secondary)]">
                          {teamsMap[sid] || sid}
                        </span>
                        <button
                          onClick={() => handleUnsubscribe(sid, tpl.id)}
                          className="text-[11px] text-red-400 hover:underline"
                        >
                          {t('statusTemplates.unsubscribe')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
