"use client";

import { RefObject, useEffect, useRef } from "react";

const openDialogs: HTMLElement[] = [];
let previousOverflow = "";

/** Shared modal focus, nested Escape handling and reference-counted scroll lock. */
export function useDialog(open: boolean, ref: RefObject<HTMLElement>, onClose: () => void, busy = false) {
  const close = useRef(onClose);
  const pending = useRef(busy);
  close.current = onClose;
  pending.current = busy;
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!openDialogs.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(element);
    const top = () => [...openDialogs].sort((a, b) => {
      const layer = (node: HTMLElement) => Number(getComputedStyle(node.parentElement!).zIndex) || 0;
      return layer(a) - layer(b);
    }).at(-1) === element;
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'
    )).filter(node => node.getClientRects().length && !node.closest('[inert],[aria-hidden="true"]'));
    element.focus();
    const key = (event: KeyboardEvent) => {
      if (!top()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!pending.current) close.current();
      } else if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (!first) { event.preventDefault(); element.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const focus = (event: FocusEvent) => {
      if (top() && !element.contains(event.target as Node)) element.focus();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
      const index = openDialogs.indexOf(element);
      if (index >= 0) openDialogs.splice(index, 1);
      if (!openDialogs.length) document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, ref]);
}
