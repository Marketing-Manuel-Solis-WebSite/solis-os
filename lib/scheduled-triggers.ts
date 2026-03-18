// ============================================================
// Scheduled Automation Triggers — Time-based trigger evaluation
// for the automation engine. Cron-processed via API endpoint.
// ============================================================

export interface ScheduledTriggerConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'cron';
  /** Hour of day (0-23) */
  atHour: number;
  /** Minute of hour (0-59) */
  atMinute: number;
  /** For weekly: day of week (0=Sun, 1=Mon, ..., 6=Sat) */
  dayOfWeek?: number;
  /** For monthly: day of month (1-31) */
  dayOfMonth?: number;
  /** For cron: standard 5-field cron expression */
  cronExpression?: string;
  /** IANA timezone string */
  timezone: string;
}

// ---- Cron Expression Parser (pure TypeScript, no deps) ----

interface CronFields {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

/**
 * Parse a single cron field into an array of matching integer values.
 * Supports: specific values (5), wildcards (*), ranges (1-5), lists (1,3,5), steps (asterisk/5, 1-10/2).
 */
function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    const trimmed = part.trim();

    // Step value — e.g. */5 or 1-30/2
    if (trimmed.includes('/')) {
      const [rangePart, stepStr] = trimmed.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) continue;

      let start = min;
      let end = max;
      if (rangePart === '*') {
        // */step — full range with step
      } else if (rangePart.includes('-')) {
        const [lo, hi] = rangePart.split('-').map(Number);
        if (!isNaN(lo)) start = lo;
        if (!isNaN(hi)) end = hi;
      } else {
        const v = parseInt(rangePart, 10);
        if (!isNaN(v)) start = v;
      }
      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) values.add(i);
      }
      continue;
    }

    // Wildcard
    if (trimmed === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    // Range — e.g. 1-5
    if (trimmed.includes('-')) {
      const [lo, hi] = trimmed.split('-').map(Number);
      if (!isNaN(lo) && !isNaN(hi)) {
        for (let i = lo; i <= hi; i++) {
          if (i >= min && i <= max) values.add(i);
        }
      }
      continue;
    }

    // Specific value
    const v = parseInt(trimmed, 10);
    if (!isNaN(v) && v >= min && v <= max) {
      values.add(v);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

/**
 * Parse a standard 5-field cron expression: minute hour day-of-month month day-of-week.
 * Returns null if the expression is invalid.
 */
export function parseCronExpression(expr: string): CronFields | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const minutes = parseCronField(parts[0], 0, 59);
  const hours = parseCronField(parts[1], 0, 23);
  const daysOfMonth = parseCronField(parts[2], 1, 31);
  const months = parseCronField(parts[3], 1, 12);
  const daysOfWeek = parseCronField(parts[4], 0, 6);

  // All fields must produce at least one value
  if (!minutes.length || !hours.length || !daysOfMonth.length || !months.length || !daysOfWeek.length) {
    return null;
  }

  return { minutes, hours, daysOfMonth, months, daysOfWeek };
}

/**
 * Check if a given Date matches a parsed cron schedule.
 */
function matchesCron(fields: CronFields, date: Date): boolean {
  return (
    fields.minutes.includes(date.getMinutes()) &&
    fields.hours.includes(date.getHours()) &&
    fields.months.includes(date.getMonth() + 1) &&
    // Cron uses OR semantics between day-of-month and day-of-week when both are restricted
    (fields.daysOfMonth.includes(date.getDate()) || fields.daysOfWeek.includes(date.getDay()))
  );
}

/**
 * Check if a scheduled trigger should fire now, given its config and last run time.
 * Uses a tolerance window of 10 minutes to account for cron job timing.
 */
export function shouldTriggerNow(
  config: ScheduledTriggerConfig,
  lastRunAt: Date | null,
  now: Date = new Date(),
): boolean {
  // Get current time in the configured timezone
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: config.timezone || 'UTC' }));

  // --- Cron expression path ---
  if (config.frequency === 'cron' && config.cronExpression) {
    const fields = parseCronExpression(config.cronExpression);
    if (!fields) return false;

    // Check a 10-minute window around now (same tolerance as preset schedules)
    let matched = false;
    for (let offset = -10; offset <= 0; offset++) {
      const check = new Date(tzNow.getTime() + offset * 60_000);
      if (matchesCron(fields, check)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;

    // Prevent double-fire: check if we already ran within the last tolerance window
    if (lastRunAt) {
      const lastRunTz = new Date(lastRunAt.toLocaleString('en-US', { timeZone: config.timezone || 'UTC' }));
      const diffMs = tzNow.getTime() - lastRunTz.getTime();
      // Don't re-fire if last run was less than 10 minutes ago
      if (diffMs < 10 * 60_000) return false;
    }

    return true;
  }

  // --- Preset schedule path (daily/weekly/monthly) ---
  const currentHour = tzNow.getHours();
  const currentMinute = tzNow.getMinutes();
  const currentDay = tzNow.getDay(); // 0=Sun
  const currentDate = tzNow.getDate(); // 1-31

  // Check if we're in the right time window (within 10 min of scheduled time)
  const scheduledMinutes = config.atHour * 60 + (config.atMinute || 0);
  const currentMinutes = currentHour * 60 + currentMinute;
  const diff = Math.abs(currentMinutes - scheduledMinutes);
  if (diff > 10) return false;

  // Check frequency-specific constraints
  if (config.frequency === 'weekly' && config.dayOfWeek != null) {
    if (currentDay !== config.dayOfWeek) return false;
  }
  if (config.frequency === 'monthly' && config.dayOfMonth != null) {
    if (currentDate !== config.dayOfMonth) return false;
  }

  // Check if already ran today (prevent double-fire)
  if (lastRunAt) {
    const lastRunTz = new Date(lastRunAt.toLocaleString('en-US', { timeZone: config.timezone || 'UTC' }));
    if (
      lastRunTz.getFullYear() === tzNow.getFullYear() &&
      lastRunTz.getMonth() === tzNow.getMonth() &&
      lastRunTz.getDate() === tzNow.getDate()
    ) {
      return false; // Already ran today
    }
  }

  return true;
}

/**
 * Compute the next run time for a scheduled trigger.
 */
export function getNextRunAt(
  config: ScheduledTriggerConfig,
  from: Date = new Date(),
): Date {
  // --- Cron expression path ---
  if (config.frequency === 'cron' && config.cronExpression) {
    return getNextCronRunAt(config.cronExpression, from);
  }

  // --- Preset schedule path ---
  const next = new Date(from);
  next.setHours(config.atHour, config.atMinute || 0, 0, 0);

  // If the time has already passed today, move to next day
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  if (config.frequency === 'weekly' && config.dayOfWeek != null) {
    while (next.getDay() !== config.dayOfWeek) {
      next.setDate(next.getDate() + 1);
    }
  }

  if (config.frequency === 'monthly' && config.dayOfMonth != null) {
    next.setDate(config.dayOfMonth);
    if (next <= from) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(config.dayOfMonth);
    }
  }

  return next;
}

