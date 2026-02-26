'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Copy, Check, Loader2 } from 'lucide-react';
import type { AIMessage, AIMode } from '@/lib/ai-db';

const MODE_COLORS: Record<string, string> = { chat: '#D4A843', research: '#3B82F6', deep: '#A855F7' };

interface Props {
  messages: AIMessage[];
  loading: boolean;
  streamingText: string;
  mode: AIMode;
  userId: string;
}

export default function AIMessages({ messages, loading, streamingText, mode, userId }: Props) {
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
      .replace(/^- \[x\] (.+)$/gm, '<li class="ai-checkbox checked">✅ $1</li>')
      .replace(/^- \[ \] (.+)$/gm, '<li class="ai-checkbox">⬜ $1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="ai-link" target="_blank">$1</a>')
      .replace(/^(?!<[hbluptd]|<li|<pre|<code|<hr|<tr|<blockquote)(.+)$/gm, '<p class="ai-p">$1</p>');

    html = html.replace(/(<li class="ai-li">.+?<\/li>\n?)+/g, '<ul class="ai-ul">$&</ul>');
    html = html.replace(/(<li class="ai-li-num">.+?<\/li>\n?)+/g, '<ol class="ai-ol">$&</ol>');
    html = html.replace(/(<tr>.+?<\/tr>\n?)+/g, '<table class="ai-table">$&</table>');
    return html;
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          const modeColor = MODE_COLORS[msg.mode] || MODE_COLORS.chat;

          if (isSystem) {
            return (
              <motion.div key={msg.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-2">
                <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-full border border-[var(--border)]">{msg.content}</span>
              </motion.div>
            );
          }

          if (isUser) {
            return (
              <motion.div key={msg.id || i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="flex justify-end">
                <div className="max-w-[75%]">
                  <div className="px-4 py-3 rounded-2xl rounded-tr-md bg-[#D4A843]/10 border border-[#D4A843]/20">
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {msg.createdAt && (
                    <p className="text-[9px] text-[var(--text-muted)] mt-1 text-right">
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div key={msg.id || i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${modeColor}15`, border: `1px solid ${modeColor}20` }}>
                  <Bot className="h-3.5 w-3.5" style={{ color: modeColor }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: modeColor }}>Solis AI</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-md font-bold" style={{ backgroundColor: `${modeColor}10`, color: modeColor }}>
                  {msg.mode === 'deep' ? 'REPORT' : msg.mode === 'research' ? 'RESEARCH' : 'CHAT'}
                </span>
                {msg.createdAt && (
                  <span className="text-[9px] text-[var(--text-muted)] ml-auto">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="ml-9 rounded-2xl rounded-tl-md bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
                <div className="p-5 ai-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                <div className="flex items-center gap-2 px-5 py-2.5 border-t border-[var(--border)] bg-[var(--bg-base)]/50">
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => copyText(msg.content, i)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition">
                    {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedIdx === i ? 'Copied!' : 'Copy'}
                  </motion.button>
                  {msg.tokens > 0 && <span className="text-[9px] text-[var(--text-muted)] ml-auto">{msg.tokens.toLocaleString()} chars</span>}
                </div>
              </div>
            </motion.div>
          );
        })}

        {loading && streamingText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${MODE_COLORS[mode]}15`, border: `1px solid ${MODE_COLORS[mode]}20` }}>
                <Bot className="h-3.5 w-3.5" style={{ color: MODE_COLORS[mode] }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: MODE_COLORS[mode] }}>Solis AI</span>
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: MODE_COLORS[mode] }} />
            </div>
            <div className="ml-9 p-5 rounded-2xl rounded-tl-md bg-[var(--bg-card)] border border-[var(--border)]">
              <div className="ai-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }} />
              <span className="inline-block w-1.5 h-4 bg-[#D4A843] animate-pulse ml-0.5 rounded-sm" />
            </div>
          </motion.div>
        )}

        {loading && !streamingText && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${MODE_COLORS[mode]}15`, border: `1px solid ${MODE_COLORS[mode]}20` }}>
                <Bot className="h-3.5 w-3.5" style={{ color: MODE_COLORS[mode] }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: MODE_COLORS[mode] }}>Solis AI</span>
            </div>
            <div className="ml-9 px-5 py-4 rounded-2xl rounded-tl-md bg-[var(--bg-card)] border border-[var(--border)] flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: MODE_COLORS[mode] }} />
              <span className="text-xs text-[var(--text-muted)]">
                {mode === 'deep' ? 'Generating comprehensive report...' : mode === 'research' ? 'Researching and analyzing...' : 'Thinking...'}
              </span>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
