'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Key, Copy, Check, AlertTriangle, Trash2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { onApiKeysSnapshot } from '@/lib/integrations-db';
import { ALL_SCOPES } from '@/lib/integrations-types';
import type { ApiKeyScope } from '@/lib/integrations-types';
import { useToast } from '@/components/notifications/toast-provider';

export default function ApiKeyManager() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [keys, setKeys] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState('');
  const [copied, setCopied] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);
  const [expiration, setExpiration] = useState<string>('never');
  const [creating, setCreating] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onApiKeysSnapshot(setKeys);
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || scopes.length === 0) return;
    setCreating(true);
    try {
      let expiresAt = null;
      if (expiration === '30') expiresAt = Date.now() + 30 * 86400000;
      if (expiration === '90') expiresAt = Date.now() + 90 * 86400000;
      if (expiration === '365') expiresAt = Date.now() + 365 * 86400000;

      const res = await fetch('/api/integrations/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes,
          expiresAt,
          createdBy: user?.uid || '',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error');

      setNewKeyRaw(data.raw);
      setShowCreate(false);
      setName('');
      setScopes([]);
      setExpiration('never');
    } catch {
      toast.error('Error creating API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('API key revoked');
      setRevokeConfirm(null);
    } catch {
      toast.error('Error');
    }
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(newKeyRaw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  };

  const activeKeys = keys.filter((k: any) => k.active);
  const revokedKeys = keys.filter((k: any) => !k.active);

  const formatDate = (d: any) => {
    if (!d) return t('integ.apiKeys.never');
    const date = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
    return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      {/* New key reveal */}
      <AnimatePresence>
        {newKeyRaw && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-5 rounded-xl bg-[var(--accent-subtle)] border-2 border-[var(--accent)]/30"
          >
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t('integ.apiKeys.copyWarning')}</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-base)] text-xs font-mono text-[var(--text-primary)] select-all break-all">
                {newKeyRaw}
              </code>
              <button onClick={copyKey} className="px-3 py-2.5 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => setNewKeyRaw('')}
              className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {t('common.close')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('integ.apiKeys.title')}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t('integ.apiKeys.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
        >
          <Plus className="h-4 w-4" /> {t('integ.apiKeys.generate')}
        </motion.button>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] shadow-modal overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('integ.apiKeys.generate')}</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
                  <X className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-5">
                {/* Name */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">
                    {t('integ.apiKeys.name')}
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('integ.apiKeys.namePlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                </div>

                {/* Scopes */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
                    {t('integ.apiKeys.scopes')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_SCOPES.map(scope => (
                      <label
                        key={scope.value}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          scopes.includes(scope.value)
                            ? 'bg-[var(--accent-subtle)] border border-[var(--accent)]/30'
                            : 'bg-[var(--bg-base)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={scopes.includes(scope.value)}
                          onChange={() => toggleScope(scope.value)}
                          className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-3.5 w-3.5"
                        />
                        <span className="text-xs text-[var(--text-secondary)]">{t(scope.labelKey)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Expiration */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">
                    {t('integ.apiKeys.expiration')}
                  </label>
                  <select
                    value={expiration}
                    onChange={e => setExpiration(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  >
                    <option value="never">{t('integ.apiKeys.expNever')}</option>
                    <option value="30">{t('integ.apiKeys.exp30')}</option>
                    <option value="90">{t('integ.apiKeys.exp90')}</option>
                    <option value="365">{t('integ.apiKeys.exp365')}</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors">
                  {t('common.cancel')}
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  disabled={!name.trim() || scopes.length === 0 || creating}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {t('integ.apiKeys.generate')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys list */}
      {activeKeys.length === 0 && revokedKeys.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-3">
            <Key className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t('integ.apiKeys.noKeys')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('integ.apiKeys.noKeysDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeKeys.map((key: any, i: number) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-[var(--bg-elevated)] shadow-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Key className="h-4 w-4 text-green-500" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{key.name}</p>
                  <p className="text-xs text-[var(--text-muted)] font-mono">{key.prefix}•••</p>
                </div>
                <span className="text-[11px] font-medium text-green-500 uppercase tracking-wider">{t('integ.apiKeys.active')}</span>
                {revokeConfirm === key.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleRevoke(key.id)} className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-[var(--error)] hover:opacity-90">
                      {t('common.confirm')}
                    </button>
                    <button onClick={() => setRevokeConfirm(null)} className="px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setRevokeConfirm(key.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                <span>{t('integ.apiKeys.scopes')}: {key.scopes?.length || 0}</span>
                <span>{t('integ.apiKeys.created')}: {formatDate(key.createdAt)}</span>
                <span>{t('integ.apiKeys.lastUsed')}: {formatDate(key.lastUsedAt)}</span>
                <span>{t('integ.apiKeys.expires')}: {formatDate(key.expiresAt)}</span>
              </div>
            </motion.div>
          ))}

          {revokedKeys.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                {t('integ.apiKeys.revoked')}
              </p>
              {revokedKeys.map((key: any) => (
                <div key={key.id} className="rounded-xl bg-[var(--bg-tertiary)] p-4 opacity-50 mb-2">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                    <span className="text-sm text-[var(--text-muted)] line-through">{key.name}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{key.prefix}•••</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
