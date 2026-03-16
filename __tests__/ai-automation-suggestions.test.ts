import { describe, it, expect } from 'vitest';
import {
  detectPatterns,
  SUGGESTION_TEMPLATES,
  promptSuggestAutomations,
  mergeWithTemplates,
} from '@/lib/ai-automation-suggestions';
import type { AutomationSuggestion, BehaviorPattern } from '@/lib/ai-automation-suggestions';

// ---- detectPatterns ----

describe('detectPatterns', () => {
  it('detects frequent status transitions', () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      action: 'updated',
      resource: 'task',
      detail: `status → done`,
      actorName: 'Alice',
      createdAt: new Date(),
    }));
    const patterns = detectPatterns(events);
    expect(patterns.some(p => p.pattern.includes('status'))).toBe(true);
    expect(patterns.find(p => p.pattern.includes('status'))!.frequency).toBeGreaterThanOrEqual(5);
  });

  it('detects repeated task creation with similar titles', () => {
    const events = Array.from({ length: 4 }, (_, i) => ({
      action: 'created',
      resource: 'task',
      detail: `Review client ${i} documents`,
      actorName: 'Bob',
      createdAt: new Date(),
    }));
    const patterns = detectPatterns(events);
    expect(patterns.some(p => p.pattern.includes('review'))).toBe(true);
  });

  it('detects frequent actor+action patterns', () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      action: 'assigned',
      resource: 'task',
      detail: `Task ${i}`,
      actorName: 'Manager',
      createdAt: new Date(),
    }));
    const patterns = detectPatterns(events);
    expect(patterns.some(p => p.pattern.includes('Manager'))).toBe(true);
  });

  it('returns empty array when no patterns detected', () => {
    const events = [
      { action: 'created', resource: 'task', detail: 'Unique task', actorName: 'Alice', createdAt: new Date() },
    ];
    const patterns = detectPatterns(events);
    expect(patterns).toHaveLength(0);
  });

  it('limits results to 10 patterns max', () => {
    // Create many different patterns
    const events: any[] = [];
    for (let i = 0; i < 15; i++) {
      const prefix = `prefix${i}`;
      for (let j = 0; j < 5; j++) {
        events.push({ action: 'updated', resource: 'task', detail: `status → state${i}`, actorName: `actor${i}`, createdAt: new Date() });
      }
    }
    const patterns = detectPatterns(events);
    expect(patterns.length).toBeLessThanOrEqual(10);
  });

  it('sorts patterns by frequency descending', () => {
    const events: any[] = [];
    // 10 transitions to "done"
    for (let i = 0; i < 10; i++) {
      events.push({ action: 'updated', resource: 'task', detail: 'status → done', actorName: 'A', createdAt: new Date() });
    }
    // 5 transitions to "review"
    for (let i = 0; i < 5; i++) {
      events.push({ action: 'updated', resource: 'task', detail: 'status → review', actorName: 'A', createdAt: new Date() });
    }
    const patterns = detectPatterns(events);
    if (patterns.length >= 2) {
      expect(patterns[0].frequency).toBeGreaterThanOrEqual(patterns[1].frequency);
    }
  });
});

// ---- SUGGESTION_TEMPLATES ----

describe('SUGGESTION_TEMPLATES', () => {
  it('has at least 5 templates', () => {
    expect(SUGGESTION_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('each template has required fields', () => {
    for (const t of SUGGESTION_TEMPLATES) {
      expect(t.title).toBeTruthy();
      expect(t.trigger).toBeTruthy();
      expect(t.actions.length).toBeGreaterThan(0);
      expect(t.category).toBeTruthy();
    }
  });
});

// ---- promptSuggestAutomations ----

describe('promptSuggestAutomations', () => {
  it('includes patterns and existing automations in prompt', () => {
    const patterns: BehaviorPattern[] = [
      { pattern: 'Frequent status changes', frequency: 10, examples: ['ex1'] },
    ];
    const existing = [{ name: 'Auto-close', trigger: 'task.overdue' }];
    const prompt = promptSuggestAutomations(patterns, existing);
    expect(prompt).toContain('Frequent status changes');
    expect(prompt).toContain('Auto-close');
    expect(prompt).toContain('10x');
  });

  it('shows "None configured" when no existing automations', () => {
    const prompt = promptSuggestAutomations([], []);
    expect(prompt).toContain('None configured');
  });
});

// ---- mergeWithTemplates ----

describe('mergeWithTemplates', () => {
  it('includes built-in templates in results', () => {
    const result = mergeWithTemplates([], []);
    expect(result.length).toBeGreaterThanOrEqual(SUGGESTION_TEMPLATES.length);
  });

  it('filters out suggestions matching existing automation names', () => {
    const existing = [SUGGESTION_TEMPLATES[0].title];
    const result = mergeWithTemplates([], existing);
    expect(result.find(s => s.title === SUGGESTION_TEMPLATES[0].title)).toBeUndefined();
  });

  it('merges AI suggestions with templates', () => {
    const aiSuggestion: AutomationSuggestion = {
      id: 'ai_1',
      title: 'Custom AI suggestion',
      description: 'A custom suggestion',
      trigger: 'task.created',
      actions: ['notify'],
      estimatedTimeSaved: '1 hour/week',
      confidence: 0.85,
      basedOn: 'pattern X',
      category: 'notification',
    };
    const result = mergeWithTemplates([aiSuggestion], []);
    expect(result.find(s => s.id === 'ai_1')).toBeDefined();
  });

  it('case-insensitive matching for existing names', () => {
    const existing = [SUGGESTION_TEMPLATES[0].title.toUpperCase()];
    const result = mergeWithTemplates([], existing);
    expect(result.find(s => s.title === SUGGESTION_TEMPLATES[0].title)).toBeUndefined();
  });
});
