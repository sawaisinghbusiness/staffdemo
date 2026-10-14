"use client";

import { Children, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, ChevronDown, Phone, RotateCw, Search, WifiOff, X } from "lucide-react";
import { initials } from "@/lib/format";
import { useL } from "@/lib/i18n";

/** Soft pastel pairs (background, text) for avatars, subject marks and the home grid. Never the same hue as a status. */
export const TINTS: [string, string][] = [
  ["#E8EFFC", "#103A86"],
  ["#E0F2FE", "#0369A1"],
  ["#DCFCE7", "#15803D"],
  ["#FEF3C7", "#B45309"],
  ["#FCE7F3", "#BE185D"],
  ["#E0E7FF", "#4338CA"],
  ["#FFEDD5", "#C2410C"],
  ["#CCFBF1", "#0F766E"],
];

/** A stable tint for a name, so the same child always gets the same colour. */
export const tintOf = (s: string) => Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length;

export function Avatar({ name, url, size = 48, tint }: { name: string; url?: string | null; size?: number; tint?: number }) {
  const [bg, fg] = TINTS[(tint ?? tintOf(name)) % TINTS.length];
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.34, background: bg, color: fg }}>
      {initials(name)}
    </span>
  );
}

/** The school's logo, or its initials on a violet tile when no logo is set in the ERP. */
export function SchoolMark({ name, url, size = 34 }: { name: string; url?: string | null; size?: number }) {
  const r = Math.round(size * 0.28);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="shrink-0 bg-white object-contain" style={{ width: size, height: size, borderRadius: r }} />
  ) : (
    <span className="grid shrink-0 place-items-center bg-brand-600 font-extrabold tracking-wide text-white" style={{ width: size, height: size, borderRadius: r, fontSize: size * 0.34 }}>
      {name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
    </span>
  );
}

export type Tone = "ok" | "bad" | "wait" | "mute";
const TONE_CLASS: Record<Tone, string> = { ok: "status-ok", bad: "status-bad", wait: "status-wait", mute: "status-mute" };

/** Outlined status word: Approved, Pending, Marked. */
export function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={TONE_CLASS[tone]}>{children}</span>;
}

/** The kit's tabs with an underline. */
export function LineTabs<K extends string>({ value, onChange, options, label }: { value: K; onChange: (k: K) => void; options: { key: K; text: string }[]; label: string }) {
  return (
    <div className="tabs-line" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** Bordered dropdown with its small label inside, as the kit draws it. */
/** Plain text of an <option>'s children ("12", ". ", "Aarav" → "12. Aarav"). */
const textOf = (n: React.ReactNode): string =>
  n == null || typeof n === "boolean" ? "" : typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(textOf).join("") : isValidElement(n) ? textOf((n.props as { children?: React.ReactNode }).children) : "";

/**
 * A field that opens the app's own small list box right under it, instead of the phone's plain dropdown.
 * About six rows show; the rest scroll inside the box. Takes <option> children as before.
 */
export function SelectBox({ label, value, onChange, children, className }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((o) => {
      const p = o.props as { value?: string | number; children?: React.ReactNode };
      const text = textOf(p.children).trim();
      return { value: p.value !== undefined ? String(p.value) : text, text };
    });
  const current = options.find((o) => o.value === value);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);
  const search = options.length > 8;
  const shown = q ? options.filter((o) => o.text.toLowerCase().includes(q.trim().toLowerCase())) : options;

  // A tap outside or Escape closes the box; on opening, the chosen row is scrolled into view.
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", out);
    window.addEventListener("keydown", esc);
    const box = list.current;
    const sel = box?.querySelector<HTMLElement>("[aria-selected='true']");
    if (box && sel) box.scrollTop = sel.offsetTop - box.clientHeight / 2 + sel.offsetHeight / 2;
    return () => {
      document.removeEventListener("pointerdown", out);
      window.removeEventListener("keydown", esc);
    };
  }, [open, close]);

  return (
    <div ref={wrap} className={clsx("relative", open && "z-30")}>
      <button type="button" onClick={() => (open ? close() : setOpen(true))} disabled={!options.length} aria-haspopup="listbox" aria-expanded={open} className={clsx("field-box text-left disabled:opacity-60", open && "!border-[#3099a4]", className)}>
        {/* One line: "Class - 5th B". */}
        <span className="min-w-0 flex-1 truncate text-[15.5px]">
          <span className="text-ink-500">{label} - </span>
          <span className="font-semibold text-ink-900">{current?.text || "—"}</span>
        </span>
        <ChevronDown className={clsx("transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="drop-in absolute inset-x-0 top-full mt-1.5 min-w-[200px] overflow-hidden rounded-xl border-[1.5px] border-ink-900 bg-white shadow-[0_12px_28px_rgba(22,33,58,.16)]">
          {search && (
            <label className="block border-b border-ink-100 p-2">
              <span className="sr-only">{L({ hi: "खोजें", en: "Search" })}</span>
              <span className="flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-2.5">
                <Search className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "खोजें", en: "Search" })} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-400" />
              </span>
            </label>
          )}
          {shown.length === 0 ? (
            <p className="px-3 py-4 text-center text-[14px] text-ink-500">{L({ hi: "कुछ नहीं मिला", en: "Nothing found" })}</p>
          ) : (
            <ul ref={list} role="listbox" aria-label={label} className="max-h-[264px] overflow-y-auto overscroll-contain py-1">
              {shown.map((o) => {
                const on = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        onChange(o.value);
                        close();
                      }}
                      className={clsx("flex min-h-[44px] w-full items-center gap-2.5 px-3 text-left active:bg-ink-100", on && "bg-[#3099a4]/10")}
                    >
                      <span className={clsx("min-w-0 flex-1 truncate text-[15px]", on ? "font-semibold text-[#3099a4]" : "text-ink-900")}>{o.text}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-[#3099a4]" strokeWidth={2.6} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row-card space-y-2">
          <Skeleton className="h-3.5 w-32 bg-ink-200/70" />
          <Skeleton className="h-4 w-3/4 bg-ink-200/70" />
        </div>
      ))}
    </div>
  );
}

