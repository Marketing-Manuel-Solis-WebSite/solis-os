'use client';
import { useState, FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { FormDocument } from './constants';
import FormFieldRenderer from './form-field-renderer';
import PublicFormSuccess from './public-form-success';
import { validateSubmission, evaluateCondition, sanitizeValue } from '@/lib/form-validation';
import { uploadFile } from '@/lib/upload';
import { useI18n } from '@/lib/i18n';

interface Props {
  form: FormDocument;
}

export default function PublicFormRenderer({ form }: Props) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [consent, setConsent] = useState(false);

  const visibleFields = form.fields.filter(f => evaluateCondition(f.conditionalOn, values));

  const handleChange = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Consent check
    if (form.consentRequired && !consent) {
      setSubmitError(t('publicForm.consentRequired'));
      return;
    }

    // Client-side validation
    const { valid, errors: valErrors } = validateSubmission(form.fields, values, t);
    if (!valid) { setErrors(valErrors); return; }

    setSubmitting(true);
    try {
      // Upload files first
      const finalValues = { ...values };
      const attachments: { fieldId: string; url: string; name: string; type: string; size: number }[] = [];

      for (const field of form.fields) {
        if (field.type === 'file' && Array.isArray(values[field.id])) {
          const uploaded: string[] = [];
          for (const f of values[field.id]) {
            if (f.file) {
              const result = await uploadFile(f.file, `form-uploads/${form.id}`);
              attachments.push({ fieldId: field.id, ...result });
              uploaded.push(result.url);
            } else if (f.url) {
              uploaded.push(f.url);
            }
          }
          finalValues[field.id] = uploaded;
        } else {
          finalValues[field.id] = sanitizeValue(values[field.id]);
        }
      }

      // Submit via API
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.id,
          token: form.publicToken,
          values: finalValues,
          attachments,
          consentGiven: consent,
          utmSource: getParam('utm_source'),
          utmMedium: getParam('utm_medium'),
          utmCampaign: getParam('utm_campaign'),
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setSubmitError(t('publicForm.rateLimited'));
        } else {
          setSubmitError(data.error || t('publicForm.errorMsg'));
        }
        setSubmitting(false);
        return;
      }

      // Redirect or show success
      if (form.redirectUrl) {
        window.location.href = form.redirectUrl;
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError(t('publicForm.errorMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PublicFormSuccess
        message={form.successMessage}
        onAnother={() => { setSubmitted(false); setValues({}); setErrors({}); setConsent(false); }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{form.title}</h1>
        {form.description && <p className="text-sm text-[var(--text-secondary)] mt-1">{form.description}</p>}
      </div>

      {/* Fields */}
      <div className={`px-6 pb-4 ${form.layout === '2col' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-4'}`}>
        {visibleFields.map(field => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={v => handleChange(field.id, v)}
            error={errors[field.id]}
            mode="interactive"
          />
        ))}
      </div>

      {/* Privacy notice */}
      {form.privacyNotice && (
        <div className="px-6 pb-2">
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{form.privacyNotice}</p>
        </div>
      )}

      {/* Consent */}
      {form.consentRequired && (
        <div className="px-6 pb-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4 mt-0.5" />
            <span className="text-sm text-[var(--text-secondary)]">{t('publicForm.consent')}</span>
          </label>
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div className="px-6 pb-2">
          <p className="text-sm text-[var(--error)]">{submitError}</p>
        </div>
      )}

      {/* Submit */}
      <div className="px-6 pb-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t('publicForm.submitting') : t('publicForm.submit')}
        </button>
      </div>
    </form>
  );
}

function getParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}
