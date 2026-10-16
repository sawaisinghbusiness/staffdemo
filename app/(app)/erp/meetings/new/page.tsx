"use client";

import { useState } from "react";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { SelectBox } from "@/components/ui";

/*
 * ERP login → New meeting: the ERP's meeting form (POST /api/meetings). A PTM is cut into time slots parents pick
 * in the parent app; a general meeting just asks "I'll come / Can't come". Parents of the chosen class see it at once.
 */

interface ClassItem {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default function ErpNewMeetingPage() {
  const L = useL();
  const cls = useApi<{ data: ClassItem[] }>("/erp/classes");
  const classes = cls.data?.data || [];
  const t = todayIST();
  const [f, setF] = useState({ title: "", kind: "ptm" as "ptm" | "general", className: "", section: "", host: "", date: t, start: "10:00", end: "12:00", slotMinutes: "10", place: "", onlineUrl: "", agenda: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const sections = classes.find((c) => c.name === f.className)?.sections || [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return toast(false, L({ hi: "मीटिंग का नाम लिखें।", en: "Write the meeting's title." }));
    if (!f.date || !f.start || !f.end) return toast(false, L({ hi: "तारीख और समय भरें।", en: "Fill in the date and time." }));
    setBusy(true);
    try {
      await api("/erp/meetings", { body: { ...f, slotMinutes: Number(f.slotMinutes) } });
      toast(true, L({ hi: "मीटिंग माता-पिता के ऐप में भेज दी।", en: "Meeting sent to parents' app." }));
      window.location.replace("/erp/meetings/");
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  const text = (k: keyof typeof f, label: string, placeholder?: string) => (
    <label className="field-box">
      <small>{label}</small>
      <input id={`mt-${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </label>
  );

  return (
    <form onSubmit={save} noValidate className="animate-rise space-y-3 pb-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={L({ hi: "किस तरह की", en: "Type" })}>
        {(
          [
            ["ptm", L({ hi: "PTM · माता-पिता समय चुनें", en: "PTM · parents pick a time" })],
            ["general", L({ hi: "मीटिंग · हाँ / नहीं", en: "Meeting · yes / no" })],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set("kind", k)} className={clsx("min-h-[44px] rounded-lg px-2 text-[13px] font-semibold", f.kind === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
            {label}
          </button>
        ))}
      </div>
      {text("title", L({ hi: "नाम *", en: "Title *" }), f.kind === "ptm" ? "Parent-Teacher Meeting" : "Annual Day planning")}
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={f.className} onChange={(v) => setF((p) => ({ ...p, className: v, section: "" }))}>
          <option value="">{L({ hi: "सभी माता-पिता", en: "All parents" })}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={f.section} onChange={(v) => set("section", v)}>
          <option value="">{L({ hi: "सभी", en: "All" })}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </SelectBox>
      </div>
      <label className="field-box">
        <small>{L({ hi: "तारीख *", en: "Date *" })}</small>
        <input id="mt-date" type="date" min={t} value={f.date} onChange={(e) => set("date", e.target.value)} />
        <CalendarDays aria-hidden />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="field-box">
          <small>{L({ hi: "से *", en: "From *" })}</small>
          <input id="mt-start" type="time" value={f.start} onChange={(e) => set("start", e.target.value)} />
        </label>
        <label className="field-box">
          <small>{L({ hi: "तक *", en: "To *" })}</small>
          <input id="mt-end" type="time" value={f.end} onChange={(e) => set("end", e.target.value)} />
        </label>
      </div>
      {f.kind === "ptm" && (
        <SelectBox label={L({ hi: "हर परिवार को", en: "Minutes per family" })} value={f.slotMinutes} onChange={(v) => set("slotMinutes", v)}>
          {[5, 10, 15, 20, 30].map((n) => (
            <option key={n} value={String(n)}>
              {n} {L({ hi: "मिनट", en: "minutes" })}
            </option>
          ))}
        </SelectBox>
      )}
      {text("host", L({ hi: "किनके साथ (टीचर / प्रिंसिपल)", en: "With (teacher / principal)" }), "Neha Sharma")}
      {text("place", L({ hi: "जगह", en: "Place" }), "Room 4")}
      {text("onlineUrl", L({ hi: "ऑनलाइन लिंक (अगर हो)", en: "Online link (optional)" }), "https://meet.google.com/…")}
      <textarea id="mt-agenda" value={f.agenda} onChange={(e) => set("agenda", e.target.value)} rows={3} className="textarea-box" placeholder={L({ hi: "किस बारे में (अगर लिखना हो)", en: "Agenda (optional)" })} />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "…" : L({ hi: "माता-पिता को भेजें", en: "Send to parents" })}
      </button>
    </form>
  );
}
