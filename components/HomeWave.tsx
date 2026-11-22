"use client";

import { useEffect, useRef } from "react";

/*
 * Copied from the parent app (components/HomeWave.tsx); keep in step. Staff Home only, not for drivers.
 * Home's bottom wave (user, 2026-11-22): navy rising to the right with a gold stripe on its edge, behind the
 * rounded tab bar. It moves like water:
 *  - at rest it breathes slowly (a few pixels, ~9 s a cycle);
 *  - scrolling stirs it: the faster the scroll, the bigger the swell, which then settles back on its own
 *    (a damped spring), so a gentle scroll gives a ripple and a quick flick a wave.
 * All layers move together, so the gold always rides the navy's edge. Still for people who ask for less motion.
 *
 * Shapes are built from three frames (rest, lower, higher) with the same commands; a single number v blends
 * between them (v = 0 rest, +1 lower frame, −1 higher frame, a little beyond for a strong flick).
 */

type Pts = number[];
// The navy's top edge as numbers: M x y C x y, x y, x y C x y, x y, x y
const EDGE: Pts[] = [
  [0, 30, 80, 34, 140, 58, 200, 56, 270, 54, 340, 40, 400, 26],
  [0, 34, 90, 31, 140, 55, 200, 54, 270, 53, 335, 44, 400, 31],
  [0, 27, 75, 36, 140, 60, 200, 58, 270, 56, 345, 37, 400, 22],
];
const BACK: Pts[] = [
  [0, 30, 90, 22, 190, 34, 270, 30, 330, 27, 370, 16, 400, 8],
  [0, 27, 90, 25, 190, 31, 270, 28, 330, 26, 372, 19, 400, 12],
  [0, 32, 90, 20, 190, 36, 270, 32, 330, 29, 368, 14, 400, 5],
];

const blend = (f: Pts[], v: number) => f[0].map((a, i) => (v >= 0 ? a + (f[1][i] - a) * v : a + (f[2][i] - a) * -v));
const curve = (p: Pts) => `M${p[0]} ${p[1]} C ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]} C ${p[8]} ${p[9]}, ${p[10]} ${p[11]}, ${p[12]} ${p[13]}`;
const gold = (p: Pts) => `M${p[6]} ${p[7]} C ${p[8]} ${p[9]}, ${p[10]} ${p[11]}, ${p[12]} ${p[13]}`;
const close = (d: string) => `${d} L400 72 L0 72 Z`;
const r = (n: number) => Math.round(n * 100) / 100;

export function HomeWave({ pageBg = "#F7F9FC" }: { pageBg?: string }) {
  const back = useRef<SVGPathElement>(null);
  const backBase = useRef<SVGPathElement>(null);
  const navy = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const stripe = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    let pos = 0; // the scroll swell (spring position)
    let vel = 0;
    let lastY = window.scrollY;
    let lastT = last;

    const onScroll = () => {
      const now = performance.now();
      const dy = window.scrollY - lastY;
      // The first event of a new scroll gesture (after a pause) counts as one frame, not the whole pause.
      const gap = now - lastT;
      const dt = gap > 120 ? 16 : Math.max(8, gap);
      lastY = window.scrollY;
      lastT = now;
      // How hard the water is stirred follows the scroll speed (px per ms), not how long you scroll:
      // a slow scroll (~0.2) gives a ripple, a normal one (~1) a swell, a flick (3+) the biggest wave.
      const speed = dy / dt;
      const target = Math.max(-2.2, Math.min(2.2, speed * 1.4));
      vel += (target - pos) * 3;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // damped spring: settles in about two seconds, with one or two softer swells (like water)
      vel += (-16 * pos - 2.4 * vel) * dt;
      pos += vel * dt;
      pos = Math.max(-2.2, Math.min(2.2, pos));
      const breathe = Math.sin((now / 9000) * Math.PI * 2) * 0.85;
      const v = Math.max(-2.4, Math.min(2.4, breathe + pos));
      const e = blend(EDGE, v).map(r);
      const b = blend(BACK, v * 0.7).map(r);
      backBase.current?.setAttribute("d", close(curve(b)));
      back.current?.setAttribute("d", close(curve(b)));
      navy.current?.setAttribute("d", close(curve(e)));
      line.current?.setAttribute("d", curve(e));
      glow.current?.setAttribute("d", gold(e));
      stripe.current?.setAttribute("d", gold(e));
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const e = EDGE[0];
  const b = BACK[0];
  return (
    // 52 px of wave above the tab bar: low enough that it never crowds the last card.
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[19] mx-auto h-[calc(64px+52px+env(safe-area-inset-bottom,0px))] max-w-[560px]">
      <svg viewBox="0 0 400 72" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[52px] w-full overflow-visible">
        <defs>
          <linearGradient id="hw-navy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#173E80" />
            <stop offset="1" stopColor="#0B2250" />
          </linearGradient>
          <linearGradient id="hw-back" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3C6CC0" stopOpacity="0.10" />
            <stop offset="1" stopColor="#3C6CC0" stopOpacity="0.32" />
          </linearGradient>
          <linearGradient id="hw-gold" gradientUnits="userSpaceOnUse" x1="200" y1="0" x2="400" y2="0">
            <stop offset="0" stopColor="#E39A2D" stopOpacity="0" />
            <stop offset="0.3" stopColor="#E8A93A" />
            <stop offset="0.75" stopColor="#F3C259" />
            <stop offset="1" stopColor="#FFD978" />
          </linearGradient>
          <filter id="hw-glow" x="-10%" y="-300%" width="120%" height="700%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        {/* page colour under the see-through blue, so the list scrolling behind does not show through */}
        <path ref={backBase} d={close(curve(b))} fill={pageBg} />
        <path ref={back} d={close(curve(b))} fill="url(#hw-back)" />
        <path ref={navy} d={close(curve(e))} fill="url(#hw-navy)" />
        {/* gold: a line on the navy's edge (fixed width on screen), with a soft glow under it */}
        <g transform="translate(0 -3)">
          <path ref={glow} d={gold(e)} stroke="#F2C45A" strokeOpacity="0.5" strokeWidth="7" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" filter="url(#hw-glow)" />
          <path ref={stripe} d={gold(e)} stroke="url(#hw-gold)" strokeWidth="5" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
        </g>
        {/* a hairline of light along the navy's edge */}
        <path ref={line} d={curve(e)} stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 top-[51px] bg-[#0B2250]" />
    </div>
  );
}
