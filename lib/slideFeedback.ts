"use client";
/**
 * Feedback for the driver's slide buttons: vibration only, no sound.
 *   touch the thumb → one small buzz
 *   dragging        → a very light buzz every few percent, so the slide is felt in the hand
 *   finished        → a firmer double buzz (in SlideConfirm)
 */
import { vibrate as buzz } from "@/lib/haptics";

/** Thumb touched. */
export const slideGrab = () => buzz(25);

let lastStep = 0;
/** Dragging: progress is 0..1 along the track. */
export function slideDrag(progress: number) {
  const step = Math.floor(progress * 16); // about every 6% of the track (a pulse needs time to play)
  if (step === lastStep) return;
  lastStep = step;
  buzz(20);
}
export const resetSlideDrag = () => {
  lastStep = 0;
};

/** Ask the phone for its location now (the "Allow location?" question), so it is not asked mid-trip. */
export function askForLocation(done?: (state: "ok" | "denied") => void) {
  try {
    if (!("geolocation" in navigator)) return done?.("denied");
    navigator.geolocation.getCurrentPosition(
      () => done?.("ok"),
      (e) => done?.(e.code === 1 ? "denied" : "ok"),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 }
    );
  } catch {
    done?.("denied");
  }
}
