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
 * Trip end sound ("Fantasy game success" from Mixkit, public/sounds/driver/end.mp3) with a firm buzz.
 * The trip screen leaves at once and only leaves a note; Home plays the sound when it opens and sees the note,
 * so the driver is never kept waiting on the trip screen. Silent if the file is missing.
 */
const END_FLAG = "driver:endSound";
export function markTripEndSound() {
  try {
    sessionStorage.setItem(END_FLAG, "1");
  } catch {
    /* private mode: no end sound */
  }
}
export function playTripEndIfNew() {
  try {
    if (sessionStorage.getItem(END_FLAG) !== "1") return;
    sessionStorage.removeItem(END_FLAG);
  } catch {
    return;
  }
  const a = new Audio("/sounds/driver/end.mp3");
  const play = () => a.play().then(() => void buzz([90, 50, 180]));
  play().catch(() => {
    // Held back because this page has not been touched yet: play on the first touch (next 15 seconds only).
    const t = setTimeout(() => window.removeEventListener("pointerdown", again, true), 15_000);
    function again() {
      clearTimeout(t);
      void play().catch(() => {});
    }
    window.addEventListener("pointerdown", again, { once: true, capture: true });
  });
}

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
  // A firm double buzz with the sound, so the driver feels the trip has begun.
  const play = () => a.play().then(() => void buzz([60, 40, 120]));
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

/**
 * A soft finger-snap on every tap inside the trip screen ("Soft Two-Finger Snap", public/sounds/driver/click.mp3):
 * buttons, links, options, sheets and alerts. The slide handle has its own bump feel and is left out.
 * Call once when the trip screen opens; it returns the function that switches it off again.
 * Silent if the file is missing.
 */
export function startTripClicks(): () => void {
  let buffer: AudioBuffer | null = null;
  let gone = false;
  const c = audio();
  if (c) {
    fetch("/sounds/driver/click.mp3")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((data) => c.decodeAudioData(data))
      .then((b) => {
        if (!gone) buffer = b;
      })
      .catch(() => {
        /* no click file: taps stay silent */
      });
  }
  const onClick = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.("button, a, [role=button], [role=radio], [role=tab], summary, label");
    if (!el || el.closest(".slide-confirm-thumb") || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    const ctx2 = audio();
    if (!ctx2 || !buffer || ctx2.state !== "running") return;
    try {
      const src = ctx2.createBufferSource();
      const gain = ctx2.createGain();
      src.buffer = buffer;
      gain.gain.value = 0.9;
      src.connect(gain);
      gain.connect(ctx2.destination);
      src.start();
      src.onended = () => {
        src.disconnect();
        gain.disconnect();
      };
    } catch {
      /* silent */
    }
  };
  document.addEventListener("click", onClick, true);
  return () => {
    gone = true;
    document.removeEventListener("click", onClick, true);
  };
}
