"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { langWave } from "@/lib/langWave";

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
  // Switched by the person (not the saved choice coming back on load): the text re-forms in a wave.
  const switched = useRef(false);
  useLayoutEffect(() => {
    if (!switched.current) return;
    switched.current = false;
    langWave(document.body);
  }, [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState((old) => {
      if (old !== l) switched.current = true;
      return l;
    });
    try {
      localStorage.setItem("sa:lang", l);
    } catch {
      /* ignore */
    }
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** For code outside React (lib helpers that throw messages shown in toasts): the language chosen in Profile. */
export function say(b: Bi): string {
  try {
    return localStorage.getItem("sa:lang") === "hi" ? b.hi : b.en;
  } catch {
    return b.en;
  }
}

/** Text sits next to the screen that uses it: `const L = useL(); L({ hi: "…", en: "…" })`. English by default, Hindi from Profile. */
export function useL() {
  const { lang } = useContext(Ctx);
  return useCallback((b: Bi) => b[lang], [lang]);
}
