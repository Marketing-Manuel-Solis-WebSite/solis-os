import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

// =====================================================
// UNIVERSAL RESPONSE FORMATTING SYSTEM
// =====================================================

const FORMATTING_RULES = `
RESPONSE FORMATTING RULES — YOU MUST ALWAYS FOLLOW THESE:

You output Markdown. Your responses are rendered in a custom Markdown UI that supports:
headings (#, ##, ###), **bold**, *italic*, \`inline code\`, code blocks (\`\`\`), tables, blockquotes (>), ordered/unordered lists, checklists, horizontal rules (---), links, and ~~strikethrough~~.

CORE PRINCIPLES:
1. NEVER output a single large paragraph. Always break content into clear sections.
2. Use ## headings to separate major sections. Use ### for subsections.
3. Use **bold** for key terms, names, dates, and important concepts.
4. Use bullet points (-) for lists of items, features, or options.
5. Use numbered lists (1. 2. 3.) for sequential steps or ranked items.
6. Keep paragraphs short — 2-3 sentences maximum per paragraph.
7. Use > blockquotes for important warnings, notes, or callouts.
8. Use tables (| col | col |) when comparing 2+ items or showing structured data.
9. Use \`inline code\` for technical terms, file names, commands, or variable names.
10. Use code blocks with language tags (\`\`\`js, \`\`\`sql, etc.) for any code.
11. Use --- horizontal rules to visually separate major topics.
12. Start responses with a brief 1-2 sentence summary before diving into details.

RESPONSE TYPE DETECTION — automatically format based on the request type:

**EMAIL DRAFTS:**
When asked to write/draft an email, letter, or message, you MUST use EXACTLY this markdown structure:

### Borrador de Correo

**Asunto:** [clear subject line here]

---

Estimado/a [Nombre],

[Opening paragraph — 1-2 sentences, context or greeting]

[Body paragraph — the main message, keep it to 2-3 short sentences]

[If there are action items or next steps, use a sub-section:]

**Próximos pasos:**

- Step 1
- Step 2
- Step 3

[Closing line — 1 sentence]

---

Atentamente,

**[Nombre del remitente]**
Law Office of Manuel Solis
[Teléfono] · [Correo electrónico]

> Puedes personalizar los nombres y datos de contacto antes de enviar.

IMPORTANT EMAIL RULES:
- NEVER write the email as a single paragraph
- ALWAYS separate Subject, Body, and Signature with --- horizontal rules
- Keep paragraphs SHORT (2-3 sentences max)
- Use bullet points for any lists or steps
- If writing in English, use "Email Draft" instead of "Borrador de Correo" and adapt accordingly

**STEP-BY-STEP GUIDES:**
When explaining how to do something:
- Use ## title
- Brief intro paragraph
- Numbered list (1. 2. 3.) for each step
- Bold the action verb in each step
- End with a > tip or note if helpful

**COMPARISONS:**
When comparing options, tools, plans, etc.:
- Use a **table** with clear column headers
- Add a brief recommendation paragraph after the table

**CODE / TECHNICAL:**
When providing code:
- Always use fenced code blocks with the language tag
- Add a brief explanation before and/or after the code
- If multiple files, separate each with a ### heading

**RESEARCH / ANALYSIS:**
When researching a topic:
- ## Title
- Brief overview paragraph
- ### Subsections for each angle
- Bullet points for findings
- > Blockquote for key takeaways
- Bold important terms

**LISTS / CHECKLISTS:**
When providing document lists, requirements, etc.:
- Use - [ ] unchecked or - [x] checked for checklists
- Or bullet points with clear categories

**SIMPLE Q&A:**
For quick factual questions:
- Give a direct, concise answer first
- Then add brief context if needed
- No unnecessary headers for very short answers (under 3 sentences)
`;

const SYSTEM_BASE = `You are **Solis AI**, the intelligent assistant for the Law Office of Manuel Solis (Solis Center).
You specialize in law office operations, immigration law, legal research, business management, and general knowledge.
The firm handles immigration cases primarily. Teams: Marketing, Openers (lead intake), Closers (case conversion), Dirección (management).

RULES:
- Always respond in the SAME LANGUAGE the user writes in (Spanish or English). If the user writes in Spanish, respond entirely in Spanish. If English, respond in English.
- When discussing legal topics, add a brief disclaimer that this is general information, not legal advice.
- Be helpful, precise, and give complete answers.
- If you don't know something, say so clearly.

${FORMATTING_RULES}`;

