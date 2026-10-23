"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";

/**
 * School Sahayak's face: an orange owl in a graduation cap (the user picked "santra narangi",
 * 2026-10-23). It blinks and the cap's tassel sways; it never bounces (the user asked for that).
 * `mood`: "listen" sends a ring out while the mic is on, "think" makes the eyes look around.
 * `crop` trims the empty space around it for small spots (header, floating button).
 * `intro`: when the chat opens it runs in too fast, skids past its spot, looks back and tiptoes back
 * ("brake fail", the user's pick of three, 2026-10-23; globals.css owl-in-c).
 * `alive`: every few seconds it does something by itself so it feels alive (the user's ask, 2026-10-23):
 * waves hello, scratches its head, looks around, tilts its head or turns shy. Still no bouncing.
 */

const MOVES = ["wave", "scratch", "look", "tilt", "shy"] as const;
const MOVE_MS = 1800;

/** Picks a move every 4-8s (never the same twice running), and none while the app is in the background. */
function useIdle(on: boolean, firstAfter: number) {
  const [move, setMove] = useState("");
  useEffect(() => {
    if (!on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let last = "";
    let timer: ReturnType<typeof setTimeout>;
    const next = (wait: number) => {
      timer = setTimeout(() => {
        if (!document.hidden) {
          const pool = MOVES.filter((m) => m !== last);
          last = pool[Math.floor(Math.random() * pool.length)];
          setMove(last);
          timer = setTimeout(() => {
            setMove("");
            next(4000 + Math.random() * 4000);
          }, MOVE_MS);
        } else next(2000);
      }, wait);
    };
    next(firstAfter);
    return () => clearTimeout(timer);
  }, [on, firstAfter]);
  return move;
}

export function SahayakOwl({ size, mood, crop, intro, alive, className }: { size: number; mood?: "listen" | "think"; crop?: boolean; intro?: boolean; alive?: boolean; className?: string }) {
  const body = `owl-${useId().replace(/:/g, "")}`;
  // After the entrance (4s) when there is one; never while listening or thinking.
  const move = useIdle(!!alive && !mood, intro ? 6000 : 2500);
  return (
    <svg
      width={size}
      height={Math.round(size * (crop ? 190 / 160 : 220 / 200))}
      viewBox={crop ? "20 18 160 190" : "0 0 200 220"}
      className={clsx("sahayak-owl shrink-0 overflow-visible", intro && "owl-in-c", move && `owl-do-${move}`, mood === "listen" && "owl-listen", mood === "think" && "owl-think", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={body} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#FFD08F" />
          <stop offset=".55" stopColor="#FF8B3D" />
          <stop offset="1" stopColor="#E2611B" />
        </radialGradient>
      </defs>
      {!crop && (
        <g className="o-shadow">
          <ellipse cx="100" cy="210" rx="46" ry="7" fill="#E2611B" opacity=".18" />
        </g>
      )}
      <circle className="owl-ring" cx="100" cy="122" r="78" fill="none" stroke="#FF8B3D" strokeWidth="4" />
      {intro && <Skid />}
      <g className="o-body">
        <g className="o-run">
          <path d="M52 80 L40 42 L80 66 Z" fill="#D4561A" />
          <path d="M148 80 L160 42 L120 66 Z" fill="#D4561A" />
          <g className="o-wl">
            <ellipse cx="42" cy="136" rx="16" ry="34" fill="#D4561A" transform="rotate(16 42 136)" />
          </g>
          <g className="o-wr">
            <ellipse cx="158" cy="136" rx="16" ry="34" fill="#D4561A" transform="rotate(-16 158 136)" />
          </g>
          <ellipse cx="100" cy="126" rx="66" ry="72" fill={`url(#${body})`} />
          <ellipse cx="74" cy="78" rx="18" ry="8" fill="#fff" opacity=".35" transform="rotate(-25 74 78)" />
          <ellipse cx="100" cy="156" rx="40" ry="36" fill="#FFF4E4" />
          <g fill="none" stroke="#FFD1A1" strokeWidth="2.6" strokeLinecap="round">
            <path d="M83 150 q6 6 12 0" />
            <path d="M105 150 q6 6 12 0" />
            <path d="M94 166 q6 6 12 0" />
          </g>
          <g className="o-cheek" style={{ opacity: 0.5 }}>
            <ellipse cx="56" cy="130" rx="10" ry="6" fill="#FF5D86" />
            <ellipse cx="144" cy="130" rx="10" ry="6" fill="#FF5D86" />
          </g>
          <g className="o-eyes">
            <g className="owl-blink">
              <circle cx="73" cy="106" r="26" fill="#fff" stroke="#FFE3C7" strokeWidth="4" />
              <circle cx="127" cy="106" r="26" fill="#fff" stroke="#FFE3C7" strokeWidth="4" />
              <g className="o-pup">
                <g className="owl-pupils">
                  <circle cx="75" cy="109" r="14" fill="#1C1433" />
                  <circle cx="125" cy="109" r="14" fill="#1C1433" />
                  <circle cx="80" cy="103" r="5" fill="#fff" />
                  <circle cx="130" cy="103" r="5" fill="#fff" />
                  <circle cx="71" cy="114" r="2.2" fill="#fff" />
                  <circle cx="121" cy="114" r="2.2" fill="#fff" />
                </g>
              </g>
            </g>
          </g>
          <path d="M91 126 L109 126 L100 140 Z" fill="#FFD23F" stroke="#E0A800" strokeWidth="1.5" strokeLinejoin="round" />
          <ellipse className="o-fl" cx="86" cy="197" rx="10" ry="5.5" fill="#FFB547" />
          <ellipse className="o-fr" cx="114" cy="197" rx="10" ry="5.5" fill="#FFB547" />
        </g>
      </g>
      <g className="o-cap">
        <g className="o-capin">
          <rect x="78" y="44" width="44" height="14" rx="3" fill="#2A2350" />
          <path d="M100 22 L152 37 L100 52 L48 37 Z" fill="#2A2350" />
          <g className="owl-tassel">
            <path d="M100 37 L140 45 L140 64" stroke="#22B5A5" strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="135" y="62" width="10" height="13" rx="3" fill="#22B5A5" />
          </g>
          <circle cx="100" cy="37" r="4" fill="#22B5A5" />
        </g>
      </g>
    </svg>
  );
}

/** Skid marks and dust behind the owl as it brakes. */
function Skid() {
  return (
    <>
      <g className="o-skid" stroke="#8C84AD" strokeWidth="3" strokeLinecap="round">
        <line x1="-40" y1="203" x2="20" y2="203" />
        <line x1="-30" y1="208" x2="28" y2="208" />
      </g>
      <g className="o-smoke" fill="#E4DDF8">
        <circle cx="22" cy="194" r="12" />
        <circle cx="40" cy="198" r="9" />
        <circle cx="54" cy="192" r="7" />
      </g>
    </>
  );
}
