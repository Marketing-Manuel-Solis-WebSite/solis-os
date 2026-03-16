import { describe, it, expect } from 'vitest';
import { shouldTriggerNow, getNextRunAt, describeSchedule } from '../lib/scheduled-triggers';

describe('shouldTriggerNow', () => {
  it('triggers when time matches and no previous run', () => {
    const now = new Date('2026-03-16T09:00:00Z');
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    expect(shouldTriggerNow(config, null, now)).toBe(true);
  });

  it('does not trigger when time does not match', () => {
    const now = new Date('2026-03-16T15:00:00Z');
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    expect(shouldTriggerNow(config, null, now)).toBe(false);
  });

  it('does not trigger if already ran today', () => {
    const now = new Date('2026-03-16T09:00:00Z');
    const lastRun = new Date('2026-03-16T09:01:00Z');
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    expect(shouldTriggerNow(config, lastRun, now)).toBe(false);
  });

  it('triggers weekly on correct day', () => {
    // 2026-03-16 is a Monday (day 1)
    const now = new Date('2026-03-16T09:00:00Z');
    const config = { frequency: 'weekly' as const, atHour: 9, atMinute: 0, dayOfWeek: 1, timezone: 'UTC' };
    expect(shouldTriggerNow(config, null, now)).toBe(true);
  });

  it('does not trigger weekly on wrong day', () => {
    const now = new Date('2026-03-16T09:00:00Z'); // Monday
    const config = { frequency: 'weekly' as const, atHour: 9, atMinute: 0, dayOfWeek: 5, timezone: 'UTC' }; // Friday
    expect(shouldTriggerNow(config, null, now)).toBe(false);
  });

  it('triggers monthly on correct date', () => {
    const now = new Date('2026-03-15T09:00:00Z');
    const config = { frequency: 'monthly' as const, atHour: 9, atMinute: 0, dayOfMonth: 15, timezone: 'UTC' };
    expect(shouldTriggerNow(config, null, now)).toBe(true);
  });

  it('allows 10-minute tolerance window', () => {
    const now = new Date('2026-03-16T09:08:00Z');
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    expect(shouldTriggerNow(config, null, now)).toBe(true);
  });
});

describe('getNextRunAt', () => {
  it('returns next day for daily if already past time', () => {
    const from = new Date('2026-03-16T10:00:00Z');
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    const next = getNextRunAt(config, from);
    // Next run should be after `from`
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('returns today if time has not passed', () => {
    const from = new Date('2026-03-16T08:00:00Z');
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    const next = getNextRunAt(config, from);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
  });
});

describe('describeSchedule', () => {
  it('describes daily schedule in English', () => {
    const config = { frequency: 'daily' as const, atHour: 9, atMinute: 0, timezone: 'UTC' };
    expect(describeSchedule(config, 'en')).toBe('Every day at 09:00');
  });

  it('describes weekly schedule in Spanish', () => {
    const config = { frequency: 'weekly' as const, atHour: 14, atMinute: 30, dayOfWeek: 1, timezone: 'UTC' };
    expect(describeSchedule(config, 'es')).toBe('Cada Lunes a las 14:30');
  });

  it('describes monthly schedule', () => {
    const config = { frequency: 'monthly' as const, atHour: 8, atMinute: 0, dayOfMonth: 1, timezone: 'UTC' };
    expect(describeSchedule(config, 'en')).toBe('Day 1 of every month at 08:00');
  });
});
