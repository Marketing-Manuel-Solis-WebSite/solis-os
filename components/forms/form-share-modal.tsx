'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, RefreshCw, ExternalLink, Globe, AlertCircle } from 'lucide-react';
import type { FormDocument } from './constants';
import { useI18n } from '@/lib/i18n';
import { updateForm, regenerateFormToken } from '@/lib/db';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  form: FormDocument;
  onClose: () => void;
  onUpdate: (form: FormDocument) => void;
}

export default function FormShareModal({ form, onClose, onUpdate }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/forms/${form.publicToken}`
    : `/forms/${form.publicToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success(t('formShare.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm(t('formShare.regenerateConfirm'))) return;
    setRegenerating(true);
    try {
      const newToken = await regenerateFormToken(form.id);
      onUpdate({ ...form, publicToken: newToken });
      toast.success(t('formShare.copied'));
    } catch {
      toast.error(t('conversion.error'));
    } finally {
      setRegenerating(false);
    }
  };

  const handlePublish = async () => {
    try {
      await updateForm(form.id, { status: 'published' });
      onUpdate({ ...form, status: 'published' });
      toast.success(t('forms.publish'));
    } catch {
      toast.error(t('conversion.error'));
    }
  };

  const isPublished = form.status === 'published';

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
              <Share2Icon className="h-4.5 w-4.5 text-[var(--accent)]" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t('formShare.title')}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            {isPublished ? (
              <>
                {/* Status indicator */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Globe className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-sm font-medium text-green-600">{t('formShare.liveNow') || 'Tu formulario esta activo'}</p>
                </div>

                <div>
                  <label className="block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold">{t('formShare.publicUrl')}</label>
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
                    <ExternalLink className="h-3.5 w-3.5" /> {t('forms.preview')}
                  </a>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} /> {t('formShare.regenerate')}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{t('formShare.notPublished')}</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">{t('formShare.publishDesc') || 'Publica tu formulario para compartir el enlace'}</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePublish}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-all shadow-sm"
                >
                  <Globe className="h-4 w-4" />
                  {t('formShare.publishFirst')}
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Share2Icon({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
}
