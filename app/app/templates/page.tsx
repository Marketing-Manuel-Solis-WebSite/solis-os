'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Search, Plus, Briefcase, Megaphone, Code, Scale, Layers,
  Filter, LayoutGrid, Zap, CheckSquare, FileText, FolderOpen, List,
} from 'lucide-react';
import {
  getAllTemplates,
  createTemplateFromEntity,
  applyTemplate,
  type UnifiedTemplate,
  type TemplateType,
  type TemplateCategoryLabel,
} from '@/lib/template-center';
import TemplateCard from '@/components/templates/template-card';

// ---- Category sidebar config ----

const CATEGORIES: { key: TemplateCategoryLabel | 'all'; labelEs: string; labelEn: string; icon: React.ComponentType<any> }[] = [
  { key: 'all', labelEs: 'Todas', labelEn: 'All', icon: Layers },
  { key: 'PM', labelEs: 'Gestion de Proyectos', labelEn: 'Project Management', icon: Briefcase },
  { key: 'Marketing', labelEs: 'Marketing', labelEn: 'Marketing', icon: Megaphone },
  { key: 'Engineering', labelEs: 'Ingenieria', labelEn: 'Engineering', icon: Code },
  { key: 'Legal', labelEs: 'Legal', labelEn: 'Legal', icon: Scale },
  { key: 'General', labelEs: 'General', labelEn: 'General', icon: Layers },
];

// ---- Type filter config ----

const TYPE_FILTERS: { key: TemplateType | 'all'; labelEs: string; labelEn: string; icon: React.ComponentType<any> }[] = [
  { key: 'all', labelEs: 'Todos', labelEn: 'All', icon: LayoutGrid },
  { key: 'space', labelEs: 'Space', labelEn: 'Space', icon: Layers },
  { key: 'list', labelEs: 'Lista', labelEn: 'List', icon: List },
  { key: 'task', labelEs: 'Tarea', labelEn: 'Task', icon: CheckSquare },
  { key: 'doc', labelEs: 'Documento', labelEn: 'Document', icon: FileText },
  { key: 'automation', labelEs: 'Automatizacion', labelEn: 'Automation', icon: Zap },
];

export default function TemplatesPage() {
  const { user, me } = useAuth();
  const { lang } = useI18n();

  const [templates, setTemplates] = useState<UnifiedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategoryLabel | 'all'>('all');
  const [activeType, setActiveType] = useState<TemplateType | 'all'>('all');

  // Load templates
  useEffect(() => {
    setLoading(true);
    getAllTemplates()
      .then(setTemplates)
      .catch(err => console.error('[Templates] Load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // Filter templates
  const filtered = useMemo(() => {
    let result = templates;

    if (activeCategory !== 'all') {
      result = result.filter(t => t.category === activeCategory);
    }
    if (activeType !== 'all') {
      result = result.filter(t => t.type === activeType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [templates, activeCategory, activeType, search]);

  // Handle "Use Template"
  const handleUseTemplate = useCallback(async (template: UnifiedTemplate) => {
    if (!user?.uid) return;
    try {
      await applyTemplate(template.id, { userId: user.uid });
      // Refresh templates to update usage counts
      const updated = await getAllTemplates();
      setTemplates(updated);
    } catch (err) {
      console.error('[Templates] Apply failed:', err);
    }
  }, [user?.uid]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="px-6 pt-5 pb-8 max-w-[1440px] mx-auto"
    >
      {/* ---- Hero ---- */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-secondary)] to-[var(--accent)]/[0.04] p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

          <div className="relative">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-2">
              {lang === 'es' ? 'Centro de Plantillas' : 'Template Center'}
            </h1>
            <p className="text-[14px] text-[var(--text-muted)] leading-relaxed max-w-lg">
              {lang === 'es'
                ? 'Explora plantillas predefinidas o crea las tuyas para acelerar tu trabajo.'
                : 'Browse built-in templates or create your own to accelerate your work.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* ---- Layout: Sidebar + Content ---- */}
      <div className="flex gap-6">
        {/* Category sidebar */}
        <div className="w-[200px] shrink-0 hidden md:block">
          <div className="sticky top-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)] px-2 mb-2">
              {lang === 'es' ? 'Categorias' : 'Categories'}
            </p>
            <div className="space-y-0.5">
              {CATEGORIES.map(cat => {
                const active = activeCategory === cat.key;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-all duration-200 ${
                      active
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{lang === 'es' ? cat.labelEs : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search + Type filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1 min-w-0 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'es' ? 'Buscar plantillas...' : 'Search templates...'}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 transition"
              />
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {TYPE_FILTERS.map(tf => {
                const active = activeType === tf.key;
                return (
                  <button
                    key={tf.key}
                    onClick={() => setActiveType(tf.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                      active
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {lang === 'es' ? tf.labelEs : tf.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category pills for mobile */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 md:hidden">
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all duration-200 ${
                    active
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {lang === 'es' ? cat.labelEs : cat.labelEn}
                </button>
              );
            })}
          </div>

          {/* Results summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[12px] text-[var(--text-muted)]">
              {loading
                ? (lang === 'es' ? 'Cargando...' : 'Loading...')
                : `${filtered.length} ${lang === 'es' ? 'plantillas' : 'templates'}`
              }
            </p>
          </div>

          {/* Template grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
                <div className="relative w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-muted)]">
                {lang === 'es' ? 'Cargando plantillas...' : 'Loading templates...'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
                <LayoutGrid className="h-8 w-8 text-[var(--text-muted)] opacity-40" />
              </div>
              <p className="text-[14px] text-[var(--text-muted)] font-medium">
                {search
                  ? (lang === 'es' ? 'No se encontraron plantillas' : 'No templates found')
                  : (lang === 'es' ? 'No hay plantillas en esta categoria' : 'No templates in this category')
                }
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-[13px] text-[var(--accent)] hover:underline"
                >
                  {lang === 'es' ? 'Limpiar busqueda' : 'Clear search'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((template, i) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={handleUseTemplate}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
