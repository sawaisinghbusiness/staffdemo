"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { useErpAppearance } from "@/lib/erpAppearance";
import { useActionPalette } from "@/lib/actionPalette";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Check, ChevronDown, Phone, RotateCw, Search, WifiOff, X } from "lucide-react";
import { useDialog } from "@/lib/useDialog";
import { initials } from "@/lib/format";
import { useL } from "@/lib/i18n";

/** Identity uses one neutral pair; semantic colours belong to actual status. */
export const TINTS: [string, string][] = [["#E8EFF7", "#0D2A5E"]];

/** A stable tint for a name, so the same child always gets the same colour. */
export const tintOf = (s: string) => Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length;

export function Avatar({ name, url, size = 48, tint }: { name: string; url?: string | null; size?: number; tint?: number }) {
  const [bg, fg] = TINTS[(tint ?? tintOf(name)) % TINTS.length];
  // A photo replaced in the ERP deletes the old file: if a saved (old) link fails, show initials, not a broken image.
  const [failed, setFailed] = useState<string | null>(null);
  return url && failed !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} onError={() => setFailed(url)} className="shrink-0 rounded-full object-cover object-[50%_22%]" style={{ width: size, height: size }} />
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

/**
 * The red count on anything new and not yet opened, exactly as on Parent Enquiries: "3", or "10+"
 * above ten. Text works too ("New"). Every screen uses this one, so they always look the same.
 */
export function CountBadge({ n, label, className }: { n: number | string; label?: string; className?: string }) {
  return (
    <span className={clsx("grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-[#ff3040] px-1.5 text-[12px] font-bold text-white", className)} aria-label={label}>
      {typeof n === "number" && n > 10 ? "10+" : n}
    </span>
  );
}

export type Tone = "ok" | "bad" | "wait" | "mute";
const TONE_CLASS: Record<Tone, string> = { ok: "status-ok", bad: "status-bad", wait: "status-wait", mute: "status-mute" };

/** Outlined status word: Approved, Pending, Marked. */
export function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={TONE_CLASS[tone]}>{children}</span>;
}

/** The kit's tabs with an underline that slides to the picked tab. */
export function LineTabs<K extends string>({ value, onChange, options, label }: { value: K; onChange: (k: K) => void; options: { key: K; text: React.ReactNode }[]; label: string }) {
  const at = Math.max(0, options.findIndex((o) => o.key === value));
  return (
    <div className="tabs-line relative" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)}>
          {o.text}
        </button>
      ))}
      <span aria-hidden className="tabs-line-bar" style={{ width: `${100 / options.length}%`, transform: `translateX(${at * 100}%)` }} />
    </div>
  );
}

/**
 * Tabs in one row that scrolls sideways when there are many (the student profile). Each tab is as wide as
 * its word; the picked one scrolls into view. Arrow keys move between tabs. Codex owns its final look.
 */
