// ================================================================
// AI Automation Suggestions — Pattern-based automation discovery
// ================================================================
// Analyzes user behavior patterns in event logs to suggest
// automations that would save time.

import { CONTEXT_LIMITS, truncateContext } from './ai-prompts';

const ORG_CONTEXT = `Organization: Law Office of Manuel Solis (Solis Center). Immigration law.`;

// ---- Types ----

export interface AutomationSuggestion {
  id: string;
  title: string;
  description: string;
  trigger: string;
  actions: string[];
  estimatedTimeSaved: string;   // e.g. "2 hours/week"
  confidence: number;           // 0-1
  basedOn: string;              // pattern that led to suggestion
  category: 'task' | 'notification' | 'assignment' | 'status' | 'escalation';
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  examples: string[];
}

// ---- Pattern Detection (Pure Functions) ----

/**
 * Detect repetitive behavior patterns from event logs.
 */
export function detectPatterns(
  events: { action: string; resource: string; detail: string; actorName: string; createdAt: any }[],
): BehaviorPattern[] {
  const patterns: BehaviorPattern[] = [];

  // Pattern 1: Frequent manual status changes (same transition)
  const statusChanges = events.filter(e => e.action === 'updated' && e.detail?.includes('status'));
  const transitionCounts: Record<string, { count: number; examples: string[] }> = {};
  for (const e of statusChanges) {
    const match = e.detail.match(/status\s*→\s*(\w+)/);
    if (match) {
      const key = `status_to_${match[1]}`;
      if (!transitionCounts[key]) transitionCounts[key] = { count: 0, examples: [] };
      transitionCounts[key].count++;
      if (transitionCounts[key].examples.length < 3) transitionCounts[key].examples.push(e.detail);
    }
  }
  for (const [key, data] of Object.entries(transitionCounts)) {
    if (data.count >= 5) {
      patterns.push({
        pattern: `Frequent manual ${key.replace('_', ' ')} transitions`,
        frequency: data.count,
        examples: data.examples,
      });
    }
  }

  // Pattern 2: Repeated task creation with similar titles
  const taskCreations = events.filter(e => e.action === 'created' && e.resource === 'task');
  const titlePrefixes: Record<string, { count: number; examples: string[] }> = {};
  for (const e of taskCreations) {
    const prefix = (e.detail || '').split(/[\s\-:]/)[0]?.toLowerCase();
    if (prefix && prefix.length >= 3) {
      if (!titlePrefixes[prefix]) titlePrefixes[prefix] = { count: 0, examples: [] };
      titlePrefixes[prefix].count++;
      if (titlePrefixes[prefix].examples.length < 3) titlePrefixes[prefix].examples.push(e.detail);
    }
  }
  for (const [prefix, data] of Object.entries(titlePrefixes)) {
    if (data.count >= 3) {
      patterns.push({
        pattern: `Repeated task creation starting with "${prefix}"`,
        frequency: data.count,
        examples: data.examples,
      });
    }
  }

  // Pattern 3: Same actor doing same action repeatedly
  const actorActions: Record<string, { count: number; examples: string[] }> = {};
  for (const e of events) {
    const key = `${e.actorName}:${e.action}:${e.resource}`;
    if (!actorActions[key]) actorActions[key] = { count: 0, examples: [] };
    actorActions[key].count++;
    if (actorActions[key].examples.length < 3) actorActions[key].examples.push(e.detail || '');
  }
  for (const [key, data] of Object.entries(actorActions)) {
    if (data.count >= 10) {
      const [actor, action, resource] = key.split(':');
      patterns.push({
        pattern: `${actor} frequently ${action}s ${resource}s`,
        frequency: data.count,
        examples: data.examples,
      });
    }
  }

  return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
}

// ---- Built-in Suggestion Templates ----

