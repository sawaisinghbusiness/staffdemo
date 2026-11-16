"use client";
import { useEffect, useRef } from "react";
import { vibrate } from "@/lib/haptics";

/**
 * The moving background of the slide-to-confirm track: a halftone grid of small balls (small at the top,
 * larger towards the bottom, with a slow shimmer running across), like a sports-game button.
 * It reacts for real: triangles near the handle, and near the mouse or finger anywhere on the track, grow and
 * light up, and they cool down slowly afterwards, so the handle leaves a fading trail where it has been.
 * Low cost: about 30 frames a second, stops when off screen or the tab is hidden, and draws one still frame
 * when reduced motion is on.
 */
const CELL = 28; // fewer balls, well spaced

/** One small ball: a filled circle with a shine and, when big enough to read, a curved seam cut out. `u` is its radius. */
function ball(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.beginPath();
  ctx.arc(x, y, u, 0, Math.PI * 2);
  ctx.fill();
  if (u > 2.4) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = Math.max(0.7, u * 0.16);
    ctx.beginPath();
    ctx.arc(x + u * 0.9, y + u * 0.9, u * 1.15, Math.PI * 1.02, Math.PI * 1.48); // seam
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(x - u * 0.35, y - u * 0.38, u * 0.24, 0, Math.PI * 2); // shine
    ctx.fill();
    ctx.restore();
  }
}

export function SlideNet({ tone }: { tone: "dark" | "yellow" }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const track = el?.parentElement;
    const ctx = el?.getContext("2d");
    if (!el || !track || !ctx) return;
    const thumb = track.querySelector<HTMLElement>(".slide-confirm-thumb");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, cols = 0, rows = 0, frame = 0, last = 0, visible = true;
    let heat = new Float32Array(0); // how lit each triangle is, 0..1, cooling over time
    let px = -999, py = -999, pointerOn = false; // mouse or finger over the track
    let lastCell = -1, lastBuzz = 0;

    const size = () => {
      const b = track.getBoundingClientRect();
      w = b.width;
      h = b.height;
      const s = Math.min(devicePixelRatio || 1, 2);
      el.width = Math.round(w * s);
      el.height = Math.round(h * s);
      ctx.setTransform(s, 0, 0, s, 0, 0);
      cols = Math.ceil(w / CELL) + 1;
      rows = Math.ceil(h / CELL) + 1;
      heat = new Float32Array(cols * rows);
    };

    const warm = (x: number, y: number, radius: number, amount: number) => {
      const c0 = Math.max(0, Math.floor((x - radius) / CELL)), c1 = Math.min(cols - 1, Math.ceil((x + radius) / CELL));
      const r0 = Math.max(0, Math.floor((y - radius) / CELL)), r1 = Math.min(rows - 1, Math.ceil((y + radius) / CELL));
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const d = Math.hypot(c * CELL + CELL / 2 - x, r * CELL + CELL / 2 - y);
          const f = Math.pow(Math.max(0, 1 - d / radius), 1.5) * amount;
          const i = r * cols + c;
          if (f > heat[i]) heat[i] = f;
        }
    };

    const draw = (t: number) => {
      frame = 0;
      if (!w || !h) return;
      const done = track.getAttribute("data-complete") === "true";
      const light = tone === "dark" || done;
      const ink = light ? "255,255,255" : "23,37,30";
      const still = reduced.matches;
      const time = still ? 0 : t / 1000;
      // Where the handle really is on screen (its drag position plus the hint glide).
      const tb = track.getBoundingClientRect();
      const hb = thumb?.getBoundingClientRect();
      const hx = hb ? hb.left - tb.left + hb.width / 2 : 29;
      if (!still) {
        warm(hx, h / 2, 46, 1);
        if (pointerOn) warm(px, py, 38, 0.9);
      }
      ctx.clearRect(0, 0, w, h);
      for (let r = 0; r < rows; r++) {
        const depth = rows > 1 ? r / (rows - 1) : 1; // 0 at the top, 1 at the bottom
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          // Only ahead of the handle: nothing is drawn to its left, and the first few fade in.
          const ahead = (c * CELL + CELL / 2 - (hx + 26)) / 16;
          if (ahead <= 0) { heat[i] = 0; continue; }
          const fade = Math.min(1, ahead);
          const hot = heat[i];
          if (!still) heat[i] = hot > 0.004 ? hot * 0.955 : 0; // cool down: this is the trail
          // Lit triangles tremble, as if they feel the finger; the tremble dies away as they cool.
          const shake = still ? 0 : hot * 1.6;
          const cx = c * CELL + CELL / 2 + (r % 2 ? CELL / 2 : 0) + (Math.random() - 0.5) * 2 * shake;
          const cy = r * CELL + CELL / 2 + (Math.random() - 0.5) * 2 * shake;
          // Halftone: bigger towards the bottom, with a slow shimmer moving right.
          const wave = 0.5 + 0.5 * Math.sin(cx / 46 - time * 1.1 + r * 0.5);
          const s = 1.3 + depth * 1.9 + wave * 0.5 + hot * 2.6;
          const alpha = Math.min(0.6, 0.03 + depth * 0.07 + wave * 0.025 + hot * 0.3); // quiet: the label stays easy to read
          ctx.fillStyle = `rgba(${ink},${(alpha * fade).toFixed(3)})`;
          ball(ctx, cx, cy, s);
        }
      }
      if (!still) loop();
    };
    const loop = () => {
      if (frame || !visible || document.hidden) return;
      frame = requestAnimationFrame((t) => {
        frame = 0;
        if (t - last < 32) return loop(); // about 30 frames a second is plenty for a background
        last = t;
        draw(t);
      });
    };

    const onMove = (e: PointerEvent) => {
      const b = track.getBoundingClientRect();
      px = e.clientX - b.left;
      py = e.clientY - b.top;
      pointerOn = true;
      // A tiny buzz each time the finger crosses onto another triangle (phones only; the handle has its own drag feel).
      const cell = Math.floor(py / CELL) * 1000 + Math.floor(px / CELL);
      const now = performance.now();
      if (cell !== lastCell && now - lastBuzz > 45 && track.getAttribute("data-dragging") !== "true" && !reduced.matches) {
        lastCell = cell;
        lastBuzz = now;
        vibrate(8); // a light dot, like the slide ticks
      }
    };
    const onLeave = () => (pointerOn = false);

    size();
    draw(performance.now());
    const ro = new ResizeObserver(() => (size(), draw(performance.now())));
    ro.observe(track);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) loop();
    });
    io.observe(track);
    const onVis = () => !document.hidden && loop();
    document.addEventListener("visibilitychange", onVis);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerdown", onMove);
    track.addEventListener("pointerleave", onLeave);
    track.addEventListener("pointerup", onLeave);
    track.addEventListener("pointercancel", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerdown", onMove);
      track.removeEventListener("pointerleave", onLeave);
      track.removeEventListener("pointerup", onLeave);
      track.removeEventListener("pointercancel", onLeave);
    };
  }, [tone]);

  return <canvas ref={canvas} className="slide-confirm-net" aria-hidden />;
}
