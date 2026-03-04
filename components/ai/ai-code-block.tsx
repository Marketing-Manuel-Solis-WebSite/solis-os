'use client';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  code: string;
  language?: string;
}

export default function AICodeBlock({ code, language }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const lines = code.split('\n');
  const isLong = lines.length > 30;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ai-codeblock-wrapper group/code my-3 rounded-xl overflow-hidden border border-[var(--border)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          {language && language !== 'undefined' && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {language}
            </span>
          )}
          {isLong && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {lines.length} {t('ai.codeLines')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLong && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            >
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {collapsed ? t('ai.expand') : t('ai.collapse')}
            </button>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[var(--success)]" />
                <span className="text-[var(--success)]">{t('ai.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>{t('ai.copy')}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Code content */}
      <div
        className="overflow-x-auto overflow-y-hidden transition-all duration-200"
        style={{
          maxHeight: collapsed ? '0px' : `${Math.min(lines.length * 22 + 32, 600)}px`,
        }}
      >
        <pre
          ref={preRef}
          className="p-4 text-[13px] leading-[1.65] font-mono bg-[var(--bg-tertiary)]"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" }}
        >
          <code className="text-[var(--text-secondary)] whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}
