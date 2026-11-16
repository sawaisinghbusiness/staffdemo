"use client";
import { useCallback, useEffect, useRef } from "react";
import { useDiscardDialog } from "@/components/DiscardDialog";

/** Custom confirmation for in-app navigation; native unload protection remains intact. */
export function useUnsavedChanges(dirty: boolean, onDiscard?: () => void) {
  const ask = useDiscardDialog();
  const active = useRef(dirty);
  const discard = useRef(onDiscard);
  const navigating = useRef(false);
  const replaying = useRef(false);
  discard.current = onDiscard;
  active.current = dirty;
  const confirmDiscard = useCallback(async () => {
    if (!active.current) return true;
    if (!(await ask())) return false;
    discard.current?.();
    active.current = false;
    return true;
  }, [ask]);
  const markSaved = useCallback(() => { active.current = false; }, []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!active.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!active.current || replaying.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element;
      if (target.closest?.('[data-discard-dialog]')) return;
      const tab = target.closest?.('[role="tab"]') as HTMLElement | null;
      let destination: HTMLElement | null = null;
      if (tab && tab.getAttribute("aria-selected") !== "true") destination = tab;
      else {
        const anchor = target.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
        const next = new URL(anchor.href, location.href);
        if (next.origin !== location.origin || next.pathname + next.search === location.pathname + location.search) return;
        destination = anchor;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      if (navigating.current) return;
      navigating.current = true;
      void confirmDiscard().then(allowed => {
        if (allowed && destination?.isConnected) {
          replaying.current = true;
          try { destination.click(); } finally { replaying.current = false; }
        }
      }).finally(() => { navigating.current = false; });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [confirmDiscard]);
  return { confirmDiscard, markSaved };
}
