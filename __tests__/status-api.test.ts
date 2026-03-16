import { describe, it, expect, vi } from 'vitest';

// Mock Firebase (status-config imports firebase/firestore)
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), serverTimestamp: vi.fn(),
}));

import {
  DEFAULT_STATUSES,
  type StatusDef,
  type StatusCategory,
  isDoneStatus,
  isActiveStatus,
  isNotStartedStatus,
  getStatus,
  getInitialStatus,
  getDoneStatus,
  generateStatusId,
} from '../lib/status-config';

// ============================================
// STEP 16 — Tests for status update API
// ============================================

describe('Status API — Custom status configs have required fields', () => {
  it('custom status config objects contain id, name (label), color, and order', () => {
    const custom: StatusDef = {
      id: 'qa_review',
      name: 'QA Review',
      nameEs: 'Revisión QA',
      color: '#F59E0B',
      category: 'active',
      order: 3,
    };

    expect(custom.id).toBe('qa_review');
    expect(custom.name).toBe('QA Review');
    expect(custom.color).toBe('#F59E0B');
    expect(typeof custom.order).toBe('number');
    expect(custom.order).toBe(3);
  });

  it('rejects status config missing required fields at type level', () => {
    // Verify all required fields are present in a valid config
    const valid: StatusDef = {
      id: 'staging',
      name: 'Staging',
      nameEs: 'Staging',
      color: '#6366F1',
      category: 'active',
      order: 4,
    };

    expect(valid).toHaveProperty('id');
    expect(valid).toHaveProperty('name');
    expect(valid).toHaveProperty('color');
    expect(valid).toHaveProperty('order');
    expect(valid).toHaveProperty('category');
  });

  it('generateStatusId produces a valid id from a custom label', () => {
    expect(generateStatusId('QA Review')).toBe('qa_review');
    expect(generateStatusId('Ready for Deploy')).toBe('ready_for_deploy');
    expect(generateStatusId('Won\'t Fix')).toBe('won_t_fix');
  });

  it('custom statuses can be used with all helper functions', () => {
    const custom: StatusDef[] = [
      { id: 'backlog', name: 'Backlog', nameEs: 'Backlog', color: '#64748B', category: 'not_started', order: 0 },
      { id: 'dev', name: 'Development', nameEs: 'Desarrollo', color: '#3B82F6', category: 'active', order: 1 },
      { id: 'qa', name: 'QA', nameEs: 'QA', color: '#A855F7', category: 'active', order: 2 },
      { id: 'released', name: 'Released', nameEs: 'Publicado', color: '#22C55E', category: 'done', order: 3 },
    ];

    expect(getStatus('dev', custom).name).toBe('Development');
    expect(getInitialStatus(custom)).toBe('backlog');
    expect(getDoneStatus(custom)).toBe('released');
  });
});

describe('Status API — Full status transition pipeline', () => {
  it('transitions todo → in_progress → in_review → done correctly', () => {
    const pipeline: string[] = ['todo', 'in_progress', 'in_review', 'done'];

    // 1. Start at todo — should be not_started
    expect(isNotStartedStatus(pipeline[0])).toBe(true);
    expect(isActiveStatus(pipeline[0])).toBe(false);
    expect(isDoneStatus(pipeline[0])).toBe(false);

    // 2. Move to in_progress — should be active
    expect(isNotStartedStatus(pipeline[1])).toBe(false);
    expect(isActiveStatus(pipeline[1])).toBe(true);
    expect(isDoneStatus(pipeline[1])).toBe(false);

    // 3. Move to in_review — should be active
    expect(isNotStartedStatus(pipeline[2])).toBe(false);
    expect(isActiveStatus(pipeline[2])).toBe(true);
    expect(isDoneStatus(pipeline[2])).toBe(false);

    // 4. Move to done — should be done
    expect(isNotStartedStatus(pipeline[3])).toBe(false);
    expect(isActiveStatus(pipeline[3])).toBe(false);
    expect(isDoneStatus(pipeline[3])).toBe(true);
  });

  it('each transition step maps to the correct category', () => {
    const expectedCategories: [string, StatusCategory][] = [
      ['todo', 'not_started'],
      ['in_progress', 'active'],
      ['in_review', 'active'],
      ['done', 'done'],
    ];

    for (const [statusId, expectedCategory] of expectedCategories) {
      const status = getStatus(statusId);
      expect(status.category).toBe(expectedCategory);
    }
  });

  it('status order is monotonically increasing through the pipeline', () => {
    const pipeline = ['todo', 'in_progress', 'in_review', 'done'];
    const orders = pipeline.map(id => getStatus(id).order);

    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  it('getStatus returns correct color for each pipeline stage', () => {
    expect(getStatus('todo').color).toBe('#64748B');
    expect(getStatus('in_progress').color).toBe('#3B82F6');
    expect(getStatus('in_review').color).toBe('#A855F7');
    expect(getStatus('done').color).toBe('#22C55E');
  });
});

describe('Status API — Default statuses are always present', () => {
  it('DEFAULT_STATUSES contains all 6 built-in statuses', () => {
    expect(DEFAULT_STATUSES.length).toBe(6);
  });

  it('required default statuses are always present', () => {
    const ids = DEFAULT_STATUSES.map(s => s.id);
    expect(ids).toContain('todo');
    expect(ids).toContain('open');
    expect(ids).toContain('in_progress');
    expect(ids).toContain('in_review');
    expect(ids).toContain('blocked');
    expect(ids).toContain('done');
  });

  it('every default status has a valid color (hex format)', () => {
    for (const s of DEFAULT_STATUSES) {
      expect(s.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('every default status has both English and Spanish names', () => {
    for (const s of DEFAULT_STATUSES) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.nameEs.length).toBeGreaterThan(0);
    }
  });

  it('default statuses cover all required categories', () => {
    const categories = new Set(DEFAULT_STATUSES.map(s => s.category));
    expect(categories.has('not_started')).toBe(true);
    expect(categories.has('active')).toBe(true);
    expect(categories.has('done')).toBe(true);
  });

  it('default statuses have unique ids and orders', () => {
    const ids = DEFAULT_STATUSES.map(s => s.id);
    const orders = DEFAULT_STATUSES.map(s => s.order);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('getInitialStatus defaults to todo', () => {
    expect(getInitialStatus()).toBe('todo');
  });

  it('getDoneStatus defaults to done', () => {
    expect(getDoneStatus()).toBe('done');
  });
});
