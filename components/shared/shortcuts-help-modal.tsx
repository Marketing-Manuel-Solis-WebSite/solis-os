'use client';

// ============================================================
// Keyboard Shortcuts Help Modal — Shows all available shortcuts
// grouped by category, with search.
// ============================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { GLOBAL_SHORTCUTS, type ShortcutDef } from '@/lib/hooks/use-global-shortcuts';
import { X, Search, Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KBD({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] text-[11px] font-mono font-semibold text-[var(--text-secondary)] shadow-sm">
      {children}
    </kbd>
  );
}

const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  navigation: { en: 'Navigation', es: 'Navegación' },
  creation: { en: 'Creation', es: 'Creación' },
  views: { en: 'Views', es: 'Vistas' },
  other: { en: 'Other', es: 'Otros' },
};

export default function ShortcutsHelpModal({ open, onOpenChange }: Props) {
  const { lang } = useI18n();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return GLOBAL_SHORTCUTS;
    const q = search.toLowerCase();
    return GLOBAL_SHORTCUTS.filter(s =>
      s.description.toLowerCase().includes(q) ||
      s.descriptionEs.toLowerCase().includes(q) ||
      s.keys.join(' ').includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const cats = new Map<string, ShortcutDef[]>();
    for (const s of filtered) {
      const list = cats.get(s.category);
      if (list) list.push(s);
      else cats.set(s.category, [s]);
    }
    return cats;
  }, [filtered]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-base)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {lang === 'es' ? 'Atajos de Teclado' : 'Keyboard Shortcuts'}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'es' ? 'Buscar atajo...' : 'Search shortcuts...'}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-elevated)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-0 focus:ring-1 focus:ring-[var(--accent)] outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="max-h-80 overflow-y-auto px-5 py-3 space-y-4">
          {grouped.size === 0 ? (
            <p className="text-center text-[13px] text-[var(--text-muted)] py-4">
              {lang === 'es' ? 'Sin resultados' : 'No results'}
            </p>
          ) : (
            Array.from(grouped.entries()).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[category]?.[lang] || category}
                </h3>
                <div className="space-y-1">
                  {shortcuts.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--bg-hover)] transition">
                      <span className="text-[13px] text-[var(--text-secondary)]">
                        {lang === 'es' ? s.descriptionEs : s.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-[10px] text-[var(--text-muted)] mx-0.5">{lang === 'es' ? 'luego' : 'then'}</span>}
                            <KBD>{k.toUpperCase()}</KBD>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-center">
          <p className="text-[11px] text-[var(--text-muted)]">
            {lang === 'es' ? 'Presiona' : 'Press'} <KBD>?</KBD> {lang === 'es' ? 'para ver estos atajos' : 'to show these shortcuts'}
          </p>
        </div>
      </div>
    </div>
  );
}
