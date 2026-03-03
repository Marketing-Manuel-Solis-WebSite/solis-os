'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
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
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('formShare.title')}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {isPublished ? (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">{t('formShare.publicUrl')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={publicUrl}
                      className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] px-3 py-2 outline-none"
                    />
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {t('forms.preview')}
                  </a>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} /> {t('formShare.regenerate')}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-[var(--text-muted)] mb-3">{t('formShare.notPublished')}</p>
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {t('formShare.publishFirst')}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
