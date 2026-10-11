"use client";

import clsx from "clsx";
import { initials } from "@/lib/format";

/** A child's photo (or initials) in the green ring. */
export function Face({ name, url, size = 36, grey, plain, className }: { name: string; url?: string | null; size?: number; grey?: boolean; plain?: boolean; className?: string }) {
  // `plain`: only a thin white edge, for faces stacked over each other.
  const ring = plain ? "0 0 0 2px #fff" : grey ? "0 0 0 2px #fff, 0 0 0 3.5px #DCDCD8" : "0 0 0 2px #fff, 0 0 0 3.5px #4DCB7F";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={clsx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size, boxShadow: ring }} />
  ) : (
    <span
      className={clsx("grid shrink-0 place-items-center rounded-full font-semibold", grey ? "bg-drv-soft text-drv-mute" : "bg-[#E9F4EF] text-drv-green", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), boxShadow: ring }}
    >
      {/* Small faces sit stacked over each other: one letter fits, two get cut. */}
      {size < 32 ? initials(name).slice(0, 1) : initials(name)}
    </span>
  );
}

/** Up to four faces overlapping, then "+3". */
export function Faces({ kids, more }: { kids: { name: string; photoUrl: string | null }[]; more: (n: number) => string }) {
  const shown = kids.slice(0, 4);
  return (
    <div className="flex items-center">
      {shown.map((k, i) => (
        <Face key={k.name + i} name={k.name} url={k.photoUrl} size={28} plain className={i ? "-ml-2" : ""} />
      ))}
      {kids.length > shown.length && <span className="ml-2 text-[12px] text-drv-mute">{more(kids.length - shown.length)}</span>}
    </div>
  );
}

/** A map pin, as on the map, for lists and timelines. */
export function Pin({ tone, size = 18 }: { tone: "start" | "end" | "stop"; size?: number }) {
  const [fill, stroke, dot] = tone === "start" ? ["#4DCB7F", "#0F6E57", "#fff"] : tone === "end" ? ["#FFCB00", "#A07800", "#fff"] : ["#fff", "#1A1A1A", "#1A1A1A"];
  return (
    <svg width={size} height={size * 1.27} viewBox="-11 -27 22 28" aria-hidden className="shrink-0">
      <path d="M0 0C-5-7-9-11-9-16a9 9 0 0 1 18 0C9-11 5-7 0 0Z" fill={fill} stroke={stroke} strokeWidth="2" />
      <circle cy="-16" r="3.4" fill={dot} />
    </svg>
  );
}

/** "2:31 PM" from an ISO time. */
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();

/** Two short tones, loud enough over an engine. */
export function ding(times = 1) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    for (let r = 0; r < times; r++)
      [880, 1175].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        o.type = "sine";
        const t = ctx.currentTime + r * 0.7 + i * 0.22;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.22);
      });
    setTimeout(() => ctx.close(), 800 + times * 700);
  } catch {
    /* no sound: the screen and the buzz still show */
  }
}
