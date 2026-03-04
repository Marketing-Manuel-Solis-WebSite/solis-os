'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, Copy, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  message: string;
  details?: string;
}

export default function AIErrorCallout({ message, details }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullText = details || message;
  const isLong = fullText.length > 200;
  const shortMessage = message.replace(/^Error:\s*/i, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] overflow-hidden max-w-full">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-[var(--error)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--error)] font-medium leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>
            {shortMessage}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            title={t('ai.copy')}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            >
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? t('ai.hideDetails') : t('ai.showDetails')}
            </button>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {expanded && isLong && (
        <div className="px-4 pb-3 pt-0">
          <pre
            className="text-[12px] leading-relaxed text-[var(--text-muted)] font-mono whitespace-pre-wrap p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] max-h-[300px] overflow-y-auto overflow-x-hidden"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {fullText}
          </pre>
        </div>
      )}
    </div>
  );
}
