'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check, ExternalLink, Info } from 'lucide-react';
import type { ConnectorDepth } from '@/lib/integrations-types';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { INTEGRATION_CATALOG, CATEGORIES } from '@/lib/integrations-catalog';
import { getIntegrations, deleteIntegration } from '@/lib/integrations-db';
import { useToast } from '@/components/notifications/toast-provider';
import IntegrationConnectModal from './integration-connect-modal';
import type { IntegrationDef, IntegrationCategory } from '@/lib/integrations-types';

export default function IntegrationCatalog() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [connected, setConnected] = useState<any[]>([]);
  const [selectedDef, setSelectedDef] = useState<IntegrationDef | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(true);

  const loadConnected = useCallback(() => {
    getIntegrations().then(setConnected).catch(() => setConnected([]));
  }, []);

  useEffect(() => { loadConnected(); }, [loadConnected]);

  const getStatus = (provider: string) => {
    const conn = connected.find((c: any) => c.provider === provider);
    return conn?.status || null;
  };

  const filtered = INTEGRATION_CATALOG.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.provider.includes(q);
    }
    return true;
  });

  // Group by category for display
  const groupedByCategory = CATEGORIES
    .filter(cat => cat.id !== 'all')
    .map(cat => ({
      ...cat,
      items: filtered.filter(item => item.category === cat.id),
    }))
    .filter(group => group.items.length > 0);

  const handleDisconnect = async (provider: string) => {
    const conn = connected.find((c: any) => c.provider === provider);
    if (!conn) return;
    try {
      await deleteIntegration(conn.id);
      loadConnected();
      toast.success(t('integ.catalog.disconnect'));
    } catch {
      toast.error('Error');
    }
  };

  const depthLabel = (d: ConnectorDepth) =>
    d === 'full' ? t('integ.depth.full') || 'Full'
    : d === 'basic' ? t('integ.depth.basic') || 'Basic'
    : d === 'read_only' ? t('integ.depth.readOnly') || 'Read-only'
    : t('integ.depth.stub') || 'Planned';

  const depthColor = (d: ConnectorDepth) =>
    d === 'full' ? 'text-green-500 bg-green-500/10'
    : d === 'basic' ? 'text-blue-500 bg-blue-500/10'
    : d === 'read_only' ? 'text-amber-500 bg-amber-500/10'
    : 'text-[var(--text-muted)] bg-[var(--bg-tertiary)]';

  const renderCard = (item: IntegrationDef, i: number) => {
    const status = getStatus(item.provider);
    const Icon = item.icon;
    return (
      <motion.div
        key={item.provider}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: i * 0.03 }}
        className={`group relative rounded-xl bg-[var(--bg-elevated)] shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden ${item.depth === 'stub' ? 'opacity-60' : ''}`}
      >
        {/* Color strip */}
        <div className="h-1 w-full" style={{ backgroundColor: item.color }} />

        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${item.color}15` }}
            >
              <Icon className="h-5 w-5" style={{ color: item.color }} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</h3>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${depthColor(item.depth)}`}>
                  {depthLabel(item.depth)}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{t(item.descriptionKey)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <span
              className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${item.color}15`, color: item.color }}
            >
              {t(`integ.category.${item.category}`)}
            </span>

            {item.comingSoon ? (
              <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)]">
                {t('integ.catalog.comingSoon')}
              </span>
            ) : status === 'connected' ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                  <Check className="h-3 w-3" /> {t('integ.catalog.connected')}
                </span>
                <button
                  onClick={() => setSelectedDef(item)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {t('integ.catalog.configure')}
                </button>
              </div>
            ) : status === 'error' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--error)] font-medium">
                  {t('integ.catalog.status.error')}
                </span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedDef(item)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                >
                  {t('integ.catalog.connect')}
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDef(item)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                {t('integ.catalog.connect')}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div>
      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('integ.catalog.search')}
            className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-xl overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                category === cat.id
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid - grouped by category */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">{t('integ.catalog.noResults')}</p>
        </div>
      ) : category === 'all' ? (
        // Show grouped by category when viewing all
        <div className="space-y-8">
          {groupedByCategory.map(group => (
            <div key={group.id}>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                {t(group.labelKey)}
                <span className="text-[var(--text-muted)] font-normal normal-case tracking-normal">({group.items.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.items.map((item, i) => renderCard(item, i))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Show flat grid when filtering by category
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, i) => renderCard(item, i))}
        </div>
      )}

      {/* Connect Modal */}
      <AnimatePresence>
        {selectedDef && (
          <IntegrationConnectModal
            def={selectedDef}
            status={getStatus(selectedDef.provider)}
            onClose={() => { setSelectedDef(null); loadConnected(); }}
            onDisconnect={() => {
              handleDisconnect(selectedDef.provider);
              setSelectedDef(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
