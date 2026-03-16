// ================================================================
// AI Writing Assistant — Transform / generate text
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/server-auth';
import {
  buildWritingPrompt,
  buildWritingResult,
  countWords,
  type WritingRequest,
  type WritingAction,
} from '@/lib/ai-writing-assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTENT = 15_000;
const VALID_ACTIONS: WritingAction[] = ['continue', 'rewrite', 'expand', 'condense', 'translate', 'proofread', 'tone_shift'];
const VALID_TONES = ['formal', 'casual', 'professional', 'friendly', 'academic', 'legal'];
const VALID_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko', 'ar',
  'hi', 'bn', 'pl', 'uk', 'sv', 'da', 'no', 'fi', 'cs', 'ro', 'hu', 'tr',
  'th', 'vi', 'id', 'ms', 'he', 'el', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt',
];

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, content, context, tone, targetLanguage, instructions, docId } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (tone && !VALID_TONES.includes(tone)) {
      return NextResponse.json({ error: `Invalid tone. Must be one of: ${VALID_TONES.join(', ')}` }, { status: 400 });
    }

    if (targetLanguage && !VALID_LANGUAGES.includes(targetLanguage)) {
      return NextResponse.json({ error: `Invalid targetLanguage. Must be a valid ISO language code.` }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const writingReq: WritingRequest = {
      action,
      content: content.slice(0, MAX_CONTENT),
      context: context?.slice(0, 3000),
      tone,
      targetLanguage,
      instructions: instructions?.slice(0, 500),
    };

    const prompt = buildWritingPrompt(writingReq);

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.5, topP: 0.9, maxOutputTokens: 8192 },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 502 });
    }

    const writingResult = buildWritingResult(content, text, action);

    return NextResponse.json({
      ...writingResult,
      docId: docId || null,
    });
  } catch (err: any) {
    console.error('[AI:Writing] error:', err?.message || err);

    if (err?.status === 429 || err?.message?.includes('429')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again in a moment.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
