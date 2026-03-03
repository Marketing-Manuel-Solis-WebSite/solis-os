'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, X, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  onStop: (seconds: number) => void;
  taskTitle: string;
}

const LS_KEY = 'solis-timer';

interface TimerState {
  startedAt: number; // timestamp ms
  taskTitle: string;
}

export function useTimer() {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [taskTitle, setTaskTitle] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const state: TimerState = JSON.parse(saved);
      setStartedAt(state.startedAt);
      setTaskTitle(state.taskTitle);
      setRunning(true);
    }
  }, []);

  const start = (title: string) => {
    const now = Date.now();
    setStartedAt(now);
    setTaskTitle(title);
    setRunning(true);
    localStorage.setItem(LS_KEY, JSON.stringify({ startedAt: now, taskTitle: title }));
  };

  const stop = (): number => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    setRunning(false);
    localStorage.removeItem(LS_KEY);
    return elapsed;
  };

  const discard = () => {
    setRunning(false);
    localStorage.removeItem(LS_KEY);
  };

  return { running, startedAt, taskTitle, start, stop, discard };
}

export default function TimerWidget({ onStop, taskTitle }: Props & { startedAt: number; onDiscard: () => void }) {
  return null; // Inline in page
}

export function TimerFloating({ startedAt, taskTitle, onStop, onDiscard }: {
  startedAt: number;
  taskTitle: string;
  onStop: () => void;
  onDiscard: () => void;
}) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-elevated)] shadow-dropdown"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <Clock className="h-4 w-4 text-[var(--accent)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-mono font-bold text-[var(--text-primary)]">
          {pad(hrs)}:{pad(mins)}:{pad(secs)}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{taskTitle}</p>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={onStop}
          className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition"
          title={t('timesheets.stopTimer')}
        >
          <Square className="h-3.5 w-3.5" fill="white" />
        </button>
        <button
          onClick={onDiscard}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition"
          title={t('timesheets.discardTimer')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
