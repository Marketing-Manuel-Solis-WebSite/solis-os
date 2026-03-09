'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldX, Plus, FileInput } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { getForms, createForm } from '@/lib/db';
import { useToast } from '@/components/notifications/toast-provider';
import FormList from '@/components/forms/form-list';
import FormBuilder from '@/components/forms/form-builder';
import FormShareModal from '@/components/forms/form-share-modal';
import FormSubmissionsInbox from '@/components/forms/form-submissions-inbox';
import type { FormDocument } from '@/components/forms/constants';

export default function FormsPage() {
  const { user, me, can } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [forms, setForms] = useState<FormDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeForm, setActiveForm] = useState<FormDocument | null>(null);
  const [shareForm, setShareForm] = useState<FormDocument | null>(null);
  const [tab, setTab] = useState<'forms' | 'responses'>('forms');
  const mountedRef = useRef(true);

  const hasAccess = can('form', 'create') || me?.role === 'owner' || me?.role === 'admin';

  const loadForms = useCallback(async () => {
    try {
      const { items: data, hasMore: more } = await getForms();
      if (mountedRef.current) { setForms(data as FormDocument[]); setHasMore(more); }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { items: data, hasMore: more } = await getForms();
        if (!cancelled) { setForms(data as FormDocument[]); setHasMore(more); }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; mountedRef.current = false; };
  }, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const ref = await createForm({
        title: '',
        description: '',
        status: 'draft',
        fields: [],
        layout: '1col',
        successMessage: '',
        redirectUrl: '',
        logoUrl: '',
        responseLimit: null,
        openAt: null,
        closeAt: null,
        captchaEnabled: false,
        rateLimitPerMinute: 10,
        collectIp: false,
        collectUserAgent: false,
        privacyNotice: '',
        consentRequired: false,
        retentionDays: null,
        defaultMappingId: '',
        autoConvert: false,
        createdBy: user?.uid || '',
        createdByName: me?.displayName || '',
        teamId: '',
      });
      const newId = ref.id;
      const { items: refreshed } = await getForms();
      const all = refreshed as FormDocument[];
      const newForm = all.find(f => f.id === newId);
      setForms(all);
      if (newForm) setActiveForm(newForm);
    } catch {
      toast.error(t('conversion.error'));
    } finally {
      setCreating(false);
    }
  };

  // Permission guard
  if (!hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-20">
          <ShieldX className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t('forms.noPermission')}</h3>
          <p className="text-[14px] text-[var(--text-muted)]">{t('forms.subtitle')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  // Builder view
  if (activeForm) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <button
            onClick={() => { setActiveForm(null); loadForms(); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
          >
            &larr; {t('common.back')}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FormBuilder
            form={activeForm}
            onUpdate={updated => setActiveForm(updated)}
            onShare={f => setShareForm(f)}
          />
        </div>

        {shareForm && (
          <FormShareModal
            form={shareForm}
            onClose={() => setShareForm(null)}
            onUpdate={updated => {
              setShareForm(updated);
              setActiveForm(updated);
              setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header — matches design system */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileInput className="h-6 w-6 text-[var(--accent)]" />
            {t('forms.title')}
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-0.5">{t('forms.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-md hover:opacity-90 transition disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('forms.createForm')}
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] mb-5">
        {[
          { key: 'forms' as const, label: t('forms.tabForms') },
          { key: 'responses' as const, label: t('forms.tabResponses') },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${tab === tb.key ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'forms' ? (
        <FormList
          forms={forms}
          onSelect={setActiveForm}
          onShare={setShareForm}
          onCreate={handleCreate}
          onRefresh={loadForms}
        />
      ) : (
        <FormSubmissionsInbox forms={forms} />
      )}

      {/* Has More indicator */}
      {hasMore && !loading && (
        <div className="text-center py-4 mt-2">
          <span className="text-[13px] text-[var(--text-muted)]">
            {t('common.showingItems', { n: forms.length })} — {t('common.moreAvailable')}
          </span>
        </div>
      )}

      {/* Share modal */}
      {shareForm && (
        <FormShareModal
          form={shareForm}
          onClose={() => setShareForm(null)}
          onUpdate={updated => {
            setShareForm(updated);
            setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
          }}
        />
      )}
    </div>
  );
}
