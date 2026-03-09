import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, shouldGenerateNext } from '../lib/recurrence';

describe('calculateNextDueDate', () => {
  const base = new Date('2026-03-09T10:00:00Z');

  it('daily: adds N days', () => {
    const result = calculateNextDueDate({ frequency: 'daily', interval: 1 }, base);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-10');
  });

  it('daily: interval=3', () => {
    const result = calculateNextDueDate({ frequency: 'daily', interval: 3 }, base);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  it('weekly: adds 7*N days when no daysOfWeek', () => {
    const result = calculateNextDueDate({ frequency: 'weekly', interval: 1 }, base);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-16');
  });

  it('weekly: skips to next matching day of week', () => {
    // 2026-03-09 is Monday (1). daysOfWeek=[3] (Wednesday)
    const result = calculateNextDueDate({ frequency: 'weekly', interval: 1, daysOfWeek: [3] }, base);
    expect(result.getDay()).toBe(3); // Wednesday
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-11');
  });

  it('weekly: wraps around to next week if no matching day ahead', () => {
    // 2026-03-09 is Monday(1). daysOfWeek=[1] (Monday) → next Monday
    const result = calculateNextDueDate({ frequency: 'weekly', interval: 1, daysOfWeek: [1] }, base);
    expect(result.getDay()).toBe(1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-16');
  });

  it('monthly: adds N months', () => {
    const result = calculateNextDueDate({ frequency: 'monthly', interval: 1 }, base);
    expect(result.getMonth()).toBe(3); // April
  });

  it('monthly: with dayOfMonth clamps to end of month', () => {
    // Jan 15 + 1 month with dayOfMonth=31 → Feb has 28 days → clamped to 28
    const jan15 = new Date(2026, 0, 15, 10, 0, 0); // local time
    const result = calculateNextDueDate({ frequency: 'monthly', interval: 1, dayOfMonth: 31 }, jan15);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28); // clamped to end of Feb
  });

  it('yearly: adds N years', () => {
    const result = calculateNextDueDate({ frequency: 'yearly', interval: 1 }, base);
    expect(result.getFullYear()).toBe(2027);
  });

  it('yearly: with monthOfYear and dayOfMonth', () => {
    const result = calculateNextDueDate({
      frequency: 'yearly', interval: 1, monthOfYear: 12, dayOfMonth: 25,
    }, base);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(11); // December (0-indexed)
    expect(result.getDate()).toBe(25);
  });
});

describe('shouldGenerateNext', () => {
  it('returns true when no limits', () => {
    expect(shouldGenerateNext({ frequency: 'daily', interval: 1 })).toBe(true);
  });

  it('returns false when endAfter reached', () => {
    expect(shouldGenerateNext({
      frequency: 'daily', interval: 1, endAfter: 5, occurrenceCount: 5,
    })).toBe(false);
  });

  it('returns true when endAfter not yet reached', () => {
    expect(shouldGenerateNext({
      frequency: 'daily', interval: 1, endAfter: 5, occurrenceCount: 4,
    })).toBe(true);
  });

  it('returns false when nextDue is past endDate', () => {
    const endDate = { toDate: () => new Date('2026-03-15T00:00:00Z') };
    const nextDue = new Date('2026-03-16T00:00:00Z');
    expect(shouldGenerateNext({
      frequency: 'daily', interval: 1, endDate,
    }, nextDue)).toBe(false);
  });

  it('returns true when nextDue is before endDate', () => {
    const endDate = { toDate: () => new Date('2026-03-20T00:00:00Z') };
    const nextDue = new Date('2026-03-16T00:00:00Z');
    expect(shouldGenerateNext({
      frequency: 'daily', interval: 1, endDate,
    }, nextDue)).toBe(true);
  });
});
