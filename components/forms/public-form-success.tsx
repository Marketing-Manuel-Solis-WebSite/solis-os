'use client';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  message?: string;
  onAnother?: () => void;
}

export default function PublicFormSuccess({ message, onAnother }: Props) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-16 px-7 text-center space-y-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto"
      >
        <CheckCircle2 className="h-8 w-8 text-green-500" strokeWidth={1.5} />
      </motion.div>
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('publicForm.success')}</h2>
      <p className="text-[14px] text-[var(--text-secondary)] max-w-xs mx-auto">{message || t('publicForm.successDefault')}</p>
      {onAnother && (
        <button
          onClick={onAnother}
          className="mt-4 px-5 py-2.5 rounded-xl text-sm text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all font-medium"
        >
          {t('publicForm.anotherResponse')}
        </button>
      )}
    </motion.div>
  );
}
