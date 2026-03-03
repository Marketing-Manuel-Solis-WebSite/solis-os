'use client';
import { X } from 'lucide-react';
import type { FormDocument } from './constants';
import { useI18n } from '@/lib/i18n';

interface Props {
  form: FormDocument;
  onChange: (updates: Partial<FormDocument>) => void;
}

export default function FormSettingsPanel({ form, onChange }: Props) {
  const { t } = useI18n();
  const inputCls = 'w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3.5 py-2.5 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 outline-none transition-all';
  const labelCls = 'block text-[12px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-semibold';

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-1">
      {/* General */}
      <Section title={t('common.general')}>
        <div>
          <label className={labelCls}>{t('formSettings.title')}</label>
          <input className={inputCls} placeholder={t('formSettings.titlePlaceholder')} value={form.title} onChange={e => onChange({ title: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>{t('formSettings.description')}</label>
          <textarea className={`${inputCls} min-h-[60px] resize-y`} placeholder={t('formSettings.descPlaceholder')} value={form.description} onChange={e => onChange({ description: e.target.value })} rows={2} />
        </div>
        <div>
          <label className={labelCls}>{t('formSettings.successMessage')}</label>
          <input className={inputCls} placeholder={t('formSettings.successPlaceholder')} value={form.successMessage} onChange={e => onChange({ successMessage: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>{t('formSettings.redirectUrl')}</label>
          <input className={inputCls} placeholder={t('formSettings.redirectPlaceholder')} value={form.redirectUrl} onChange={e => onChange({ redirectUrl: e.target.value })} />
        </div>
      </Section>

      {/* Layout */}
      <Section title={t('formSettings.layout')}>
        <div className="flex gap-2">
          {(['1col', '2col'] as const).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => onChange({ layout: l })}
              className={`flex-1 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${form.layout === l ? 'bg-[var(--accent)] text-white shadow-sm' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {t(`formSettings.layout${l === '1col' ? '1col' : '2col'}`)}
            </button>
          ))}
        </div>
        <div>
          <label className={labelCls}>{t('formSettings.logo')}</label>
          {form.logoUrl ? (
            <div className="flex items-center gap-2">
              <img src={form.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-lg" />
              <button type="button" onClick={() => onChange({ logoUrl: '' })} className="text-sm text-[var(--error)] hover:underline flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> {t('formSettings.removeLogo')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{t('formSettings.uploadLogo')}</p>
          )}
        </div>
      </Section>

      {/* Limits */}
      <Section title={t('formSettings.responseLimit')}>
        <div>
          <label className={labelCls}>{t('formSettings.responseLimit')}</label>
          <input type="number" className={inputCls} min={0} placeholder={t('formSettings.responseLimitPlaceholder')} value={form.responseLimit ?? ''} onChange={e => onChange({ responseLimit: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('formSettings.openAt')}</label>
            <input type="datetime-local" className={inputCls} value={form.openAt ? toLocal(form.openAt) : ''} onChange={e => onChange({ openAt: e.target.value ? new Date(e.target.value) : null })} />
          </div>
          <div>
            <label className={labelCls}>{t('formSettings.closeAt')}</label>
            <input type="datetime-local" className={inputCls} value={form.closeAt ? toLocal(form.closeAt) : ''} onChange={e => onChange({ closeAt: e.target.value ? new Date(e.target.value) : null })} />
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section title={t('formSettings.captcha')}>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
          <input type="checkbox" checked={form.captchaEnabled} onChange={e => onChange({ captchaEnabled: e.target.checked })} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
          <div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">{t('formSettings.captcha')}</span>
            <p className="text-[12px] text-[var(--text-muted)]">{t('formSettings.captchaDesc')}</p>
          </div>
        </label>
        <div>
          <label className={labelCls}>{t('formSettings.rateLimit')}</label>
          <input type="number" className={inputCls} min={1} max={100} value={form.rateLimitPerMinute} onChange={e => onChange({ rateLimitPerMinute: Number(e.target.value) || 10 })} />
        </div>
      </Section>

      {/* Privacy */}
      <Section title={t('formPrivacy.title')}>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
          <input type="checkbox" checked={form.collectIp} onChange={e => onChange({ collectIp: e.target.checked })} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">{t('formPrivacy.collectIp')}</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
          <input type="checkbox" checked={form.collectUserAgent} onChange={e => onChange({ collectUserAgent: e.target.checked })} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">{t('formPrivacy.collectUa')}</span>
        </label>
        <div>
          <label className={labelCls}>{t('formPrivacy.privacyNotice')}</label>
          <textarea className={`${inputCls} min-h-[50px] resize-y`} placeholder={t('formPrivacy.privacyPlaceholder')} value={form.privacyNotice} onChange={e => onChange({ privacyNotice: e.target.value })} rows={2} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-[var(--bg-hover)] transition-all">
          <input type="checkbox" checked={form.consentRequired} onChange={e => onChange({ consentRequired: e.target.checked })} className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4" />
          <div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">{t('formPrivacy.consentRequired')}</span>
            <p className="text-[12px] text-[var(--text-muted)]">{t('formPrivacy.consentDesc')}</p>
          </div>
        </label>
        <div>
          <label className={labelCls}>{t('formPrivacy.retentionDays')}</label>
          <input type="number" className={inputCls} min={1} placeholder={t('formPrivacy.retentionPlaceholder')} value={form.retentionDays ?? ''} onChange={e => onChange({ retentionDays: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">{title}</h3>
      {children}
    </div>
  );
}

function toLocal(d: any): string {
  try {
    const date = d?.toDate ? d.toDate() : new Date(d?.seconds ? d.seconds * 1000 : d);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch { return ''; }
}
