'use client';

// ============================================================
// Schedule Trigger Config — UI for configuring schedule-based
// automation triggers (daily, weekly, monthly, cron expression).
// ============================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { Clock, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { getNextRunAt, getNextCronRuns, parseCronExpression } from '@/lib/scheduled-triggers';

interface Props {
  triggerType: string;
  triggerConfig: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'Asia/Tokyo',
];

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

export default function ScheduleTriggerConfig({ triggerType, triggerConfig, onChange }: Props) {
  const { lang } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(triggerType === 'schedule_cron');
  const es = lang === 'es';

  const update = (key: string, value: string) => {
    onChange({ ...triggerConfig, [key]: value });
  };

  const isCron = triggerType === 'schedule_cron' || showAdvanced;
  const cronExpr = triggerConfig.cronExpression || '';

  // Compute next 5 runs for preview
  const nextRuns = useMemo(() => {
    const now = new Date();
    if (isCron && cronExpr) {
      const parsed = parseCronExpression(cronExpr);
      if (!parsed) return [];
      return getNextCronRuns(cronExpr, 5, now);
    }

    // Compute from preset config
    const frequency = triggerType === 'scheduled_daily' ? 'daily'
      : triggerType === 'scheduled_weekly' ? 'weekly'
      : triggerType === 'scheduled_monthly' ? 'monthly'
      : 'daily';

    const config = {
      frequency: frequency as 'daily' | 'weekly' | 'monthly',
      atHour: parseInt(triggerConfig.atHour || '9', 10),
      atMinute: parseInt(triggerConfig.atMinute || '0', 10),
      dayOfWeek: triggerConfig.dayOfWeek != null ? parseInt(triggerConfig.dayOfWeek, 10) : undefined,
      dayOfMonth: triggerConfig.dayOfMonth != null ? parseInt(triggerConfig.dayOfMonth, 10) : undefined,
      timezone: triggerConfig.timezone || 'UTC',
    };

    const runs: Date[] = [];
    let cursor = now;
    for (let i = 0; i < 5; i++) {
      const next = getNextRunAt(config, cursor);
      runs.push(next);
      cursor = next;
    }
    return runs;
  }, [isCron, cronExpr, triggerType, triggerConfig.atHour, triggerConfig.atMinute, triggerConfig.dayOfWeek, triggerConfig.dayOfMonth, triggerConfig.timezone]);

  // Validate cron expression
  const cronValid = isCron && cronExpr ? parseCronExpression(cronExpr) !== null : true;

  const inputClass = 'w-full h-8 px-2.5 rounded-lg bg-[var(--bg-base)] text-sm text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none';
  const labelClass = 'text-[11px] text-[var(--text-muted)] mb-1 block';

  return (
    <div className="mt-4 p-4 rounded-xl bg-[var(--bg-elevated)] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {es ? 'Configuracion de horario' : 'Schedule Configuration'}
        </p>
      </div>

      {/* Preset controls (hidden when in pure cron mode) */}
      {!isCron && (
        <>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>{es ? 'Hora' : 'Hour'}</label>
              <input type="number" min={0} max={23} value={triggerConfig.atHour || '9'}
                onChange={e => update('atHour', e.target.value)}
                className={inputClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>{es ? 'Minuto' : 'Minute'}</label>
              <input type="number" min={0} max={59} value={triggerConfig.atMinute || '0'}
                onChange={e => update('atMinute', e.target.value)}
                className={inputClass} />
            </div>
          </div>

          {triggerType === 'scheduled_weekly' && (
            <div>
              <label className={labelClass}>{es ? 'Dia de la semana' : 'Day of week'}</label>
              <select value={triggerConfig.dayOfWeek || '1'}
                onChange={e => update('dayOfWeek', e.target.value)}
                className={inputClass}>
                {(es ? DAYS_ES : DAYS_EN).map((day, i) => (
                  <option key={i} value={String(i)}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {triggerType === 'scheduled_monthly' && (
            <div>
              <label className={labelClass}>{es ? 'Dia del mes' : 'Day of month'}</label>
              <input type="number" min={1} max={31} value={triggerConfig.dayOfMonth || '1'}
                onChange={e => update('dayOfMonth', e.target.value)}
                className={inputClass} />
            </div>
          )}

          <div>
            <label className={labelClass}>{es ? 'Zona horaria' : 'Timezone'}</label>
            <select value={triggerConfig.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={e => update('timezone', e.target.value)}
              className={inputClass}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Advanced cron toggle (only for preset triggers, not schedule_cron) */}
      {triggerType !== 'schedule_cron' && (
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] font-medium transition"
        >
          {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {es ? 'Avanzado (expresion cron)' : 'Advanced (cron expression)'}
        </button>
      )}

      {/* Cron expression input */}
      {isCron && (
        <div className="space-y-2">
          <div>
            <label className={labelClass}>
              {es ? 'Expresion Cron (5 campos: minuto hora dia mes dia-semana)' : 'Cron Expression (5 fields: minute hour day month weekday)'}
            </label>
            <input
              type="text"
              value={cronExpr}
              onChange={e => update('cronExpression', e.target.value)}
              placeholder="*/15 9-17 * * 1-5"
              className={`${inputClass} font-mono ${cronExpr && !cronValid ? 'border-red-500/50 focus:border-red-500' : ''}`}
            />
            {cronExpr && !cronValid && (
              <p className="text-[11px] text-red-400 mt-1">
                {es ? 'Expresion cron invalida. Use 5 campos separados por espacios.' : 'Invalid cron expression. Use 5 space-separated fields.'}
              </p>
            )}
          </div>

          {/* Common presets */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: es ? 'Cada 15 min' : 'Every 15 min', expr: '*/15 * * * *' },
              { label: es ? 'Cada hora' : 'Hourly', expr: '0 * * * *' },
              { label: es ? 'Lun-Vie 9am' : 'Weekdays 9am', expr: '0 9 * * 1-5' },
              { label: es ? 'Lun-Vie c/hora (9-17)' : 'Weekdays hourly (9-5)', expr: '0 9-17 * * 1-5' },
              { label: es ? 'Dia 1 y 15' : '1st & 15th', expr: '0 9 1,15 * *' },
            ].map(preset => (
              <button
                key={preset.expr}
                type="button"
                onClick={() => update('cronExpression', preset.expr)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                  cronExpr === preset.expr
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Timezone for cron too */}
          <div>
            <label className={labelClass}>{es ? 'Zona horaria' : 'Timezone'}</label>
            <select value={triggerConfig.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={e => update('timezone', e.target.value)}
              className={inputClass}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Next 5 runs preview */}
      {nextRuns.length > 0 && (
        <div className="mt-2 pt-3 border-t border-[var(--border)]">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {es ? 'Proximas 5 ejecuciones' : 'Next 5 runs'}
          </p>
          <div className="space-y-1">
            {nextRuns.map((run, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="w-4 h-4 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-[var(--text-secondary)] font-mono">
                  {run.toLocaleDateString(es ? 'es' : 'en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}
                  {run.toLocaleTimeString(es ? 'es' : 'en', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCron && cronExpr && !cronValid && (
        <div className="mt-2 pt-3 border-t border-[var(--border)]">
          <p className="text-[12px] text-[var(--text-muted)]">
            {es
              ? 'Corrija la expresion cron para ver la vista previa de ejecuciones.'
              : 'Fix the cron expression to see the run preview.'}
          </p>
        </div>
      )}
    </div>
  );
}
