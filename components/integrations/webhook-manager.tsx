'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Webhook, Send, Trash2, X, Copy, Check,
  ChevronDown, ChevronRight, Link2,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import {
  getWebhooks, getIncomingWebhooks,
} from '@/lib/integrations-db';
import { ALL_EVENTS } from '@/lib/integrations-types';
import type { WebhookEvent } from '@/lib/integrations-types';
import { useToast } from '@/components/notifications/toast-provider';
import WebhookLogs from './webhook-logs';

interface Props {
  mode: 'webhooks' | 'incoming';
}

export default function WebhookManager({ mode }: Props) {
  return mode === 'webhooks' ? <OutgoingWebhooks /> : <IncomingWebhooks />;
}

// ============================================
// OUTGOING WEBHOOKS
// ============================================
function OutgoingWebhooks() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [creating, setCreating] = useState(false);

  const loadWebhooks = useCallback(() => {
    getWebhooks().then(setWebhooks).catch(() => setWebhooks([]));
  }, []);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  const handleCreate = async () => {
    if (!name.trim() || !url.trim() || events.length === 0) return;
    setCreating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/integrations/webhooks-manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          events,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error');

      setShowCreate(false);
      setName('');
      setUrl('');
      setEvents([]);
      loadWebhooks();
      toast.success(t('integ.webhook.add'));
    } catch {
      toast.error('Error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch(`/api/integrations/webhooks-manage/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error();
      toast.success(t('integ.webhook.delete'));
      setDeleteConfirm(null);
      loadWebhooks();
    } catch {
      toast.error('Error');
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    await fetch(`/api/integrations/webhooks-manage/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ active: !active }),
    });
    loadWebhooks();
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId: id }),
      });
      if (res.ok) toast.success(t('integ.webhook.testSent'));
      else toast.error(t('integ.webhook.testFailed'));
    } catch {
      toast.error(t('integ.webhook.testFailed'));
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('integ.webhook.title')}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t('integ.webhook.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
        >
          <Plus className="h-4 w-4" /> {t('integ.webhook.add')}
        </motion.button>
      </div>

      {/* Create Modal */}
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
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('integ.webhook.add')}</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
                  <X className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">
                    {t('integ.webhook.name')}
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('integ.webhook.namePlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">
                    {t('integ.webhook.url')}
                  </label>
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder={t('integ.webhook.urlPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">
                    {t('integ.webhook.events')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {ALL_EVENTS.map(ev => (
                      <label
                        key={ev.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                          events.includes(ev.value)
                            ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                            : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={events.includes(ev.value)}
                          onChange={() => toggleEvent(ev.value)}
                          className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-3.5 w-3.5"
                        />
                        {t(ev.labelKey)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
                  {t('common.cancel')}
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  disabled={!name.trim() || !url.trim() || events.length === 0 || creating}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {t('integ.webhook.add')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-3">
            <Webhook className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t('integ.webhook.noWebhooks')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('integ.webhook.noWebhooksDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh: any, i: number) => (
            <motion.div
              key={wh.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-[var(--bg-elevated)] shadow-card overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${wh.active ? 'bg-green-500/10' : 'bg-[var(--bg-tertiary)]'}`}>
                    <Webhook className={`h-4 w-4 ${wh.active ? 'text-green-500' : 'text-[var(--text-muted)]'}`} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{wh.name}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono truncate">{wh.url}</p>
                  </div>

                  <button
                    onClick={() => handleToggle(wh.id, wh.active)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      wh.active ? 'bg-green-500/10 text-green-500' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                    }`}
                  >
                    {wh.active ? t('integ.webhook.active') : t('integ.webhook.inactive')}
                  </button>
                  <button onClick={() => handleTest(wh.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" title={t('integ.webhook.test')}>
                    <Send className="h-4 w-4" />
                  </button>
                  {deleteConfirm === wh.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(wh.id)} className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-[var(--error)]">{t('common.confirm')}</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-lg text-xs text-[var(--text-muted)]">{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(wh.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t('integ.webhook.events')}: {wh.events?.length || 0}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t('integ.webhook.deliveryStats', {
                      success: wh.deliveryStats?.success || 0,
                      total: wh.deliveryStats?.total || 0,
                    })}
                  </span>
                  <button
                    onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                    className="text-[11px] text-[var(--accent)] font-medium flex items-center gap-1 ml-auto hover:underline"
                  >
                    {expandedId === wh.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {t('integ.webhook.logs')}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === wh.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[var(--border-subtle)]"
                  >
                    <WebhookLogs webhookId={wh.id} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// INCOMING WEBHOOKS
// ============================================
function IncomingWebhooks() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [actionType, setActionType] = useState<'create_task' | 'create_notification' | 'trigger_automation'>('create_task');
  const [creating, setCreating] = useState(false);

  const loadEndpoints = useCallback(() => {
    getIncomingWebhooks().then(setEndpoints).catch(() => setEndpoints([]));
  }, []);

  useEffect(() => { loadEndpoints(); }, [loadEndpoints]);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/integrations/incoming-manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          provider: provider.trim() || 'custom',
          actionType,
          actionConfig: {},
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error');

      setShowCreate(false);
      setName('');
      setProvider('');
      loadEndpoints();
      toast.success(t('integ.incoming.add'));
    } catch {
      toast.error('Error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch(`/api/integrations/incoming-manage/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error();
      toast.success(t('integ.incoming.delete'));
      setDeleteConfirm(null);
      loadEndpoints();
    } catch {
      toast.error('Error');
    }
  };

  const copyUrl = async (token: string, id: string) => {
    await navigator.clipboard.writeText(`${appUrl}/api/incoming/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('integ.incoming.title')}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t('integ.incoming.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-md"
        >
          <Plus className="h-4 w-4" /> {t('integ.incoming.add')}
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
              className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-modal overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('integ.incoming.add')}</h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
                  <X className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">{t('integ.incoming.name')}</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder={t('integ.incoming.namePlaceholder')} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">{t('integ.incoming.provider')}</label>
                  <input value={provider} onChange={e => setProvider(e.target.value)} placeholder={t('integ.incoming.providerPlaceholder')} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">{t('integ.incoming.action')}</label>
                  <select value={actionType} onChange={e => setActionType(e.target.value as any)} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
                    <option value="create_task">{t('integ.incoming.actionCreateTask')}</option>
                    <option value="create_notification">{t('integ.incoming.actionNotification')}</option>
                    <option value="trigger_automation">{t('integ.incoming.actionAutomation')}</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">{t('common.cancel')}</button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleCreate} disabled={!name.trim() || creating} className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50">
                  {t('integ.incoming.add')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Endpoints List */}
      {endpoints.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-3">
            <Link2 className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t('integ.incoming.noEndpoints')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('integ.incoming.noEndpointsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep: any, i: number) => (
            <motion.div
              key={ep.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-[var(--bg-elevated)] shadow-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{ep.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{ep.provider || 'custom'}</p>
                </div>
                <button
                  onClick={() => copyUrl(ep.token, ep.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent)] bg-[var(--accent-subtle)] hover:bg-[var(--accent)]/20 transition-colors flex items-center gap-1"
                >
                  {copiedId === ep.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {t('integ.incoming.copyUrl')}
                </button>
                {deleteConfirm === ep.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => handleDelete(ep.id)} className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-[var(--error)]">{t('common.confirm')}</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-lg text-xs text-[var(--text-muted)]">{t('common.cancel')}</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(ep.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                <span>{t('integ.incoming.eventCount', { n: ep.eventCount || 0 })}</span>
                <span className="font-mono truncate flex-1">{appUrl}/api/incoming/{ep.token}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
