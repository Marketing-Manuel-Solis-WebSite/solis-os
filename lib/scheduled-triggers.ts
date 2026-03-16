// ============================================================
// Scheduled Automation Triggers — Time-based trigger evaluation
// for the automation engine. Cron-processed via API endpoint.
// ============================================================

export interface ScheduledTriggerConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  /** Hour of day (0-23) */
  atHour: number;
  /** Minute of hour (0-59) */
  atMinute: number;
  /** For weekly: day of week (0=Sun, 1=Mon, ..., 6=Sat) */
  dayOfWeek?: number;
  /** For monthly: day of month (1-31) */
  dayOfMonth?: number;
  /** IANA timezone string */
  timezone: string;
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
 * Get the human-readable description of a schedule.
 */
export function describeSchedule(config: ScheduledTriggerConfig, lang: 'en' | 'es' = 'en'): string {
  const time = `${String(config.atHour).padStart(2, '0')}:${String(config.atMinute || 0).padStart(2, '0')}`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const diasEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
