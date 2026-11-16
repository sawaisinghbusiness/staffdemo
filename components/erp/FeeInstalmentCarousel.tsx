"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useL } from "@/lib/i18n";

/** Browsing instalments never changes the cashier's amount or payment allocation. */
export function FeeInstalmentCarousel({ children, labels, initialIndex = 0 }: {
  children: ReactNode[]; labels: string[]; initialIndex?: number;
}) {
  const L = useL();
  const start = Math.max(0, Math.min(initialIndex, children.length - 1));
  const [active, setActive] = useState(start);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    const slide = el?.children[start] as HTMLElement | undefined;
    if (el && slide) el.scrollLeft = slide.offsetLeft;
    setActive(start);
  }, [start]);

  function go(index: number) {
    const el = track.current;
    const slide = el?.children[index] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  if (!children.length) return null;
  return (
    <section className="fee-carousel mt-4" aria-label={L({ hi: "फीस की किस्तें", en: "Fee instalments" })} aria-roledescription="carousel" data-swipe>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-500" aria-live="polite" aria-atomic="true">
          {labels[active]} <span aria-hidden>·</span> {active + 1}/{children.length}
        </p>
        <div className="flex gap-1">
          <button type="button" className="fee-carousel-arrow" disabled={active === 0} onClick={() => go(active - 1)} aria-label={L({ hi: "पिछली किस्त", en: "Previous instalment" })}><ChevronLeft size={18} aria-hidden /></button>
          <button type="button" className="fee-carousel-arrow" disabled={active === children.length - 1} onClick={() => go(active + 1)} aria-label={L({ hi: "अगली किस्त", en: "Next instalment" })}><ChevronRight size={18} aria-hidden /></button>
        </div>
      </div>
      <div ref={track} className="fee-carousel-track" tabIndex={0} aria-label={L({ hi: "किस्त बदलने के लिए बाएँ या दाएँ स्वाइप करें", en: "Swipe left or right to browse instalments" })}
        onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(Math.max(0, Math.min(children.length - 1, active + (e.key === "ArrowRight" ? 1 : -1)))); } }}
        onScroll={() => { const el = track.current; if (!el) return; let closest = 0, distance = Infinity; Array.from(el.children).forEach((child, i) => { const d = Math.abs((child as HTMLElement).offsetLeft - el.scrollLeft); if (d < distance) { distance = d; closest = i; } }); setActive(closest); }}>
        {children.map((child, i) => <div key={i} className="fee-carousel-slide" role="group" aria-roledescription="slide" aria-label={`${labels[i]}, ${i + 1}/${children.length}`} aria-hidden={i !== active}>{child}</div>)}
      </div>
      <div className="fee-carousel-position" aria-hidden>{children.map((_, i) => <span key={i} data-active={i === active} />)}</div>
    </section>
  );
}
