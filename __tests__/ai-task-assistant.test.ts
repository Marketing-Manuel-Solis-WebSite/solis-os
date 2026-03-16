import { describe, it, expect } from 'vitest';
import {
  promptTaskPrioritize,
  promptDecomposeTask,
  promptSuggestAssignees,
  promptSmartCategorize,
  computeWorkloads,
  parseAIJSON,
} from '@/lib/ai-task-assistant';

// ---- promptTaskPrioritize ----

describe('promptTaskPrioritize', () => {
  it('includes task title and description in prompt', () => {
    const prompt = promptTaskPrioritize('Fix login bug', 'Users cannot login on mobile');
    expect(prompt).toContain('Fix login bug');
    expect(prompt).toContain('Users cannot login on mobile');
  });

  it('includes existing tasks when provided', () => {
    const prompt = promptTaskPrioritize('New task', 'desc', [
      { title: 'Task A', priority: 'high' },
      { title: 'Task B', priority: 'low' },
    ]);
    expect(prompt).toContain('[high] Task A');
    expect(prompt).toContain('[low] Task B');
  });

  it('handles missing existing tasks gracefully', () => {
    const prompt = promptTaskPrioritize('New task', 'desc');
    expect(prompt).toContain('None provided');
  });
});

// ---- promptDecomposeTask ----

describe('promptDecomposeTask', () => {
  it('returns a prompt requesting subtask decomposition', () => {
    const prompt = promptDecomposeTask('Redesign homepage', 'Full redesign of the landing page');
    expect(prompt).toContain('Redesign homepage');
    expect(prompt).toContain('subtasks');
    expect(prompt).toContain('3-8');
  });
});

// ---- promptSuggestAssignees ----

describe('promptSuggestAssignees', () => {
  it('includes workload data in prompt', () => {
    const workloads = [
      { userId: 'u1', displayName: 'Alice', activeTasks: 3, overdueTasks: 0, completedThisWeek: 5, avgCompletionDays: 2, expertise: ['immigration', 'visa'] },
    ];
    const prompt = promptSuggestAssignees('Prepare visa', 'Prepare H1B visa application', workloads);
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('3 active');
    expect(prompt).toContain('immigration, visa');
  });
});

// ---- promptSmartCategorize ----

describe('promptSmartCategorize', () => {
  it('includes available tags', () => {
    const prompt = promptSmartCategorize('Fix bug', 'Crash on save', ['bug', 'feature', 'urgent']);
    expect(prompt).toContain('bug, feature, urgent');
  });
});

// ---- computeWorkloads ----

describe('computeWorkloads', () => {
  const members = [
    { userId: 'u1', displayName: 'Alice' },
    { userId: 'u2', displayName: 'Bob' },
  ];

  it('counts active and overdue tasks per member', () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().split('T')[0];
    const tasks = [
      { status: 'in_progress', assignees: ['u1'], tags: ['visa'], dueDate: yesterday },
      { status: 'in_progress', assignees: ['u1'], tags: ['visa'] },
      { status: 'done', assignees: ['u1'], tags: [] },
      { status: 'in_progress', assignees: ['u2'], tags: ['legal'] },
    ];

    const result = computeWorkloads(members, tasks);
    const alice = result.find(r => r.userId === 'u1')!;
    const bob = result.find(r => r.userId === 'u2')!;

    expect(alice.activeTasks).toBe(2);
    expect(alice.overdueTasks).toBe(1);
    expect(bob.activeTasks).toBe(1);
    expect(bob.overdueTasks).toBe(0);
  });

  it('computes expertise from task tags', () => {
    const tasks = [
      { status: 'in_progress', assignees: ['u1'], tags: ['visa', 'immigration'] },
      { status: 'done', assignees: ['u1'], tags: ['visa'] },
      { status: 'in_progress', assignees: ['u1'], tags: ['visa', 'legal'] },
    ];

    const result = computeWorkloads(members, tasks);
    const alice = result.find(r => r.userId === 'u1')!;
    expect(alice.expertise[0]).toBe('visa'); // most frequent
  });

  it('returns empty workload for members with no tasks', () => {
    const result = computeWorkloads(members, []);
    expect(result).toHaveLength(2);
    expect(result[0].activeTasks).toBe(0);
    expect(result[0].overdueTasks).toBe(0);
    expect(result[0].expertise).toEqual([]);
  });
});

// ---- parseAIJSON ----

describe('parseAIJSON', () => {
  it('parses clean JSON', () => {
    const result = parseAIJSON<{ priority: string }>('{"priority":"high"}');
    expect(result).toEqual({ priority: 'high' });
  });

  it('strips markdown code fences', () => {
    const result = parseAIJSON<{ a: number }>('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it('finds JSON within surrounding text', () => {
    const result = parseAIJSON<{ x: boolean }>('Here is the result: {"x": true} hope that helps!');
    expect(result).toEqual({ x: true });
  });

  it('returns null for invalid JSON', () => {
    expect(parseAIJSON('not json at all')).toBeNull();
  });

  it('handles nested objects', () => {
    const result = parseAIJSON<{ a: { b: number } }>('{"a": {"b": 42}}');
    expect(result?.a.b).toBe(42);
  });
});
