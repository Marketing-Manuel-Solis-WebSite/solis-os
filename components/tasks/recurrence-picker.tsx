'use client';
import { useState, useEffect } from 'react';
import { Repeat, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { type RecurrenceConfig, getRecurrenceDescription } from '@/lib/recurrence';

interface Props {
  value?: RecurrenceConfig;
  onChange: (config: RecurrenceConfig | undefined) => void;
}

const DAY_LABELS_ES = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];
const DAY_LABELS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function RecurrencePicker({ value, onChange }: Props) {
  const { t, lang } = useI18n();
  const [enabled, setEnabled] = useState(!!value);
  const [config, setConfig] = useState<RecurrenceConfig>(value || {
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: [],
  });

  useEffect(() => {
    if (enabled) {
      onChange(config);
    } else {
      onChange(undefined);
    }
  }, [config, enabled]);

  const dayLabels = lang === 'es' ? DAY_LABELS_ES : DAY_LABELS_EN;

  const toggleDay = (day: number) => {
    const days = config.daysOfWeek || [];
    const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    setConfig({ ...config, daysOfWeek: newDays });
  };

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] transition"
      >
        <Repeat className="h-3 w-3" /> {t('recurrence.addRecurrence')}
      </button>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-[var(--bg-elevated)] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
          <Repeat className="h-3.5 w-3.5 text-[var(--accent)]" />
          {t('recurrence.recurrence')}
        </div>
        <button
          onClick={() => { setEnabled(false); onChange(undefined); }}
          className="p-1 rounded text-[var(--text-muted)] hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Frequency + interval */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[var(--text-muted)]">{t('recurrence.every')}</span>
        <input
          type="number"
          min={1}
          max={99}
          value={config.interval}
          onChange={e => setConfig({ ...config, interval: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-14 h-7 px-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] text-center outline-none"
        />
        <select
          value={config.frequency}
          onChange={e => setConfig({ ...config, frequency: e.target.value as any })}
          className="h-7 px-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none"
        >
          <option value="daily">{t('recurrence.days')}</option>
          <option value="weekly">{t('recurrence.weeks')}</option>
          <option value="monthly">{t('recurrence.months')}</option>
          <option value="yearly">{t('recurrence.years')}</option>
        </select>
      </div>

      {/* Day of week selector for weekly */}
      {config.frequency === 'weekly' && (
        <div className="flex gap-1">
          {dayLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`w-7 h-7 rounded-lg text-[11px] font-medium transition ${
                (config.daysOfWeek || []).includes(i)
                  ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-base)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* End condition */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[var(--text-muted)]">{t('recurrence.ends')}</span>
        <select
          value={config.endAfter ? 'after' : config.endDate ? 'date' : 'never'}
          onChange={e => {
            switch (e.target.value) {
              case 'never': setConfig({ ...config, endAfter: undefined, endDate: undefined }); break;
              case 'after': setConfig({ ...config, endAfter: 10, endDate: undefined }); break;
              case 'date': setConfig({ ...config, endAfter: undefined }); break;
            }
          }}
          className="h-7 px-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none"
        >
          <option value="never">{t('recurrence.never')}</option>
          <option value="after">{t('recurrence.afterN')}</option>
        </select>
        {config.endAfter != null && (
          <input
            type="number"
            min={1}
            value={config.endAfter}
            onChange={e => setConfig({ ...config, endAfter: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-14 h-7 px-2 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] text-center outline-none"
          />
        )}
        {config.endAfter != null && (
          <span className="text-[12px] text-[var(--text-muted)]">{t('recurrence.times')}</span>
        )}
      </div>

      {/* Summary */}
      <p className="text-[11px] text-[var(--accent)] italic">
        {getRecurrenceDescription(config, t, lang)}
      </p>
    </div>
  );
}
