// ================================================================
// AI Automation Suggestions — Analyze patterns & suggest automations
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/server-auth';
import { adminDb } from '@/lib/firebase-admin';
import { ORG_ID as ORG } from '@/lib/org';
import {
  detectPatterns,
  promptSuggestAutomations,
  mergeWithTemplates,
  type AutomationSuggestion,
} from '@/lib/ai-automation-suggestions';
import { parseAIJSON } from '@/lib/ai-task-assistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Fetch recent event logs for pattern detection
    const eventsSnap = await adminDb
      .collection(`orgs/${ORG}/eventLog`)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const events = eventsSnap.docs.map(d => {
      const data = d.data();
      return {
        action: data.action || '',
        resource: data.resource || '',
        detail: data.detail || '',
        actorName: data.actorName || '',
        createdAt: data.createdAt,
      };
    });

    const patterns = detectPatterns(events);

    // Fetch existing automations to avoid duplicate suggestions
    const autoSnap = await adminDb.collection(`orgs/${ORG}/automations`).get();
    const existingAutomations = autoSnap.docs.map(d => ({
      name: d.data().name || '',
      trigger: d.data().trigger || '',
    }));

    let aiSuggestions: AutomationSuggestion[] = [];

    // Only call AI if we have meaningful patterns
    if (patterns.length > 0) {
      const prompt = promptSuggestAutomations(patterns, existingAutomations);

      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.5, topP: 0.9, maxOutputTokens: 4096 },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseAIJSON<{ suggestions: Omit<AutomationSuggestion, 'id' | 'basedOn'>[] }>(text);

      if (parsed?.suggestions && Array.isArray(parsed.suggestions)) {
        aiSuggestions = parsed.suggestions.map((s, i) => ({
          ...s,
          id: `ai_${i}`,
          basedOn: 'AI analysis of user behavior patterns',
          confidence: Math.min(1, Math.max(0, s.confidence ?? 0.6)),
        })) as AutomationSuggestion[];
      }
    }

    const existingNames = existingAutomations.map(a => a.name);
    const merged = mergeWithTemplates(aiSuggestions, existingNames);

    return NextResponse.json({
      suggestions: merged.slice(0, 10),
      patterns: patterns.slice(0, 5),
      existingCount: existingAutomations.length,
    });
  } catch (err: any) {
    console.error('[AI:SuggestAutomations] error:', err?.message || err);

    if (err?.status === 429 || err?.message?.includes('429')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again in a moment.' }, { status: 429 });
    }

    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
  }
}
