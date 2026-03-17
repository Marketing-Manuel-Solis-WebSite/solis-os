'use client';

// ============================================================
// Mobile Quick Actions — Floating action button (FAB) with
// speed-dial menu for creating tasks, docs, and quick notes.
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, CheckSquare, FileText, StickyNote, Loader2 } from 'lucide-react';
import BottomSheet from '@/components/mobile/bottom-sheet';
import { createDocument } from '@/lib/db';

interface QuickAction {
  id: string;
  Icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  color: string;
}

const ACTIONS: QuickAction[] = [
  { id: 'task', Icon: CheckSquare, labelKey: 'mobile.createTask', color: 'var(--accent)' },
  { id: 'doc', Icon: FileText, labelKey: 'mobile.createDoc', color: '#3B82F6' },
  { id: 'note', Icon: StickyNote, labelKey: 'mobile.quickNote', color: '#F59E0B' },
];

export default function MobileQuickActions() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = useCallback((actionId: string) => {
    setOpen(false);
    switch (actionId) {
      case 'task':
        router.push('/app/tasks?create=true');
        break;
      case 'doc':
        router.push('/app/docs?create=true');
        break;
      case 'note':
        setNoteText('');
        setNoteOpen(true);
        break;
    }
  }, [router]);

  const handleSaveNote = useCallback(async () => {
    if (!noteText.trim() || !user?.uid) return;
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const title = lang === 'es'
        ? `Nota rápida — ${dateStr}`
        : `Quick note — ${dateStr}`;

      await createDocument({
        title,
        content: noteText.trim(),
        contentHtml: `<p>${noteText.trim().replace(/\n/g, '</p><p>')}</p>`,
        createdBy: user.uid,
        teamId: '',
      });
      setNoteOpen(false);
      setNoteText('');
    } finally {
      setSaving(false);
    }
  }, [noteText, user?.uid, lang]);

  return (
    <>
      {/* FAB + Speed Dial */}
      <div
        ref={containerRef}
        className="fixed bottom-[76px] right-4 z-[60] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Speed dial items */}
        <AnimatePresence>
          {open && (
            <div className="absolute bottom-16 right-0 flex flex-col items-end gap-3 mb-2">
              {ACTIONS.map((action, i) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  transition={{ duration: 0.15, delay: i * 0.04 }}
                  onClick={() => handleAction(action.id)}
                  className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full shadow-lg bg-[var(--bg-elevated)] border border-[var(--border)] active:bg-[var(--bg-hover)] transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: action.color + '20' }}
                  >
                    <action.Icon className="h-4 w-4" style={{ color: action.color }} />
                  </div>
                  <span className="text-[13px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {t(action.labelKey)}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(prev => !prev)}
          className="w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-text)] shadow-lg flex items-center justify-center active:opacity-80 transition-opacity"
          aria-label={t('mobile.quickActions')}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </motion.button>
      </div>

      {/* Quick Note Bottom Sheet */}
      <BottomSheet
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={t('mobile.quickNote')}
      >
        <div className="space-y-4 pb-4">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={5}
            autoFocus
            placeholder={lang === 'es' ? 'Escribe tu nota...' : 'Write your note...'}
            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] text-[15px] text-[var(--text-primary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none resize-none leading-relaxed"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setNoteOpen(false)}
              className="flex-1 h-12 rounded-xl text-[14px] font-medium text-[var(--text-secondary)] bg-[var(--bg-elevated)] active:bg-[var(--bg-hover)] transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveNote}
              disabled={saving || !noteText.trim()}
              className="flex-1 h-12 rounded-xl text-[14px] font-semibold bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.save')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
