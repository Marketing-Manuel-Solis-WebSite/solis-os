'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, Check, Link2, Trash2, Plus, Shield, Clock, Eye, MessageSquare, Edit2, Loader2, Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import {
  createShareLink,
  getShareLinksForResource,
  revokeShareLink,
  type ShareLink,
  type SharePermission,
} from '@/lib/share-links';

interface Props {
  doc: { id: string; title: string };
  open: boolean;
  onClose: () => void;
}

const PERMISSION_OPTIONS: { value: SharePermission; icon: typeof Eye; labelKey: string }[] = [
  { value: 'view', icon: Eye, labelKey: 'common.view' },
  { value: 'comment', icon: MessageSquare, labelKey: 'common.comment' },
  { value: 'edit', icon: Edit2, labelKey: 'common.edit' },
];

const EXPIRY_OPTIONS = [
  { value: '24h', labelEs: '24 horas', labelEn: '24 hours' },
  { value: '7d', labelEs: '7 días', labelEn: '7 days' },
  { value: '30d', labelEs: '30 días', labelEn: '30 days' },
  { value: 'never', labelEs: 'Nunca', labelEn: 'Never' },
];

function getExpiryDate(value: string): Date | null {
  const now = new Date();
  switch (value) {
    case '24h': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default: return null;
  }
}

function formatExpiry(expiresAt: any, lang: string): string {
  if (!expiresAt) return lang === 'es' ? 'Nunca' : 'Never';
  const ms = expiresAt?.seconds ? expiresAt.seconds * 1000 : new Date(expiresAt).getTime();
  const date = new Date(ms);
  if (Date.now() > ms) return lang === 'es' ? 'Expirado' : 'Expired';
  return date.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function DocShareModal({ doc, open, onClose }: Props) {
  const { user, me } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();

  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [permission, setPermission] = useState<SharePermission>('view');
  const [expiry, setExpiry] = useState('7d');
  const [password, setPassword] = useState('');

  // Load existing links
  useEffect(() => {
    if (!open) return;
    loadLinks();
  }, [open, doc.id]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const all = await getShareLinksForResource('doc', doc.id);
      // Sort active first, then by creation date desc
      all.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setLinks(all);
    } catch {
      toast.error(t('docs.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !me) return;
    setCreating(true);
    try {
      const expiresAt = getExpiryDate(expiry);
      const result = await createShareLink({
        resourceType: 'doc',
        resourceId: doc.id,
        resourceTitle: doc.title || 'Untitled',
        permission,
        createdBy: user.uid,
        createdByName: me.displayName || user.displayName || 'Unknown',
        expiresAt,
        password: password.trim() || null,
      });

      // Build the URL and copy to clipboard
      const url = `${window.location.origin}/shared/doc/${result.token}`;
      await navigator.clipboard.writeText(url);
      toast.success(t('docs.linkCopied'));

      setShowCreate(false);
      setPermission('view');
      setExpiry('7d');
      setPassword('');
      await loadLinks();
    } catch {
      toast.error(lang === 'es' ? 'Error al crear enlace' : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (link: ShareLink) => {
    try {
      await revokeShareLink(link.id);
      toast.success(t('docs.revokeLink'));
      await loadLinks();
    } catch {
      toast.error(lang === 'es' ? 'Error al revocar' : 'Failed to revoke');
    }
  };

  const handleCopy = async (token: string, linkId: string) => {
    const url = `${window.location.origin}/shared/doc/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    toast.success(t('docs.linkCopied'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeLinks = links.filter(l => l.active);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] shadow-modal overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Link2 className="h-4.5 w-4.5 text-[var(--accent)]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t('docs.share')}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
              </div>
            ) : (
              <>
                {/* Active links */}
                {activeLinks.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t('docs.shareLink')} ({activeLinks.length})
                    </label>
                    {activeLinks.map(link => {
                      const permIcon = link.permission === 'view' ? Eye
                        : link.permission === 'comment' ? MessageSquare : Edit2;
                      const PermIcon = permIcon;
                      const isExpired = link.expiresAt && (
                        (link.expiresAt?.seconds ? link.expiresAt.seconds * 1000 : new Date(link.expiresAt).getTime()) < Date.now()
                      );

                      return (
                        <div key={link.id} className={`rounded-xl border p-3 space-y-2 ${isExpired ? 'border-red-500/20 bg-red-500/5' : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PermIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
                              <span className="text-sm font-medium text-[var(--text-primary)] capitalize">{link.permission}</span>
                              {link.password && <span title={lang === 'es' ? 'Protegido con contraseña' : 'Password protected'}><Lock className="h-3 w-3 text-amber-400" /></span>}
                              {isExpired && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">{lang === 'es' ? 'Expirado' : 'Expired'}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCopy(link.token, link.id)}
                                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition"
                                title={t('docs.linkCopied')}
                              >
                                {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleRevoke(link)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition"
                                title={t('docs.revokeLink')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </motion.button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatExpiry(link.expiresAt, lang)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {link.useCount} {lang === 'es' ? 'usos' : 'uses'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
                      <Link2 className="h-6 w-6 text-[var(--accent)]" />
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{t('docs.noActiveLinks')}</p>
                  </div>
                )}

                {/* Create new link section */}
                {showCreate ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('docs.createLink')}</h3>

                    {/* Permission */}
                    <div>
                      <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2 font-semibold">
                        {t('docs.permission')}
                      </label>
                      <div className="flex gap-2">
                        {PERMISSION_OPTIONS.map(opt => {
                          const Icon = opt.icon;
                          const isActive = permission === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setPermission(opt.value)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                isActive
                                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/30'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span className="capitalize">{opt.value}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expiry */}
                    <div>
                      <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2 font-semibold">
                        {t('docs.expiry')}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {EXPIRY_OPTIONS.map(opt => {
                          const isActive = expiry === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setExpiry(opt.value)}
                              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                isActive
                                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/30'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                              }`}
                            >
                              {lang === 'es' ? opt.labelEs : opt.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-2 font-semibold">
                        {t('docs.password')}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={lang === 'es' ? 'Dejar vacío para sin contraseña' : 'Leave empty for no password'}
                        className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] px-3.5 py-2.5 outline-none focus:border-[var(--accent)] transition placeholder:text-[var(--text-muted)]"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreate}
                        disabled={creating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                      >
                        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                        {t('docs.createLink')}
                      </motion.button>
                      <button
                        onClick={() => setShowCreate(false)}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setShowCreate(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[var(--border-default)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    {t('docs.createLink')}
                  </motion.button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
