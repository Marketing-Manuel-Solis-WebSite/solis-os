'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  loading: boolean;
  onSend: (content: string) => void;
}

export default function AIInput({ loading, onSend }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const canSend = text.trim().length > 0 && !loading;

  const handleSubmit = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, text, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSubmit]);

  return (
    <div className="shrink-0 pb-4 pt-2 px-4">
      <div className="max-w-[780px] mx-auto">
        {/* Composer container — flex so button stays inside */}
        <div
          className={`flex items-end gap-2 rounded-2xl transition-all duration-200 bg-[var(--bg-elevated)] border px-3 pb-2.5 pt-1 ${
            focused
              ? 'border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/10'
              : 'border-[var(--border)]'
          }`}
          style={{ boxShadow: focused ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); resizeTextarea(); }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('ai.inputPlaceholder')}
            rows={1}
            disabled={loading}
            className="flex-1 min-w-0 py-2.5 bg-transparent text-[0.9375rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none disabled:opacity-50 leading-relaxed"
            style={{ minHeight: '40px', maxHeight: '200px' }}
          />

          {/* Send button — inside flex, always stays in the box */}
          <motion.button
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.9 } : {}}
            onClick={handleSubmit}
            disabled={!canSend}
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 mb-0.5 ${
              canSend
                ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] shadow-sm'
                : 'bg-[var(--bg-tertiary)]'
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 text-[var(--text-muted)] animate-spin" />
            ) : (
              <ArrowUp
                className={`h-4 w-4 transition-colors ${canSend ? 'text-white' : 'text-[var(--text-muted)]'}`}
              />
            )}
          </motion.button>
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[11px] text-[var(--text-muted)]">
            {t('ai.disclaimer')}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] hidden sm:block">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] font-mono border border-[var(--border-subtle)]">Enter</kbd>
            {' '}{t('ai.send')} · {' '}
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] font-mono border border-[var(--border-subtle)]">Shift+Enter</kbd>
            {' '}{t('ai.newLine')}
          </p>
        </div>
      </div>
    </div>
  );
}
