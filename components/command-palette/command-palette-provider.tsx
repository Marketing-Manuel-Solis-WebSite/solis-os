'use client';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import CommandPalette from './command-palette';

interface CommandPaletteCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<CommandPaletteCtx>({ open: false, setOpen: () => {}, toggle: () => {} });

export const useCommandPalette = () => useContext(Ctx);

export default function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen(v => !v), []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  return (
    <Ctx.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}
