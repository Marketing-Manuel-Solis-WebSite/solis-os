'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { translations, type Lang } from './translations';

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({
  lang: 'es',
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangRaw] = useState<Lang>('es');

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('solis-lang') as Lang | null;
    if (stored && (stored === 'en' || stored === 'es')) {
      setLangRaw(stored);
    }
  }, []);

  // Apply lang attribute to <html>
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangRaw(l);
    localStorage.setItem('solis-lang', l);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang][key] || translations.es[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** For use outside React (e.g., auth-errors.ts). Pass lang explicitly. */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let str = translations[lang][key] || translations.es[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}
