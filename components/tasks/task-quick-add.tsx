'use client';

import { useState, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { Plus } from 'lucide-react';

interface Props {
  groupKey: string;
  groupLabel: string;
  onAdd: (title: string) => void;
}

export default function TaskQuickAdd({ groupKey, groupLabel, onAdd }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim());
    setTitle('');
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    if (!title.trim()) {
      setActive(false);
      setTitle('');
    }
  };

  if (!active) {
    return (
      <button
        onClick={() => {
          setActive(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 px-5 py-3 mt-2 w-full text-[var(--text-muted)] hover:text-[var(--accent)] text-[13px] group transition-colors rounded-xl hover:bg-[var(--bg-elevated)]/60"
      >
        <Plus className="h-4 w-4 transition-colors group-hover:text-[var(--accent)]" />
        {t('tasks.newTask')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-5 py-3 mt-2 rounded-xl bg-[var(--bg-elevated)] shadow-card ring-1 ring-[var(--accent)]/25">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setActive(false);
            setTitle('');
          }
        }}
        onBlur={handleBlur}
        placeholder={`${t('tasks.newTask')} \u2014 ${groupLabel}...`}
        className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
      />
      <button
        onClick={submit}
        disabled={!title.trim()}
        className="px-4 h-8 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-semibold transition-colors text-[13px] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        {t('common.create')}
      </button>
    </div>
  );
}
