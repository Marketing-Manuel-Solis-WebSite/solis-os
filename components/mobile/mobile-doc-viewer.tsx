'use client';

// ============================================================
// Mobile Document Viewer — Read-only mobile-optimized viewer
// with floating Edit button and scroll-to-top.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pencil, ArrowUp } from 'lucide-react';

interface Props {
  doc: {
    id: string;
    title?: string;
    contentHtml?: string;
  };
  onBack: () => void;
  onEdit?: () => void;
}

export default function MobileDocViewer({ doc, onBack, onEdit }: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track scroll position to show/hide scroll-to-top button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    setShowScrollTop(scrollRef.current.scrollTop > 300);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="fixed inset-0 z-[80] bg-[var(--bg-base)] flex flex-col md:hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-base)]">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--bg-elevated)] active:bg-[var(--bg-hover)] transition-colors"
          aria-label={t('mobile.back')}
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-primary)]" />
        </button>
        <h1 className="flex-1 text-[16px] font-semibold text-[var(--text-primary)] truncate">
          {doc.title || 'Untitled'}
        </h1>
      </div>

      {/* Content — scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-6 pb-24"
      >
        {doc.contentHtml ? (
          <div
            className="mobile-doc-content prose prose-sm max-w-none
              text-[var(--text-primary)]
              [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6
              [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5
              [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4
              [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:mb-3
              [&_ul]:pl-5 [&_ul]:mb-3
              [&_ol]:pl-5 [&_ol]:mb-3
              [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:mb-1
              [&_a]:text-[var(--accent)] [&_a]:underline
              [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--border)]
              [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--text-secondary)]
              [&_code]:bg-[var(--bg-elevated)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]
              [&_pre]:bg-[var(--bg-elevated)] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto
              [&_img]:rounded-xl [&_img]:max-w-full
              [&_table]:w-full [&_table]:text-[13px]
              [&_th]:text-left [&_th]:p-2 [&_th]:border-b [&_th]:border-[var(--border)]
              [&_td]:p-2 [&_td]:border-b [&_td]:border-[var(--border-subtle)]"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.contentHtml) }}
          />
        ) : (
          <p className="text-[var(--text-muted)] text-[14px] italic">
            {t('common.noResults')}
          </p>
        )}
      </div>

      {/* Floating Edit Button */}
      {onEdit && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.2 }}
          onClick={onEdit}
          className="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-text)] shadow-lg flex items-center justify-center active:opacity-80 transition-opacity md:hidden"
          aria-label={t('mobile.edit')}
        >
          <Pencil className="h-5 w-5" />
        </motion.button>
      )}

      {/* Scroll-to-top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={scrollToTop}
            className="fixed bottom-20 left-5 w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] shadow-md flex items-center justify-center active:bg-[var(--bg-hover)] transition-colors md:hidden"
            aria-label={t('mobile.scrollToTop')}
          >
            <ArrowUp className="h-4 w-4 text-[var(--text-secondary)]" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
