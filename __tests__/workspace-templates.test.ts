import { describe, it, expect } from 'vitest';
import {
  WORKSPACE_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getAllTemplateCategories,
} from '@/lib/workspace-templates';

// ---- WORKSPACE_TEMPLATES ----

describe('WORKSPACE_TEMPLATES', () => {
  it('has at least 4 templates', () => {
    expect(WORKSPACE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it('each template has required structure', () => {
    for (const t of WORKSPACE_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.teams.length).toBeGreaterThan(0);
      expect(t.spaces.length).toBeGreaterThan(0);
      expect(t.customStatuses.length).toBeGreaterThan(0);
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  it('each team has name, icon, color, description', () => {
    for (const t of WORKSPACE_TEMPLATES) {
      for (const team of t.teams) {
        expect(team.name).toBeTruthy();
        expect(team.icon).toBeTruthy();
        expect(team.color).toBeTruthy();
        expect(team.description).toBeTruthy();
      }
    }
  });

  it('space teamRef references a valid team', () => {
    for (const t of WORKSPACE_TEMPLATES) {
      const teamNames = new Set(t.teams.map(tm => tm.name));
      for (const space of t.spaces) {
        expect(teamNames.has(space.teamRef)).toBe(true);
      }
    }
  });

  it('list folderRef references a valid folder in its space', () => {
    for (const t of WORKSPACE_TEMPLATES) {
      for (const space of t.spaces) {
        const folderNames = new Set(space.folders.map(f => f.name));
        for (const list of space.lists) {
          if (list.folderRef) {
            expect(folderNames.has(list.folderRef)).toBe(true);
          }
        }
      }
    }
  });

  it('all template IDs are unique', () => {
    const ids = WORKSPACE_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---- getTemplateById ----

describe('getTemplateById', () => {
  it('returns a template by its ID', () => {
    const t = getTemplateById('law_firm_immigration');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Immigration Law Firm');
  });

  it('returns undefined for unknown ID', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined();
  });
});

// ---- getTemplatesByCategory ----

describe('getTemplatesByCategory', () => {
  it('returns templates matching the category', () => {
    const results = getTemplatesByCategory('software_dev');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(t => t.category === 'software_dev')).toBe(true);
  });

  it('returns empty array for category with no templates', () => {
    const results = getTemplatesByCategory('custom');
    expect(results).toEqual([]);
  });
});

// ---- getAllTemplateCategories ----

describe('getAllTemplateCategories', () => {
  it('returns all expected categories', () => {
    const cats = getAllTemplateCategories();
    const values = cats.map(c => c.value);
    expect(values).toContain('law_firm');
    expect(values).toContain('software_dev');
    expect(values).toContain('marketing_agency');
    expect(values).toContain('general');
  });

  it('each category has value and label', () => {
    for (const cat of getAllTemplateCategories()) {
      expect(cat.value).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });
});
