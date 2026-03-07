// ================================================================
// SOLIS CENTER — Recurring Tasks: Pure Logic
// ================================================================

export interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];     // 0=Sun..6=Sat
  dayOfMonth?: number;       // 1-31
  monthOfYear?: number;      // 1-12
  endDate?: any;             // Firestore timestamp or null
  endAfter?: number;         // Max occurrences
  occurrenceCount?: number;  // Generated so far
}

// Calculate the next due date based on config and a reference date
export function calculateNextDueDate(config: RecurrenceConfig, fromDate: Date): Date {
  const next = new Date(fromDate);

  switch (config.frequency) {
    case 'daily':
      next.setDate(next.getDate() + config.interval);
      break;

    case 'weekly':
      if (config.daysOfWeek && config.daysOfWeek.length > 0) {
        // Find next matching day of week
        let found = false;
        for (let attempt = 1; attempt <= 14; attempt++) {
          next.setDate(next.getDate() + 1);
          if (config.daysOfWeek.includes(next.getDay())) {
            found = true;
            break;
          }
        }
        if (!found) {
          next.setDate(fromDate.getDate() + 7 * config.interval);
        }
      } else {
        next.setDate(next.getDate() + 7 * config.interval);
      }
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + config.interval);
      if (config.dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(config.dayOfMonth, maxDay));
      }
      break;

    case 'yearly':
      next.setFullYear(next.getFullYear() + config.interval);
      if (config.monthOfYear) {
        next.setMonth(config.monthOfYear - 1);
      }
      if (config.dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(config.dayOfMonth, maxDay));
      }
      break;
  }

  return next;
}

// Check if we should generate the next instance
// nextDue: the calculated next due date; used to compare against endDate instead of now
export function shouldGenerateNext(config: RecurrenceConfig, nextDue?: Date): boolean {
  const count = config.occurrenceCount || 0;

  // Check endAfter limit
  if (config.endAfter && count >= config.endAfter) return false;

  // Check endDate — compare next due date (not now) against the end boundary
  if (config.endDate) {
    const endDate = config.endDate.toDate ? config.endDate.toDate() : new Date(config.endDate.seconds * 1000);
    const referenceDate = nextDue || new Date();
    if (referenceDate > endDate) return false;
  }

  return true;
}

// Get a human-readable description of the recurrence
export function getRecurrenceDescription(
  config: RecurrenceConfig,
  t: (key: string, params?: Record<string, any>) => string,
  lang: 'es' | 'en' = 'es',
): string {
  const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNames = lang === 'es' ? DAY_NAMES_ES : DAY_NAMES_EN;

  let desc = '';
  const interval = config.interval || 1;

  switch (config.frequency) {
    case 'daily':
      desc = interval === 1 ? t('recurrence.daily') : t('recurrence.everyNDays', { n: interval });
      break;
    case 'weekly':
      if (config.daysOfWeek?.length) {
        const days = config.daysOfWeek.map(d => dayNames[d]).join(', ');
        desc = interval === 1
          ? t('recurrence.weeklyOn', { days })
          : t('recurrence.everyNWeeksOn', { n: interval, days });
      } else {
        desc = interval === 1 ? t('recurrence.weekly') : t('recurrence.everyNWeeks', { n: interval });
      }
      break;
    case 'monthly':
      desc = interval === 1 ? t('recurrence.monthly') : t('recurrence.everyNMonths', { n: interval });
      break;
    case 'yearly':
      desc = interval === 1 ? t('recurrence.yearly') : t('recurrence.everyNYears', { n: interval });
      break;
  }

  if (config.endAfter) {
    desc += ` (${config.endAfter} ${t('recurrence.times')})`;
  }

  return desc;
}