export function ScrollTabs<K extends string>({ value, onChange, options, label }: { value: K; onChange: (k: K) => void; options: { key: K; text: React.ReactNode }[]; label: string }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [value]);
  const move = (by: number) => {
    const i = options.findIndex((o) => o.key === value);
    const next = options[(i + by + options.length) % options.length];
    onChange(next.key);
    requestAnimationFrame(() => row.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };
  return (
    <div
      ref={row}
      className="scroll-tabs flex gap-1 overflow-x-auto border-b border-ink-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.preventDefault(), move(1));
        else if (e.key === "ArrowLeft") (e.preventDefault(), move(-1));
        else if (e.key === "Home") (e.preventDefault(), onChange(options[0].key));
        else if (e.key === "End") (e.preventDefault(), onChange(options[options.length - 1].key));
      }}
    >
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.key)}
            className={clsx("min-h-[46px] shrink-0 whitespace-nowrap border-b-2 px-4 text-[14px] font-semibold", on ? "border-[#0D2A5E] text-[#0D2A5E]" : "border-transparent text-ink-500")}
          >
            {o.text}
          </button>
        );
      })}
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
  const L = useL(); const id = useId();
  const [open,setOpen] = useState(false); const [q,setQ] = useState(""); const [active,setActive] = useState(0);
  const wrap=useRef<HTMLDivElement>(null); const trigger=useRef<HTMLButtonElement>(null); const list=useRef<HTMLUListElement>(null);
  const options=Children.toArray(children).filter(isValidElement).map(o=>{const p=o.props as {value?:string|number;children?:React.ReactNode};return{value:p.value!==undefined?String(p.value):textOf(p.children).trim(),text:textOf(p.children).trim()}});
  const current=options.find(o=>o.value===value); const search=options.length>8;
  const shown=q?options.filter(o=>o.text.toLowerCase().includes(q.trim().toLowerCase())):options;
  const close=useCallback((restore=false)=>{setOpen(false);setQ("");if(restore)requestAnimationFrame(()=>trigger.current?.focus())},[]);
  useEffect(()=>{
    if(!open)return;
    const out=(e:PointerEvent)=>{if(wrap.current&&!wrap.current.contains(e.target as Node))close()};
    document.addEventListener("pointerdown",out);
    const index=Math.max(0,options.findIndex(o=>o.value===value));setActive(index);
    const frame=requestAnimationFrame(()=>list.current?.focus());
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("pointerdown",out)};
  },[open,close]); // Selection is read when the list opens, not on every rerender.
  useEffect(()=>{if(open)list.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)?.scrollIntoView({block:"nearest"})},[active,open]);
  const choose=(index:number)=>{const option=shown[index];if(option){onChange(option.value);close(true)}};
  return <div ref={wrap} className={clsx("relative min-w-0",open&&"z-30")} onKeyDown={e=>{
    if(!open)return;
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close(true)}
    else if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setActive(i=>(i+(e.key==="ArrowDown"?1:-1)+Math.max(1,shown.length))%Math.max(1,shown.length));list.current?.focus()}
    else if(e.key==="Home"&&e.target===list.current){e.preventDefault();setActive(0)}
    else if(e.key==="End"&&e.target===list.current){e.preventDefault();setActive(Math.max(0,shown.length-1))}
    else if((e.key==="Enter"||e.key===" ")&&e.target===list.current){e.preventDefault();choose(active)}
    else if(e.key==="Tab"){close()}
    else if(e.target===list.current&&e.key.length===1&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(search){setQ(text=>text+e.key);setActive(0);requestAnimationFrame(()=>wrap.current?.querySelector<HTMLInputElement>("input")?.focus())}else{const match=shown.findIndex(o=>o.text.toLowerCase().startsWith(e.key.toLowerCase()));if(match>=0)setActive(match)}}
  }}>
    <button ref={trigger} type="button" disabled={!options.length} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={()=>open?close(true):setOpen(true)} onKeyDown={e=>{if(!open&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();setOpen(true)}}} className={clsx("field-box ui-select-trigger text-left disabled:opacity-60",open&&"!border-[#0D2A5E]",className)}>
      <span className="ui-select-copy"><span className="ui-select-label">{label}</span><span className="ui-select-value">{current?.text||"—"}</span></span><ChevronDown aria-hidden className={clsx("shrink-0 transition-transform duration-150",open&&"rotate-180")}/>
    </button>
    {open&&<div className="drop-in absolute inset-x-0 top-full mt-1.5 overflow-hidden rounded-xl border border-ink-900 bg-white shadow-[0_12px_28px_rgba(22,33,58,.16)]">
      {search&&<label className="block border-b border-ink-100 p-2"><span className="sr-only">{L({hi:"खोजें",en:"Search"})}</span><span className="flex min-h-[44px] items-center gap-2 rounded-lg bg-ink-100 px-2.5"><Search size={16} aria-hidden/><input value={q} onChange={e=>{setQ(e.target.value);setActive(0)}} placeholder={L({hi:"खोजें",en:"Search"})} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"/></span></label>}
      <ul id={id} ref={list} role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={shown[active]?`${id}-${active}`:undefined} className="max-h-[264px] overflow-y-auto overscroll-contain py-1 outline-none">
        {!shown.length?<li className="px-3 py-4 text-[14px] text-ink-500">{L({hi:"कुछ नहीं मिला",en:"Nothing found"})}</li>:shown.map((o,i)=><li id={`${id}-${i}`} key={o.value} role="option" aria-selected={o.value===value} data-option-index={i} onPointerMove={()=>setActive(i)} onClick={()=>choose(i)} className={clsx("flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 py-2 text-[15px] leading-snug",i===active&&"bg-ink-100",o.value===value&&"font-semibold")}><span className="min-w-0 flex-1 break-words">{o.text}</span>{o.value===value&&<Check size={16} aria-hidden className="shrink-0"/>}</li>)}
      </ul>
    </div>}
  </div>;
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
      {L({ hi: "नई जानकारी नहीं मिली। सेव की हुई जानकारी दिख रही है।", en: "Could not refresh. Showing saved information." })}
    </div>
  );
}

