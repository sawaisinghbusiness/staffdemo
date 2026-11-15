"use client";
import { useEffect, useState } from "react";

/**
 * Vibration for the driver's screens. Phones only buzz once the person has touched the page, and very short
 * pulses (under ~15 ms) are often too weak to feel, so every pattern here is a little longer than you would think.
 */
export function vibrate(pattern: number | number[]): boolean {
  try {
    return !!navigator.vibrate?.(pattern);
  } catch {
    return false;
  }
}

/** The pick-up / drop-off alert: three strong buzzes, repeated until the alert is closed. */
export const ALERT_BUZZ = [400, 150, 400, 150, 400];
/** Slide finished. */
export const DONE_BUZZ = [90, 50, 180];

/**
 * True once the phone will let this page vibrate. Until the driver has touched the screen once, Chrome refuses
 * (the alert would stay silent), so the trip screen shows a "touch once" line while this is false.
 */
export function useHapticsReady(): boolean {
  const supported = typeof navigator !== "undefined" && "vibrate" in navigator;
  const [ready, setReady] = useState(true);
  useEffect(() => {
    if (!supported) return;
    const ua = (navigator as any).userActivation;
    if (!ua || ua.hasBeenActive) return;
    setReady(false);
    const on = () => setReady(true);
    window.addEventListener("pointerdown", on, { once: true, capture: true });
    window.addEventListener("keydown", on, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", on, true);
      window.removeEventListener("keydown", on, true);
    };
  }, [supported]);
  return ready;
}
