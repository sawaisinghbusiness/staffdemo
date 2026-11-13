"use client";

import { useRef } from "react";

/**
 * Which way the screen just shown should move (2026-11-13): a newly opened screen slides in from the right,
 * going back (the Back arrow, the phone's back button or swipe) brings the earlier one in from the left,
 * and switching between bottom tabs only fades. The first screen of a visit doesn't move.
 */
export type PageMotion = "none" | "fwd" | "back" | "tab";

let goingBack = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (goingBack = true));

/** Call when the in-app Back arrow is tapped, so that screen comes in like the phone's back. */
export const markBack = () => {
  goingBack = true;
};

export function usePageMotion(path: string, isTab: (p: string) => boolean): PageMotion {
  const last = useRef<{ path: string; motion: PageMotion }>({ path, motion: "none" });
  if (last.current.path !== path) {
    const motion: PageMotion = goingBack ? "back" : isTab(path) && isTab(last.current.path) ? "tab" : "fwd";
    goingBack = false;
    last.current = { path, motion };
  }
  return last.current.motion;
}

/** The CSS class for a motion (see .page-fwd / .page-back / .page-tab in globals.css). */
export const motionClass = (m: PageMotion) => (m === "none" ? "" : `page-${m}`);
