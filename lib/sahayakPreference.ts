"use client";

import { useSyncExternalStore } from "react";

const KEY = "sa:sahayak-enabled";
const EVENT = "sa:sahayak-preference";
let current = false;
let transient: boolean | null = null;
const snapshot = () => {
  if (transient !== null) return transient;
  try { current = localStorage.getItem(KEY) === "true"; } catch { /* Keep the current choice when storage is blocked. */ }
  return current;
};
const subscribe = (notify: () => void) => {
  const changed = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { transient = null; notify(); } };
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", changed);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", changed); };
};
function setEnabled(value: boolean) {
  current = value;
  try { localStorage.setItem(KEY, String(value)); transient = null; } catch { transient = value; }
  window.dispatchEvent(new Event(EVENT));
}
const serverSnapshot = () => false;

/** Floating owl is opt-in; navigation and reloads retain the explicit choice. */
export function useSahayakPreference() {
  return [useSyncExternalStore(subscribe, snapshot, serverSnapshot), setEnabled] as const;
}
