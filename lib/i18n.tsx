'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Lang = 'zh' | 'en';

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** 取当前语言文案：t('中文', 'English') */
  t: (zh: string, en: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = 'openthemis_lang';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === 'zh' || saved === 'en') {
        setLangState(saved);
      } else if (typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('zh')) {
        setLangState('en');
      }
    } catch { /* ignore */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
    }
  }, []);

  const toggle = useCallback(() => setLang(lang === 'zh' ? 'en' : 'zh'), [lang, setLang]);

  const t = useCallback((zh: string, en: string) => (lang === 'zh' ? zh : en), [lang]);

  return <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // 容错：未包裹 Provider 时默认中文，避免崩溃
    return { lang: 'zh', setLang: () => {}, toggle: () => {}, t: (zh) => zh };
  }
  return ctx;
}
