'use client';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Inbox, ChevronDown } from 'lucide-react';
import type { FormDocument, FormSubmission, SubmissionStatus } from './constants';
import { SUBMISSION_STATUSES } from './constants';
import { getFormSubmissions, onFormSubmissionsSnapshot } from '@/lib/db';
import FormSubmissionDetail from './form-submission-detail';
import { useI18n } from '@/lib/i18n';

interface Props {
  forms: FormDocument[];
}

export default function FormSubmissionsInbox({ forms }: Props) {
  const { t } = useI18n();
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | ''>('');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState<FormSubmission | null>(null);

  const selectedForm = forms.find(f => f.id === selectedFormId) || null;

  useEffect(() => {
    if (!selectedFormId) {
      setSubmissions([]);
      return;
    }
    setLoading(true);
    const unsub = onFormSubmissionsSnapshot(selectedFormId, (subs: any[]) => {
      setSubmissions(subs as FormSubmission[]);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedFormId]);

  const filtered = submissions.filter(s => {
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex gap-4 h-full min-h-[400px]">
      {/* List */}
      <div className="flex-1 space-y-3">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={selectedFormId}
              onChange={e => setSelectedFormId(e.target.value)}
              className="appearance-none pr-8 pl-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none transition-all"
            >
              <option value="">{t('submissions.allForms')}</option>
              {forms.map(f => (
                <option key={f.id} value={f.id}>{f.title || t('formBuilder.title')}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!statusFilter ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {t('submissions.allStatuses')}
            </button>
            {SUBMISSION_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === s.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {!selectedFormId ? (
          <div className="py-12 text-center">
            <Inbox className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-muted)]">{t('submissions.noSubmissions')}</p>
            <p className="text-[13px] text-[var(--text-muted)]">{t('submissions.noSubmissionsDesc')}</p>
          </div>
        ) : loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-5 w-5 text-[var(--accent)] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="h-6 w-6 text-[var(--text-muted)] mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-muted)]">{t('submissions.noSubmissions')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(sub => {
              const statusInfo = SUBMISSION_STATUSES.find(s => s.value === sub.status);
              const firstValue = Object.values(sub.values || {})[0];
              const date = sub.createdAt?.toDate ? sub.createdAt.toDate() : new Date(sub.createdAt?.seconds ? sub.createdAt.seconds * 1000 : 0);
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSub(sub)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-[var(--bg-hover)] ${selectedSub?.id === sub.id ? 'bg-[var(--accent-subtle)] border border-[var(--accent)]' : 'border border-transparent'}`}
                >
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: `${statusInfo?.color}20`, color: statusInfo?.color }}
                  >
                    {t(statusInfo?.labelKey || 'submissions.new')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {typeof firstValue === 'string' ? firstValue.slice(0, 80) : `#${sub.id.slice(0, 6)}`}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedSub && selectedForm && (
        <div className="w-96 border-l border-[var(--border-subtle)] overflow-y-auto">
          <FormSubmissionDetail
            submission={selectedSub}
            form={selectedForm}
            onClose={() => setSelectedSub(null)}
            onUpdate={(updated) => {
              setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
              setSelectedSub(updated);
            }}
          />
        </div>
      )}
    </div>
  );
}
