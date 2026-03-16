import { describe, it, expect } from 'vitest';

import {
  AUTOMATION_TEMPLATES,
  VALID_TRIGGER_TYPES,
  VALID_ACTION_TYPES,
  VALID_CONDITION_OPERATORS,
  getAutomationTemplates,
  getTemplateCategories,
  type AutomationTemplate,
} from '../lib/automation-templates';

describe('Automation Templates — seed data', () => {
  it('has exactly 10 predefined templates', () => {
    expect(AUTOMATION_TEMPLATES.length).toBe(10);
  });

  it('each template has all required fields', () => {
    for (const tmpl of AUTOMATION_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.category).toBeTruthy();
      expect(tmpl.trigger).toBeTruthy();
      expect(Array.isArray(tmpl.conditions)).toBe(true);
      expect(Array.isArray(tmpl.actions)).toBe(true);
      expect(tmpl.actions.length).toBeGreaterThan(0);
    }
  });

  it('all templates have unique ids', () => {
    const ids = AUTOMATION_TEMPLATES.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all templates use valid trigger types', () => {
    const validTriggers = new Set<string>(VALID_TRIGGER_TYPES);
    for (const tmpl of AUTOMATION_TEMPLATES) {
      expect(validTriggers.has(tmpl.trigger)).toBe(true);
    }
  });

  it('all templates use valid action types', () => {
    const validActions = new Set<string>(VALID_ACTION_TYPES);
    for (const tmpl of AUTOMATION_TEMPLATES) {
      for (const action of tmpl.actions) {
        expect(validActions.has(action.type)).toBe(true);
      }
    }
  });

  it('all template conditions use valid operators', () => {
    const validOps = new Set<string>(VALID_CONDITION_OPERATORS);
    for (const tmpl of AUTOMATION_TEMPLATES) {
      for (const cond of tmpl.conditions) {
        expect(validOps.has(cond.operator)).toBe(true);
      }
    }
  });

  it('each action has an id, type, and config object', () => {
    for (const tmpl of AUTOMATION_TEMPLATES) {
      for (const action of tmpl.actions) {
        expect(action.id).toBeTruthy();
        expect(action.type).toBeTruthy();
        expect(typeof action.config).toBe('object');
      }
    }
  });

  it('each condition has id, field, operator, value', () => {
    for (const tmpl of AUTOMATION_TEMPLATES) {
      for (const cond of tmpl.conditions) {
        expect(cond.id).toBeTruthy();
        expect(cond.field).toBeTruthy();
        expect(cond.operator).toBeTruthy();
        // value can be empty string for some operators, but must be defined
        expect(typeof cond.value).toBe('string');
      }
    }
  });

  it('covers multiple trigger types', () => {
    const triggers = new Set(AUTOMATION_TEMPLATES.map(t => t.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(4);
  });

  it('covers multiple categories', () => {
    const categories = getTemplateCategories();
    expect(categories.length).toBeGreaterThanOrEqual(4);
  });
});

describe('getAutomationTemplates()', () => {
  it('returns all templates when no category given', () => {
    const all = getAutomationTemplates();
    expect(all.length).toBe(AUTOMATION_TEMPLATES.length);
  });

  it('filters by category correctly', () => {
    const assignment = getAutomationTemplates('assignment');
    expect(assignment.length).toBeGreaterThan(0);
    for (const tmpl of assignment) {
      expect(tmpl.category).toBe('assignment');
    }
  });

  it('returns empty array for a category with no templates', () => {
    // Cast to bypass TS check for testing unknown category
    const result = getAutomationTemplates('nonexistent' as any);
    expect(result).toEqual([]);
  });
});

describe('getTemplateCategories()', () => {
  it('returns unique categories', () => {
    const cats = getTemplateCategories();
    const unique = new Set(cats);
    expect(unique.size).toBe(cats.length);
  });

  it('includes expected categories', () => {
    const cats = getTemplateCategories();
    expect(cats).toContain('assignment');
    expect(cats).toContain('status');
    expect(cats).toContain('notification');
    expect(cats).toContain('organization');
  });
});
