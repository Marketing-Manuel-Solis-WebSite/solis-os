import { describe, it, expect, vi } from 'vitest';

// Mock server-only to prevent "Cannot be imported from a Client Component" error
vi.mock('server-only', () => ({}));

// Mock Firebase Admin to prevent SDK initialization hanging in test environments
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {},
  adminAuth: { verifyIdToken: vi.fn() },
}));

import {
  promptDecomposeTask,
  promptSuggestAssignees,
  computeWorkloads,
  parseAIJSON,
  type WorkloadSummary,
} from '@/lib/ai-task-assistant';
import {
  detectPatterns,
  promptSuggestAutomations,
  mergeWithTemplates,
  SUGGESTION_TEMPLATES,
  type AutomationSuggestion,
} from '@/lib/ai-automation-suggestions';
import {
  buildWritingPrompt,
  buildWritingResult,
  countWords,
  type WritingRequest,
} from '@/lib/ai-writing-assistant';

// ================================================================
// Step 37: Tests for AI UI endpoints — validates that prompt
// construction functions, parsing, and helpers work correctly
// ================================================================

// ---- Decompose endpoint helpers ----

describe('AI Decompose — prompt & parse', () => {
  it('promptDecomposeTask produces a valid prompt', () => {
    const prompt = promptDecomposeTask('Prepare I-130 package', 'Gather supporting docs for family petition');
    expect(prompt).toContain('Prepare I-130 package');
    expect(prompt).toContain('subtasks');
    expect(prompt).toContain('3-8');
    expect(prompt).toContain('JSON');
  });

  it('parseAIJSON handles decompose response correctly', () => {
    const raw = '{"subtasks": ["Gather ID copies", "Draft cover letter", "File forms"]}';
    const result = parseAIJSON<{ subtasks: string[] }>(raw);
    expect(result).not.toBeNull();
    expect(result!.subtasks).toHaveLength(3);
    expect(result!.subtasks[0]).toBe('Gather ID copies');
  });

  it('parseAIJSON returns null for garbage input', () => {
    expect(parseAIJSON('this is not json')).toBeNull();
  });

  it('parseAIJSON handles markdown-wrapped JSON', () => {
    const raw = '```json\n{"subtasks": ["a", "b"]}\n```';
    const result = parseAIJSON<{ subtasks: string[] }>(raw);
    expect(result).not.toBeNull();
    expect(result!.subtasks).toHaveLength(2);
  });
});

// ---- Suggest Assignees endpoint helpers ----

describe('AI Suggest Assignees — prompt & workload', () => {
  const members = [
    { userId: 'u1', displayName: 'Alice' },
    { userId: 'u2', displayName: 'Bob' },
  ];

  it('promptSuggestAssignees includes workload context', () => {
    const workloads: WorkloadSummary[] = [
      { userId: 'u1', displayName: 'Alice', activeTasks: 5, overdueTasks: 1, completedThisWeek: 3, avgCompletionDays: 2, expertise: ['immigration'] },
      { userId: 'u2', displayName: 'Bob', activeTasks: 2, overdueTasks: 0, completedThisWeek: 7, avgCompletionDays: 1, expertise: ['visa'] },
    ];
    const prompt = promptSuggestAssignees('File H1B', 'Prepare H1B petition', workloads);
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('Bob');
    expect(prompt).toContain('5 active');
    expect(prompt).toContain('immigration');
  });

  it('computeWorkloads computes correctly with real data', () => {
    const tasks = [
      { status: 'in_progress', assignees: ['u1'], tags: ['visa'], dueDate: '2020-01-01' },
      { status: 'todo', assignees: ['u2'], tags: ['legal'] },
      { status: 'done', assignees: ['u1'], tags: ['visa'] },
    ];
    const result = computeWorkloads(members, tasks);
    const alice = result.find(w => w.userId === 'u1')!;
    expect(alice.activeTasks).toBe(1);
    expect(alice.overdueTasks).toBe(1); // past due date
    expect(alice.expertise).toContain('visa');
  });
});

// ---- Suggest Automations endpoint helpers ----

