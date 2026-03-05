'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronDown, Sparkles } from 'lucide-react';
import type { AIMessage } from '@/lib/ai-db';
import { useI18n } from '@/lib/i18n';
import AIMarkdown from './ai-markdown';
import AIThinking from './ai-thinking';
import AIErrorCallout from './ai-error-callout';

interface Props {
  messages: AIMessage[];
  loading: boolean;
  streamingText: string;
  userPhoto?: string;
  userName?: string;
}

function UserAvatar({ photo, name }: { photo?: string; name?: string }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name || ''}
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}

function AIAvatar() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--accent), #5B8DEF)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Sparkles style={{ width: 16, height: 16, color: '#fff' }} />
    </div>
  );
}

export default function AIMessages({ messages, loading, streamingText, userPhoto, userName }: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAutoScrolling = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    if (isAutoScrolling.current) scrollToBottom();
  }, [messages.length, streamingText, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom < 100;
    isAutoScrolling.current = nearBottom;
    setShowScrollBtn(!nearBottom && messages.length > 2);
  }, [messages.length]);

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const isError = (content: string) =>
    content.startsWith('Error:') || content.startsWith('error:') || content.includes('429') || content.includes('rate limit');

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ height: '100%', overflowY: 'auto', scrollBehavior: 'smooth', scrollbarGutter: 'stable' }}
      >
        {/* Central container */}
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '32px 24px' }}>
          {/* Messages with vertical gap */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';

              /* System message */
              if (isSystem) {
                return (
                  <div key={msg.id || i} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                    <span style={{
                      fontSize: 12, color: 'var(--text-muted)',
                      background: 'var(--bg-tertiary)', padding: '6px 14px',
                      borderRadius: 999, border: '1px solid var(--border)',
                    }}>
                      {msg.content}
                    </span>
                  </div>
                );
              }

              /* User message — right aligned */
              if (isUser) {
                return (
                  <motion.div
                    key={msg.id || i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'flex-end' }}
                  >
                    <div style={{ maxWidth: 720 }}>
                      <div style={{
                        padding: '14px 20px',
                        borderRadius: '20px 20px 6px 20px',
                        fontSize: '0.9375rem',
                        color: '#fff',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        background: 'var(--gradient-primary)',
                        boxShadow: 'var(--shadow-sm)',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                    <UserAvatar photo={userPhoto} name={userName} />
                  </motion.div>
                );
              }

              /* AI error */
              if (isError(msg.content)) {
                return (
                  <motion.div
                    key={msg.id || i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                  >
                    <AIAvatar />
                    <div style={{ maxWidth: 820, minWidth: 0 }}>
                      <AIErrorCallout message={msg.content} />
                    </div>
                  </motion.div>
                );
              }

              /* AI response — left aligned, in a bubble */
              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="group"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                >
                  <AIAvatar />
                  <div style={{ maxWidth: 820, minWidth: 0 }}>
                    {/* The bubble */}
                    <div className="ai-response-bubble" style={{
                      padding: '16px 20px',
                      borderRadius: '20px 20px 20px 6px',
                      overflow: 'hidden',
                    }}>
                      <AIMarkdown content={msg.content} />
                    </div>

                    {/* Copy button on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyText(msg.content, i)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {copiedIdx === i ? (
                          <><Check className="h-3 w-3 text-[var(--success)]" /><span className="text-[var(--success)]">{t('ai.copied')}</span></>
                        ) : (
                          <><Copy className="h-3 w-3" /><span>{t('ai.copy')}</span></>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Streaming */}
            <AnimatePresence>
              {loading && streamingText && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                >
                  <AIAvatar />
                  <div style={{ maxWidth: 820, minWidth: 0 }}>
                    <div className="ai-response-bubble" style={{
                      padding: '16px 20px',
                      borderRadius: '20px 20px 20px 6px',
                      overflow: 'hidden',
                    }}>
                      <AIMarkdown content={streamingText} />
                      <motion.span
                        style={{ display: 'inline-block', width: 3, height: 20, background: 'var(--accent)', borderRadius: 999, marginLeft: 2, verticalAlign: 'middle' }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thinking */}
            <AnimatePresence>
              {loading && !streamingText && <AIThinking />}
            </AnimatePresence>

            <div ref={bottomRef} style={{ height: 4 }} />
          </div>
        </div>
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={() => { scrollToBottom(); isAutoScrolling.current = true; }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer z-10"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>{t('ai.scrollToBottom')}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
