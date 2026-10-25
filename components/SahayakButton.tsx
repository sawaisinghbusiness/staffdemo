"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SahayakOwl } from "./SahayakOwl";
import { useL } from "@/lib/i18n";

/**
 * The floating School Sahayak button. A tap opens the chat; a drag moves it anywhere, and on letting go it
 * glides to the nearer side (left or right) at that height (the user's ask, 2026-10-23). The spot is kept
 * on this phone. It stays inside the app's column on wide screens and clear of the tab bar.
 */

const SIZE = 56;
const GAP = 16;
const NAV = 64; // the tab bar's height, above the safe area
const KEY = "pa:sahayak-pos";
type Spot = { side: "left" | "right"; bottom: number };

const load = (): Spot => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && (s.side === "left" || s.side === "right") && typeof s.bottom === "number") return s;
  } catch {
    /* nothing kept */
  }
  return { side: "right", bottom: NAV + GAP };
};

/** Left edge of the app's column (560px wide at most, centred). */
const column = () => {
  const w = Math.min(window.innerWidth, 560);
  return { left: (window.innerWidth - w) / 2, width: w };
};

export function SahayakButton() {
  const L = useL();
  const router = useRouter();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [, setSize] = useState(0);
  const touch = useRef<{ id: number; dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null);

  useEffect(() => {
    setSpot(load());
    const resize = () => setSize(window.innerWidth + window.innerHeight);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  if (!spot) return null;

  const col = column();
  const restX = spot.side === "left" ? col.left + GAP : col.left + col.width - GAP - SIZE;
  const maxBottom = window.innerHeight - SIZE - 120; // clear of the top bar
  const bottom = Math.min(Math.max(spot.bottom, NAV + GAP), maxBottom);
  const restY = window.innerHeight - bottom - SIZE;

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    touch.current = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    if (!t.moved && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < 8) return;
    t.moved = true;
    setDrag({ x: e.clientX - t.dx, y: e.clientY - t.dy });
  }
  function up(e: React.PointerEvent) {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    touch.current = null;
    if (!t.moved) {
      router.push("/assistant/");
      return;
    }
    const x = e.clientX - t.dx + SIZE / 2;
    const next: Spot = {
      side: x < col.left + col.width / 2 ? "left" : "right",
      bottom: Math.min(Math.max(window.innerHeight - (e.clientY - t.dy) - SIZE, NAV + GAP), maxBottom),
    };
    setDrag(null);
    setSpot(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* not kept: fine */
    }
  }

  const x = drag ? drag.x : restX;
  const y = drag ? drag.y : restY;
  return (
    <button
      type="button"
      data-swipe
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        touch.current = null;
        setDrag(null);
      }}
      aria-label={L({ hi: "स्कूल सहायक से पूछें", en: "Ask School Sahayak" })}
      className="fixed left-0 top-0 z-20 grid place-items-center overflow-hidden rounded-full border-[3px] border-white bg-[#FFF4E4] shadow-[0_8px_20px_rgba(226,97,27,0.35)] active:scale-95"
      style={{
        width: SIZE,
        height: SIZE,
        touchAction: "none",
        // Resting, it keeps clear of the phone's bottom bar too; while dragged it sits under the finger.
        transform: drag ? `translate3d(${x}px, ${y}px, 0) scale(1.08)` : `translate3d(${x}px, calc(${y}px - env(safe-area-inset-bottom, 0px)), 0)`,
        transition: drag ? "none" : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* The same owl as on the chat screen, small and still (no bouncing). */}
      <SahayakOwl size={40} crop alive />
    </button>
  );
}
