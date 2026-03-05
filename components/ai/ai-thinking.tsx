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
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent), #5B8DEF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles style={{ width: 16, height: 16, color: '#fff' }} />
      </div>
      <div className="ai-response-bubble" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px',
        borderRadius: '20px 20px 20px 6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('ai.thinking')}</span>
      </div>
    </motion.div>
  );
}
