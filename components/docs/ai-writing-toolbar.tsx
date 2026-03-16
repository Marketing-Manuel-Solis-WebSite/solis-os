'use client';

import { useState, useCallback } from 'react';
import {
  Sparkles, Loader2, X, ArrowRight, Type, Minimize2, Maximize2,
  Languages, Check, RefreshCw, Eraser, PenLine,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useFeatureFlag } from '@/lib/feature-flags';
import type { WritingAction, WritingTone } from '@/lib/ai-writing-assistant';

const ACTIONS: { id: WritingAction; label: string; icon: any; desc: string }[] = [
  { id: 'continue', label: 'Continue', icon: ArrowRight, desc: 'Continue writing naturally' },
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, desc: 'Rewrite for clarity' },
  { id: 'expand', label: 'Expand', icon: Maximize2, desc: 'Add more detail' },
  { id: 'condense', label: 'Condense', icon: Minimize2, desc: 'Make it shorter' },
  { id: 'translate', label: 'Translate', icon: Languages, desc: 'Translate to another language' },
  { id: 'proofread', label: 'Proofread', icon: Check, desc: 'Fix grammar & spelling' },
  { id: 'tone_shift', label: 'Tone', icon: PenLine, desc: 'Change the tone' },
];

const TONES: { id: WritingTone; label: string }[] = [
  { id: 'formal', label: 'Formal' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'academic', label: 'Academic' },
  { id: 'legal', label: 'Legal' },
];

const LANGUAGES = ['Spanish', 'English', 'Portuguese', 'French', 'German', 'Italian'];

interface AIWritingToolbarProps {
  selectedText: string;
  docId: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
}

export default function AIWritingToolbar({
  selectedText,
  docId,
  onInsert,
  onReplace,
  onClose,
}: AIWritingToolbarProps) {
  const enabled = useFeatureFlag('ai-writing-ui');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<WritingAction | null>(null);
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [instructions, setInstructions] = useState('');

  const callAI = useCallback(async (action: WritingAction, options?: { tone?: WritingTone; targetLanguage?: string }) => {
    if (!selectedText.trim() && action !== 'continue') return;

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveAction(action);
    setShowToneMenu(false);
    setShowLangMenu(false);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action,
          content: selectedText,
          docId,
          tone: options?.tone,
          targetLanguage: options?.targetLanguage,
          instructions: instructions.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data.text || '');
    } catch (err: any) {
      setError(err.message || 'AI processing failed');
    }
    setLoading(false);
  }, [selectedText, docId, instructions]);

  if (!enabled) return null;

  return (
    <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-dropdown overflow-hidden anim-fade">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--accent)]/5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          AI Writing Assistant
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Action buttons */}
      {!result && !loading && (
        <div className="px-3 py-2">
          <div className="flex flex-wrap gap-1 mb-2">
            {ACTIONS.map((a) => {
              if (a.id === 'tone_shift') {
                return (
                  <div key={a.id} className="relative">
                    <button
                      onClick={() => { setShowToneMenu(!showToneMenu); setShowLangMenu(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-base)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
                      title={a.desc}
                    >
                      <a.icon className="h-3.5 w-3.5" />
                      {a.label}
                    </button>
                    {showToneMenu && (
                      <div className="absolute left-0 top-full mt-1 bg-[var(--bg-elevated)] rounded-lg shadow-dropdown border border-[var(--border-subtle)] py-1 z-10 w-36">
                        {TONES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => callAI('tone_shift', { tone: t.id })}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (a.id === 'translate') {
                return (
                  <div key={a.id} className="relative">
                    <button
                      onClick={() => { setShowLangMenu(!showLangMenu); setShowToneMenu(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-base)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
                      title={a.desc}
                    >
                      <a.icon className="h-3.5 w-3.5" />
                      {a.label}
                    </button>
                    {showLangMenu && (
                      <div className="absolute left-0 top-full mt-1 bg-[var(--bg-elevated)] rounded-lg shadow-dropdown border border-[var(--border-subtle)] py-1 z-10 w-36">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang}
                            onClick={() => callAI('translate', { targetLanguage: lang })}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={a.id}
                  onClick={() => callAI(a.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-base)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
                  title={a.desc}
                >
                  <a.icon className="h-3.5 w-3.5" />
                  {a.label}
                </button>
              );
            })}
          </div>
          {/* Optional custom instructions */}
          <input
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Custom instructions (optional)..."
            className="w-full h-8 px-3 text-[12px] rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-subtle)] outline-none focus:border-[var(--accent)]/40 placeholder:text-[var(--text-muted)]"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 px-3 py-6 text-[var(--text-muted)] text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing ({activeAction})...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2">
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
            {error}
            <button
              onClick={() => { setError(null); setResult(null); }}
              className="ml-2 text-red-300 underline hover:text-red-200"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Result preview */}
      {result && !loading && (
        <div className="px-3 py-2">
          <div className="mb-2">
            <p className="text-[11px] uppercase font-semibold text-[var(--text-muted)] mb-1">
              Preview ({activeAction})
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3">
              <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {result}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onInsert(result); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] text-sm font-medium hover:bg-[var(--accent-hover)] transition"
            >
              Insert
            </button>
            <button
              onClick={() => { onReplace(result); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-base)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] transition"
            >
              Replace
            </button>
            <button
              onClick={() => { setResult(null); setActiveAction(null); }}
              className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
