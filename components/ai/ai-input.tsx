'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

interface Props {
  loading: boolean;
  onSend: (content: string) => void;
}

export default function AIInput({ loading, onSend }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const canSend = text.trim().length > 0 && !loading;

  return (
    <div className="shrink-0 pb-4 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-2xl transition-all"
          style={{
            background: 'var(--bg-elevated)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          }}>
          <textarea ref={textareaRef} value={text}
            onChange={e => { setText(e.target.value); handleInput(); }}
            onKeyDown={handleKeyDown}
            placeholder="      Message Solis AI..."
            rows={1} disabled={loading}
            className="w-full pl-4 pr-14 py-3.5 rounded-2xl bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none disabled:opacity-50"
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />
          <motion.button
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.9 } : {}}
            onClick={handleSubmit}
            disabled={!canSend}
            className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: canSend ? 'var(--accent)' : 'var(--bg-elevated)',
              boxShadow: 'none',
            }}>
            <ArrowUp className="h-4 w-4" style={{ color: canSend ? 'var(--accent-text)' : 'var(--text-muted)' }} />
          </motion.button>
        </div>
        <p className="text-[12px] text-[var(--text-muted)] text-center mt-2">
          Solis AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