/** `slow`: the request ran out of time (server slow or waking up), which is not the same as no internet. */
export function ErrorCard({ offline, slow, onRetry }: { offline?: boolean; slow?: boolean; onRetry: () => unknown }) {
  const L = useL();
  return (
    <div className="row-card flex flex-col items-start gap-3 p-4" role="alert">
      <p className="text-ink-700">
        {slow ? L({ hi: "सर्वर जवाब देने में देर कर रहा है। थोड़ी देर में दोबारा कोशिश करें।", en: "The server is taking too long to answer. Please try again in a moment." }) : offline ? L({ hi: "इंटरनेट नहीं है। कनेक्शन आने पर दोबारा कोशिश करें।", en: "No internet. Try again when you are connected." }) : L({ hi: "कुछ गड़बड़ हुई। दोबारा कोशिश करें।", en: "Something went wrong. Please try again." })}
      </p>
      <RetryButton onRetry={onRetry} />
    </div>
  );
}

/**
 * "Try again" that visibly works: it presses in, the icon spins and the label reads "Trying…" until the reload
 * has finished. If the screen is still
 * showing the error afterwards, a short line says so with a small shake, and after two failures
 * "Reopen page" offers a full reload. When the retry works, the error card goes away with this button.
 */
export function RetryButton({ onRetry, className }: { onRetry: () => unknown; className?: string }) {
  const L = useL();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run() {
    if (busy) return;
    setBusy(true);

    try {
      const result = await onRetry();
      if (result === true || (Array.isArray(result) && result.every(v => v === true))) { if(alive.current)setFailed(0); return; }
    } catch {
      /* The owning screen retains its failure. */
    } finally {
      if(alive.current)setBusy(false);
    }

    if (!alive.current) return;
    setBusy(false);
    setFailed((n) => n + 1);
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={clsx("btn-line retry-button min-h-[44px]", className)} onClick={run} disabled={busy} aria-busy={busy}>
          <RotateCw className={clsx("h-4 w-4", busy && "animate-spin")} aria-hidden />
          {busy ? L({ hi: "कोशिश हो रही है…", en: "Trying…" }) : L({ hi: "दोबारा कोशिश करें", en: "Try again" })}
        </button>
        {failed >= 2 && !busy && (
          <button type="button" className="btn-quiet retry-button min-h-[44px]" onClick={() => window.location.reload()}>
            {L({ hi: "पेज दोबारा खोलें", en: "Reopen page" })}
          </button>
        )}
      </div>
      {failed > 0 && !busy && (
        <p key={failed} role="status" className="retry-still text-[13px] text-rose-700">
          {L({ hi: "नई जानकारी नहीं मिली। फिर कोशिश करें या पेज दोबारा खोलें।", en: "Could not refresh. Try again or reopen the page." })}
        </p>
      )}
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

/**
 * Save bar that sits just above the tab bar on long lists (attendance, homework check, marks).
 * Drawn on <body>: the page's entry animation leaves a transform on the page wrapper, which would
 * otherwise pin this "fixed" bar to the end of the list instead of the screen.
 */
export function StickyBar({ children }: { children: React.ReactNode }) {
  const actionPalette = useActionPalette();
  const erpAppearance = useErpAppearance();
  // Count open bars on <body>, so main gets room for the bar (staff-workspace.css) and loses it when the last one goes.
  useEffect(() => {
    const body = document.body;
    const n = Number(body.dataset.saveBars || 0) + 1;
    body.dataset.saveBars = String(n);
    body.classList.add("has-save-bar");
    return () => {
      const left = Number(body.dataset.saveBars || 1) - 1;
      body.dataset.saveBars = String(left);
      if (left <= 0) body.classList.remove("has-save-bar");
    };
  }, []);
  const bar = <div data-action-theme={actionPalette ? "evergreen" : undefined} className={clsx(erpAppearance && "erp-interface", "staff-workspace staff-save-bar fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-[560px] border-t border-ink-100 bg-white px-4 py-2.5")}>{children}</div>;
  return typeof document === "undefined" ? bar : createPortal(bar, document.body);
}

/** Bottom sheet with a grab handle. Closes on the dim area, the X and Escape. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const actionPalette = useActionPalette();
  const erpAppearance = useErpAppearance();
  const L = useL();
  const panel = useRef<HTMLDivElement>(null);
  useDialog(true, panel, onClose);

  return createPortal(
    <div data-action-theme={actionPalette ? "evergreen" : undefined} className={clsx(erpAppearance && "erp-interface", "staff-workspace fixed inset-0 z-50 flex items-end justify-center")} role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 animate-fadeIn bg-night-950/45" onClick={onClose} aria-label={L({ hi: "बंद करें", en: "Close" })} />
      <div ref={panel} tabIndex={-1} className="pb-safe relative max-h-[92dvh] w-full max-w-[560px] animate-slide-up overflow-y-auto rounded-t-[22px] bg-white">
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
