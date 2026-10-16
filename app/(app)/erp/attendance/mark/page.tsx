"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import type { AttendanceDay, SectionDay } from "@/lib/erpAttendance";
import { ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Attendance → Mark attendance: the ERP's day view (GET /api/attendance/day). Every section of the
 * school for a date, marked or not; tap one to take its roll call. Any past date can be opened and changed.
 */

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
const shift = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
};
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default function ErpMarkAttendancePage() {
  const L = useL();
  const [date, setDate] = useState(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("date")) || todayIso());
  const { data, error, reload } = useApi<AttendanceDay>(`/erp/attendance/day?date=${date}`);
  const day = data && data.date === date ? data : undefined;
  const t = day?.totals;
  const isToday = date === todayIso();
  const byClass = useMemo(() => {
    const m = new Map<string, SectionDay[]>();
    for (const s of day?.sections || []) m.set(s.class, [...(m.get(s.class) || []), s]);
    return Array.from(m.entries());
  }, [day]);
  const dateText = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setDate(shift(date, -1))} aria-label={L({ hi: "पिछला दिन", en: "Previous day" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <label className="field-box flex-1">
          <small>{L({ hi: "तारीख", en: "Date" })}</small>
          <input id="att-date" type="date" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
        <button type="button" onClick={() => setDate(shift(date, 1))} disabled={isToday} aria-label={L({ hi: "अगला दिन", en: "Next day" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white disabled:opacity-40">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p className="text-[13px] text-ink-500">
        {dateText}
        {t ? ` · ${t.sectionsMarked} / ${t.sections} ${L({ hi: "सेक्शन की हाज़िरी लगी", en: "sections marked" })}` : ""}
        {!isToday && (
          <button type="button" onClick={() => setDate(todayIso())} className="ml-2 font-semibold text-brand-600">
            {L({ hi: "आज", en: "Today" })}
          </button>
        )}
      </p>
      {day && (day.sunday || day.holiday) && (
        <p className="flex gap-2 rounded-xl bg-marigold-50 p-3 text-[13.5px] text-ink-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          {day.holiday ? L({ hi: `छुट्टी है (${day.holiday})।`, en: `Holiday (${day.holiday}).` }) : L({ hi: "रविवार है।", en: "It is a Sunday." })} {L({ hi: "स्कूल खुला था तो फिर भी हाज़िरी लगा सकते हैं।", en: "You can still mark attendance if school was open." })}
        </p>
      )}
      {error && !day && error.status !== 401 && <ErrorCard offline={error.status === 0} onRetry={reload} />}

      <div className="grid grid-cols-2 gap-2">
        <Figure label={L({ hi: "उपस्थित", en: "Present" })} value={t ? t.present + t.half : null} note={t && t.marked ? `${pct(t.present + t.half * 0.5, t.marked)}% ${L({ hi: "जिनकी लगी", en: "of those marked" })}` : L({ hi: "अभी किसी की नहीं लगी", en: "Nobody marked yet" })} dot="bg-jade-500" />
        <Figure label={L({ hi: "अनुपस्थित", en: "Absent" })} value={t ? t.absent : null} note={t && t.absent ? L({ hi: "माता-पिता को WhatsApp कर सकते हैं", en: "Parents can be told on WhatsApp" }) : "—"} dot="bg-rose-500" />
        <Figure label={L({ hi: "छुट्टी पर", en: "On leave" })} value={t ? t.leave : null} note={t && t.half ? `${t.half} ${L({ hi: "आधा दिन", en: "half day" })}` : "—"} dot="bg-marigold-400" />
        <Figure label={L({ hi: "बाकी सेक्शन", en: "Sections left" })} value={t ? t.sections - t.sectionsMarked : null} note={t ? `${t.marked.toLocaleString("en-IN")} / ${t.students.toLocaleString("en-IN")} ${L({ hi: "बच्चे", en: "students" })}` : ""} dot="bg-ink-400" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <h2 className="text-[16px] font-bold text-brand-800">{L({ hi: "सेक्शन", en: "Sections" })}</h2>
        <span className="flex items-center gap-3 text-[12px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-jade-600" strokeWidth={3} aria-hidden /> {L({ hi: "लगी", en: "Marked" })}
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-3 w-3 rounded border border-dashed border-ink-400" /> {L({ hi: "बाकी", en: "Not yet" })}
          </span>
        </span>
      </div>
      {!day ? (
        !error ? <ListSkeleton rows={6} /> : null
      ) : (
        <ul>
          {byClass.map(([cls, secs]) => (
            <li key={cls} className="flex items-start gap-3 border-b border-ink-100 py-2.5">
              <span className="w-16 shrink-0 pt-3 text-[13.5px] font-semibold text-ink-700">{cls}</span>
              <div className="flex flex-1 flex-wrap gap-2">
                {secs.map((s) => {
                  const done = s.marked > 0;
                  return (
                    <Link
                      key={s.classSec}
                      href={`/erp/attendance/mark/section/?date=${date}&class=${encodeURIComponent(s.class)}&section=${encodeURIComponent(s.section)}`}
                      className={clsx("min-h-[48px] min-w-[72px] rounded-xl px-2.5 py-1.5", done ? "border border-ink-100 bg-white" : "border border-dashed border-ink-300 bg-ink-50")}
                    >
                      <span className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-[14px] font-semibold">{s.section}</span>
                        {done && <Check className="h-4 w-4 shrink-0 text-jade-600" strokeWidth={3} aria-hidden />}
                      </span>
                      <span className="tnum block text-[12px] text-ink-500">
                        {done ? (
                          <>
                            {s.present + s.half}/{s.students}
                            {s.absent ? <span className="ml-1 font-semibold text-rose-600">−{s.absent}</span> : null}
                          </>
                        ) : (
                          String(s.students)
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Figure({ label, value, note, dot }: { label: string; value: number | null; note: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500">
        <i className={clsx("h-2 w-2 rounded-full", dot)} />
        {label}
      </span>
      <span className="tnum mt-0.5 block text-[22px] font-extrabold">{value === null ? "…" : value.toLocaleString("en-IN")}</span>
      <span className="block truncate text-[12px] text-ink-400">{note}</span>
    </div>
  );
}
