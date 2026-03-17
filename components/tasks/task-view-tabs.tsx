'use client';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  Inbox, User, Sun, CalendarClock, AlertTriangle, Eye, Bookmark, Plus,
  MoreHorizontal, Pin, Copy, Share2, Pencil, Trash2, X, UserCheck, Globe,
  Lock, Star, Link, Loader2, Check,
} from 'lucide-react';
import type { ViewDefinition } from '@/types';
import { BUILT_IN_PRESETS, type ViewPreset, SavedView } from './constants';

interface Props {
  activePreset: string;
  savedViews: SavedView[];
  pinnedPresets: string[];
  onPresetChange: (id: string) => void;
  onSaveView: () => void;
  onLoadView: (sv: SavedView) => void;
  onDeleteView?: (id: string) => void;
  onDuplicateView?: (sv: SavedView) => void;
  onTogglePin?: (id: string) => void;
  onRenameView?: (id: string, name: string) => void;
  allPresets?: ViewPreset[];
  // Shared views
  sharedViews?: SavedView[];
  onDeleteSharedView?: (id: string) => void;
  onDuplicateSharedView?: (sv: SavedView) => void;
  onPromoteView?: (sv: SavedView) => void;
  onDemoteView?: (id: string) => void;
  canManageShared?: boolean;
  // Firestore first-class views
  firestoreViews?: ViewDefinition[];
  onPinView?: (viewId: string) => void;
  onSetDefaultView?: (viewId: string) => void;
  onShareViewLink?: (viewId: string) => void;
  // View autosave status indicator
  saveStatus?: null | 'saving' | 'saved';
}

const PRESET_ICONS: Record<string, any> = {
  all: Inbox,
  my_tasks: User,
  created_by_me: UserCheck,
  today: Sun,
  upcoming: CalendarClock,
  overdue: AlertTriangle,
  in_review: Eye,
};

