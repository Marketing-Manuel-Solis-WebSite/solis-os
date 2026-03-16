'use client';

// ============================================================
// Global Keyboard Shortcuts Hook — Two-key chord system
// with input guard and cleanup. Mounted at layout level.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

export interface ShortcutDef {
  id: string;
  /** Key sequence: ['g', 't'] = chord, ['n'] = single key */
  keys: string[];
  description: string;
  descriptionEs: string;
  scope: 'global' | 'tasks' | 'docs' | 'chat';
  category: 'navigation' | 'creation' | 'views' | 'other';
}

export const GLOBAL_SHORTCUTS: ShortcutDef[] = [
  // Navigation chords (G + letter)
  { id: 'go-dashboard', keys: ['g', 'd'], description: 'Go to Dashboard', descriptionEs: 'Ir al Dashboard', scope: 'global', category: 'navigation' },
  { id: 'go-tasks', keys: ['g', 't'], description: 'Go to Tasks', descriptionEs: 'Ir a Tareas', scope: 'global', category: 'navigation' },
  { id: 'go-chat', keys: ['g', 'c'], description: 'Go to Chat', descriptionEs: 'Ir al Chat', scope: 'global', category: 'navigation' },
  { id: 'go-docs', keys: ['g', 'o'], description: 'Go to Docs', descriptionEs: 'Ir a Documentos', scope: 'global', category: 'navigation' },
  { id: 'go-goals', keys: ['g', 'l'], description: 'Go to Goals', descriptionEs: 'Ir a Objetivos', scope: 'global', category: 'navigation' },
  { id: 'go-analytics', keys: ['g', 'a'], description: 'Go to Analytics', descriptionEs: 'Ir a Analíticas', scope: 'global', category: 'navigation' },
  // Single key shortcuts
  { id: 'new-task', keys: ['n'], description: 'New Task', descriptionEs: 'Nueva Tarea', scope: 'global', category: 'creation' },
  { id: 'show-help', keys: ['?'], description: 'Show Shortcuts', descriptionEs: 'Mostrar Atajos', scope: 'global', category: 'other' },
];

const ROUTE_MAP: Record<string, string> = {
  'go-dashboard': '/app',
  'go-tasks': '/app/tasks',
  'go-chat': '/app/chat',
  'go-docs': '/app/docs',
  'go-goals': '/app/goals',
  'go-analytics': '/app/analytics',
};

interface UseGlobalShortcutsOptions {
  onNavigate: (path: string) => void;
  onNewTask: () => void;
  onShowHelp: () => void;
  onSearch?: () => void;
  enabled?: boolean;
}

function isInputFocused(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts({
  onNavigate,
  onNewTask,
  onShowHelp,
  enabled = true,
}: UseGlobalShortcutsOptions): void {
  const chordRef = useRef<{ firstKey: string | null; timer: ReturnType<typeof setTimeout> | null }>({
    firstKey: null,
    timer: null,
  });

  const resetChord = useCallback(() => {
    if (chordRef.current.timer) clearTimeout(chordRef.current.timer);
    chordRef.current = { firstKey: null, timer: null };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip when modifier keys are held (except Shift for ?)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Skip when input is focused
      if (isInputFocused(e)) return;

      const key = e.key.toLowerCase();
      const chord = chordRef.current;

      // Check if this completes a chord
      if (chord.firstKey) {
        resetChord();
        const matchId = GLOBAL_SHORTCUTS.find(
          s => s.keys.length === 2 && s.keys[0] === chord.firstKey && s.keys[1] === key
        )?.id;
        if (matchId) {
          e.preventDefault();
          const route = ROUTE_MAP[matchId];
          if (route) onNavigate(route);
          return;
        }
        // Chord didn't match — fall through to check single keys
      }

      // Check if this starts a chord
      const startsChord = GLOBAL_SHORTCUTS.some(s => s.keys.length === 2 && s.keys[0] === key);
      if (startsChord) {
        chordRef.current.firstKey = key;
        chordRef.current.timer = setTimeout(resetChord, 500);
        return;
      }

      // Single key shortcuts
      if (key === 'n') {
        e.preventDefault();
        onNewTask();
      } else if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        onShowHelp();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      resetChord();
    };
  }, [enabled, onNavigate, onNewTask, onShowHelp, resetChord]);
}