export function OfflineNote({ show }: { show: boolean }) {
  const L = useL();
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-marigold-300/70 bg-marigold-50 px-3 py-2 text-sm font-medium text-ink-700">
      <WifiOff className="h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
      {L({ hi: "इंटरनेट नहीं है। पुरानी जानकारी दिख रही है।", en: "No internet. Showing saved information." })}
    </div>
  );
}

export function ErrorCard({ offline, onRetry }: { offline?: boolean; onRetry: () => void }) {
  const L = useL();
  return (
    <div className="row-card flex flex-col items-start gap-3 p-4">
      <p className="text-ink-700">
        {offline ? L({ hi: "इंटरनेट नहीं है। कनेक्शन आने पर दोबारा कोशिश करें।", en: "No internet. Try again when you are connected." }) : L({ hi: "कुछ गड़बड़ हुई। दोबारा कोशिश करें।", en: "Something went wrong. Please try again." })}
      </p>
      <button className="btn-line min-h-[44px]" onClick={onRetry}>
        <RotateCw className="h-4 w-4" aria-hidden /> {L({ hi: "दोबारा कोशिश करें", en: "Try again" })}
      </button>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="row-card py-4 text-[15px] text-ink-500">{children}</p>;
}

export function CallOffice({ phone, className }: { phone?: string; className?: string }) {
  const L = useL();
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className={clsx("btn-line", className)}>
      <Phone className="h-4 w-4" aria-hidden /> {L({ hi: "ऑफ़िस को कॉल करें", en: "Call the office" })}
    </a>
  );
}

/** Save bar that sits just above the tab bar on long lists (attendance, homework check, marks). */
export function StickyBar({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-[560px] border-t border-ink-100 bg-white px-4 py-2.5">{children}</div>;
}

/** Bottom sheet with a grab handle. Closes on the dim area, the X and Escape. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const L = useL();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 animate-fadeIn bg-night-950/45" onClick={onClose} aria-label={L({ hi: "बंद करें", en: "Close" })} />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-[560px] animate-slide-up overflow-y-auto rounded-t-[22px] bg-white">
        <div className="sticky top-0 z-10 bg-white px-4 pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-ink-200" aria-hidden />
          <div className="flex items-center justify-between pb-1 pt-1.5">
            <h2 className="text-[18px] font-bold">{title}</h2>
            <button onClick={onClose} className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink-500 active:bg-ink-100" aria-label={L({ hi: "बंद करें", en: "Close" })}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="px-4 pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