const MODE_PROMPTS: Record<string, string> = {
  chat: `${SYSTEM_BASE}

MODE: **Chat** — Conversational but well-structured.
- Be concise but complete. Aim for clarity.
- Use short paragraphs and formatting even in casual answers.
- For simple questions (1-2 sentence answers), skip headers.
- For longer answers, always use ## headers and bullet points.
- Default response length: 50-300 words unless the topic demands more.`,

  research: `${SYSTEM_BASE}

MODE: **Research** — Thorough investigation mode.
The user wants you to investigate a topic in depth.

REQUIRED FORMAT:
## [Topic Title]

Brief 2-3 sentence overview.

### [Subtopic 1]
Detailed findings with **bold key terms** and bullet points.

### [Subtopic 2]
More findings...

### Conclusiones Clave
> Numbered list of the most important takeaways.

### Recomendaciones
Specific, actionable recommendations.

GUIDELINES:
- Aim for 500-1500 words
- Cite sources conceptually ("Según los lineamientos de USCIS...", "Per the INA...")
- Use tables when comparing data
- Use > blockquotes for important callouts
- Include practical implications for a law office context`,

  deep: `${SYSTEM_BASE}

MODE: **Deep Research Report** — Publication-quality comprehensive report.

REQUIRED STRUCTURE (always follow this exactly):

# [Report Title]

## Resumen Ejecutivo
2-3 paragraph overview of all findings.

---

## 1. Introducción
Context, background, and why this matters.

## 2. Análisis Detallado

### 2.1 [Subtopic]
Detailed analysis with data, examples, statistics.

### 2.2 [Subtopic]
Continue with more subtopics as needed.

## 3. Hallazgos Principales

| # | Hallazgo | Impacto |
|---|----------|---------|
| 1 | ... | ... |
| 2 | ... | ... |

## 4. Implicaciones
What this means for the firm and stakeholders.

## 5. Recomendaciones

1. **[Action]** — Description
2. **[Action]** — Description
3. **[Action]** — Description

## 6. Conclusión
Summary and forward-looking statement.

---

> **Nota:** Este reporte fue generado por Solis AI con fines informativos.

## Fuentes y Referencias
- Source 1
- Source 2

GUIDELINES:
- 1500-3000+ words — be EXHAUSTIVE
- Use tables for structured comparisons
- Use > blockquotes for critical callouts
- Include legal citations where relevant
- Professional tone — suitable for the managing partner`,
};

// Max input sizes to prevent abuse
const MAX_QUESTION_LENGTH = 10_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CONTENT = 500;

export async function POST(request: NextRequest) {
  const start = Date.now();
  let authedUser: any = null;

  try {
    const body = await request.json();
    let { question, mode = 'chat', history = [], feature = 'chat' } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    // Auth check — require valid Firebase ID token
    authedUser = await authenticateRequest(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 20 req/min per userId
    const { allowed } = await checkRateLimit('ai-chat', authedUser.uid, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Input validation — truncate oversized inputs
    const truncated = question.length > MAX_QUESTION_LENGTH;
    if (truncated) {
      question = question.slice(0, MAX_QUESTION_LENGTH);
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const genAI = new GoogleGenerativeAI(key);

    const modelName = 'gemini-2.5-flash';
    const generationConfig: Record<string, any> = {
      chat: { temperature: 0.7, topP: 0.9, maxOutputTokens: 4096 },
      research: { temperature: 0.4, topP: 0.95, maxOutputTokens: 16384 },
      deep: { temperature: 0.3, topP: 0.95, maxOutputTokens: 30000 },
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: generationConfig[mode] || generationConfig.chat,
    });

    const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.chat;
    let fullPrompt = systemPrompt + '\n\n';

    // Conversation history for context — bounded
    const recentHistory = (history || []).slice(-MAX_HISTORY_MESSAGES);
    if (recentHistory.length > 0) {
      fullPrompt += '--- CONVERSATION HISTORY ---\n';
      for (const msg of recentHistory) {
        const content = typeof msg.content === 'string' ? msg.content.slice(0, MAX_HISTORY_CONTENT) : '';
        if (msg.role === 'user') {
          fullPrompt += `USER: ${content}\n`;
        } else {
          fullPrompt += `ASSISTANT: ${content}...\n`;
        }
      }
      fullPrompt += '--- END HISTORY ---\n\n';
    }

    if (mode === 'research') {
      fullPrompt += `RESEARCH REQUEST: ${question}\n\nProvide a thorough, well-structured research response following the format above:`;
    } else if (mode === 'deep') {
      fullPrompt += `DEEP RESEARCH REPORT REQUEST: ${question}\n\nGenerate a comprehensive, publication-quality research report following the exact structure above:`;
    } else {
      fullPrompt += `USER: ${question}`;
    }

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    const durationMs = Date.now() - start;

    // Estimate tokens (rough: ~4 chars per token for English/Spanish)
    const estimatedInputTokens = Math.ceil(fullPrompt.length / 4);
    const estimatedOutputTokens = Math.ceil(text.length / 4);

    return NextResponse.json({
      answer: text,
      mode,
      tokens: estimatedInputTokens + estimatedOutputTokens,
      truncated,
      durationMs,
      usage: {
        inputChars: fullPrompt.length,
        outputChars: text.length,
        estimatedInputTokens,
        estimatedOutputTokens,
      },
    });
  } catch (error: any) {
    const durationMs = Date.now() - start;
    console.error('AI API error:', error?.message || error);

    // Classify error for user-friendly message
    const is429 = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota');
    if (is429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a minute and try again.', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    const isTimeout = error?.name === 'AbortError' || error?.message?.includes('timeout');
    if (isTimeout) {
      return NextResponse.json(
        { error: 'AI request timed out. Try a simpler question or shorter context.', code: 'TIMEOUT' },
        { status: 504 }
      );
    }

    const isAuth = error?.status === 401 || error?.status === 403 || error?.message?.includes('API key');
    if (isAuth) {
      return NextResponse.json(
        { error: 'AI service authentication failed. Contact admin.', code: 'AUTH_FAILED' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'AI processing failed. Try again or use a shorter prompt.', code: 'INTERNAL', durationMs },
      { status: 500 }
    );
  }
}