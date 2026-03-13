'use client';
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

// ─── Input Dialog (Create / Rename) ──────────────────────
interface InputDialogProps {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function SpaceInputDialog({
  open, title, description, placeholder, defaultValue = '', confirmLabel, onConfirm, onCancel,
}: InputDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[var(--bg-elevated)] rounded-xl shadow-modal p-6 z-[100]">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          {description && <p className="text-sm text-[var(--text-tertiary)] mt-1">{description}</p>}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
          placeholder={placeholder}
          className="input-dark h-10 text-sm w-full rounded-xl mb-4"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {confirmLabel || t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog (Delete) ─────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SpaceConfirmDialog({
  open, title, description, confirmLabel, destructive = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[var(--bg-elevated)] rounded-xl shadow-modal p-6 z-[100]">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">{description}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              destructive
                ? 'bg-[var(--error)] text-white hover:opacity-90'
                : 'bg-[var(--accent)] text-white hover:opacity-90'
            }`}
          >
            {confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
