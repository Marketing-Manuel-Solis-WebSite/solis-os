// ================================================================
// AI Writing Assistant — Document & content writing helpers
// ================================================================
// Extends the existing doc-ai-panel with structured prompt builders
// for common writing operations.

import { CONTEXT_LIMITS, truncateContext } from './ai-prompts';

const ORG_CONTEXT = `Organization: Law Office of Manuel Solis (Solis Center). Immigration law.`;

const GUARDRAILS = `RULES:
- Respond in the SAME LANGUAGE as the input text.
- Return ONLY the modified text, no explanations or meta-commentary.
- Maintain the same formatting style (markdown, headers, lists) as the original.
- Never fabricate legal citations or case numbers.`;

// ---- Types ----

export type WritingTone = 'formal' | 'professional' | 'casual' | 'friendly' | 'academic' | 'legal';
export type WritingAction = 'continue' | 'rewrite' | 'expand' | 'condense' | 'translate' | 'proofread' | 'tone_shift';

export interface WritingRequest {
  action: WritingAction;
  content: string;
  context?: string;         // surrounding text for continuity
  tone?: WritingTone;
  targetLanguage?: string;  // for translate action
  instructions?: string;    // custom user instructions
}

export interface WritingResult {
  text: string;
  action: WritingAction;
  wordCountBefore: number;
  wordCountAfter: number;
}

// ---- Prompt Builders ----

export function buildWritingPrompt(request: WritingRequest): string {
  switch (request.action) {
    case 'continue':
      return promptContinueWriting(request.content, request.context, request.instructions);
    case 'rewrite':
      return promptRewrite(request.content, request.tone, request.instructions);
    case 'expand':
      return promptExpand(request.content, request.instructions);
    case 'condense':
      return promptCondense(request.content, request.instructions);
    case 'translate':
      return promptTranslate(request.content, request.targetLanguage || 'Spanish');
    case 'proofread':
      return promptProofread(request.content);
    case 'tone_shift':
      return promptToneShift(request.content, request.tone || 'professional');
    default:
      return promptRewrite(request.content, request.tone, request.instructions);
  }
}

function promptContinueWriting(content: string, context?: string, instructions?: string): string {
  const ctx = context ? `\nPreceding context:\n${truncateContext(context, 3000).text}\n` : '';
  return `${ORG_CONTEXT}
${GUARDRAILS}

Continue writing the following text naturally. Match the style, tone, and format of the existing content.
Write 2-4 paragraphs that logically follow from what's written.
${instructions ? `\nAdditional instructions: ${instructions}` : ''}
${ctx}
Text to continue from:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Continue:`;
}

function promptRewrite(content: string, tone?: WritingTone, instructions?: string): string {
  const toneInstr = tone ? `\nUse a ${tone} tone.` : '';
  return `${ORG_CONTEXT}
${GUARDRAILS}

Rewrite the following text to improve clarity, flow, and impact.
Maintain the same key information and structure.${toneInstr}
${instructions ? `\nAdditional instructions: ${instructions}` : ''}

Original text:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Rewritten text:`;
}

function promptExpand(content: string, instructions?: string): string {
  return `${ORG_CONTEXT}
${GUARDRAILS}

Expand the following text with more detail, examples, and explanation.
Approximately double the length while maintaining quality.
${instructions ? `\nAdditional instructions: ${instructions}` : ''}

Text to expand:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Expanded text:`;
}

function promptCondense(content: string, instructions?: string): string {
  return `${ORG_CONTEXT}
${GUARDRAILS}

Condense the following text to approximately half its length.
Keep all key information, remove redundancy, and tighten the language.
${instructions ? `\nAdditional instructions: ${instructions}` : ''}

Text to condense:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Condensed text:`;
}

function promptTranslate(content: string, targetLanguage: string): string {
  return `${ORG_CONTEXT}
RULES:
- Translate the following text to ${targetLanguage}.
- Maintain the same formatting (markdown, headers, lists).
- Keep proper nouns, brand names, and technical terms as-is when appropriate.
- Preserve legal terminology accuracy.

Text to translate:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Translation:`;
}

function promptProofread(content: string): string {
  return `${ORG_CONTEXT}
${GUARDRAILS}

Proofread the following text. Fix all grammar, spelling, punctuation, and style errors.
Return the corrected text only. If no corrections needed, return the original text unchanged.

Text:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Corrected text:`;
}

function promptToneShift(content: string, targetTone: WritingTone): string {
  const toneDescriptions: Record<WritingTone, string> = {
    formal: 'formal and impersonal, suitable for official communications',
    professional: 'professional but approachable, suitable for business emails',
    casual: 'casual and conversational, suitable for internal team messages',
    friendly: 'warm and friendly, suitable for client-facing communications',
    academic: 'academic and precise, suitable for research or formal reports',
    legal: 'legal and precise, suitable for legal documents and filings',
  };

  return `${ORG_CONTEXT}
${GUARDRAILS}

Rewrite the following text in a ${targetTone} tone.
The tone should be: ${toneDescriptions[targetTone]}.
Keep the same information and structure.

Text:
${truncateContext(content, CONTEXT_LIMITS.docContent).text}

Rewritten in ${targetTone} tone:`;
}

// ---- Helpers ----

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function buildWritingResult(original: string, result: string, action: WritingAction): WritingResult {
  return {
    text: result,
    action,
    wordCountBefore: countWords(original),
    wordCountAfter: countWords(result),
  };
}

// ---- Template Prompts for Common Documents ----

export function promptDraftEmail(params: {
  recipient: string;
  subject: string;
  keyPoints: string[];
  tone?: WritingTone;
}): string {
  return `${ORG_CONTEXT}
${GUARDRAILS}

Draft a professional email.

To: ${params.recipient}
Subject: ${params.subject}
Key points to cover:
${params.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}
${params.tone ? `Tone: ${params.tone}` : 'Tone: professional'}

Format:
Subject: [subject line]

[email body]

Best regards,
[Solis Center Team]`;
}

export function promptDraftMemo(params: {
  topic: string;
  audience: string;
  keyPoints: string[];
}): string {
  return `${ORG_CONTEXT}
${GUARDRAILS}

Draft an internal memo.

Topic: ${params.topic}
Audience: ${params.audience}
Key points:
${params.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Format:
## MEMORANDUM

**To:** ${params.audience}
**From:** [Author]
**Date:** [Current date]
**Re:** ${params.topic}

---

[Body with clear sections, action items, and next steps]`;
}
