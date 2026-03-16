'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { searchMessagesInChannel } from '@/lib/db';
import { Search, X, Loader2, MessageSquare, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  channelId: string;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return [text];
  return [
    text.slice(0, idx),
    <mark key="hl" className="bg-[var(--accent-subtle)] text-[var(--accent)] rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>,
    text.slice(idx + q.length),
  ];
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function ChatSearchPanel({ channelId, onClose, onJumpToMessage }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const matches = await searchMessagesInChannel(channelId, q.trim());
      setResults(matches);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {loading ? (
          <Loader2 className="h-4 w-4 text-[var(--text-muted)] animate-spin shrink-0" />
        ) : (
          <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder={t('chatSearch.placeholder')}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        />
        {searched && !loading && (
          <span className="text-[11px] text-[var(--text-muted)] shrink-0">
            {t('chatSearch.results', { count: String(results.length) })}
          </span>
        )}
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div className="max-h-[300px] overflow-y-auto border-t border-[var(--border-subtle)]">
          {results.length === 0 && !loading ? (
            <div className="py-6 text-center text-sm text-[var(--text-muted)]">
              {t('chatSearch.noResults')}
            </div>
          ) : (
            <div className="py-1">
              {results.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => onJumpToMessage(msg.id)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-hover)] transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="h-3.5 w-3.5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{msg.displayName || 'Unknown'}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatTimestamp(msg.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2">
                      {highlightText(msg.content || '', query)}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 mt-1.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
