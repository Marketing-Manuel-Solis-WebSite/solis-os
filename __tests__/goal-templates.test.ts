import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({ db: {} }));

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'tmpl-1' });
const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
}));

// Mock db functions for createGoalFromTemplate
vi.mock('../lib/db', () => ({
  createGoal: vi.fn().mockResolvedValue({ id: 'goal-from-tmpl' }),
  createGoalTarget: vi.fn().mockResolvedValue({ id: 'target-1' }),
}));

import {
  BUILT_IN_TEMPLATES,
  getTemplates,
  createTemplate,
  deleteTemplate,
  createGoalFromTemplate,
} from '../lib/goal-templates';
import { createGoal, createGoalTarget } from '../lib/db';

describe('Goal Templates — built-in', () => {
  it('has at least 5 built-in templates', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('each built-in has required fields', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.color).toMatch(/^#/);
      expect(t.defaultTargets.length).toBeGreaterThan(0);
      expect(t.isBuiltIn).toBe(true);
    }
  });

  it('covers expected categories', () => {
    const cats = new Set(BUILT_IN_TEMPLATES.map(t => t.category));
    expect(cats.has('revenue')).toBe(true);
    expect(cats.has('okr')).toBe(true);
    expect(cats.has('sprint')).toBe(true);
    expect(cats.has('health')).toBe(true);
    expect(cats.has('growth')).toBe(true);
  });

  it('OKR template has 3 key results', () => {
    const okr = BUILT_IN_TEMPLATES.find(t => t.category === 'okr');
    expect(okr).toBeDefined();
    expect(okr!.defaultTargets).toHaveLength(3);
    expect(okr!.defaultTargets[0].type).toBe('percentage');
  });
});

describe('Goal Templates — CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getTemplates returns built-in + custom', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'custom-1', data: () => ({ name: 'Custom Template', isBuiltIn: false }) },
      ],
    });

    const templates = await getTemplates();
    // Should have all built-in + 1 custom
    expect(templates.length).toBe(BUILT_IN_TEMPLATES.length + 1);
    expect(templates.some(t => t.name === 'Custom Template')).toBe(true);
  });

  it('createTemplate returns ID', async () => {
    const id = await createTemplate({
      name: 'My Template',
      description: 'Test',
      category: 'custom',
      icon: 'Star',
      color: '#FF0000',
      defaultTargets: [{ name: 'KPI', type: 'number', targetValue: 100, unit: 'items' }],
      defaultTags: ['test'],
      createdBy: 'user-1',
    });

    expect(id).toBe('tmpl-1');
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('deleteTemplate calls deleteDoc', async () => {
    await deleteTemplate('tmpl-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});

describe('Goal Templates — instantiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createGoalFromTemplate creates goal + targets', async () => {
    const template = BUILT_IN_TEMPLATES[0]; // Revenue Target (2 targets)

    const result = await createGoalFromTemplate(template, {
      name: 'Q1 Revenue',
      ownerId: 'user-1',
      ownerName: 'John',
      createdBy: 'user-1',
      createdByName: 'John',
    });

    expect(result.goalId).toBe('goal-from-tmpl');
    expect(result.targetIds).toHaveLength(template.defaultTargets.length);
    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Q1 Revenue',
      color: template.color,
    }));
    expect(createGoalTarget).toHaveBeenCalledTimes(template.defaultTargets.length);
  });
});
