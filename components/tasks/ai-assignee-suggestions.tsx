'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2, X, User, BarChart3 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useFeatureFlag } from '@/lib/feature-flags';

interface Suggestion {
  userId: string;
  displayName: string;
  reason: string;
  score: number;
}

interface WorkloadInfo {
  userId: string;
  displayName: string;
  activeTasks: number;
  overdueTasks: number;
}

interface AIAssigneeSuggestionsProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  onSelectAssignee: (userId: string) => void;
  onClose: () => void;
}

export default function AIAssigneeSuggestions({
  taskId,
  taskTitle,
  taskDescription,
  onSelectAssignee,
  onClose,
}: AIAssigneeSuggestionsProps) {
  const enabled = useFeatureFlag('ai-workload-ui');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadInfo[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/ai/suggest-assignees', {
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
      setSuggestions(data.suggestions || []);
      setWorkloads(data.workloads || []);
    } catch (err: any) {
      setError(err.message || 'Failed to get suggestions');
    }
    setLoading(false);
  }, [taskId, taskTitle, taskDescription]);

  useEffect(() => {
    if (enabled) fetchSuggestions();
  }, [enabled, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (!enabled) return null;

  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400 bg-emerald-500/10';
    if (score >= 0.5) return 'text-amber-400 bg-amber-500/10';
    return 'text-[var(--text-muted)] bg-[var(--bg-elevated)]';
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 w-80 bg-[var(--bg-elevated)] rounded-xl shadow-dropdown border border-[var(--border-subtle)] z-30 overflow-hidden anim-fade"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--accent)]/5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          AI Assignee Suggestions
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-2 py-2 max-h-80 overflow-y-auto">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-[var(--text-muted)] text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing workloads...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mx-1">
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
          <div className="space-y-1">
            {suggestions.map((s) => {
              const wl = workloads.find(w => w.userId === s.userId);
              return (
                <button
                  key={s.userId}
                  onClick={() => {
                    onSelectAssignee(s.userId);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[10px] font-bold text-[var(--accent)]">
                        {s.displayName?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">
                        {s.displayName}
                      </span>
                    </div>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${scoreColor(s.score)}`}>
                      {Math.round(s.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)] pl-8">{s.reason}</p>
                  {wl && (
                    <div className="flex items-center gap-3 pl-8 mt-1 text-[11px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {wl.activeTasks} active
                      </span>
                      {wl.overdueTasks > 0 && (
                        <span className="text-red-400">{wl.overdueTasks} overdue</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && suggestions.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            No suggestions available.
          </p>
        )}
      </div>
    </div>
  );
}