/**
 * Calculate the next run time from a cron expression by minute-stepping forward.
 * Caps the search at 366 days to avoid infinite loops from impossible expressions.
 */
export function getNextCronRunAt(cronExpr: string, from: Date = new Date()): Date {
  const fields = parseCronExpression(cronExpr);
  if (!fields) return new Date(from.getTime() + 86_400_000); // fallback: +1 day

  // Start from the next whole minute
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const maxIterations = 366 * 24 * 60; // ~1 year of minutes
  for (let i = 0; i < maxIterations; i++) {
    // Quick-skip: if month doesn't match, jump to next valid month
    const month = candidate.getMonth() + 1; // 1-based
    if (!fields.months.includes(month)) {
      // Jump to first day of next month
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    // Quick-skip: if day doesn't match either day-of-month or day-of-week, jump to next day
    if (!fields.daysOfMonth.includes(candidate.getDate()) && !fields.daysOfWeek.includes(candidate.getDay())) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    // Quick-skip: if hour doesn't match, jump to next hour
    if (!fields.hours.includes(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }

    // Check minute
    if (fields.minutes.includes(candidate.getMinutes())) {
      return candidate;
    }

    // Advance by 1 minute
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback if no match found (shouldn't happen with valid expressions)
  return new Date(from.getTime() + 86_400_000);
}

/**
 * Get multiple upcoming run times from a cron expression.
 */
export function getNextCronRuns(cronExpr: string, count: number, from: Date = new Date()): Date[] {
  const runs: Date[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const next = getNextCronRunAt(cronExpr, cursor);
    runs.push(next);
    cursor = next;
  }
  return runs;
}

/**
 * Get the human-readable description of a schedule.
 */
export function describeSchedule(config: ScheduledTriggerConfig, lang: 'en' | 'es' = 'en'): string {
  const time = `${String(config.atHour).padStart(2, '0')}:${String(config.atMinute || 0).padStart(2, '0')}`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const diasEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  if (config.frequency === 'cron' && config.cronExpression) {
    return lang === 'es'
      ? `Expresión cron: ${config.cronExpression}`
      : `Cron: ${config.cronExpression}`;
  }
  if (config.frequency === 'daily') {
    return lang === 'es' ? `Todos los días a las ${time}` : `Every day at ${time}`;
  }
  if (config.frequency === 'weekly' && config.dayOfWeek != null) {
    const day = lang === 'es' ? diasEs[config.dayOfWeek] : days[config.dayOfWeek];
    return lang === 'es' ? `Cada ${day} a las ${time}` : `Every ${day} at ${time}`;
  }
  if (config.frequency === 'monthly' && config.dayOfMonth != null) {
    return lang === 'es'
      ? `El día ${config.dayOfMonth} de cada mes a las ${time}`
      : `Day ${config.dayOfMonth} of every month at ${time}`;
  }
  return lang === 'es' ? `Programado a las ${time}` : `Scheduled at ${time}`;
}
