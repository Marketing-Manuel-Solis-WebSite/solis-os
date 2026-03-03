'use client';
import { useState, useEffect } from 'react';
import { Loader2, Inbox, ChevronDown } from 'lucide-react';
import type { FormDocument, FormSubmission, SubmissionStatus } from './constants';
import { SUBMISSION_STATUSES } from './constants';
import { onFormSubmissionsSnapshot } from '@/lib/db';
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={selectedFormId}
              onChange={e => setSelectedFormId(e.target.value)}
              className="appearance-none pr-8 pl-3.5 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all"
            >
              <option value="">{t('submissions.allForms')}</option>
              {forms.map(f => (
                <option key={f.id} value={f.id}>{f.title || t('formBuilder.title')}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-xl p-1">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!statusFilter ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            >
              {t('submissions.allStatuses')}
            </button>
            {SUBMISSION_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${statusFilter === s.value ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {!selectedFormId ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t('submissions.noSubmissions')}</h3>
            <p className="text-[14px] text-[var(--text-muted)]">{t('submissions.noSubmissionsDesc')}</p>
          </div>
        ) : loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="h-6 w-6 text-[var(--accent)] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Inbox className="h-10 w-10 text-[var(--text-muted)]/20 mx-auto mb-3" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t('submissions.noSubmissions')}</h3>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(sub => {
              const statusInfo = SUBMISSION_STATUSES.find(s => s.value === sub.status);
              const firstValue = Object.values(sub.values || {})[0];
              const date = sub.createdAt?.toDate ? sub.createdAt.toDate() : new Date(sub.createdAt?.seconds ? sub.createdAt.seconds * 1000 : 0);
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSub(sub)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-[var(--bg-hover)] ${selectedSub?.id === sub.id ? 'bg-[var(--accent-subtle)] ring-1 ring-[var(--accent)]/20 shadow-sm' : 'bg-[var(--bg-secondary)] shadow-card hover:shadow-card-hover'}`}
                >
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: `${statusInfo?.color}18`, color: statusInfo?.color }}
                  >
                    {t(statusInfo?.labelKey || 'submissions.new')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {typeof firstValue === 'string' ? firstValue.slice(0, 80) : `#${sub.id.slice(0, 6)}`}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
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
        <div className="w-96 border-l border-[var(--border-subtle)] overflow-y-auto bg-[var(--bg-secondary)]">
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
