'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeCtx {
  theme: Theme;
  resolved: 'dark' | 'light';
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: 'dark',
  resolved: 'dark',
  setTheme: () => {},
  toggle: () => {},
});

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>('dark');
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark');

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('solis-theme') as Theme | null;
    const initial = stored || 'dark';
    setThemeRaw(initial);
    setResolved(resolveTheme(initial));
  }, []);

  // Apply theme class to <html>
  useEffect(() => {
    const r = resolveTheme(theme);
    setResolved(r);
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(r);
    root.style.colorScheme = r;
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolved(getSystemTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t);
    localStorage.setItem('solis-theme', t);
  }, []);

  const toggle = useCallback(() => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolved, setTheme]);

  return <Ctx.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
