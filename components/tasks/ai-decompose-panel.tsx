'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Check, Plus, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useFeatureFlag } from '@/lib/feature-flags';

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface AIDecomposePanelProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  onAddSubtasks: (subtasks: Subtask[]) => void;
  onClose: () => void;
}

export default function AIDecomposePanel({
  taskId,
  taskTitle,
  taskDescription,
  onAddSubtasks,
  onClose,
}: AIDecomposePanelProps) {
  const enabled = useFeatureFlag('ai-decompose-ui');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ taskId, taskTitle, taskDescription }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setSuggestions(data.subtasks || []);
      setChecked(new Set(data.subtasks?.map((_: string, i: number) => i) || []));
      setHasLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate subtasks');
    }
    setLoading(false);
  }, [taskId, taskTitle, taskDescription]);

  const toggleCheck = (idx: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAdd = () => {
    const selected = suggestions
      .filter((_, i) => checked.has(i))
      .map((title, i) => ({
        id: `ai_${Date.now()}_${i}`,
        title,
        done: false,
      }));
    if (selected.length > 0) {
      onAddSubtasks(selected);
    }
    onClose();
  };

  if (!enabled) return null;

  return (
    <div className="mt-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden anim-fade">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--accent)]/5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          AI Subtask Decomposition
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-3">
        {/* Initial state: Generate button */}
        {!hasLoaded && !loading && (
          <button
            onClick={fetchSuggestions}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/20 transition"
          >
            <Sparkles className="h-4 w-4" />
            Generate Subtasks with AI
          </button>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-[var(--text-muted)] text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing task and generating subtasks...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mb-2">
            {error}
            <button
              onClick={fetchSuggestions}
              className="ml-2 text-red-300 underline hover:text-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Suggestions list */}
        {hasLoaded && suggestions.length > 0 && !loading && (
          <div className="space-y-1">
            {suggestions.map((title, i) => (
              <label
                key={i}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer transition"
              >
                <button
                  onClick={() => toggleCheck(i)}
                  className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition shrink-0 ${
                    checked.has(i)
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {checked.has(i) && <Check className="h-2.5 w-2.5" />}
                </button>
                <span className="text-[13px] text-[var(--text-secondary)]">{title}</span>
              </label>
            ))}

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={handleAdd}
                disabled={checked.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] text-sm font-medium hover:bg-[var(--accent-hover)] transition disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Selected ({checked.size})
              </button>
              <button
                onClick={fetchSuggestions}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}

        {/* No suggestions */}
        {hasLoaded && suggestions.length === 0 && !loading && !error && (
          <p className="text-sm text-[var(--text-muted)] text-center py-3">
            No subtasks could be generated. Try adding more detail to the task description.
          </p>
        )}
      </div>
    </div>
  );
}
