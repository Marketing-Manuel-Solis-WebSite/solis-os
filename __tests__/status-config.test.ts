import { describe, it, expect, vi } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), serverTimestamp: vi.fn(),
}));

import {
  DEFAULT_STATUSES,
  isDoneStatus,
  isActiveStatus,
  isNotStartedStatus,
  isBlockedStatus,
  getStatus,
  getStatusIds,
  getInitialStatus,
  getDoneStatus,
  generateStatusId,
} from '../lib/status-config';

describe('Status Config — DEFAULT_STATUSES', () => {
  it('has at least one not_started and one done status', () => {
    expect(DEFAULT_STATUSES.some(s => s.category === 'not_started')).toBe(true);
    expect(DEFAULT_STATUSES.some(s => s.category === 'done')).toBe(true);
  });

  it('includes all original 6 statuses', () => {
    const ids = DEFAULT_STATUSES.map(s => s.id);
    expect(ids).toContain('todo');
    expect(ids).toContain('in_progress');
    expect(ids).toContain('in_review');
    expect(ids).toContain('done');
    expect(ids).toContain('blocked');
    expect(ids).toContain('open');
  });

  it('every status has required fields', () => {
    for (const s of DEFAULT_STATUSES) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.nameEs).toBeTruthy();
      expect(s.color).toMatch(/^#/);
      expect(['not_started', 'active', 'done', 'closed']).toContain(s.category);
      expect(typeof s.order).toBe('number');
    }
  });
});

describe('Status Config — Category helpers', () => {
  it('isDoneStatus returns true for done category', () => {
    expect(isDoneStatus('done')).toBe(true);
    expect(isDoneStatus('completed')).toBe(true); // legacy compat
    expect(isDoneStatus('todo')).toBe(false);
    expect(isDoneStatus('in_progress')).toBe(false);
  });

  it('isActiveStatus returns true for active category', () => {
    expect(isActiveStatus('in_progress')).toBe(true);
    expect(isActiveStatus('in_review')).toBe(true);
    expect(isActiveStatus('blocked')).toBe(true);
    expect(isActiveStatus('todo')).toBe(false);
    expect(isActiveStatus('done')).toBe(false);
  });

  it('isNotStartedStatus returns true for not_started category', () => {
    expect(isNotStartedStatus('todo')).toBe(true);
    expect(isNotStartedStatus('open')).toBe(true);
    expect(isNotStartedStatus('in_progress')).toBe(false);
  });

  it('isBlockedStatus returns true only for blocked', () => {
    expect(isBlockedStatus('blocked')).toBe(true);
    expect(isBlockedStatus('done')).toBe(false);
  });
});

describe('Status Config — Utilities', () => {
  it('getStatus finds by id with fallback', () => {
    expect(getStatus('done').id).toBe('done');
    expect(getStatus('nonexistent').id).toBe('todo'); // fallback to first
  });

  it('getStatusIds returns all ids', () => {
    const ids = getStatusIds();
    expect(ids.length).toBe(DEFAULT_STATUSES.length);
    expect(ids).toContain('done');
  });

  it('getInitialStatus returns first not_started', () => {
    expect(getInitialStatus()).toBe('todo');
  });

  it('getDoneStatus returns first done', () => {
    expect(getDoneStatus()).toBe('done');
  });

  it('generateStatusId sanitizes name', () => {
    expect(generateStatusId('En Progreso')).toBe('en_progreso');
    expect(generateStatusId('  Done!  ')).toBe('done');
    expect(generateStatusId('Testing & QA')).toBe('testing_qa');
  });
});

describe('Status Config — Custom statuses', () => {
  const custom = [
    { id: 'backlog', name: 'Backlog', nameEs: 'Backlog', color: '#888', category: 'not_started' as const, order: 0 },
    { id: 'shipped', name: 'Shipped', nameEs: 'Enviado', color: '#0f0', category: 'done' as const, order: 1 },
  ];

  it('helpers work with custom statuses', () => {
    expect(isDoneStatus('shipped', custom)).toBe(true);
    expect(isDoneStatus('backlog', custom)).toBe(false);
    expect(isNotStartedStatus('backlog', custom)).toBe(true);
    expect(getInitialStatus(custom)).toBe('backlog');
    expect(getDoneStatus(custom)).toBe('shipped');
  });
});
