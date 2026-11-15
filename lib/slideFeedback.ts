"use client";
/**
 * Feedback for the driver's slide buttons: vibration only, no sound.
 *   touch the thumb → one small buzz
 *   dragging        → bumps: uneven buzzes with a very quiet thud, like dragging an object over a rough surface
 *   finished        → a firmer double buzz (in SlideConfirm), no sound
 */
import { vibrate as buzz } from "@/lib/haptics";

/*
 * Dragging the thumb feels like pulling an object over a bumpy surface: while it moves, every 9 to 20 px
 * (never the same twice) there is a bump, a short uneven buzz plus a very quiet low thud. Stand still and it
 * is silent and still. The thuds are kept quiet on purpose (the cab is not a gaming console).
 */
let ctx: AudioContext | null = null;
let thud: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx || ctx.state === "closed") {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    if (!thud) {
      const n = Math.floor(ctx.sampleRate * 0.07);
      thud = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = thud.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch {
    return null;
  }
}

/** One low thud, a different weight each time. `strength` is 0..1. */
function playThud(strength: number) {
  const c = audio();
  if (!c || !thud || c.state !== "running") return;
  try {
    const t = c.currentTime;
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = thud;
    filter.type = "lowpass";
    filter.frequency.value = 220 + strength * 380;
    const peak = 0.025 + strength * 0.05; // quiet: at most about 7% of full volume
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
    src.stop(t + 0.07);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  } catch {
    /* no sound: the buzz still comes */
  }
}

const TRACK_PX = 300; // roughly one slide; only used to turn progress into distance
let moved = 0;
let nextBump = 12;
let lastProgress: number | null = null;

/** Thumb touched: a small buzz, and the audio is switched on by this tap. */
export function slideGrab() {
  audio();
  buzz(25);
}

/** Dragging: progress is 0..1 along the track. */
export function slideDrag(progress: number) {
  if (lastProgress === null) {
    lastProgress = progress;
    return;
  }
  moved += Math.abs(progress - lastProgress) * TRACK_PX;
  lastProgress = progress;
  if (moved < nextBump) return;
  moved = 0;
  nextBump = 9 + Math.random() * 11;
  const strength = Math.random();
  buzz([Math.round(16 + strength * 16)]); // 16..32 ms, uneven like gravel
  playThud(strength);
}
export const resetSlideDrag = () => {
  moved = 0;
  nextBump = 12;
  lastProgress = null;
};

/**
 * The one sound in the driver app: when the trip ends ("Electro success sound", public/sounds/driver/end.mp3).
 * Resolves after the sound has had time to play, so the screen can leave afterwards. Silent if the file is missing.
 */
export function playTripEnd(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const a = new Audio("/sounds/driver/end.mp3");
      a.volume = 1;
      const done = () => resolve();
      a.addEventListener("ended", done, { once: true });
      a.addEventListener("error", done, { once: true });
      setTimeout(done, 2500); // never hold the driver on this screen
      void a.play().catch(done);
    } catch {
      resolve();
    }
  });
}

/**
 * Trip start sound ("success_low", public/sounds/driver/start.mp3). It plays when the trip screen has loaded,
 * not while the thumb is still sliding on the Home screen: the slide only leaves a note, and the trip screen
 * plays the sound once when it sees the note. Silent if the file is missing.
 */
const START_FLAG = "driver:startSound";
export function markTripStartSound() {
  try {
    sessionStorage.setItem(START_FLAG, "1");
  } catch {
    /* private mode: no start sound */
  }
}
export function playTripStartIfNew() {
  try {
    if (sessionStorage.getItem(START_FLAG) !== "1") return;
    sessionStorage.removeItem(START_FLAG);
  } catch {
    return;
  }
  const a = new Audio("/sounds/driver/start.mp3");
  const play = () => a.play();
  play().catch(() => {
    // The phone held the sound back because the new page has not been touched yet: play it on the first touch
    // (for the next 15 seconds only), so it is still heard.
    const t = setTimeout(() => window.removeEventListener("pointerdown", again, true), 15_000);
    function again() {
      clearTimeout(t);
      void play().catch(() => {});
    }
    window.addEventListener("pointerdown", again, { once: true, capture: true });
  });
}

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
