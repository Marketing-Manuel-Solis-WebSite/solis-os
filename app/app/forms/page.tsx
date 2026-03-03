'use client';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, ShieldX } from 'lucide-react';
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
  const [activeForm, setActiveForm] = useState<FormDocument | null>(null);
  const [shareForm, setShareForm] = useState<FormDocument | null>(null);
  const [tab, setTab] = useState<'forms' | 'responses'>('forms');

  const hasAccess = can('form', 'create') || me?.role === 'owner' || me?.role === 'admin';

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getForms();
      setForms(data as FormDocument[]);
    } catch {
      toast.error(t('docs.loadError'));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const handleCreate = async () => {
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
      // Reload to get the full object with publicToken
      const refreshed = await getForms();
      const newForm = (refreshed as FormDocument[]).find(f => f.id === newId);
      setForms(refreshed as FormDocument[]);
      if (newForm) setActiveForm(newForm);
    } catch {
      toast.error(t('conversion.error'));
    }
  };

  // Permission guard
  if (!hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ShieldX className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-muted)]">{t('forms.noPermission')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  // Builder view
  if (activeForm) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)]">
          <button
            onClick={() => { setActiveForm(null); loadForms(); }}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            {t('common.back')}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FormBuilder
            form={activeForm}
            onUpdate={updated => setActiveForm(updated)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{t('forms.title')}</h1>
        <p className="text-sm text-[var(--text-muted)]">{t('forms.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)]">
        {[
          { key: 'forms' as const, label: t('forms.tabForms') },
          { key: 'responses' as const, label: t('forms.tabResponses') },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${tab === tb.key ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
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
