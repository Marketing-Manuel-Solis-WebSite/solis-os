'use client';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface Props {
  password: string;
}

const CHECKS = [
  { key: 'length', label: 'Al menos 8 caracteres', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'Una letra mayuscula', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Una letra minuscula', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'Un numero', test: (p: string) => /\d/.test(p) },
  { key: 'special', label: 'Un caracter especial (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

type Level = 'debil' | 'regular' | 'buena' | 'fuerte';

function getLevel(score: number): { level: Level; color: string; bars: number } {
  if (score <= 2) return { level: 'debil', color: 'var(--error)', bars: 1 };
  if (score === 3) return { level: 'regular', color: 'var(--warning)', bars: 2 };
  if (score === 4) return { level: 'buena', color: '#00C48C', bars: 3 };
  return { level: 'fuerte', color: '#00C48C', bars: 4 };
}

const LEVEL_LABELS: Record<Level, string> = {
  debil: 'Debil',
  regular: 'Regular',
  buena: 'Buena',
  fuerte: 'Fuerte',
};

export default function PasswordStrength({ password }: Props) {
  if (!password) return null;

  const results = CHECKS.map(c => ({ ...c, pass: c.test(password) }));
  const score = results.filter(r => r.pass).length;
  const { level, color, bars } = getLevel(score);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      {/* Bars */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i <= bars ? 1 : 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="h-full rounded-full origin-left"
              style={{ backgroundColor: i <= bars ? color : 'transparent' }}
            />
          </div>
        ))}
      </div>

      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color }}>
          {LEVEL_LABELS[level]}
        </span>
        <span className="text-[13px] text-[var(--text-muted)]">{score}/5</span>
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        {results.map(r => (
          <div key={r.key} className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200"
              style={{
                backgroundColor: r.pass ? '#00C48C' : 'var(--bg-tertiary)',
              }}
            >
              {r.pass ? (
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              ) : (
                <X className="w-2.5 h-2.5 text-[var(--text-muted)]" strokeWidth={2.5} />
              )}
            </div>
            <span
              className="text-[13px] transition-colors duration-200"
              style={{ color: r.pass ? 'var(--text-secondary)' : 'var(--text-muted)' }}
            >
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
