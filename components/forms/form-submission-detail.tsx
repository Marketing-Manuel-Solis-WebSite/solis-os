'use client';
import { useState } from 'react';
import { X, CheckCircle2, XCircle, ArrowRight, Save } from 'lucide-react';
import type { FormDocument, FormSubmission } from './constants';
import { SUBMISSION_STATUSES } from './constants';
import { updateFormSubmission } from '@/lib/db';
import FormConversionModal from './form-conversion-modal';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';

interface Props {
  submission: FormSubmission;
  form: FormDocument;
  onClose: () => void;
  onUpdate: (updated: FormSubmission) => void;
}

export default function FormSubmissionDetail({ submission, form, onClose, onUpdate }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [notes, setNotes] = useState(submission.notes || '');
  const [showConvert, setShowConvert] = useState(false);

  const date = submission.createdAt?.toDate ? submission.createdAt.toDate() : new Date(submission.createdAt?.seconds ? submission.createdAt.seconds * 1000 : 0);
  const statusInfo = SUBMISSION_STATUSES.find(s => s.value === submission.status);

  const handleStatusChange = async (status: 'reviewed' | 'discarded') => {
    try {
      await updateFormSubmission(form.id, submission.id, { status, reviewedAt: new Date() });
      onUpdate({ ...submission, status, reviewedAt: new Date() as any });
      toast.success(t('tasks.updated'));
    } catch {
      toast.error(t('conversion.error'));
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateFormSubmission(form.id, submission.id, { notes });
      onUpdate({ ...submission, notes });
      toast.success(t('tasks.updated'));
    } catch {
      toast.error(t('conversion.error'));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('submissions.detail')}</h3>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${statusInfo?.color}20`, color: statusInfo?.color }}
          >
            {t(statusInfo?.labelKey || 'submissions.new')}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Date */}
        <p className="text-[12px] text-[var(--text-muted)]">
          {t('submissions.receivedAt')}: {date.toLocaleString('es-MX')}
        </p>

        {/* Field values */}
        <div className="space-y-3">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('submissions.fieldValues')}</h4>
          {form.fields.map(field => {
            const val = submission.values?.[field.id];
            if (val === undefined || val === null || val === '') return null;
            return (
              <div key={field.id} className="space-y-0.5">
                <p className="text-[12px] font-medium text-[var(--text-muted)]">{field.label || field.type}</p>
                <p className="text-sm text-[var(--text-primary)] break-words">
                  {Array.isArray(val) ? val.join(', ') : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Attachments */}
        {submission.attachments && submission.attachments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('submissions.attachments')}</h4>
            {submission.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-[var(--accent)] hover:underline truncate">
                {a.name}
              </a>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('submissions.metadata')}</h4>
          {submission.ip && <MetaRow label={t('submissions.ip')} value={submission.ip} />}
          {submission.userAgent && <MetaRow label={t('submissions.userAgent')} value={submission.userAgent} />}
          {submission.utmSource && <MetaRow label={t('submissions.utmSource')} value={submission.utmSource} />}
          {submission.utmMedium && <MetaRow label={t('submissions.utmMedium')} value={submission.utmMedium} />}
          {submission.utmCampaign && <MetaRow label={t('submissions.utmCampaign')} value={submission.utmCampaign} />}
          {submission.referrer && <MetaRow label={t('submissions.referrer')} value={submission.referrer} />}
          <MetaRow
            label={t('submissions.consent')}
            value={submission.consentGiven ? t('submissions.consentYes') : t('submissions.consentNo')}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('submissions.notes')}</h4>
          <textarea
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:border-[var(--accent)] outline-none resize-y min-h-[60px]"
            placeholder={t('submissions.notesPlaceholder')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
          {notes !== submission.notes && (
            <button onClick={handleSaveNotes} className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline">
              <Save className="h-3.5 w-3.5" /> {t('common.save')}
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
        {submission.status === 'new' && (
          <button
            onClick={() => handleStatusChange('reviewed')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {t('submissions.markReviewed')}
          </button>
        )}
        {submission.status !== 'converted' && (
          <button
            onClick={() => setShowConvert(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowRight className="h-3.5 w-3.5" /> {t('submissions.convert')}
          </button>
        )}
        {submission.status !== 'discarded' && submission.status !== 'converted' && (
          <button
            onClick={() => handleStatusChange('discarded')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <XCircle className="h-3.5 w-3.5" /> {t('submissions.discard')}
          </button>
        )}
      </div>

      {/* Conversion modal */}
      {showConvert && (
        <FormConversionModal
          submission={submission}
          form={form}
          onClose={() => setShowConvert(false)}
          onConverted={(updated) => {
            onUpdate(updated);
            setShowConvert(false);
          }}
        />
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-[var(--text-muted)] shrink-0">{label}:</span>
      <span className="text-[var(--text-secondary)] break-all">{value}</span>
    </div>
  );
}