export const SUGGESTION_TEMPLATES: Omit<AutomationSuggestion, 'id' | 'confidence' | 'basedOn'>[] = [
  {
    title: 'Auto-assign overdue task escalation',
    description: 'When a task becomes overdue, automatically notify the manager and change priority to high.',
    trigger: 'task.overdue',
    actions: ['change_priority → high', 'notify_manager', 'add_tag "escalated"'],
    estimatedTimeSaved: '1 hour/week',
    category: 'escalation',
  },
  {
    title: 'Welcome notification for new team members',
    description: 'When a new member is added, create a welcome task and send onboarding notification.',
    trigger: 'member.added',
    actions: ['create_task "Complete onboarding"', 'notify_user "Welcome to the team"'],
    estimatedTimeSaved: '30 min/occurrence',
    category: 'notification',
  },
  {
    title: 'Auto-close stale tasks',
    description: 'Tasks in "in_review" status for more than 7 days are automatically moved to "done".',
    trigger: 'task.status_stale(7d, in_review)',
    actions: ['change_status → done', 'add_comment "Auto-closed after 7 days in review"'],
    estimatedTimeSaved: '2 hours/week',
    category: 'status',
  },
  {
    title: 'Notify on high-priority task creation',
    description: 'When an urgent or high-priority task is created, notify all team managers immediately.',
    trigger: 'task.created(priority=urgent|high)',
    actions: ['notify_managers', 'add_to_inbox'],
    estimatedTimeSaved: '45 min/week',
    category: 'notification',
  },
  {
    title: 'Auto-assign tasks by tag',
    description: 'Automatically assign tasks to specific team members based on task tags/category.',
    trigger: 'task.created',
    actions: ['assign_by_tag_expertise'],
    estimatedTimeSaved: '3 hours/week',
    category: 'assignment',
  },
  {
    title: 'Goal progress alert',
    description: 'When a goal falls below expected progress, notify the owner and mark as at_risk.',
    trigger: 'goal.progress_behind(threshold=15%)',
    actions: ['change_status → at_risk', 'notify_owner', 'create_checkin_reminder'],
    estimatedTimeSaved: '1 hour/week',
    category: 'escalation',
  },
];

// ---- AI Prompt for Custom Suggestions ----

export function promptSuggestAutomations(
  patterns: BehaviorPattern[],
  existingAutomations: { name: string; trigger: string }[],
): string {
  const patternCtx = patterns.map(p =>
    `- Pattern: ${p.pattern} (${p.frequency}x)\n  Examples: ${p.examples.join(', ')}`,
  ).join('\n');

  const existingCtx = existingAutomations.map(a => `- ${a.name} (trigger: ${a.trigger})`).join('\n') || 'None configured';

  return `${ORG_CONTEXT}

Analyze these user behavior patterns and suggest automations that would save time.

Detected patterns:
${patternCtx}

Already configured automations:
${existingCtx}

Suggest 2-4 NEW automations (not duplicating existing ones).

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "suggestions": [
    {
      "title": "Automation name",
      "description": "What it does",
      "trigger": "trigger event",
      "actions": ["action1", "action2"],
      "estimatedTimeSaved": "X hours/week",
      "category": "task|notification|assignment|status|escalation",
      "confidence": 0.0-1.0
    }
  ]
}`;
}

/**
 * Merge AI suggestions with built-in templates, deduplicating by title similarity.
 */
export function mergeWithTemplates(
  aiSuggestions: AutomationSuggestion[],
  existingAutomationNames: string[],
): AutomationSuggestion[] {
  const all = [
    ...SUGGESTION_TEMPLATES.map((t, i) => ({
      ...t,
      id: `builtin_${i}`,
      confidence: 0.7,
      basedOn: 'Common automation pattern',
    })),
    ...aiSuggestions,
  ];

  // Filter out anything that matches existing automation names
  const existingLower = new Set(existingAutomationNames.map(n => n.toLowerCase()));
  return all.filter(s => !existingLower.has(s.title.toLowerCase()));
}
