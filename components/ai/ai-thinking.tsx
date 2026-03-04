'use client';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function AIThinking() {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3 items-start"
    >
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[#5B8DEF] flex items-center justify-center shrink-0 shadow-sm">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl rounded-tl-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--accent)]"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="text-[13px] text-[var(--text-muted)]">{t('ai.thinking')}</span>
      </div>
    </motion.div>
  );
}
