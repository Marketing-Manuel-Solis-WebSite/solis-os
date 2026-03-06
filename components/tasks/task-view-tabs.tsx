'use client';
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import {
  Inbox, User, Sun, CalendarClock, AlertTriangle, Eye, Bookmark, Plus,
  MoreHorizontal, Pin, Copy, Share2, Pencil, Trash2, X,
} from 'lucide-react';
import { BUILT_IN_PRESETS, SavedView } from './constants';

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
}

const PRESET_ICONS: Record<string, any> = {
  all: Inbox,
  my_tasks: User,
  today: Sun,
  upcoming: CalendarClock,
  overdue: AlertTriangle,
  in_review: Eye,
};

export default function TaskViewTabs({
  activePreset, savedViews, pinnedPresets, onPresetChange,
  onSaveView, onLoadView, onDeleteView, onDuplicateView, onTogglePin, onRenameView,
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

  const visiblePresets = BUILT_IN_PRESETS.filter(p => pinnedPresets.includes(p.id));

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
              <motion.div
                layoutId="preset-indicator"
                className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[var(--accent)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}

      {/* Separator */}
      {savedViews.length > 0 && (
        <div className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" />
      )}

      {/* Saved views */}
      {savedViews.map(sv => {
        const active = activePreset === `saved:${sv.id}`;
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
              {active && (
                <motion.div
                  layoutId="preset-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[var(--accent)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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

      {/* Save current view */}
      <button
        onClick={onSaveView}
        className="flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all duration-200 whitespace-nowrap shrink-0"
      >
        <Plus className="h-3 w-3" />
        {t('common.save')}
      </button>
    </div>
  );
}
