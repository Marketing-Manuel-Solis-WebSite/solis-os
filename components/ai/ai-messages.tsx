'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronDown, Sparkles, User } from 'lucide-react';
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
        className="w-8 h-8 rounded-full object-cover shrink-0"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initials = (name || 'U').charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 text-white text-[13px] font-semibold">
      {initials}
    </div>
  );
}

function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#5B8DEF] flex items-center justify-center shrink-0 shadow-sm">
      <Sparkles className="h-4 w-4 text-white" />
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
    if (isAutoScrolling.current) {
      scrollToBottom();
    }
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

  const isError = (content: string) => {
    return content.startsWith('Error:') || content.startsWith('error:') || content.includes('429') || content.includes('rate limit');
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scroll-smooth"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6 space-y-5">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';

            // System message
            if (isSystem) {
              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center py-2"
                >
                  <span className="text-[12px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)]">
                    {msg.content}
                  </span>
                </motion.div>
              );
            }

            // User message — avatar + bubble
            if (isUser) {
              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-3 justify-end"
                >
                  <div className="max-w-[80%] sm:max-w-[70%]">
                    <div
                      className="px-4 py-3 rounded-2xl rounded-tr-md text-[0.9375rem] text-white leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: 'var(--gradient-primary)',
                        boxShadow: 'var(--shadow-sm)',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                  <UserAvatar photo={userPhoto} name={userName} />
                </motion.div>
              );
            }

            // Assistant message — error
            if (isError(msg.content)) {
              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-3"
                >
                  <AIAvatar />
                  <div className="flex-1 min-w-0 max-w-[85%]">
                    <AIErrorCallout message={msg.content} />
                  </div>
                </motion.div>
              );
            }

            // Assistant message — avatar + constrained content
            return (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-start gap-3"
              >
                <AIAvatar />
                <div className="flex-1 min-w-0 max-w-[calc(100%-44px)]">
                  <AIMarkdown content={msg.content} />

                  {/* Copy on hover */}
                  <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

          {/* Streaming text */}
          <AnimatePresence>
            {loading && streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3"
              >
                <AIAvatar />
                <div className="flex-1 min-w-0 max-w-[calc(100%-44px)]">
                  <AIMarkdown content={streamingText} />
                  <motion.span
                    className="inline-block w-[3px] h-5 bg-[var(--accent)] rounded-full ml-0.5 align-middle"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thinking indicator */}
          <AnimatePresence>
            {loading && !streamingText && (
              <AIThinking />
            )}
          </AnimatePresence>

          <div ref={bottomRef} className="h-1" />
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
