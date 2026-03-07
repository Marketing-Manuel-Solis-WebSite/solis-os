'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useGlobalSearch } from '@/lib/hooks/use-global-search';
import {
  SearchResult, QuickAction, ENTITY_CONFIG, highlightMatch,
} from '@/lib/search-utils';
import { Search, ArrowRight, Loader2, Command as CommandIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { results, actions, loading, search } = useGlobalSearch();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(value, lang);
    }, 200);
  }, [search, lang]);

  // Handle selection
  const handleSelect = useCallback((value: string) => {
    onClose();
    // Quick actions
    if (value.startsWith('action:')) {
      const actionId = value.replace('action:', '');
      const action = actions.find(a => a.id === actionId);
      if (action?.href) router.push(action.href);
      return;
    }
    // Entity results
    if (value.startsWith('result:')) {
      const [, type, id] = value.split(':');
      const result = results.find(r => r.id === id && r.type === type);
      if (result?.href) router.push(result.href);
    }
  }, [actions, results, router, onClose]);

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const hasResults = results.length > 0 || actions.length > 0;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-[640px]"
          >
            <Command
              className="bg-[var(--bg-elevated)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]"
              shouldFilter={false}
              loop
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-subtle)]">
                {loading ? (
                  <Loader2 className="h-5 w-5 text-[var(--text-muted)] animate-spin shrink-0" />
                ) : (
                  <Search className="h-5 w-5 text-[var(--text-muted)] shrink-0" strokeWidth={1.75} />
                )}
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={handleChange}
                  placeholder={t('commandPalette.placeholder')}
                  className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[11px] text-[var(--text-muted)] font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
                {query && !loading && !hasResults && (
                  <Command.Empty className="py-8 text-center text-sm text-[var(--text-muted)]">
                    {t('commandPalette.noResults')}
                  </Command.Empty>
                )}

                {/* Quick actions */}
                {actions.length > 0 && (
                  <Command.Group heading={t('commandPalette.actions')} className="cmdk-group">
                    {actions.map(action => (
                      <Command.Item
                        key={action.id}
                        value={`action:${action.id}`}
                        onSelect={handleSelect}
                        className="cmdk-item"
                      >
                        <action.icon className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={1.75} />
                        <span className="flex-1 text-sm text-[var(--text-primary)]">
                          {lang === 'es' ? action.labelEs : action.label}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Entity results grouped by type */}
                {Object.entries(grouped).map(([type, items]) => {
                  const config = ENTITY_CONFIG[type as keyof typeof ENTITY_CONFIG];
                  if (!config) return null;
                  return (
                    <Command.Group
                      key={type}
                      heading={lang === 'es' ? config.labelEs : config.labelEn}
                      className="cmdk-group"
                    >
                      {items.map(item => {
                        const Icon = config.icon;
                        const segments = highlightMatch(item.title, query);
                        return (
                          <Command.Item
                            key={`${item.type}:${item.id}`}
                            value={`result:${item.type}:${item.id}`}
                            onSelect={handleSelect}
                            className="cmdk-item"
                          >
                            <Icon className="h-4 w-4 shrink-0" style={{ color: config.color }} strokeWidth={1.75} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-[var(--text-primary)] truncate block">
                                {segments.map((seg, i) =>
                                  seg.highlight ? (
                                    <mark key={i} className="bg-[var(--accent-subtle)] text-[var(--accent)] rounded-sm px-0.5">
                                      {seg.text}
                                    </mark>
                                  ) : (
                                    <span key={i}>{seg.text}</span>
                                  )
                                )}
                              </span>
                              {item.subtitle && (
                                <span className="text-[12px] text-[var(--text-muted)] truncate block">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  );
                })}

                {/* Empty state — show navigation when no query */}
                {!query && (
                  <Command.Group heading={t('commandPalette.navigate')} className="cmdk-group">
                    {[
                      { label: 'Dashboard', href: '/app', icon: ENTITY_CONFIG.task.icon },
                      { label: lang === 'es' ? 'Tareas' : 'Tasks', href: '/app/tasks', icon: ENTITY_CONFIG.task.icon },
                      { label: lang === 'es' ? 'Documentos' : 'Documents', href: '/app/docs', icon: ENTITY_CONFIG.doc.icon },
                      { label: 'Chat', href: '/app/chat', icon: ENTITY_CONFIG.channel.icon },
                      { label: lang === 'es' ? 'Metas' : 'Goals', href: '/app/goals', icon: ENTITY_CONFIG.goal.icon },
                    ].map(item => (
                      <Command.Item
                        key={item.href}
                        value={`nav:${item.href}`}
                        onSelect={() => { onClose(); router.push(item.href); }}
                        className="cmdk-item"
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} />
                        <span className="flex-1 text-sm text-[var(--text-primary)]">{item.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]/50">
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[10px]">↑↓</kbd>
                    {t('commandPalette.navigate')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[10px]">↵</kbd>
                    {t('commandPalette.open')}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                  <CommandIcon className="h-3 w-3" />
                  K
                </span>
              </div>
            </Command>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
