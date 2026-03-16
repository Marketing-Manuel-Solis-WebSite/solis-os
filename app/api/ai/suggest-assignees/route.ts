// ================================================================
// AI Assignee Suggestions — Recommend assignees based on workload
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import {
  promptSuggestAssignees,
  computeWorkloads,
  parseAIJSON,
  type WorkloadSummary,
  type AssigneeSuggestion,
} from '@/lib/ai-task-assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TITLE = 500;
const MAX_DESC = 5000;

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, taskTitle, taskDescription } = body;

    if (!taskTitle || typeof taskTitle !== 'string' || !taskTitle.trim()) {
      return NextResponse.json({ error: 'taskTitle is required' }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Fetch members
    const membersSnap = await adminDb.collection(`orgs/${ORG}/members`).where('active', '==', true).get();
    const members = membersSnap.docs.map(d => ({
      userId: d.id,
      displayName: d.data().displayName || d.data().email || d.id,
    }));

    if (members.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Fetch tasks for workload computation
    const tasksSnap = await adminDb.collection(`orgs/${ORG}/tasks`).get();
    const tasks = tasksSnap.docs.map(d => {
      const data = d.data();
      return {
        status: data.status || 'todo',
        assignees: data.assignees || [],
        tags: data.tags || [],
        dueDate: data.dueDate,
        completedAt: data.completedAt,
        createdAt: data.createdAt,
      };
    });

    const workloads = computeWorkloads(members, tasks);

    const title = taskTitle.slice(0, MAX_TITLE);
    const description = (taskDescription || '').slice(0, MAX_DESC);
    const prompt = promptSuggestAssignees(title, description, workloads);

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 2048 },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseAIJSON<{ suggestions: { displayName: string; reason: string; score: number }[] }>(text);

    if (!parsed?.suggestions || !Array.isArray(parsed.suggestions)) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    // Map displayName back to userId
    const suggestions: AssigneeSuggestion[] = parsed.suggestions.map(s => {
      const match = members.find(m =>
        m.displayName.toLowerCase() === s.displayName.toLowerCase() ||
        m.displayName.toLowerCase().includes(s.displayName.toLowerCase()),
      );
      return {
        userId: match?.userId || '',
        displayName: s.displayName,
        reason: s.reason,
        score: Math.min(1, Math.max(0, s.score)),
      };
    }).filter(s => s.userId);

    return NextResponse.json({
      taskId: taskId || null,
      suggestions: suggestions.slice(0, 5),
      workloads: workloads.map(w => ({
        userId: w.userId,
        displayName: w.displayName,
        activeTasks: w.activeTasks,
        overdueTasks: w.overdueTasks,
      })),
    });
  } catch (err: any) {
    console.error('[AI:SuggestAssignees] error:', err?.message || err);

    if (err?.status === 429 || err?.message?.includes('429')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again in a moment.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
