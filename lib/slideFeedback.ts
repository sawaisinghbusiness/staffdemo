"use client";
/**
 * Feedback for the driver's slide buttons: vibration only, no sound.
 *   touch the thumb → one small buzz
 *   dragging        → a very light buzz every few percent, so the slide is felt in the hand
 *   finished        → a firmer double buzz (in SlideConfirm)
 */
const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no vibration on this phone */
  }
};

/** Thumb touched. */
export const slideGrab = () => buzz(12);

let lastStep = 0;
/** Dragging: progress is 0..1 along the track. */
export function slideDrag(progress: number) {
  const step = Math.floor(progress * 24); // about every 4% of the track
  if (step === lastStep) return;
  lastStep = step;
  buzz(8);
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
