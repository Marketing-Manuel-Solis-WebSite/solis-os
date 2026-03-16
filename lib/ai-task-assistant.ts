// ================================================================
// AI Task Assistant — Smart suggestions for task management
// ================================================================
// Provides AI-powered suggestions for:
//   - Priority inference from title/description
//   - Subtask decomposition
//   - Time estimates
//   - Assignee recommendations based on workload/expertise
//   - Smart task categorization

import { CONTEXT_LIMITS, truncateContext } from './ai-prompts';

const ORG_CONTEXT = `Organization: Law Office of Manuel Solis (Solis Center). Immigration law.`;

// ---- Types ----

export interface TaskSuggestion {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  priorityReason: string;
  suggestedTags: string[];
  estimatedHours: number | null;
  subtasks: string[];
  suggestedAssignees: AssigneeSuggestion[];
}

export interface AssigneeSuggestion {
  userId: string;
  displayName: string;
  reason: string;
  score: number; // 0-1 relevance
}

export interface WorkloadSummary {
  userId: string;
  displayName: string;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
  avgCompletionDays: number;
  expertise: string[]; // tags they frequently work on
}

// ---- Prompt Builders ----

export function promptTaskPrioritize(
  title: string,
  description: string,
  existingTasks?: { title: string; priority: string }[],
): string {
  const tasksCtx = existingTasks?.slice(0, 10).map(t => `- [${t.priority}] ${t.title}`).join('\n') || 'None provided';

  return `${ORG_CONTEXT}

Analyze this task and suggest the appropriate priority level.

Task: "${title}"
Description: ${truncateContext(description, CONTEXT_LIMITS.taskContext).text}

Existing team tasks for reference:
${tasksCtx}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "priority": "urgent|high|medium|low",
  "reason": "brief explanation",
  "suggestedTags": ["tag1", "tag2"],
  "estimatedHours": number_or_null
}`;
}

export function promptDecomposeTask(
  title: string,
  description: string,
): string {
  return `${ORG_CONTEXT}

Break down this task into actionable subtasks.

Task: "${title}"
Description: ${truncateContext(description, CONTEXT_LIMITS.taskContext).text}

Requirements:
- Return 3-8 specific, independently completable subtasks
- Each subtask should be clear and actionable
- Order them logically (dependencies first)

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "subtasks": ["subtask 1", "subtask 2", ...]
}`;
}

export function promptSuggestAssignees(
  title: string,
  description: string,
  workloads: WorkloadSummary[],
): string {
  const workloadCtx = workloads.slice(0, 15).map(w =>
    `- ${w.displayName}: ${w.activeTasks} active, ${w.overdueTasks} overdue, expertise: [${w.expertise.join(', ')}]`,
  ).join('\n');

  return `${ORG_CONTEXT}

Suggest the best team member(s) to assign this task to.

Task: "${title}"
Description: ${truncateContext(description, 1500).text}

Team workloads:
${workloadCtx}

Consider:
1. Expertise match (relevant tags/skills)
2. Current workload (fewer active tasks = more capacity)
3. Overdue tasks (high overdue = less capacity)

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "suggestions": [
    { "displayName": "name", "reason": "brief reason", "score": 0.0-1.0 }
  ]
}`;
}

export function promptSmartCategorize(
  title: string,
  description: string,
  availableTags: string[],
): string {
  return `${ORG_CONTEXT}

Categorize this task by selecting relevant tags and suggesting a task type.

Task: "${title}"
Description: ${truncateContext(description, 1500).text}

Available tags: ${availableTags.slice(0, 30).join(', ')}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "tags": ["tag1", "tag2"],
  "type": "task|bug|feature|improvement|research",
  "category": "brief category name"
}`;
}

// ---- Workload Computation (Pure) ----

/**
 * Compute workload summary from raw task data.
 * This is a pure function — no Firestore calls.
 */
export function computeWorkloads(
  members: { userId: string; displayName: string }[],
  tasks: { status: string; assignees: string[]; tags: string[]; dueDate?: string; completedAt?: any; createdAt?: any }[],
): WorkloadSummary[] {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const todayStr = now.toISOString().split('T')[0];

  return members.map(member => {
    const myTasks = tasks.filter(t => t.assignees?.includes(member.userId));
    const active = myTasks.filter(t => t.status !== 'done' && t.status !== 'completed' && t.status !== 'cancelled');
    const overdue = active.filter(t => t.dueDate && t.dueDate < todayStr);
    const completedRecently = myTasks.filter(t => {
      if (t.status !== 'done' && t.status !== 'completed') return false;
      const completedAt = t.completedAt?.toDate?.() || (t.completedAt?.seconds ? new Date(t.completedAt.seconds * 1000) : null);
      return completedAt && completedAt >= weekAgo;
    });

    // Expertise: most common tags across their tasks
    const tagCounts: Record<string, number> = {};
    myTasks.forEach(t => (t.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }));
    const expertise = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);

    // Average completion time
    let totalDays = 0;
    let completedCount = 0;
    myTasks.forEach(t => {
      if (t.status !== 'done' && t.status !== 'completed') return;
      const created = t.createdAt?.toDate?.() || (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000) : null);
      const completed = t.completedAt?.toDate?.() || (t.completedAt?.seconds ? new Date(t.completedAt.seconds * 1000) : null);
      if (created && completed) {
        totalDays += (completed.getTime() - created.getTime()) / 86_400_000;
        completedCount++;
      }
    });

    return {
      userId: member.userId,
      displayName: member.displayName,
      activeTasks: active.length,
      overdueTasks: overdue.length,
      completedThisWeek: completedRecently.length,
      avgCompletionDays: completedCount > 0 ? Math.round((totalDays / completedCount) * 10) / 10 : 0,
      expertise,
    };
  });
}

// ---- Response Parsing ----

/**
 * Parse AI JSON response, handling common issues
 * (markdown code fences, trailing text, etc.)
 */
export function parseAIJSON<T>(raw: string): T | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    // Find first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
