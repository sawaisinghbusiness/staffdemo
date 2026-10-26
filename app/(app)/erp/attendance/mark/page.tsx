"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import type { AttendanceDay } from "@/lib/erpAttendance";
import { ErpRollCall } from "@/components/erp/ErpRollCall";
import { ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

/*
 * ERP login → Attendance → Mark attendance (user's layout, 2026-10-26): the date, then Class and Section boxes
 * like the Students page (Nursery A to start), then that section's roll call in the teacher app's look with
 * Save at the end. ?date=&class=&section= opens a given section (Report and Today link here).
 */

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
const shift = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
};

export default function ErpMarkAttendancePage() {
  const L = useL();
  const [date, setDate] = useState(todayIso);
  const [cls, setCls] = useState("");
  const [sec, setSec] = useState("");
  const { data, error, reload } = useApi<AttendanceDay>(`/erp/attendance/day?date=${date}`);
  const day = data && data.date === date ? data : undefined;
  const isToday = date === todayIso();

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const d = qs.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
    setCls(qs.get("class") || "");
    setSec(qs.get("section") || "");
  }, []);

  const classes = useMemo(() => Array.from(new Set((day?.sections || []).map((s) => s.class))), [day]);
  const sections = useMemo(() => (day?.sections || []).filter((s) => s.class === cls).map((s) => s.section), [day, cls]);

  // Start on the first class (Nursery) and its first section (A), or keep the one asked for if it exists.
  useEffect(() => {
    if (!classes.length) return;
    if (!classes.includes(cls)) {
      const first = classes[0];
      setCls(first);
      setSec(day!.sections.find((s) => s.class === first)?.section || "");
    } else if (!sections.includes(sec)) setSec(sections[0] || "");
  }, [classes, sections, cls, sec, day]);

  return (
    <div className="animate-rise space-y-3 pb-6">
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

      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox
          label={L({ hi: "कक्षा", en: "Class" })}
          value={cls}
          onChange={(v) => {
            setCls(v);
            setSec(day?.sections.find((s) => s.class === v)?.section || "");
          }}
        >
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sec} onChange={setSec}>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectBox>
      </div>

      {day && (day.sunday || day.holiday) && (
        <p className="flex gap-2 rounded-xl bg-marigold-50 p-3 text-[13.5px] text-ink-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          {day.holiday ? L({ hi: `छुट्टी है (${day.holiday})।`, en: `Holiday (${day.holiday}).` }) : L({ hi: "रविवार है।", en: "It is a Sunday." })} {L({ hi: "स्कूल खुला था तो फिर भी हाज़िरी लगा सकते हैं।", en: "You can still mark attendance if school was open." })}
        </p>
      )}

      {!day ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={8} />
      ) : cls && sec && sections.includes(sec) ? (
        <ErpRollCall key={`${date}|${cls}|${sec}`} date={date} cls={cls} sec={sec} onSaved={reload} />
      ) : null}
    </div>
  );
}
