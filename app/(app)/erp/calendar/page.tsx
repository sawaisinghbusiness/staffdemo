"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { monthYear } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, SelectBox, Sheet, Skeleton } from "@/components/ui";

/*
 * ERP login → Calendar (the ERP roadmap's "Calendar & holidays"): the school's events and holidays from
 * calendar_events (GET /api/calendar?month=). A holiday switches off attendance for those days everywhere; events
 * show in the parent app. Month grid in the staff app's own calendar look (MyMonth): holidays are filled blue
 * circles, days with an event get a dot. The admin adds, edits and deletes.
 */

type CalEvent = { id: string; title: string; category: string; start: string; end: string; isHoliday: boolean; description: string };

const SESSION_START = "2026-04";
const SESSION_END = "2027-03";
const HOL = "bg-[#2563eb]";
const WEEK = { hi: ["सो", "मं", "बु", "गु", "शु", "श", "र"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
const CATS: { k: string; hi: string; en: string }[] = [
  { k: "Event", hi: "कार्यक्रम", en: "Event" },
  { k: "Meeting", hi: "मीटिंग", en: "Meeting" },
  { k: "Exam", hi: "परीक्षा", en: "Exam" },
  { k: "Celebration", hi: "उत्सव", en: "Celebration" },
  { k: "Sports", hi: "खेल", en: "Sports" },
  { k: "Other", hi: "अन्य", en: "Other" },
];
const catName = (k: string, L: (b: { hi: string; en: string }) => string) => (k === "Holiday" ? L({ hi: "छुट्टी", en: "Holiday" }) : L(CATS.find((c) => c.k === k) || { hi: k, en: k }));

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const shift = (m: string, by: number) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1)).toISOString().slice(0, 7);
const daysOf = (m: string) => {
  const n = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`);
};
const fmt = (iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", opts);
const range = (e: CalEvent, lang: Lang) =>
  e.start === e.end ? fmt(e.start, lang, { weekday: "short", day: "numeric", month: "short" }) : `${fmt(e.start, lang, { day: "numeric", month: "short" })} – ${fmt(e.end, lang, { day: "numeric", month: "short" })}`;

export default function ErpCalendarPage() {
  const L = useL();
  const { lang } = useLang();
  const today = todayIST();
  const [month, setMonth] = useState(() => {
    const m = today.slice(0, 7);
    return m < SESSION_START ? SESSION_START : m > SESSION_END ? SESSION_END : m;
  });
  const [picked, setPicked] = useState<string | null>(null);
  const [edit, setEdit] = useState<CalEvent | "new" | null>(null);
  const { data, error, reload } = useApi<{ month: string; data: CalEvent[] }>(`/erp/calendar?month=${month}`);
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";
  const shown = data && data.month === month ? data.data : undefined;

  const days = daysOf(month);
  const lead = (new Date(days[0] + "T00:00:00").getDay() + 6) % 7;
  const on = (d: string) => (shown || []).filter((e) => e.start <= d && e.end >= d);
  const list = useMemo(() => (shown || []).filter((e) => !picked || (e.start <= picked && e.end >= picked)), [shown, picked]);
  const go = (by: number) => {
    setMonth(shift(month, by));
    setPicked(null);
  };

  if (!shown && error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;

  return (
    <div className="animate-rise space-y-3.5 pb-4">
      <section className="cal font-title">
        <div className="flex items-center justify-between">
          <button onClick={() => go(-1)} disabled={month <= SESSION_START} aria-label={L({ hi: "पिछला महीना", en: "Previous month" })} className="grid h-11 w-11 place-items-center rounded-full text-ink-700 active:bg-ink-100 disabled:opacity-25">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className="text-[16px] font-bold">{monthYear(month, lang)}</p>
          <button onClick={() => go(1)} disabled={month >= SESSION_END} aria-label={L({ hi: "अगला महीना", en: "Next month" })} className="grid h-11 w-11 place-items-center rounded-full text-ink-700 active:bg-ink-100 disabled:opacity-25">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {WEEK[lang].map((w) => (
            <span key={w} className="pb-1.5 text-[12px] text-ink-400">
              {w}
            </span>
          ))}
          {!shown
            ? Array.from({ length: 35 }, (_, i) => (
                <span key={i} className="grid h-11 place-items-center">
                  <Skeleton className="h-6 w-6 rounded-full bg-ink-200/60" />
                </span>
              ))
            : [
                ...Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />),
                ...days.map((d) => {
                  const evs = on(d);
                  const hol = evs.some((e) => e.isHoliday);
                  const ev = evs.some((e) => !e.isHoliday);
                  const sunday = new Date(d + "T00:00:00").getDay() === 0;
                  const sel = picked === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPicked(sel ? null : d)}
                      aria-pressed={sel}
                      aria-label={`${fmt(d, lang, { weekday: "long", day: "numeric", month: "long" })}${evs.length ? `: ${evs.map((e) => e.title).join(", ")}` : ""}`}
                      className="relative grid h-11 place-items-center"
                    >
                      <span
                        className={clsx(
                          "tnum grid h-8 w-8 place-items-center rounded-full text-[14.5px] font-semibold",
                          hol ? clsx("text-white", HOL) : d === today ? "border-2 border-ink-900 text-ink-900" : sunday ? "text-ink-300" : "text-ink-900",
                          sel && "ring-2 ring-ink-900 ring-offset-2",
                          d === today && "!font-extrabold"
                        )}
                      >
                        {+d.slice(8)}
                      </span>
                      {ev && <i className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />}
                    </button>
                  );
                }),
              ]}
        </div>
        <div className="mt-2 flex items-center gap-5 border-t border-ink-900/10 px-1 pt-3 text-[12.5px] text-ink-700">
          <span className="flex items-center gap-1.5">
            <span className={clsx("h-2.5 w-2.5 rounded-full", HOL)} aria-hidden />
            {L({ hi: "स्कूल छुट्टी", en: "Holiday" })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
            {L({ hi: "कार्यक्रम", en: "Event" })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-ink-900" aria-hidden />
            {L({ hi: "आज", en: "Today" })}
          </span>
        </div>
      </section>

      <div className="flex items-center justify-between gap-2 pt-1">
        <h2 className="mlabel">
          {picked ? fmt(picked, lang, { weekday: "long", day: "numeric", month: "long" }) : L({ hi: "इस महीने", en: "This month" })}
          {picked && (
            <button type="button" onClick={() => setPicked(null)} className="ml-2 font-semibold normal-case text-brand-600">
              {L({ hi: "पूरा महीना", en: "Whole month" })}
            </button>
          )}
        </h2>
        {isAdmin && (
          <button type="button" onClick={() => setEdit("new")} className="flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] border-ink-900 bg-white px-3.5 text-[13.5px] font-semibold text-ink-900 active:bg-ink-100">
            <Plus className="h-4 w-4" aria-hidden />
            {L({ hi: "जोड़ें", en: "Add" })}
          </button>
        )}
      </div>

      {!shown ? null : !list.length ? (
        <Empty>{picked ? L({ hi: "इस दिन कुछ नहीं है।", en: "Nothing on this day." }) : L({ hi: "इस महीने कोई कार्यक्रम या छुट्टी नहीं है।", en: "No events or holidays this month." })}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setEdit(e)}
                className="glass-line card-in flex min-h-[68px] w-full items-center gap-3 !rounded-2xl px-4 py-3 text-left disabled:cursor-default"
              >
                <span className={clsx("h-3 w-3 shrink-0 rounded-full", e.isHoliday ? HOL : "bg-brand-600")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold text-ink-900">{e.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-500">
                    {range(e, lang)} · {catName(e.category, L)}
                  </span>
                  {e.description && <span className="mt-0.5 block line-clamp-2 text-[13px] text-ink-500">{e.description}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {edit && (
        <EventSheet
          ev={edit === "new" ? null : edit}
          defaultDate={picked || (month === today.slice(0, 7) ? today : `${month}-01`)}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function EventSheet({ ev, defaultDate, onClose, onSaved }: { ev: CalEvent | null; defaultDate: string; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [f, setF] = useState({
    title: ev?.title || "",
    isHoliday: ev?.isHoliday || false,
    category: ev && !ev.isHoliday ? ev.category : "Event",
    start: ev?.start || defaultDate,
    end: ev?.end || defaultDate,
    description: ev?.description || "",
  });
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.title.trim()) return toast(false, L({ hi: "नाम लिखें।", en: "Write a name." }));
    if (!f.start || !f.end || f.end < f.start) return toast(false, L({ hi: "सही तारीखें चुनें।", en: "Choose valid dates." }));
    setBusy(true);
    try {
      if (ev) await api(`/erp/calendar/${ev.id}`, { method: "PATCH", body: f });
      else await api("/erp/calendar", { body: f });
      toast(true, f.isHoliday ? L({ hi: "छुट्टी सेव हुई। इन दिनों हाज़िरी नहीं माँगी जाएगी।", en: "Holiday saved. Attendance is off on these days." }) : L({ hi: "कार्यक्रम सेव हुआ। माता-पिता के ऐप में दिखेगा।", en: "Event saved. Parents see it in their app." }));
      onSaved();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  async function remove() {
    if (!ev) return;
    if (!sure) return setSure(true);
    setBusy(true);
    try {
      await api(`/erp/calendar/${ev.id}`, { method: "DELETE" });
      toast(true, L({ hi: "हटा दिया।", en: "Deleted." }));
      onSaved();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "हटाया नहीं गया।", en: "Could not delete." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={ev ? L({ hi: "बदलें", en: "Edit" }) : L({ hi: "नया कार्यक्रम या छुट्टी", en: "New event or holiday" })} onClose={onClose}>
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={L({ hi: "किस तरह का", en: "Type" })}>
          {(
            [
              [false, L({ hi: "कार्यक्रम", en: "Event" })],
              [true, L({ hi: "स्कूल छुट्टी", en: "Holiday" })],
            ] as const
          ).map(([k, label]) => (
            <button key={String(k)} type="button" role="radio" aria-checked={f.isHoliday === k} onClick={() => set("isHoliday", k)} className={clsx("min-h-[44px] rounded-lg px-2 text-[13.5px] font-semibold", f.isHoliday === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
              {label}
            </button>
          ))}
        </div>
        <label className="field-box">
          <small>{L({ hi: "नाम *", en: "Name *" })}</small>
          <input id="ev-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={f.isHoliday ? "Diwali" : "Annual Sports Day"} />
        </label>
        {!f.isHoliday && (
          <SelectBox label={L({ hi: "किस तरह का", en: "Kind" })} value={f.category} onChange={(v) => set("category", v)}>
            {CATS.map((c) => (
              <option key={c.k} value={c.k}>
                {L(c)}
              </option>
            ))}
          </SelectBox>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field-box">
            <small>{L({ hi: "से *", en: "From *" })}</small>
            <input id="ev-start" type="date" min="2026-04-01" max="2027-03-31" value={f.start} onChange={(e) => setF((p) => ({ ...p, start: e.target.value, end: p.end < e.target.value ? e.target.value : p.end }))} />
            <CalendarDays aria-hidden />
          </label>
          <label className="field-box">
            <small>{L({ hi: "तक *", en: "To *" })}</small>
            <input id="ev-end" type="date" min={f.start} max="2027-03-31" value={f.end} onChange={(e) => set("end", e.target.value)} />
            <CalendarDays aria-hidden />
          </label>
        </div>
        <textarea id="ev-desc" value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className="textarea-box" placeholder={L({ hi: "जानकारी (अगर लिखनी हो)", en: "Details (optional)" })} />
        {f.isHoliday && <p className="text-[12.5px] text-ink-500">{L({ hi: "इन दिनों बच्चों और स्टाफ़ की हाज़िरी नहीं माँगी जाएगी।", en: "Student and staff attendance is not asked for on these days." })}</p>}
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
        </button>
        {ev && (
          <button type="button" onClick={remove} disabled={busy} className={clsx("btn-line w-full", sure && "!border-rose-500 !text-rose-600")}>
            {sure ? L({ hi: "पक्का हटाएँ?", en: "Really delete?" }) : L({ hi: "हटाएँ", en: "Delete" })}
          </button>
        )}
      </div>
    </Sheet>
  );
}
