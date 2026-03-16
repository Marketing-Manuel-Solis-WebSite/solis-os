import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }), fromDate: (d: Date) => ({ seconds: d.getTime() / 1000 }) },
  increment: vi.fn(),
}));

vi.mock('@/lib/org', () => ({
  getCurrentOrgId: () => 'test-org',
  ORG_ID: 'test-org',
}));

import { substituteVariables, resolveDateOffset, BUILT_IN_TASK_TEMPLATES } from '../lib/task-templates';

describe('substituteVariables', () => {
  it('replaces single variable', () => {
    expect(substituteVariables('Hello {{name}}', { name: 'World' })).toBe('Hello World');
  });

  it('replaces multiple variables', () => {
    expect(substituteVariables('{{a}} and {{b}}', { a: 'X', b: 'Y' })).toBe('X and Y');
  });

  it('leaves unreplaced variables as-is', () => {
    expect(substituteVariables('{{known}} {{unknown}}', { known: 'OK' })).toBe('OK {{unknown}}');
  });

  it('handles empty string', () => {
    expect(substituteVariables('', { x: 'y' })).toBe('');
  });

  it('handles no variables in text', () => {
    expect(substituteVariables('No vars here', { x: 'y' })).toBe('No vars here');
  });
});

describe('resolveDateOffset', () => {
  it('returns today for offset 0', () => {
    const result = resolveDateOffset(0);
    const today = new Date();
    expect(result.getDate()).toBe(today.getDate());
    expect(result.getMonth()).toBe(today.getMonth());
    expect(result.getFullYear()).toBe(today.getFullYear());
  });

  it('returns future date for positive offset', () => {
    const result = resolveDateOffset(7);
    const expected = new Date();
    expected.setDate(expected.getDate() + 7);
    expect(result.getDate()).toBe(expected.getDate());
  });

  it('returns past date for negative offset', () => {
    const result = resolveDateOffset(-3);
    const expected = new Date();
    expected.setDate(expected.getDate() - 3);
    expect(result.getDate()).toBe(expected.getDate());
  });
});

describe('BUILT_IN_TASK_TEMPLATES', () => {
  it('has at least 3 templates', () => {
    expect(BUILT_IN_TASK_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it('all templates have required fields', () => {
    for (const t of BUILT_IN_TASK_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.templateData).toBeTruthy();
      expect(t.templateData.status).toBeTruthy();
      expect(t.templateData.priority).toBeTruthy();
      expect(Array.isArray(t.variables)).toBe(true);
    }
  });

  it('required variables have labels', () => {
    for (const t of BUILT_IN_TASK_TEMPLATES) {
      for (const v of t.variables) {
        expect(v.key).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(v.type).toBeTruthy();
      }
    }
  });
});
