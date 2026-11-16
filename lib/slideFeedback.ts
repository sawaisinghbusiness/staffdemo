"use client";
/**
 * Feedback for the driver's slide buttons.
 *   touch the thumb → the first tick of the slide sound, with a tiny buzz
 *   dragging right  → the next ticks, one by one, each with its own tiny buzz at the same moment
 *   finished        → a firmer buzz (in SlideConfirm)
 */
import { vibrate as buzz } from "@/lib/haptics";

/*
 * The slide sound (public/sounds/driver/slide.mp3, 0.82 s) is a ratchet of ticks. Single ticks are cut from it
 * and played when the handle reaches its place on the track, and the phone gives one short, light buzz with
 * every tick (a "dot", not a long rumble). Sliding back and forward again plays the ticks again.
 */
let ctx: AudioContext | null = null;
let slideBuf: AudioBuffer | null = null;
let loading = false;

function audio(): AudioContext | null {
  try {
    if (!ctx || ctx.state === "closed") {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Load the slide sound ahead of the first touch (called when a slide button appears). Silent if missing. */
export function preloadSlideSound() {
  if (slideBuf || loading) return;
  const c = audio();
  if (!c) return;
  loading = true;
  fetch("/sounds/driver/slide.mp3")
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((data) => c.decodeAudioData(data))
    .then((b) => void (slideBuf = b))
    .catch(() => {
      /* no file: the buzzes still come */
    })
    .finally(() => void (loading = false));
}

/*
 * Only 5 ticks over the whole slide (user, 2026-11-16: "4-5 hi, rabar jaisa"), evenly spaced up to the
 * confirm point, like notches felt while stretching a rubber band. Each one is a single tick cut from the file
 * (start in ms, the next tick in the file in ms). They get a little louder and a little firmer as the band
 * tightens.
 */
const TICKS: [number, number][] = [
  [20, 50], [105, 140], [230, 285], [440, 540], [680, 0],
];
const DONE_AT = 0.88; // the slide confirms at 88% of the track
const AT = TICKS.map((_, i) => (i / (TICKS.length - 1)) * DONE_AT); // 0, 0.22, 0.44, 0.66, 0.88
// Very soft (user, 2026-11-16): every tick at 10% volume.
const VOLUME = 0.1;

/**
 * Buzz for tick i: 20 ms at the start, up to 30 ms at the end. Shorter pulses (8-12 ms) were not felt at all on
 * the driver's phone (user, 2026-11-16), so this is the shortest that is still a clear "dot".
 */
const buzzMs = (i: number) => Math.round(20 + (10 * i) / (TICKS.length - 1));

/*
 * Slow slide → every tick is felt and heard, one by one. Quick flick → only the one light tick from touching the
 * handle; the ticks it races past stay silent and still (user, 2026-11-16). "Quick" = the handle is moving faster
 * than the whole slide in about 0.6 s, or it jumped past more than one tick at once.
 */
const FAST = DONE_AT / 600; // track per ms

/** Play tick i of the slide sound now. */
function playTick(i: number) {
  const c = audio();
  if (!c || !slideBuf || c.state !== "running") return;
  try {
    const start = Math.max(0, TICKS[i][0] - 4) / 1000;
    const nextAt = TICKS[i][1] ? TICKS[i][1] / 1000 : start + 0.09;
    const len = Math.min(0.07, nextAt - start - 0.002);
    const t = c.currentTime;
    const src = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = slideBuf;
    gain.gain.setValueAtTime(VOLUME, t);
    gain.gain.setValueAtTime(VOLUME, t + len * 0.6);
    gain.gain.linearRampToValueAtTime(0.0001, t + len); // fade the tail so it doesn't click
    src.connect(gain);
    gain.connect(c.destination);
    src.start(t, start, len);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
  } catch {
    /* no sound: the buzz still comes */
  }
}

/** One tick: its sound and its buzz together. */
function tick(i: number) {
  playTick(i);
  buzz(buzzMs(i));
}

let played = -1; // the last tick passed on this slide (heard or not)
let lastP = 0;
let lastT = 0;
let speed = 0; // smoothed, track per ms

/** Thumb touched: the first tick, and the audio is switched on by this tap. */
export function slideGrab() {
  audio();
  preloadSlideSound();
  played = 0;
  lastP = 0;
  lastT = performance.now();
  speed = 0;
  tick(0);
}

/** Dragging: progress is 0..1 along the track. */
export function slideDrag(progress: number) {
  const now = performance.now();
  const dt = Math.max(1, now - lastT);
  speed = speed * 0.5 + (Math.max(0, progress - lastP) / dt) * 0.5;
  lastP = progress;
  lastT = now;
  // Slid back past a tick: it can play again on the way forward.
  while (played > 0 && progress < AT[played] - 0.03) played--;
  let reach = played;
  while (reach + 1 < TICKS.length && progress >= AT[reach + 1]) reach++;
  if (reach <= played) return;
  const quick = reach - played > 1 || speed > FAST;
  played = reach;
  if (!quick) tick(reach);
}
export const resetSlideDrag = () => {
  played = -1;
  speed = 0;
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
  a.volume = 0.5; // a little softer (user, 2026-11-16)
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
      gain.gain.value = 0.63; // 70% of what it was (user, 2026-11-16)
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