export default function TaskViewTabs({
  activePreset, savedViews, pinnedPresets, onPresetChange,
  onSaveView, onLoadView, onDeleteView, onDuplicateView, onTogglePin, onRenameView,
  allPresets,
  sharedViews, onDeleteSharedView, onDuplicateSharedView, onPromoteView, onDemoteView,
  canManageShared,
  firestoreViews, onPinView, onSetDefaultView, onShareViewLink,
  saveStatus,
}: Props) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const presetSource = allPresets || BUILT_IN_PRESETS;
  const visiblePresets = presetSource.filter(p => pinnedPresets.includes(p.id));
  const hasShared = sharedViews && sharedViews.length > 0;

  // Helper: find matching Firestore ViewDefinition for a SavedView
  const findFsView = (sv: SavedView): ViewDefinition | undefined =>
    firestoreViews?.find(v => v.name === sv.name && v.createdBy === sv.createdBy);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
      {/* Built-in preset tabs */}
      {visiblePresets.map(preset => {
        const Icon = PRESET_ICONS[preset.id] || Inbox;
        const active = activePreset === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onPresetChange(preset.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
              active
                ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.75} />
            {t(`preset.${preset.id}`)}
            {active && (
              <div
                className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[var(--accent)]"
              />
            )}
          </button>
        );
      })}

      {/* My Views separator */}
      {savedViews.length > 0 && (
        <div className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" />
      )}

      {/* My Views (private) */}
      {savedViews.map(sv => {
        const active = activePreset === `saved:${sv.id}`;
        const fsView = findFsView(sv);
        return (
          <div key={sv.id} className="relative group">
            <button
              onClick={() => { onPresetChange(`saved:${sv.id}`); onLoadView(sv); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Bookmark className="h-4 w-4" strokeWidth={1.75} />
              {sv.name}
              {/* Visual indicators */}
              {fsView?.isPinned && <Pin className="h-3 w-3 text-[var(--text-muted)]" />}
              {fsView?.isDefault && <Star className="h-3 w-3 text-amber-500" />}
              {fsView?.visibility === 'required' && <Lock className="h-3 w-3 text-[var(--text-muted)]" />}
              {fsView?.shareToken && <Link className="h-3 w-3 text-[var(--text-muted)]" />}
              {active && (
                <div
                  className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[var(--accent)]"
                />
              )}
            </button>

            {/* Context menu trigger */}
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === sv.id ? null : sv.id); }}
              className="absolute -right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>

            {/* Context menu */}
            {menuOpen === sv.id && (
              <div ref={menuRef} className="absolute top-full left-0 mt-1 w-48 rounded-xl bg-[var(--bg-elevated)] shadow-lg z-50 p-1.5 anim-slide">
                {onRenameView && (
                  <button
                    onClick={() => { const name = prompt('', sv.name); if (name?.trim()) onRenameView(sv.id, name.trim()); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {t('common.rename')}
                  </button>
                )}
                {onDuplicateView && (
                  <button
                    onClick={() => { onDuplicateView(sv); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Copy className="h-3.5 w-3.5" /> {t('common.duplicate')}
                  </button>
                )}
                {onSetDefaultView && fsView && (
                  <button
                    onClick={() => { onSetDefaultView(fsView.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Star className="h-3.5 w-3.5" /> {fsView.isDefault ? t('views.unsetDefault') : t('views.makeDefault')}
                  </button>
                )}
                {onPinView && fsView && (
                  <button
                    onClick={() => { onPinView(fsView.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Pin className="h-3.5 w-3.5" /> {fsView.isPinned ? t('views.unpin') : t('views.pin')}
                  </button>
                )}
                {onShareViewLink && fsView && (
                  <button
                    onClick={() => { onShareViewLink(fsView.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Link className="h-3.5 w-3.5" /> {t('views.shareLink')}
                  </button>
                )}
                {onPromoteView && canManageShared && (
                  <button
                    onClick={() => { onPromoteView(sv); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Share2 className="h-3.5 w-3.5" /> {t('views.promoteToShared')}
                  </button>
                )}
                {onDeleteView && (
                  <>
                    <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
                    <button
                      onClick={() => { onDeleteView(sv.id); setMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--error)] hover:bg-[var(--error-bg)] transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Shared views separator */}
      {hasShared && (
        <div className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" />
      )}

      {/* Shared views (team) */}
      {sharedViews?.map(sv => {
        const key = `shared:${sv.id}`;
        const active = activePreset === key;
        const fsView = findFsView(sv);
        return (
          <div key={key} className="relative group">
            <button
              onClick={() => { onPresetChange(key); onLoadView(sv); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Globe className="h-4 w-4" strokeWidth={1.75} />
              {sv.name}
              {/* Visual indicators */}
              {fsView?.isPinned && <Pin className="h-3 w-3 text-[var(--text-muted)]" />}
              {fsView?.isDefault && <Star className="h-3 w-3 text-amber-500" />}
              {fsView?.visibility === 'required' && <Lock className="h-3 w-3 text-[var(--text-muted)]" />}
              {fsView?.shareToken && <Link className="h-3 w-3 text-[var(--text-muted)]" />}
              {active && (
                <div className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[var(--accent)]" />
              )}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === key ? null : key); }}
              className="absolute -right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>

            {menuOpen === key && (
              <div ref={menuRef} className="absolute top-full left-0 mt-1 w-48 rounded-xl bg-[var(--bg-elevated)] shadow-lg z-50 p-1.5 anim-slide">
                {onSetDefaultView && canManageShared && fsView && (
                  <button
                    onClick={() => { onSetDefaultView(fsView.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Star className="h-3.5 w-3.5" /> {fsView.isDefault ? t('views.unsetDefault') : t('views.makeDefault')}
                  </button>
                )}
                {onPinView && canManageShared && fsView && (
                  <button
                    onClick={() => { onPinView(fsView.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Pin className="h-3.5 w-3.5" /> {fsView.isPinned ? t('views.unpin') : t('views.pin')}
                  </button>
                )}
                {onShareViewLink && fsView && (
                  <button
                    onClick={() => { onShareViewLink(fsView.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Link className="h-3.5 w-3.5" /> {t('views.shareLink')}
                  </button>
                )}
                {onDuplicateSharedView && (
                  <button
                    onClick={() => { onDuplicateSharedView(sv); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Copy className="h-3.5 w-3.5" /> {t('views.copyToMyViews')}
                  </button>
                )}
                {onDemoteView && canManageShared && (
                  <button
                    onClick={() => { onDemoteView(sv.id); setMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                  >
                    <Bookmark className="h-3.5 w-3.5" /> {t('views.makePrivate')}
                  </button>
                )}
                {onDeleteSharedView && canManageShared && (
                  <>
                    <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
                    <button
                      onClick={() => { onDeleteSharedView(sv.id); setMenuOpen(null); }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[var(--error)] hover:bg-[var(--error-bg)] transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Save current view */}
      <button
        onClick={onSaveView}
        className="flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all duration-200 whitespace-nowrap shrink-0"
      >
        <Plus className="h-3 w-3" />
        {t('common.save')}
      </button>

      {/* View autosave status indicator */}
      {saveStatus && (activePreset.startsWith('saved:') || activePreset.startsWith('shared:')) && (
        <span
          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-opacity duration-300 ${
            saveStatus === 'saving'
              ? 'text-[var(--text-muted)]'
              : 'text-emerald-500'
          }`}
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('views.autoSaving')}
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              {t('views.autoSaved')}
            </>
          )}
        </span>
      )}
    </div>
  );
}
