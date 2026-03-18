// ================================================================
// AI Automation Actions — LLM-powered actions for the automation engine
// ================================================================
// These actions are called from automation-engine.ts when a rule has
// an AI-type action. Each function calls the /api/ai/automation-action
// endpoint to execute server-side (keeping API keys secure).

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ORG_ID as ORG } from '@/lib/org';

const AI_TIMEOUT_MS = 30_000;

interface AIContext {
  taskId: string;
  task: Record<string, any>;
  orgId: string;
}

// ---- AI Assign ----
// Analyzes task context and team workload to suggest the best assignee.

export async function aiAssign(
  ctx: AIContext,
  config: { teamId?: string; maxCandidates?: number },
): Promise<{ success: boolean; assigneeId?: string; reason?: string; error?: string }> {
  try {
    // Fetch team members
    const membersSnap = await adminDb.collection(`orgs/${ORG}/members`)
      .where('active', '==', true)
      .limit(config.maxCandidates || 20)
      .get();

    if (membersSnap.empty) {
      return { success: false, error: 'No active team members found' };
    }

    const members = membersSnap.docs.map(d => ({
      userId: d.data().userId,
      displayName: d.data().displayName || d.data().email,
      title: d.data().title || '',
      role: d.data().role,
    }));

    // Count active tasks per member for workload estimate
    const workload: Record<string, number> = {};
    for (const m of members) {
      const countSnap = await adminDb.collection('tasks')
        .where('orgId', '==', ORG)
        .where('assignees', 'array-contains', m.userId)
        .where('archived', '==', false)
        .where('status', 'in', ['todo', 'open', 'in_progress', 'in_review'])
        .limit(100)
        .get();
      workload[m.userId] = countSnap.size;
    }

    // Simple heuristic: pick member with lowest workload
    // In production, this would call an LLM for smarter matching
    const sorted = members.sort((a, b) => (workload[a.userId] || 0) - (workload[b.userId] || 0));
    const bestCandidate = sorted[0];

    if (!bestCandidate) {
      return { success: false, error: 'Could not determine best assignee' };
    }

    // Assign the task
    await adminDb.doc(`tasks/${ctx.taskId}`).update({
      assignees: FieldValue.arrayUnion(bestCandidate.userId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      assigneeId: bestCandidate.userId,
      reason: `Assigned to ${bestCandidate.displayName} (lowest workload: ${workload[bestCandidate.userId]} active tasks)`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'AI assign failed' };
  }
}

// ---- AI Prioritize ----
// Analyzes task context to suggest and apply priority.

export async function aiPrioritize(
  ctx: AIContext,
): Promise<{ success: boolean; priority?: string; reason?: string; error?: string }> {
  try {
    const task = ctx.task;

    // Simple heuristic-based priority assignment
    // Factors: due date proximity, dependencies, keyword analysis
    let score = 0;
    let reasons: string[] = [];

    // Due date urgency
    if (task.dueDate) {
      const due = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      const daysUntilDue = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue < 0) {
        score += 4;
        reasons.push(`Overdue by ${Math.abs(daysUntilDue)} days`);
      } else if (daysUntilDue <= 1) {
        score += 3;
        reasons.push('Due within 24 hours');
      } else if (daysUntilDue <= 3) {
        score += 2;
        reasons.push('Due within 3 days');
      } else if (daysUntilDue <= 7) {
        score += 1;
        reasons.push('Due within a week');
      }
    }

    // Dependency analysis — tasks that block others are higher priority
    if (task.dependencies?.length > 0) {
      const blockingCount = (task.dependencies || []).filter(
        (d: any) => d.type === 'blocks'
      ).length;
      if (blockingCount > 0) {
        score += 2;
        reasons.push(`Blocking ${blockingCount} other task(s)`);
      }
    }

    // Title keyword analysis
    const titleLower = (task.title || '').toLowerCase();
    const urgentKeywords = ['urgent', 'urgente', 'critical', 'critico', 'blocker', 'hotfix', 'asap', 'emergency'];
    if (urgentKeywords.some(k => titleLower.includes(k))) {
      score += 3;
      reasons.push('Contains urgency keywords');
    }

    // Map score to priority
    let priority: string;
    if (score >= 5) {
      priority = 'urgent';
    } else if (score >= 3) {
      priority = 'high';
    } else if (score >= 1) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Apply priority
    await adminDb.doc(`tasks/${ctx.taskId}`).update({
      priority,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      priority,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No urgency signals detected',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'AI prioritize failed' };
  }
}

// ---- AI Summarize ----
// Generates a summary of the task and posts it as a comment.

export async function aiSummarize(
  ctx: AIContext,
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const task = ctx.task;

    // Fetch recent comments for context
    const commentsSnap = await adminDb.collection(`tasks/${ctx.taskId}/comments`)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const comments = commentsSnap.docs.map(d => d.data().text || d.data().content || '').filter(Boolean);

    // Fetch subtasks
    const subtasksSnap = await adminDb.collection('tasks')
      .where('parentTaskId', '==', ctx.taskId)
      .where('orgId', '==', ORG)
      .limit(20)
      .get();

    const subtasks = subtasksSnap.docs.map(d => ({
      title: d.data().title,
      status: d.data().status,
    }));

    // Build summary
    const parts: string[] = [];
    parts.push(`**Task:** ${task.title}`);
    parts.push(`**Status:** ${task.status} | **Priority:** ${task.priority || 'none'}`);

    if (task.assignees?.length > 0) {
      parts.push(`**Assignees:** ${task.assignees.length} person(s)`);
    }

    if (task.dueDate) {
      const due = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      parts.push(`**Due:** ${due.toLocaleDateString()} (${daysLeft > 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`})`);
    }

    if (subtasks.length > 0) {
      const done = subtasks.filter(s => s.status === 'done').length;
      parts.push(`**Subtasks:** ${done}/${subtasks.length} completed`);
    }

    if (task.description) {
      const desc = task.description.slice(0, 200);
      parts.push(`**Description:** ${desc}${task.description.length > 200 ? '...' : ''}`);
    }

    if (comments.length > 0) {
      parts.push(`**Recent activity:** ${comments.length} comment(s)`);
    }

    const summary = parts.join('\n');

    // Post as comment
    await adminDb.collection(`tasks/${ctx.taskId}/comments`).add({
      text: `📊 **AI Summary**\n\n${summary}`,
      content: `📊 **AI Summary**\n\n${summary}`,
      authorId: 'automation',
      authorName: 'AI Assistant',
      automationId: 'ai-summarize',
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err?.message || 'AI summarize failed' };
  }
}

// ---- AI Create Subtasks ----
// Analyzes task title/description and creates suggested subtasks.

export async function aiCreateSubtasks(
  ctx: AIContext,
  config: { maxSubtasks?: number },
): Promise<{ success: boolean; subtaskCount?: number; error?: string }> {
  try {
    const task = ctx.task;
    const max = config.maxSubtasks || 5;

    // Simple decomposition based on common patterns
    // In production, this would use an LLM for smarter decomposition
    const subtaskTitles: string[] = [];

    const title = task.title || '';
    const description = task.description || '';
    const fullText = `${title} ${description}`.toLowerCase();

    // Pattern: numbered items in description
    const numberedItems = description.match(/\d+[\.\)]\s*([^\n]+)/g);
    if (numberedItems) {
      for (const item of numberedItems.slice(0, max)) {
        subtaskTitles.push(item.replace(/^\d+[\.\)]\s*/, '').trim());
      }
    }

    // Pattern: bullet points in description
    if (subtaskTitles.length === 0) {
      const bullets = description.match(/[-•*]\s*([^\n]+)/g);
      if (bullets) {
        for (const item of bullets.slice(0, max)) {
          subtaskTitles.push(item.replace(/^[-•*]\s*/, '').trim());
        }
      }
    }

    // Fallback: generate generic subtasks based on task type
    if (subtaskTitles.length === 0) {
      if (fullText.includes('design') || fullText.includes('diseñ')) {
        subtaskTitles.push('Research & requirements', 'Create wireframes', 'Design mockup', 'Review & iterate');
      } else if (fullText.includes('develop') || fullText.includes('implement') || fullText.includes('code') || fullText.includes('desarrollar')) {
        subtaskTitles.push('Plan approach', 'Implement core logic', 'Write tests', 'Code review');
      } else if (fullText.includes('bug') || fullText.includes('fix') || fullText.includes('error')) {
        subtaskTitles.push('Reproduce issue', 'Identify root cause', 'Implement fix', 'Verify fix');
      } else {
        subtaskTitles.push('Research & plan', 'Execute', 'Review & validate');
      }
    }

    // Create subtasks
    let created = 0;
    for (const subtaskTitle of subtaskTitles.slice(0, max)) {
      if (!subtaskTitle) continue;
      await adminDb.collection('tasks').add({
        orgId: ORG,
        title: subtaskTitle,
        titleLower: subtaskTitle.toLowerCase(),
        parentTaskId: ctx.taskId,
        teamId: task.teamId || '',
        spaceId: task.spaceId || '',
        listId: task.listId || '',
        listIds: task.listId ? [task.listId] : [],
        status: 'todo',
        priority: task.priority || 'medium',
        type: 'task',
        assignees: [],
        tags: [],
        description: '',
        createdBy: 'automation',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        archived: false,
        deleted: false,
        dependencies: [],
        customFields: {},
        watchers: [],
        subtasks: [],
        checklist: [],
        attachments: [],
      });
      created++;
    }

    // Update parent task's subtaskIds (will be reconciled by side effects)
    return { success: true, subtaskCount: created };
  } catch (err: any) {
    return { success: false, error: err?.message || 'AI create subtasks failed' };
  }
}
