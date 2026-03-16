'use client';
import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, PackageOpen } from 'lucide-react';
import { getAllTemplates, type UnifiedTemplate, type TemplateType } from '@/lib/template-center';
import TemplateCard from './template-card';

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: UnifiedTemplate) => void;
  /** Filter by specific template type */
  filterType?: TemplateType;
  /** Title override */
  title?: string;
}

export default function TemplatePickerModal({
  open,
  onClose,
  onSelect,
  filterType,
  title,
}: TemplatePickerModalProps) {
  const { lang } = useI18n();
  const [templates, setTemplates] = useState<UnifiedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAllTemplates(undefined, filterType)
      .then(setTemplates)
      .catch(err => console.error('[TemplatePicker] Failed to load:', err))
      .finally(() => setLoading(false));
  }, [open, filterType]);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const handleSelect = (template: UnifiedTemplate) => {
    onSelect(template);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border)] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {title || (lang === 'es' ? 'Seleccionar plantilla' : 'Select Template')}
                </h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  {loading
                    ? (lang === 'es' ? 'Cargando...' : 'Loading...')
                    : `${filtered.length} ${lang === 'es' ? 'plantillas disponibles' : 'templates available'}`
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-px bg-[var(--border-subtle)]" />

            {/* Search */}
            <div className="px-5 py-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'es' ? 'Buscar plantillas...' : 'Search templates...'}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 transition"
                />
              </div>
            </div>

            {/* Template grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 scrollbar-thin">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
                  <p className="text-[13px] text-[var(--text-muted)]">
                    {lang === 'es' ? 'Cargando plantillas...' : 'Loading templates...'}
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <PackageOpen className="h-10 w-10 text-[var(--text-muted)] opacity-40" />
                  <p className="text-[13px] text-[var(--text-muted)] text-center">
                    {search
                      ? (lang === 'es' ? 'No se encontraron plantillas' : 'No templates found')
                      : (lang === 'es' ? 'No hay plantillas disponibles' : 'No templates available')
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((template, i) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onUse={handleSelect}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
