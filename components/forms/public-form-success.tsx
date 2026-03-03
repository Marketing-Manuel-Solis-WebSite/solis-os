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
      className="py-12 px-6 text-center space-y-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
      >
        <CheckCircle2 className="h-12 w-12 text-[var(--success)] mx-auto" strokeWidth={1.5} />
      </motion.div>
      <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('publicForm.success')}</h2>
      <p className="text-sm text-[var(--text-secondary)]">{message || t('publicForm.successDefault')}</p>
      {onAnother && (
        <button
          onClick={onAnother}
          className="mt-4 px-4 py-2 rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all font-medium"
        >
          {t('publicForm.anotherResponse')}
        </button>
      )}
    </motion.div>
  );
}
