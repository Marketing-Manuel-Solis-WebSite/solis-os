'use client';

import { useState, useCallback, useEffect } from 'react';
import { Sparkles, Loader2, X, Zap, Clock, ArrowRight, ChevronRight } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useFeatureFlag } from '@/lib/feature-flags';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  trigger: string;
  actions: string[];
  estimatedTimeSaved: string;
  confidence: number;
  basedOn: string;
  category: string;
}

interface AISuggestionsPanelProps {
  onCreateAutomation: (data: {
    name: string;
    description: string;
    trigger: string;
    actions: string[];
  }) => void;
  onClose: () => void;
}

export default function AISuggestionsPanel({
  onCreateAutomation,
  onClose,
}: AISuggestionsPanelProps) {
  const enabled = useFeatureFlag('ai-automation-ui');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/suggest-automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to get suggestions');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) fetchSuggestions();
  }, [enabled, fetchSuggestions]);

  if (!enabled) return null;

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return 'text-emerald-400';
    if (c >= 0.5) return 'text-amber-400';
    return 'text-[var(--text-muted)]';
  };

  const categoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      task: 'bg-blue-500/10 text-blue-400',
      notification: 'bg-purple-500/10 text-purple-400',
      assignment: 'bg-emerald-500/10 text-emerald-400',
      status: 'bg-amber-500/10 text-amber-400',
      escalation: 'bg-red-500/10 text-red-400',
    };
    return colors[cat] || 'bg-[var(--bg-elevated)] text-[var(--text-muted)]';
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-[var(--bg-base)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col anim-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">AI Automation Suggestions</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-muted)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
            <p className="text-sm">Analyzing patterns and generating suggestions...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded-xl mb-4">
            {error}
            <button
              onClick={fetchSuggestions}
              className="ml-2 text-red-300 underline hover:text-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Suggestions */}
        {!loading && suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((s) => {
              const isExpanded = expandedId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden transition-all"
                >
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--bg-hover)] transition"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex-1">
                        {s.title}
                      </h3>
                      <ChevronRight
                        className={`h-4 w-4 text-[var(--text-muted)] transition-transform shrink-0 mt-0.5 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                    <p className="text-[12px] text-[var(--text-muted)] line-clamp-2">{s.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${categoryColor(s.category)}`}>
                        {s.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <Clock className="h-3 w-3" />
                        {s.estimatedTimeSaved}
                      </span>
                      <span className={`text-[11px] font-semibold ${confidenceColor(s.confidence)}`}>
                        {Math.round(s.confidence * 100)}% match
                      </span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/50">
                      <div className="mb-3">
                        <p className="text-[11px] uppercase font-semibold text-[var(--text-muted)] mb-1">Trigger</p>
                        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                          <Zap className="h-3.5 w-3.5 text-amber-400" />
                          {s.trigger}
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-[11px] uppercase font-semibold text-[var(--text-muted)] mb-1">Actions</p>
                        <div className="space-y-1">
                          {s.actions.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                              <ArrowRight className="h-3 w-3 text-[var(--accent)]" />
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mb-3">
                        Based on: {s.basedOn}
                      </p>
                      <button
                        onClick={() => {
                          onCreateAutomation({
                            name: s.title,
                            description: s.description,
                            trigger: s.trigger,
                            actions: s.actions,
                          });
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] text-sm font-medium hover:bg-[var(--accent-hover)] transition"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Create Automation
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Sparkles className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">No suggestions available yet.</p>
            <p className="text-[12px] mt-1">AI will analyze your workflow patterns to suggest automations.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-center">
        <p className="text-[11px] text-[var(--text-muted)]">
          Suggestions are based on detected workflow patterns and common best practices.
        </p>
      </div>
    </div>
  );
}
