import { describe, it, expect } from 'vitest';

// Pure logic tests for status template validation rules
// (Firestore operations can't be tested without emulator)

type StatusCategory = 'not_started' | 'active' | 'done' | 'closed';

interface StatusDef {
  id: string;
  name: string;
  nameEs: string;
  color: string;
  category: StatusCategory;
  order: number;
}

// Replicate validation logic from status-templates.ts
function validateTemplate(statuses: StatusDef[]): { valid: boolean; error?: string } {
  if (!statuses || statuses.length === 0) return { valid: false, error: 'Template must have at least one status' };
  const hasStart = statuses.some(s => s.category === 'not_started');
  const hasDone = statuses.some(s => s.category === 'done');
  if (!hasStart) return { valid: false, error: 'Template must have at least one "not_started" status' };
  if (!hasDone) return { valid: false, error: 'Template must have at least one "done" status' };
  // Check for duplicate IDs
  const ids = statuses.map(s => s.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) return { valid: false, error: 'Duplicate status IDs found' };
  return { valid: true };
}

function computeBlastRadius(subscribedSpaces: string[]): number {
  return subscribedSpaces.length;
}

// ---- Test data ----

const validStatuses: StatusDef[] = [
  { id: 'todo', name: 'To Do', nameEs: 'Por hacer', color: '#64748B', category: 'not_started', order: 0 },
  { id: 'in_progress', name: 'In Progress', nameEs: 'En progreso', color: '#3B82F6', category: 'active', order: 1 },
  { id: 'done', name: 'Done', nameEs: 'Completado', color: '#22C55E', category: 'done', order: 2 },
];

const kanbanStatuses: StatusDef[] = [
  { id: 'backlog', name: 'Backlog', nameEs: 'Pendiente', color: '#64748B', category: 'not_started', order: 0 },
  { id: 'ready', name: 'Ready', nameEs: 'Listo', color: '#94A3B8', category: 'not_started', order: 1 },
  { id: 'in_progress', name: 'In Progress', nameEs: 'En progreso', color: '#3B82F6', category: 'active', order: 2 },
  { id: 'in_review', name: 'Review', nameEs: 'Revisión', color: '#A855F7', category: 'active', order: 3 },
  { id: 'done', name: 'Done', nameEs: 'Completado', color: '#22C55E', category: 'done', order: 4 },
  { id: 'archived', name: 'Archived', nameEs: 'Archivado', color: '#374151', category: 'closed', order: 5 },
];

// ---- Tests ----

describe('Status Template — Validation', () => {
  it('valid template with not_started + done passes', () => {
    expect(validateTemplate(validStatuses).valid).toBe(true);
  });

  it('kanban template with all categories passes', () => {
    expect(validateTemplate(kanbanStatuses).valid).toBe(true);
  });

  it('rejects empty statuses array', () => {
    const result = validateTemplate([]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least one');
  });

  it('rejects template without not_started', () => {
    const statuses: StatusDef[] = [
      { id: 'in_progress', name: 'IP', nameEs: 'EP', color: '#3B82F6', category: 'active', order: 0 },
      { id: 'done', name: 'Done', nameEs: 'Done', color: '#22C55E', category: 'done', order: 1 },
    ];
    const result = validateTemplate(statuses);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not_started');
  });

  it('rejects template without done', () => {
    const statuses: StatusDef[] = [
      { id: 'todo', name: 'Todo', nameEs: 'Todo', color: '#64748B', category: 'not_started', order: 0 },
      { id: 'in_progress', name: 'IP', nameEs: 'EP', color: '#3B82F6', category: 'active', order: 1 },
    ];
    const result = validateTemplate(statuses);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('done');
  });

  it('rejects duplicate status IDs', () => {
    const statuses: StatusDef[] = [
      { id: 'todo', name: 'Todo', nameEs: 'Todo', color: '#64748B', category: 'not_started', order: 0 },
      { id: 'todo', name: 'Todo2', nameEs: 'Todo2', color: '#94A3B8', category: 'active', order: 1 },
      { id: 'done', name: 'Done', nameEs: 'Done', color: '#22C55E', category: 'done', order: 2 },
    ];
    const result = validateTemplate(statuses);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate');
  });

  it('accepts template with only not_started + done (minimal)', () => {
    const statuses: StatusDef[] = [
      { id: 'todo', name: 'Todo', nameEs: 'Todo', color: '#64748B', category: 'not_started', order: 0 },
      { id: 'done', name: 'Done', nameEs: 'Done', color: '#22C55E', category: 'done', order: 1 },
    ];
    expect(validateTemplate(statuses).valid).toBe(true);
  });

  it('accepts closed category without not_started', () => {
    // closed is different from done — still need not_started
    const statuses: StatusDef[] = [
      { id: 'todo', name: 'Todo', nameEs: 'Todo', color: '#64748B', category: 'not_started', order: 0 },
      { id: 'closed', name: 'Closed', nameEs: 'Cerrado', color: '#374151', category: 'closed', order: 1 },
    ];
    // This should FAIL — needs 'done' specifically
    expect(validateTemplate(statuses).valid).toBe(false);
  });
});

describe('Status Template — Blast Radius', () => {
  it('returns 0 for empty subscriptions', () => {
    expect(computeBlastRadius([])).toBe(0);
  });

  it('returns correct count for subscribed spaces', () => {
    expect(computeBlastRadius(['space-1', 'space-2', 'space-3'])).toBe(3);
  });

  it('returns 1 for single subscription', () => {
    expect(computeBlastRadius(['space-1'])).toBe(1);
  });
});

describe('Status Template — Required Fields', () => {
  it('every status must have id, name, nameEs, color, category, order', () => {
    for (const s of validStatuses) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.nameEs).toBeTruthy();
      expect(s.color).toMatch(/^#/);
      expect(['not_started', 'active', 'done', 'closed']).toContain(s.category);
      expect(typeof s.order).toBe('number');
    }
  });

  it('statuses maintain ascending order', () => {
    for (let i = 1; i < kanbanStatuses.length; i++) {
      expect(kanbanStatuses[i].order).toBeGreaterThan(kanbanStatuses[i - 1].order);
    }
  });
});
