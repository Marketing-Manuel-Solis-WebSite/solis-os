'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldX, Plug } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import IntegrationCatalog from '@/components/integrations/integration-catalog';
import ApiKeyManager from '@/components/integrations/api-key-manager';
import WebhookManager from '@/components/integrations/webhook-manager';
import ActivityLog from '@/components/integrations/activity-log';

const TABS = ['catalog', 'apiKeys', 'webhooks', 'incoming', 'activity'] as const;
type Tab = typeof TABS[number];

export default function IntegrationsPage() {
  const { me, can } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('catalog');
  const [loading, setLoading] = useState(true);

  const hasAccess = can('integration', 'manage') || me?.role === 'owner' || me?.role === 'admin';

  useEffect(() => { setLoading(false); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center">
          <ShieldX className="h-7 w-7 text-[var(--error)]" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-[var(--text-muted)]">{t('integ.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
          <Plug className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('integ.title')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('integ.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-xl w-fit mb-6">
        {TABS.map(tb => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === tb
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t(`integ.tab.${tb}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tab === 'catalog' && <IntegrationCatalog />}
        {tab === 'apiKeys' && <ApiKeyManager />}
        {(tab === 'webhooks' || tab === 'incoming') && <WebhookManager mode={tab} />}
        {tab === 'activity' && <ActivityLog />}
      </motion.div>
    </div>
  );
}
