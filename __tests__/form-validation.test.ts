import { describe, it, expect } from 'vitest';
import { sanitizeValue, evaluateCondition, validateSubmission } from '../lib/form-validation';

// Minimal t() stub
const t = (key: string, params?: Record<string, any>) => {
  let msg = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) msg = msg.replace(`{${k}}`, String(v));
  }
  return msg;
};

// Helper to create a minimal FormField
function field(overrides: any) {
  return {
    id: 'f1',
    type: 'short_text',
    label: 'Field',
    required: false,
    validations: {},
    options: [],
    ...overrides,
  };
}

describe('sanitizeValue', () => {
  it('strips script tags', () => {
    expect(sanitizeValue('<script>alert(1)</script>hello')).toBe('hello');
  });

  it('strips HTML tags', () => {
    expect(sanitizeValue('<b>bold</b>')).toBe('bold');
  });

  it('strips event handlers', () => {
    expect(sanitizeValue('text onload="bad()"')).toBe('text');
  });

  it('strips javascript: protocol', () => {
    expect(sanitizeValue('javascript:alert(1)')).toBe('alert(1)');
  });

  it('passes through non-strings', () => {
    expect(sanitizeValue(42)).toBe(42);
    expect(sanitizeValue(null)).toBe(null);
    expect(sanitizeValue(true)).toBe(true);
  });

  it('trims whitespace', () => {
    expect(sanitizeValue('  hello  ')).toBe('hello');
  });
});

describe('evaluateCondition', () => {
  it('returns true when no condition', () => {
    expect(evaluateCondition(undefined, {})).toBe(true);
  });

  it('equals operator works', () => {
    const cond = { fieldId: 'type', operator: 'equals' as const, value: 'bug' };
    expect(evaluateCondition(cond, { type: 'bug' })).toBe(true);
    expect(evaluateCondition(cond, { type: 'feature' })).toBe(false);
  });

  it('not_equals operator works', () => {
    const cond = { fieldId: 'status', operator: 'not_equals' as const, value: 'done' };
    expect(evaluateCondition(cond, { status: 'todo' })).toBe(true);
    expect(evaluateCondition(cond, { status: 'done' })).toBe(false);
  });

  it('contains operator works', () => {
    const cond = { fieldId: 'name', operator: 'contains' as const, value: 'test' };
    expect(evaluateCondition(cond, { name: 'my test case' })).toBe(true);
    expect(evaluateCondition(cond, { name: 'other' })).toBe(false);
  });

  it('not_empty operator works', () => {
    const cond = { fieldId: 'val', operator: 'not_empty' as const, value: '' };
    expect(evaluateCondition(cond, { val: 'something' })).toBe(true);
    expect(evaluateCondition(cond, { val: '' })).toBe(false);
    expect(evaluateCondition(cond, { val: null })).toBe(false);
    expect(evaluateCondition(cond, {})).toBe(false);
  });
});

describe('validateSubmission', () => {
  it('passes when no required fields and no values', () => {
    const result = validateSubmission([field({ required: false })], {}, t);
    expect(result.valid).toBe(true);
  });

  it('fails when required field is empty', () => {
    const result = validateSubmission([field({ required: true })], {}, t);
    expect(result.valid).toBe(false);
    expect(result.errors.f1).toContain('formValidation.required');
  });

  it('validates email format', () => {
    const f = field({ type: 'email', required: true });
    const good = validateSubmission([f], { f1: 'user@example.com' }, t);
    expect(good.valid).toBe(true);

    const bad = validateSubmission([f], { f1: 'not-an-email' }, t);
    expect(bad.valid).toBe(false);
  });

  it('validates phone format', () => {
    const f = field({ type: 'phone', required: true });
    const good = validateSubmission([f], { f1: '+1 (555) 123-4567' }, t);
    expect(good.valid).toBe(true);

    const bad = validateSubmission([f], { f1: 'abc' }, t);
    expect(bad.valid).toBe(false);
  });

  it('validates URL format', () => {
    const f = field({ type: 'url', required: true });
    const good = validateSubmission([f], { f1: 'https://example.com' }, t);
    expect(good.valid).toBe(true);

    const bad = validateSubmission([f], { f1: 'not-a-url' }, t);
    expect(bad.valid).toBe(false);
  });

  it('validates number min/max', () => {
    const f = field({ type: 'number', required: true, validations: { min: 1, max: 10 } });
    const good = validateSubmission([f], { f1: 5 }, t);
    expect(good.valid).toBe(true);

    const low = validateSubmission([f], { f1: 0 }, t);
    expect(low.valid).toBe(false);

    const high = validateSubmission([f], { f1: 11 }, t);
    expect(high.valid).toBe(false);
  });

  it('validates text minLength/maxLength', () => {
    const f = field({ type: 'short_text', validations: { minLength: 3, maxLength: 10 } });
    const good = validateSubmission([f], { f1: 'hello' }, t);
    expect(good.valid).toBe(true);

    const short = validateSubmission([f], { f1: 'ab' }, t);
    expect(short.valid).toBe(false);

    const long = validateSubmission([f], { f1: 'this is way too long' }, t);
    expect(long.valid).toBe(false);
  });

  it('validates rating range', () => {
    const f = field({ type: 'rating', required: true, ratingMax: 5 });
    const good = validateSubmission([f], { f1: 3 }, t);
    expect(good.valid).toBe(true);

    const bad = validateSubmission([f], { f1: 6 }, t);
    expect(bad.valid).toBe(false);
  });

  it('validates dropdown/radio against options', () => {
    const f = field({
      type: 'dropdown',
      required: true,
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    });
    const good = validateSubmission([f], { f1: 'a' }, t);
    expect(good.valid).toBe(true);

    const bad = validateSubmission([f], { f1: 'invalid' }, t);
    expect(bad.valid).toBe(false);
  });

  it('skips hidden conditional fields', () => {
    const f = field({
      required: true,
      conditionalOn: { fieldId: 'toggle', operator: 'equals', value: 'yes' },
    });
    // Condition not met → field hidden → required check skipped
    const result = validateSubmission([f], { toggle: 'no' }, t);
    expect(result.valid).toBe(true);
  });
});
