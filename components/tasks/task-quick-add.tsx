'use client';
import { useState, useRef } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  groupKey: string;
  groupLabel: string;
  onAdd: (title: string) => void;
}

export default function TaskQuickAdd({ groupKey, groupLabel, onAdd }: Props) {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim());
    setTitle('');
    inputRef.current?.focus();
  };

  if (!active) {
    return (
      <button
        onClick={() => { setActive(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-4 py-2 mt-1 text-[var(--text-muted)] hover:text-[var(--accent)] text-xs group transition rounded-xl hover:bg-[var(--bg-elevated)]">
        <Plus className="h-3.5 w-3.5 group-hover:text-[var(--accent)]" />
        Agregar tarea
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 mt-1 rounded-xl bg-[var(--bg-elevated)] shadow-card ring-1 ring-[var(--accent)]/20">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setActive(false); setTitle(''); }
        }}
        onBlur={() => { if (!title.trim()) setActive(false); }}
        placeholder={`Agregar tarea a "${groupLabel}"...`}
        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
      />
      <button onClick={submit} disabled={!title.trim()}
        className="px-3 h-7 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] font-medium transition text-[11px] disabled:opacity-40">
        Agregar
      </button>
    </div>
  );
}
