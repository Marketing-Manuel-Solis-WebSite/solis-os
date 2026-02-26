'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageSquare, Globe, FileSearch, Zap } from 'lucide-react';
import type { AIMode } from '@/lib/ai-db';

const MODE_CONFIG: Record<AIMode, { label: string; icon: any; color: string; placeholder: string }> = {
  chat: { label: 'Chat', icon: MessageSquare, color: '#D4A843', placeholder: 'Ask Solis AI anything...' },
  research: { label: 'Research', icon: Globe, color: '#3B82F6', placeholder: 'What topic should I research? (detailed analysis with sources)' },
  deep: { label: 'Deep Search', icon: FileSearch, color: '#A855F7', placeholder: 'What report should I generate? (comprehensive, publication-quality)' },
};

interface Props {
  mode: AIMode;
  loading: boolean;
  onSend: (content: string, mode?: AIMode) => void;
  onModeChange: (mode: AIMode) => void;
}

export default function AIInput({ mode, loading, onSend, onModeChange }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const config = MODE_CONFIG[mode];

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

  useEffect(() => { textareaRef.current?.focus(); }, [mode]);

  const QUICK: Record<AIMode, string[]> = {
    chat: ['Redacta un correo para cliente', 'Lista de documentos para visa H-1B', 'Mejora este texto profesionalmente'],
    research: ['Cambios recientes en política migratoria', 'Estrategias de marketing para bufete legal', 'Comparar tipos de visa de trabajo'],
    deep: ['Reporte completo: Proceso de asilo', 'Análisis de mercado para firma de inmigración', 'Guía operativa para departamento de closers'],
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-sm shrink-0">
      {!text && !loading && (
        <div className="flex gap-1.5 px-5 pt-3 overflow-x-auto pb-1 scrollbar-thin">
          {QUICK[mode].map((q, i) => (
            <motion.button key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setText(q); textareaRef.current?.focus(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition whitespace-nowrap shrink-0">
              <Zap className="h-2.5 w-2.5" style={{ color: config.color }} />
              {q}
            </motion.button>
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-1 px-2.5 py-2 rounded-xl border shrink-0 h-[46px]"
            style={{ backgroundColor: `${config.color}08`, borderColor: `${config.color}20` }}>
            <config.icon className="h-4 w-4" style={{ color: config.color }} />
            <span className="text-[10px] font-semibold" style={{ color: config.color }}>{config.label}</span>
          </div>

          <div className="flex-1 relative">
            <textarea ref={textareaRef} value={text}
              onChange={e => { setText(e.target.value); handleInput(); }}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              rows={1} disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-base)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none transition disabled:opacity-50 focus:ring-1"
              style={{ minHeight: '46px', maxHeight: '200px', borderColor: text ? `${config.color}30` : 'var(--border)' }}
              onFocus={e => { e.target.style.borderColor = `${config.color}40`; e.target.style.boxShadow = `0 0 0 1px ${config.color}10`; }}
              onBlur={e => { e.target.style.borderColor = text ? `${config.color}30` : 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
            onClick={handleSubmit} disabled={!text.trim() || loading}
            className="h-[46px] px-5 rounded-xl text-sm font-semibold flex items-center gap-2 transition disabled:opacity-30 shrink-0"
            style={{ backgroundColor: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}>
            <Send className="h-4 w-4" />
            {mode === 'deep' ? 'Generate' : 'Send'}
          </motion.button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[9px] text-[var(--text-muted)]">Enter to send · Shift+Enter for new line</span>
          <div className="flex items-center gap-2">
            {text.length > 0 && <span className="text-[9px] text-[var(--text-muted)]">{text.length} chars</span>}
            <div className="flex gap-0.5">
              {(['chat', 'research', 'deep'] as AIMode[]).map(m => {
                const mc = MODE_CONFIG[m];
                return (
                  <motion.button key={m} whileTap={{ scale: 0.85 }}
                    onClick={() => onModeChange(m)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition ${mode === m ? '' : 'opacity-30 hover:opacity-60'}`}
                    style={mode === m ? { backgroundColor: `${mc.color}15` } : {}}
                    title={mc.label}>
                    <mc.icon className="h-2.5 w-2.5" style={{ color: mc.color }} />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