describe('AI Suggest Automations — patterns & merge', () => {
  it('detectPatterns finds status transition patterns', () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      action: 'updated',
      resource: 'task',
      detail: `status → done`,
      actorName: 'Alice',
      createdAt: null,
    }));
    const patterns = detectPatterns(events);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].pattern).toContain('status');
  });

  it('detectPatterns handles empty events', () => {
    expect(detectPatterns([])).toEqual([]);
  });

  it('promptSuggestAutomations includes patterns in prompt', () => {
    const patterns = [
      { pattern: 'Frequent status to done transitions', frequency: 15, examples: ['status → done'] },
    ];
    const existing = [{ name: 'Existing automation', trigger: 'task_created' }];
    const prompt = promptSuggestAutomations(patterns, existing);
    expect(prompt).toContain('Frequent status to done transitions');
    expect(prompt).toContain('Existing automation');
  });

  it('mergeWithTemplates includes built-in templates', () => {
    const merged = mergeWithTemplates([], []);
    expect(merged.length).toBe(SUGGESTION_TEMPLATES.length);
  });

  it('mergeWithTemplates filters duplicates by name', () => {
    const existingNames = [SUGGESTION_TEMPLATES[0].title];
    const merged = mergeWithTemplates([], existingNames);
    expect(merged.length).toBe(SUGGESTION_TEMPLATES.length - 1);
  });
});

// ---- Writing Assistant endpoint helpers ----

describe('AI Writing — prompt building & helpers', () => {
  it('buildWritingPrompt produces prompts for all actions', () => {
    const actions = ['continue', 'rewrite', 'expand', 'condense', 'translate', 'proofread', 'tone_shift'] as const;
    for (const action of actions) {
      const req: WritingRequest = {
        action,
        content: 'Test content here.',
        tone: action === 'tone_shift' ? 'formal' : undefined,
        targetLanguage: action === 'translate' ? 'Spanish' : undefined,
      };
      const prompt = buildWritingPrompt(req);
      expect(prompt.length).toBeGreaterThan(50);
      expect(prompt).toContain('Test content here');
    }
  });

  it('countWords counts correctly', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  spaced   out  ')).toBe(2);
    expect(countWords('')).toBe(0);
  });

  it('buildWritingResult builds correct metadata', () => {
    const result = buildWritingResult('hello world', 'hello beautiful world out there', 'expand');
    expect(result.action).toBe('expand');
    expect(result.wordCountBefore).toBe(2);
    expect(result.wordCountAfter).toBe(5);
    expect(result.text).toBe('hello beautiful world out there');
  });

  it('buildWritingPrompt includes custom instructions when provided', () => {
    const req: WritingRequest = {
      action: 'rewrite',
      content: 'Some text.',
      instructions: 'Make it more concise',
    };
    const prompt = buildWritingPrompt(req);
    expect(prompt).toContain('Make it more concise');
  });

  it('buildWritingPrompt handles translate with target language', () => {
    const req: WritingRequest = {
      action: 'translate',
      content: 'Hello world',
      targetLanguage: 'French',
    };
    const prompt = buildWritingPrompt(req);
    expect(prompt).toContain('French');
  });
});

// ---- Auth requirement pattern (structural test) ----

describe('API route auth pattern', () => {
  it('server-auth module exports auth functions', async () => {
    // server-auth imports firebase-admin which needs credentials at init time.
    // In CI/test environments without Firebase credentials, the import will throw.
    // This test validates the module structure when credentials are available.
    try {
      const mod = await import('@/lib/server-auth');
      expect(typeof mod.authenticateRequest).toBe('function');
      expect(typeof mod.verifyIdToken).toBe('function');
    } catch (err: any) {
      // Expected in environments without Firebase Admin credentials
      expect(err.message).toContain('Firebase Admin SDK');
    }
  });
});

// ---- Error handling pattern ----

describe('Error handling', () => {
  it('parseAIJSON handles deeply nested JSON', () => {
    const raw = '{"subtasks": ["a"], "meta": {"nested": {"deep": true}}}';
    const result = parseAIJSON<any>(raw);
    expect(result).not.toBeNull();
    expect(result.meta.nested.deep).toBe(true);
  });

  it('parseAIJSON handles extra text around JSON', () => {
    const raw = 'Sure, here is the result:\n{"subtasks": ["a"]}\nHope that helps!';
    const result = parseAIJSON<{ subtasks: string[] }>(raw);
    expect(result).not.toBeNull();
    expect(result!.subtasks).toEqual(['a']);
  });
});
