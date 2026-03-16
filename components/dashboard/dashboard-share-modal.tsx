'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, RefreshCw, ExternalLink, Globe, Link2, Unlink } from 'lucide-react';
import type { DashboardConfig } from '@/lib/dashboard-types';
import { useI18n } from '@/lib/i18n';
import { shareDashboard, unshareDashboard, regenerateDashboardToken } from '@/lib/dashboard-db';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  dashboard: DashboardConfig;
  onClose: () => void;
  onUpdate: (dashboard: DashboardConfig) => void;
}

export default function DashboardShareModal({ dashboard, onClose, onUpdate }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const isShared = dashboard.isShared && dashboard.publicToken;

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/shared/dashboard/${dashboard.publicToken}`
    : `/shared/dashboard/${dashboard.publicToken}`;

  const handleShare = async () => {
    setSharing(true);
    try {
      const token = await shareDashboard(dashboard.id);
      onUpdate({ ...dashboard, isShared: true, publicToken: token, shareMode: 'view' });
      toast.success(t('dashboardShare.enabled'));
    } catch {
      toast.error(t('dashboardShare.error'));
    } finally {
      setSharing(false);
    }
  };

  const handleUnshare = async () => {
    setSharing(true);
    try {
      await unshareDashboard(dashboard.id);
      onUpdate({ ...dashboard, isShared: false, publicToken: undefined });
      toast.success(t('dashboardShare.disabled'));
    } catch {
      toast.error(t('dashboardShare.error'));
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success(t('dashboardShare.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm(t('dashboardShare.regenerateConfirm'))) return;
    setRegenerating(true);
    try {
      const newToken = await regenerateDashboardToken(dashboard.id);
      onUpdate({ ...dashboard, publicToken: newToken });
      toast.success(t('dashboardShare.regenerated'));
    } catch {
      toast.error(t('dashboardShare.error'));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-modal overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Link2 className="h-4.5 w-4.5 text-[var(--accent)]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t('dashboardShare.title')}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            {isShared ? (
              <>
                {/* Status indicator */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Globe className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-sm font-medium text-green-600">{t('dashboardShare.liveNow')}</p>
                </div>

                <div>
                  <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">{t('dashboardShare.publicUrl')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={publicUrl}
                      className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] px-3.5 py-2.5 outline-none font-mono"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCopy}
                      className="p-2.5 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-sm"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </motion.button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {t('dashboardShare.preview')}
                  </a>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} /> {t('dashboardShare.regenerate')}
                  </button>
                </div>

                {/* Disable sharing */}
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={handleUnshare}
                    disabled={sharing}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    <Unlink className="h-3.5 w-3.5" /> {t('dashboardShare.disable')}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
                  <Globe className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{t('dashboardShare.notShared')}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">{t('dashboardShare.shareDesc')}</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShare}
                  disabled={sharing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" />
                  {t('dashboardShare.enableSharing')}
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
