'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import type { AIMessage } from '@/lib/ai-db';

interface Props {
  messages: AIMessage[];
  loading: boolean;
  streamingText: string;
}

export default function AIMessages({ messages, loading, streamingText }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const renderMarkdown = (text: string): string => {
    let html = text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="ai-code-block"><code class="lang-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
      .replace(/^#### (.+)$/gm, '<h4 class="ai-h4">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="ai-bold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^> (.+)$/gm, '<blockquote class="ai-blockquote">$1</blockquote>')
      .replace(/^---$/gm, '<hr class="ai-hr" />')
      .replace(/^\|(.+)\|$/gm, (match) => {
        const cells = match.split('|').filter(Boolean).map(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c))) return '<tr class="ai-table-sep"></tr>';
        return '<tr>' + cells.map(c => `<td class="ai-td">${c}</td>`).join('') + '</tr>';
      })
      .replace(/^[-*] (.+)$/gm, '<li class="ai-li">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ai-li-num">$1</li>')
      .replace(/^- \[x\] (.+)$/gm, '<li class="ai-checkbox checked">$1</li>')
      .replace(/^- \[ \] (.+)$/gm, '<li class="ai-checkbox">$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="ai-link" target="_blank">$1</a>')
      .replace(/^(?!<[hbluptd]|<li|<pre|<code|<hr|<tr|<blockquote)(.+)$/gm, '<p class="ai-p">$1</p>');

    html = html.replace(/(<li class="ai-li">.+?<\/li>\n?)+/g, '<ul class="ai-ul">$&</ul>');
    html = html.replace(/(<li class="ai-li-num">.+?<\/li>\n?)+/g, '<ol class="ai-ol">$&</ol>');
    html = html.replace(/(<tr>.+?<\/tr>\n?)+/g, '<table class="ai-table">$&</table>');
    return html;
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          if (isSystem) {
            return (
              <motion.div key={msg.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-2">
                <span className="text-[13px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-3 py-1 rounded-full">{msg.content}</span>
              </motion.div>
            );
          }

          if (isUser) {
            return (
              <motion.div key={msg.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex justify-end">
                <div className="max-w-[80%]">
                  <div className="px-4 py-3 rounded-3xl rounded-br-lg text-sm text-white leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: 'var(--accent)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}>
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            );
          }

          // AI message
          return (
            <motion.div key={msg.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5"
                  >
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                </div>
                <div className="flex-1 min-w-0 group">
                  <div className="rounded-2xl rounded-tl-lg px-4 py-3 ai-content"
                    style={{
                      background: 'var(--bg-elevated)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => copyText(msg.content, i)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition">
                      {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedIdx === i ? 'Copied' : 'Copy'}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Streaming text */}
        {loading && streamingText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5"
                >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl rounded-tl-lg px-4 py-3 ai-content"
                  style={{
                    background: 'var(--bg-elevated)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }} />
                  <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 rounded-sm align-middle" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading indicator */}
        {loading && !streamingText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5"
                >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              </div>
              <div className="flex-1">
                <div className="rounded-2xl rounded-tl-lg px-4 py-3 flex items-center gap-2.5"
                  style={{
                    background: 'var(--bg-elevated)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">Thinking...</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
