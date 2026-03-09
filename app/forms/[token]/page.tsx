'use client';
import { useEffect, useState, use } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import PublicFormShell from '@/components/forms/public-form-shell';
import PublicFormRenderer from '@/components/forms/public-form-renderer';
import type { FormDocument } from '@/components/forms/constants';

export default function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t } = useI18n();
  const [form, setForm] = useState<FormDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/forms/public/${encodeURIComponent(token)}`);
        if (!res.ok) {
          setError({ title: t('publicForm.notFound'), message: t('publicForm.notFoundMsg') });
          return;
        }
        const data = await res.json();
        const f = data as FormDocument;

        // Check status
        if (f.status !== 'published') {
          setError({ title: t('publicForm.closed'), message: t('publicForm.closedMsg') });
          return;
        }

        // Check response limit
        if (f.responseLimit && f.responseCount >= f.responseLimit) {
          setError({ title: t('publicForm.limitReached'), message: t('publicForm.limitReachedMsg') });
          return;
        }

        // Check date window
        const now = new Date();
        if (f.openAt) {
          const openDate = f.openAt?.toDate ? f.openAt.toDate() : new Date((f.openAt as any)?.seconds ? (f.openAt as any).seconds * 1000 : f.openAt as any);
          if (now < openDate) {
            setError({ title: t('publicForm.notYetOpen'), message: t('publicForm.notYetOpenMsg') });
            return;
          }
        }
        if (f.closeAt) {
          const closeDate = f.closeAt?.toDate ? f.closeAt.toDate() : new Date((f.closeAt as any)?.seconds ? (f.closeAt as any).seconds * 1000 : f.closeAt as any);
          if (now > closeDate) {
            setError({ title: t('publicForm.expired'), message: t('publicForm.expiredMsg') });
            return;
          }
        }

        setForm(f);
      } catch {
        setError({ title: t('publicForm.error'), message: t('publicForm.errorMsg') });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, t]);

  if (loading) {
    return (
      <PublicFormShell>
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-[var(--accent)] animate-spin" />
        </div>
      </PublicFormShell>
    );
  }

  if (error) {
    return (
      <PublicFormShell>
        <div className="py-12 px-6 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-[var(--text-muted)] mx-auto" strokeWidth={1.5} />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{error.title}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{error.message}</p>
        </div>
      </PublicFormShell>
    );
  }

  if (!form) return null;

  return (
    <PublicFormShell logoUrl={form.logoUrl}>
      <PublicFormRenderer form={form} />
    </PublicFormShell>
  );
}
