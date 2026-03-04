'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, AlertTriangle, Copy, Check, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/notifications/toast-provider';
import type { IntegrationDef } from '@/lib/integrations-types';

interface Props {
  def: IntegrationDef;
  status: string | null;
  onClose: () => void;
  onDisconnect: () => void;
}

export default function IntegrationConnectModal({ def, status, onClose, onDisconnect }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const Icon = def.icon;
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Provider-specific webhook URLs
  const webhookUrl = def.webhookSupported
    ? `${appUrl}/api/webhooks/${def.provider}`
    : '';

  const handleOAuth = () => {
    window.location.href = `/api/oauth/${def.provider}/authorize`;
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: def.provider,
          apiKey: apiKeyValue.trim(),
          createdBy: user?.uid || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error');
      toast.success(t('integ.connect.success', { name: def.name }));
      setApiKeyValue('');
      onClose();
    } catch {
      toast.error(t('integ.connect.error', { name: def.name }));
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-modal overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--border-subtle)]">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${def.color}15` }}
          >
            <Icon className="h-5 w-5" style={{ color: def.color }} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t('integ.connect.title', { name: def.name })}
            </h2>
            {status === 'connected' && (
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t('integ.catalog.status.connected')}
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1 text-xs text-[var(--error)] font-medium mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />
                {t('integ.catalog.status.error')}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* OAuth */}
          {def.oauthSupported && status !== 'connected' && (
            <div>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleOAuth}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: def.color }}
              >
                <ExternalLink className="h-4 w-4" />
                {t('integ.connect.oauthBtn', { name: def.name })}
              </motion.button>
              <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                {t('integ.connect.oauthDesc')}
              </p>
            </div>
          )}

          {/* Webhook URL */}
          {def.webhookSupported && webhookUrl && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
                {t('integ.connect.webhookTitle')}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] font-mono truncate">
                  {webhookUrl}
                </div>
                <button
                  onClick={() => copyUrl(webhookUrl)}
                  className="px-3 py-2.5 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-[var(--text-muted)]" />}
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                {t('integ.connect.webhookDesc', { name: def.name })}
              </p>
            </div>
          )}

          {/* API Key input for manual providers */}
          {def.apiKeySupported && status !== 'connected' && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
                {t('integ.connect.apiKeyTitle')}
              </label>
              <input
                type="password"
                value={apiKeyValue}
                onChange={e => setApiKeyValue(e.target.value)}
                placeholder={t('integ.connect.apiKeyPlaceholder')}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                {t('integ.connect.apiKeyDesc', { name: def.name })}
              </p>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveApiKey}
                disabled={!apiKeyValue.trim() || saving}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('integ.connect.save')}
              </motion.button>
            </div>
          )}
        </div>

        {/* Footer — Disconnect */}
        {status === 'connected' && (
          <div className="px-6 py-4 border-t border-[var(--border-subtle)]">
            {showDisconnectConfirm ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <AlertTriangle className="h-4 w-4 text-[var(--error)] shrink-0" />
                  <p className="text-xs text-[var(--text-secondary)]">
                    {t('integ.connect.disconnectConfirm', { name: def.name })}
                  </p>
                </div>
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={onDisconnect}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--error)] hover:opacity-90 transition-opacity"
                >
                  {t('integ.connect.disconnect')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="text-xs text-[var(--error)] hover:underline font-medium"
              >
                {t('integ.connect.disconnect')}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
