import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_BASE = `You are Solis AI, the intelligent assistant for the Law Office of Manuel Solis (Solis Center).
You are a highly capable AI assistant specialized in law office operations, immigration law, legal research, business management, and general knowledge.
You work for a law firm that handles immigration cases primarily. The team includes Marketing, Openers (lead intake), Closers (case conversion), and Dirección (management).

IMPORTANT RULES:
- Always respond in the same language the user writes in (Spanish or English)
- Be thorough, detailed, and professional
- Use markdown formatting for better readability (headers, bold, lists, tables when appropriate)
- When discussing legal topics, note this is general information, not legal advice
- Be helpful, precise, and give complete answers
- If asked about something you don't know, say so clearly
`;

const MODE_PROMPTS: Record<string, string> = {
  chat: `${SYSTEM_BASE}
MODE: Chat — Quick, conversational responses. Be concise but complete. Answer directly.
Keep responses focused and practical. Use short paragraphs.`,

  research: `${SYSTEM_BASE}
MODE: Research — You are in RESEARCH MODE. The user wants you to investigate a topic thoroughly.
Your task is to provide a comprehensive, well-researched response as if you had access to the latest information.

RESEARCH FORMAT:
- Start with a brief overview/summary
- Provide detailed findings organized by subtopic
- Include relevant data points, statistics, or examples
- Cite sources conceptually (e.g., "According to USCIS guidelines...", "Per the Immigration and Nationality Act...")
- End with key takeaways or recommendations
- Use headers (##), bullet points, bold for important terms
- Be VERY thorough — aim for 500-1500 words
- Include practical implications for a law office context when relevant`,

  deep: `${SYSTEM_BASE}
MODE: Deep Search — You are generating a COMPREHENSIVE RESEARCH REPORT. This should be publication-quality.

REPORT STRUCTURE (always follow this):
# [Report Title]

## Executive Summary
Brief 2-3 paragraph overview of findings.

## Table of Contents
List all sections.

## 1. Introduction / Background
Context and why this topic matters.

## 2. Detailed Analysis
The core research broken into logical subsections with ### headers.
Include data, examples, case studies, statistics.
Cover multiple perspectives.

## 3. Key Findings
Numbered list of the most important discoveries.

## 4. Implications & Impact
What this means for the law office / legal industry / relevant stakeholders.

## 5. Recommendations
Specific, actionable recommendations based on findings.

## 6. Conclusion
Summary and forward-looking statement.

## Sources & References
List conceptual sources (legal codes, government agencies, industry reports).

---

GUIDELINES:
- This should be 1500-3000+ words
- Be EXHAUSTIVE — cover every angle
- Use tables for comparing data
- Use > blockquotes for important callouts
- Include relevant legal citations
- Make it suitable for printing as a professional report
- Write as if presenting to the managing partner of the firm`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, mode = 'chat', history = [] } = body;

    if (!question) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'Gemini API key not configured. Add GEMINI_API_KEY to your .env file.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(key);

    // Use different model configs per mode
    const modelName = 'gemini-pro';
    const generationConfig: any = {
      chat: { temperature: 0.7, topP: 0.9, maxOutputTokens: 2048 },
      research: { temperature: 0.4, topP: 0.95, maxOutputTokens: 4096 },
      deep: { temperature: 0.3, topP: 0.95, maxOutputTokens: 8192 },
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: generationConfig[mode] || generationConfig.chat,
    });

    // Build conversation history for context
    const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.chat;
    let fullPrompt = systemPrompt + '\n\n';

    // Include last N messages for context (up to 10)
    const recentHistory = (history || []).slice(-10);
    if (recentHistory.length > 0) {
      fullPrompt += '--- CONVERSATION HISTORY ---\n';
      for (const msg of recentHistory) {
        if (msg.role === 'user') {
          fullPrompt += `USER: ${msg.content}\n`;
        } else {
          fullPrompt += `ASSISTANT: ${msg.content?.slice(0, 500)}...\n`;
        }
      }
      fullPrompt += '--- END HISTORY ---\n\n';
    }

    // Add mode-specific prefixes
    if (mode === 'research') {
      fullPrompt += `RESEARCH REQUEST: ${question}\n\nPlease provide a thorough, well-structured research response:`;
    } else if (mode === 'deep') {
      fullPrompt += `DEEP RESEARCH REPORT REQUEST: ${question}\n\nGenerate a comprehensive, publication-quality research report following the structure specified above:`;
    } else {
      fullPrompt += `USER: ${question}`;
    }

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({
      answer: text,
      mode,
      tokens: text.length, // Approximate
    });
  } catch (error: any) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: error.message || 'AI processing failed. Verify your Gemini API key in .env' },
      { status: 500 }
    );
  }
}