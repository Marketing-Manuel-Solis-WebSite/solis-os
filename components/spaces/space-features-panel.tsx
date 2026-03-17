'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import {
  getSpaceFeatures, saveSpaceFeatures, resetSpaceFeatures,
  ALL_FEATURES, MINIMAL_FEATURES, FEATURE_CATALOG,
  type SpaceFeatures, type SpaceFeatureMeta,
} from '@/lib/space-features';
import {
  Settings, RotateCcw, Zap, Loader2, Check,
  Flag, Tag, Columns3, ListTree, ListChecks, Link2, Shapes,
  Repeat, CalendarRange, Paperclip, Clock, Hourglass, Users, Eye,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Flag, Tag, Columns3, ListTree, ListChecks, Link2, Shapes,
  Repeat, CalendarRange, Paperclip, Clock, Hourglass, Users, Eye,
};

const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  tasks: { en: 'Task Features', es: 'Funciones de tareas' },
  tracking: { en: 'Time & Tracking', es: 'Tiempo y seguimiento' },
  collaboration: { en: 'Collaboration', es: 'Colaboracion' },
};

interface SpaceFeaturesPanelProps {
  spaceId: string;
  onClose?: () => void;
}

export default function SpaceFeaturesPanel({ spaceId, onClose }: SpaceFeaturesPanelProps) {
  const { user, isManager } = useAuth();
  const { t, lang: locale } = useI18n();
  const toast = useToast();

  const [features, setFeatures] = useState<SpaceFeatures>(ALL_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load
  useEffect(() => {
    getSpaceFeatures(spaceId)
      .then(f => { setFeatures(f); setLoading(false); })
      .catch(() => setLoading(false));
  }, [spaceId]);

  // Toggle a feature
  const toggle = useCallback((key: keyof SpaceFeatures) => {
    if (!isManager) return;
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  }, [isManager]);

  // Save
  const save = useCallback(async () => {
    if (!user?.uid || !dirty) return;
    setSaving(true);
    try {
      await saveSpaceFeatures(spaceId, features, user.uid);
      setDirty(false);
      toast.success(
        locale === 'es' ? 'Configuracion guardada' : 'Settings saved',
        locale === 'es' ? 'Los cambios se aplicaran a este espacio' : 'Changes will apply to this space',
      );
    } catch {
      toast.error(
        locale === 'es' ? 'Error al guardar' : 'Failed to save',
        '',
      );
    }
    setSaving(false);
  }, [spaceId, features, user?.uid, dirty, toast, locale]);

  // Presets
  const applyPreset = useCallback((preset: SpaceFeatures) => {
    if (!isManager) return;
    setFeatures(preset);
    setDirty(true);
  }, [isManager]);

  const reset = useCallback(async () => {
    if (!user?.uid) return;
    setSaving(true);
    await resetSpaceFeatures(spaceId, user.uid);
    setFeatures(ALL_FEATURES);
    setDirty(false);
    setSaving(false);
    toast.success(
      locale === 'es' ? 'Reiniciado' : 'Reset',
      locale === 'es' ? 'Todas las funciones habilitadas' : 'All features enabled',
    );
  }, [spaceId, user?.uid, toast, locale]);

  // Count enabled
  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = Object.keys(ALL_FEATURES).length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  // Group features by category
  const categories = ['tasks', 'tracking', 'collaboration'] as const;

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
            <Settings className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {locale === 'es' ? 'Funciones del espacio' : 'Space Features'}
            </h3>
            <p className="text-[12px] text-[var(--text-muted)]">
              {enabledCount}/{totalCount} {locale === 'es' ? 'habilitadas' : 'enabled'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="px-4 h-8 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-sm font-medium transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {locale === 'es' ? 'Guardar' : 'Save'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="px-3 h-8 rounded-lg bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
              {locale === 'es' ? 'Cerrar' : 'Close'}
            </button>
          )}
        </div>
      </div>

      {/* Presets */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[12px] text-[var(--text-muted)] font-semibold uppercase">
          {locale === 'es' ? 'Presets' : 'Presets'}:
        </span>
        <button
          onClick={() => applyPreset(ALL_FEATURES)}
          disabled={!isManager}
          className="px-3 py-1 rounded-lg text-[12px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition disabled:opacity-50"
        >
          <Zap className="h-3 w-3 inline mr-1" />
          {locale === 'es' ? 'Todo activado' : 'All on'}
        </button>
        <button
          onClick={() => applyPreset(MINIMAL_FEATURES)}
          disabled={!isManager}
          className="px-3 py-1 rounded-lg text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition disabled:opacity-50"
        >
          {locale === 'es' ? 'Minimo' : 'Minimal'}
        </button>
        <button
          onClick={reset}
          disabled={!isManager || saving}
          className="px-3 py-1 rounded-lg text-[12px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-secondary)] transition disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3 inline mr-1" />
          {locale === 'es' ? 'Reiniciar' : 'Reset'}
        </button>
      </div>

      {/* Feature toggles by category */}
      {categories.map(cat => {
        const catFeatures = FEATURE_CATALOG.filter(f => f.category === cat);
        const label = CATEGORY_LABELS[cat];

        return (
          <div key={cat} className="mb-5">
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
              {locale === 'es' ? label.es : label.en}
            </h4>
            <div className="space-y-1">
              {catFeatures.map(meta => {
                const Icon = ICON_MAP[meta.icon] || Settings;
                const enabled = features[meta.key];

                return (
                  <button
                    key={meta.key}
                    onClick={() => toggle(meta.key)}
                    disabled={!isManager}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition group text-left ${
                      enabled
                        ? 'bg-[var(--bg-secondary)] shadow-card'
                        : 'bg-[var(--bg-base)] opacity-60 hover:opacity-80'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className={`p-1.5 rounded-lg border shrink-0 transition ${
                      enabled
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {locale === 'es' ? meta.nameEs : meta.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {locale === 'es' ? meta.descriptionEs : meta.description}
                      </p>
                    </div>
                    {/* Toggle indicator */}
                    <div className={`w-9 h-5 rounded-full shrink-0 transition-colors relative ${
                      enabled ? 'bg-emerald-500' : 'bg-[var(--bg-tertiary)]'
                    }`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Disabled state message */}
      {!isManager && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
          {locale === 'es'
            ? 'Solo los managers y administradores pueden cambiar la configuracion del espacio.'
            : 'Only managers and admins can change space feature settings.'}
        </div>
      )}
    </div>
  );
}
