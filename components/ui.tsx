"use client";

import clsx from "clsx";
import { Phone, RotateCw, WifiOff } from "lucide-react";
import { initials } from "@/lib/format";
import { useL } from "@/lib/i18n";

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-white/90" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-800 ring-2 ring-white/90" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function OfflineNote({ show }: { show: boolean }) {
  const L = useL();
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-marigold-300/70 bg-marigold-50 px-3 py-2 text-xs font-medium text-ink-700">
      <WifiOff className="h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
      {L({ hi: "इंटरनेट नहीं है। पुरानी जानकारी दिख रही है।", en: "No internet. Showing saved information." })}
    </div>
  );
}

export function ErrorCard({ offline, onRetry }: { offline?: boolean; onRetry: () => void }) {
  const L = useL();
  return (
    <div className="card flex flex-col items-start gap-3 p-5">
      <p className="text-ink-700">
        {offline ? L({ hi: "इंटरनेट नहीं है। कनेक्शन आने पर दोबारा कोशिश करें।", en: "No internet. Try again when you are connected." }) : L({ hi: "कुछ गड़बड़ हुई। दोबारा कोशिश करें।", en: "Something went wrong. Please try again." })}
      </p>
      <button className="btn-quiet" onClick={onRetry}>
        <RotateCw className="h-4 w-4" aria-hidden /> {L({ hi: "दोबारा कोशिश करें", en: "Try again" })}
      </button>
    </div>
  );
}

export function CallOffice({ phone, className }: { phone?: string; className?: string }) {
  const L = useL();
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className={clsx("btn-quiet", className)}>
      <Phone className="h-4 w-4 text-jade-600" aria-hidden /> {L({ hi: "ऑफ़िस को कॉल करें", en: "Call the office" })}
    </a>
  );
}

/** Two or three choices side by side (44px tall), the selected one lifted. */
export function Segments<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { key: T; text: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-2xl bg-ink-200/60 p-1">
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)} className={clsx("min-h-[44px] flex-1 rounded-xl px-2 text-[15px] font-semibold transition", value === o.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-600")}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** Small "‹ back" link at the top of a sub-page. */
export function BackLink({ href, text }: { href: string; text: string }) {
  return (
    <a href={href} className="link -ml-1 text-sm">
      ‹ {text}
    </a>
  );
}
