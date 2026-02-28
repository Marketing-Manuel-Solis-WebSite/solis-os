'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, ArrowRight, Flag } from 'lucide-react';
import { STATUSES, PRIORITIES } from './constants';

interface Props {
  count: number;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

function DropUp({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[#D4A843] transition">
        {icon} {label}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl shadow-xl p-1 min-w-[140px] z-50">
          {children}
        </div>
      )}
    </div>
  );
}

export default function TaskBulkActions({ count, onStatusChange, onPriorityChange, onDelete, onClear }: Props) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="sticky bottom-4 mx-auto w-fit px-5 py-3 rounded-2xl bg-[var(--bg-card)] border border-[#D4A843]/20 shadow-2xl shadow-black/20 flex items-center gap-4 z-20"
    >
      <span className="text-sm font-semibold text-[#D4A843]">{count} seleccionadas</span>

      <div className="h-5 w-px bg-[var(--border)]" />

      {/* Status change */}
      <DropUp icon={<ArrowRight className="h-3.5 w-3.5" />} label="Mover a">
        {STATUSES.map(s => (
          <button key={s.id} onClick={() => onStatusChange(s.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </DropUp>

      {/* Priority change */}
      <DropUp icon={<Flag className="h-3.5 w-3.5" />} label="Prioridad">
        {PRIORITIES.map(p => (
          <button key={p.id} onClick={() => onPriorityChange(p.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--hover-bg)] transition">
            {p.icon} {p.label}
          </button>
        ))}
      </DropUp>

      {/* Delete */}
      <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition">
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>

      <div className="h-5 w-px bg-[var(--border)]" />

      {/* Clear selection */}
      <button onClick={onClear} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
