"use client";
import { useCallback, useEffect, useRef } from "react";
import { useL } from "@/lib/i18n";

/** Protect an editor on same-app links and browser unload. Use confirmDiscard for local context switches. */
export function useUnsavedChanges(dirty: boolean, onDiscard?: () => void) {
  const L = useL();
  const active = useRef(dirty);
  const discard = useRef(onDiscard); discard.current = onDiscard;
  const message = useRef("");
  active.current = dirty;
  message.current = L({hi:"बदलाव सेव नहीं हुए हैं। इन्हें छोड़कर आगे जाएँ?",en:"Your changes are not saved. Discard them and leave?"});
  const confirmDiscard = useCallback(() => { if(!active.current)return true; if(!window.confirm(message.current))return false; discard.current?.(); active.current=false; return true; }, []);
  const markSaved = useCallback(() => { active.current = false; }, []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!active.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!active.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const tab = (event.target as Element)?.closest?.('[role="tab"]');
      if (tab && tab.getAttribute("aria-selected") !== "true") {
        if (!confirmDiscard()) { event.preventDefault(); event.stopImmediatePropagation(); }
        else active.current = false;
        return;
      }
      const anchor = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const next = new URL(anchor.href, location.href);
      if (next.origin !== location.origin || next.pathname + next.search === location.pathname + location.search) return;
      if (!confirmDiscard()) { event.preventDefault(); event.stopImmediatePropagation(); }
      else active.current = false;
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [confirmDiscard]);
  return { confirmDiscard, markSaved };
}
