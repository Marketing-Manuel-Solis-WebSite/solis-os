// ================================================================
// AI Task Decomposition — Break a task into subtasks
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/server-auth';
import { promptDecomposeTask, parseAIJSON } from '@/lib/ai-task-assistant';

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

    const title = taskTitle.slice(0, MAX_TITLE);
    const description = (taskDescription || '').slice(0, MAX_DESC);
    const prompt = promptDecomposeTask(title, description);

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 2048 },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseAIJSON<{ subtasks: string[] }>(text);

    if (!parsed?.subtasks || !Array.isArray(parsed.subtasks)) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
    }

    return NextResponse.json({
      taskId: taskId || null,
      subtasks: parsed.subtasks.slice(0, 10),
    });
  } catch (err: any) {
    console.error('[AI:Decompose] error:', err?.message || err);

    if (err?.status === 429 || err?.message?.includes('429')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again in a moment.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
