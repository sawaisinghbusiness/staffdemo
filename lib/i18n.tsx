"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "hi" | "en";
export type Bi = { hi: string; en: string };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      if (localStorage.getItem("sa:lang") === "hi") setLangState("hi");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("sa:lang", l);
    } catch {
      /* ignore */
    }
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** Text sits next to the screen that uses it: `const L = useL(); L({ hi: "…", en: "…" })`. English by default, Hindi from Profile. */
export function useL() {
  const { lang } = useContext(Ctx);
  return useCallback((b: Bi) => b[lang], [lang]);
}
