import { describe, it, expect } from 'vitest';
import {
  buildWritingPrompt,
  countWords,
  buildWritingResult,
  promptDraftEmail,
  promptDraftMemo,
} from '@/lib/ai-writing-assistant';
import type { WritingRequest, WritingAction, WritingTone } from '@/lib/ai-writing-assistant';

// ---- buildWritingPrompt ----

describe('buildWritingPrompt', () => {
  it('builds continue prompt', () => {
    const prompt = buildWritingPrompt({ action: 'continue', content: 'The case was filed on Monday.' });
    expect(prompt).toContain('Continue writing');
    expect(prompt).toContain('The case was filed on Monday.');
  });

  it('builds rewrite prompt with tone', () => {
    const prompt = buildWritingPrompt({ action: 'rewrite', content: 'This is a draft.', tone: 'formal' });
    expect(prompt).toContain('Rewrite');
    expect(prompt).toContain('formal');
  });

  it('builds expand prompt', () => {
    const prompt = buildWritingPrompt({ action: 'expand', content: 'Short text.' });
    expect(prompt).toContain('Expand');
    expect(prompt).toContain('double the length');
  });

  it('builds condense prompt', () => {
    const prompt = buildWritingPrompt({ action: 'condense', content: 'Long text goes here.' });
    expect(prompt).toContain('Condense');
    expect(prompt).toContain('half its length');
  });

  it('builds translate prompt with target language', () => {
    const prompt = buildWritingPrompt({ action: 'translate', content: 'Hello world', targetLanguage: 'French' });
    expect(prompt).toContain('French');
    expect(prompt).toContain('Translate');
  });

  it('defaults translate language to Spanish', () => {
    const prompt = buildWritingPrompt({ action: 'translate', content: 'Hello world' });
    expect(prompt).toContain('Spanish');
  });

  it('builds proofread prompt', () => {
    const prompt = buildWritingPrompt({ action: 'proofread', content: 'Ths has a typo.' });
    expect(prompt).toContain('Proofread');
  });

  it('builds tone_shift prompt', () => {
    const prompt = buildWritingPrompt({ action: 'tone_shift', content: 'Hey dude!', tone: 'legal' });
    expect(prompt).toContain('legal');
    expect(prompt).toContain('tone');
  });

  it('includes custom instructions when provided', () => {
    const prompt = buildWritingPrompt({
      action: 'rewrite',
      content: 'Draft text.',
      instructions: 'Keep it under 100 words',
    });
    expect(prompt).toContain('Keep it under 100 words');
  });
});

// ---- countWords ----

describe('countWords', () => {
  it('counts words in a normal sentence', () => {
    expect(countWords('Hello world this is a test')).toBe(6);
  });

  it('handles extra whitespace', () => {
    expect(countWords('  one   two   three  ')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });
});

// ---- buildWritingResult ----

describe('buildWritingResult', () => {
  it('constructs result with word counts', () => {
    const result = buildWritingResult('Hello world', 'Hola mundo amigos', 'translate');
    expect(result.action).toBe('translate');
    expect(result.wordCountBefore).toBe(2);
    expect(result.wordCountAfter).toBe(3);
    expect(result.text).toBe('Hola mundo amigos');
  });
});

// ---- promptDraftEmail ----

describe('promptDraftEmail', () => {
  it('includes recipient, subject, and key points', () => {
    const prompt = promptDraftEmail({
      recipient: 'John Doe',
      subject: 'Case Update',
      keyPoints: ['Case approved', 'Next steps'],
    });
    expect(prompt).toContain('John Doe');
    expect(prompt).toContain('Case Update');
    expect(prompt).toContain('1. Case approved');
    expect(prompt).toContain('2. Next steps');
  });
});

// ---- promptDraftMemo ----

describe('promptDraftMemo', () => {
  it('includes topic, audience, and key points', () => {
    const prompt = promptDraftMemo({
      topic: 'Office Hours Change',
      audience: 'All Staff',
      keyPoints: ['New hours: 8am-5pm', 'Effective Monday'],
    });
    expect(prompt).toContain('Office Hours Change');
    expect(prompt).toContain('All Staff');
    expect(prompt).toContain('New hours: 8am-5pm');
  });
});
