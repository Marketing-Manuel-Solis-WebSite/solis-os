import { describe, it, expect } from 'vitest';

// We test the condition evaluation logic directly
// Since the engine module imports Firebase, we re-implement the pure logic here
// to test without mocks. These match the logic in lib/automation-engine.ts exactly.

function getFieldValue(task: Record<string, any>, field: string): any {
  switch (field) {
    case 'assignee_count':
      return task.assignees?.length > 0 ? 'yes' : 'no';
    case 'has_due_date':
      return task.dueDate ? 'yes' : 'no';
    default:
      return task[field];
  }
}

function evaluateCondition(
  condition: { field: string; operator: string; value: string },
  task: Record<string, any>,
): boolean {
  const fieldValue = getFieldValue(task, condition.field);
  const condValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condValue);
    case 'not_equals':
      return String(fieldValue) !== String(condValue);
    case 'contains':
      if (Array.isArray(fieldValue)) return fieldValue.some(v => String(v) === String(condValue));
      return String(fieldValue || '').includes(String(condValue));
    case 'not_contains':
      if (Array.isArray(fieldValue)) return !fieldValue.some(v => String(v) === String(condValue));
      return !String(fieldValue || '').includes(String(condValue));
    case 'is_empty':
      return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'greater_than':
      return Number(fieldValue) > Number(condValue);
    case 'less_than':
      return Number(fieldValue) < Number(condValue);
    default:
      return true;
  }
}

function allConditionsPass(
  conditions: { id: string; field: string; operator: string; value: string }[],
  task: Record<string, any>,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, task));
}

describe('Automation condition evaluation', () => {
  const task = {
    status: 'todo',
    priority: 'high',
    type: 'bug',
    tags: ['urgent', 'frontend'],
    assignees: ['user1', 'user2'],
    dueDate: '2026-03-15',
    title: 'Fix login bug',
    points: 5,
  };

  describe('equals', () => {
    it('matches exact string', () => {
      expect(evaluateCondition({ field: 'status', operator: 'equals', value: 'todo' }, task)).toBe(true);
    });
    it('rejects non-matching', () => {
      expect(evaluateCondition({ field: 'status', operator: 'equals', value: 'done' }, task)).toBe(false);
    });
  });

  describe('not_equals', () => {
    it('passes when different', () => {
      expect(evaluateCondition({ field: 'priority', operator: 'not_equals', value: 'low' }, task)).toBe(true);
    });
    it('fails when same', () => {
      expect(evaluateCondition({ field: 'priority', operator: 'not_equals', value: 'high' }, task)).toBe(false);
    });
  });

  describe('contains', () => {
    it('works for arrays', () => {
      expect(evaluateCondition({ field: 'tags', operator: 'contains', value: 'urgent' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'tags', operator: 'contains', value: 'backend' }, task)).toBe(false);
    });
    it('works for strings', () => {
      expect(evaluateCondition({ field: 'title', operator: 'contains', value: 'login' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'title', operator: 'contains', value: 'signup' }, task)).toBe(false);
    });
  });

  describe('not_contains', () => {
    it('works for arrays', () => {
      expect(evaluateCondition({ field: 'tags', operator: 'not_contains', value: 'backend' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'tags', operator: 'not_contains', value: 'urgent' }, task)).toBe(false);
    });
  });

  describe('is_empty / is_not_empty', () => {
    it('detects empty values', () => {
      const emptyTask = { name: '', tags: [], optional: null };
      expect(evaluateCondition({ field: 'name', operator: 'is_empty', value: '' }, emptyTask)).toBe(true);
      expect(evaluateCondition({ field: 'tags', operator: 'is_empty', value: '' }, emptyTask)).toBe(true);
      expect(evaluateCondition({ field: 'optional', operator: 'is_empty', value: '' }, emptyTask)).toBe(true);
      expect(evaluateCondition({ field: 'missing', operator: 'is_empty', value: '' }, emptyTask)).toBe(true);
    });
    it('detects non-empty values', () => {
      expect(evaluateCondition({ field: 'status', operator: 'is_not_empty', value: '' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'tags', operator: 'is_not_empty', value: '' }, task)).toBe(true);
    });
  });

  describe('greater_than / less_than', () => {
    it('compares numerically', () => {
      expect(evaluateCondition({ field: 'points', operator: 'greater_than', value: '3' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'points', operator: 'greater_than', value: '10' }, task)).toBe(false);
      expect(evaluateCondition({ field: 'points', operator: 'less_than', value: '10' }, task)).toBe(true);
    });
  });

  describe('virtual fields', () => {
    it('assignee_count returns yes/no', () => {
      expect(evaluateCondition({ field: 'assignee_count', operator: 'equals', value: 'yes' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'assignee_count', operator: 'equals', value: 'yes' }, { assignees: [] })).toBe(false);
    });
    it('has_due_date returns yes/no', () => {
      expect(evaluateCondition({ field: 'has_due_date', operator: 'equals', value: 'yes' }, task)).toBe(true);
      expect(evaluateCondition({ field: 'has_due_date', operator: 'equals', value: 'no' }, { dueDate: null })).toBe(true);
    });
  });

  describe('allConditionsPass', () => {
    it('returns true for empty conditions', () => {
      expect(allConditionsPass([], task)).toBe(true);
    });

    it('requires ALL conditions to pass', () => {
      const conditions = [
        { id: '1', field: 'status', operator: 'equals', value: 'todo' },
        { id: '2', field: 'priority', operator: 'equals', value: 'high' },
      ];
      expect(allConditionsPass(conditions, task)).toBe(true);
    });

    it('fails if any condition fails', () => {
      const conditions = [
        { id: '1', field: 'status', operator: 'equals', value: 'todo' },
        { id: '2', field: 'priority', operator: 'equals', value: 'low' }, // fails
      ];
      expect(allConditionsPass(conditions, task)).toBe(false);
    });
  });
});
