"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { monthYear, num } from "@/lib/format";
import { ErrorCard, Sheet, Skeleton } from "./ui";

type Mark = "P" | "A" | "L" | "H";
interface Month {
  month: string;
  today: string;
  days: { date: string; mark: Mark | null; holiday: string | null; sunday: boolean }[];
  totals: { present: number; absent: number; leave: number; half: number };
}

// One colour per state, shared by the calendar and the key under it (user's spec, 2026-10-14):
// present green, absent red, leave (and half day) yellow, school holiday blue. The day number on them is
// white, so the fills are deep enough to read it.
const FILL: Record<Mark | "hol", string> = { P: "bg-[#16a34a]", A: "bg-[#dc2626]", L: "bg-[#ca8a04]", H: "bg-[#ca8a04]", hol: "bg-[#2563eb]" };
const NAME: Record<Mark, { hi: string; en: string }> = {
  P: { hi: "उपस्थित", en: "Present" },
  A: { hi: "अनुपस्थित", en: "Absent" },
  L: { hi: "छुट्टी", en: "Leave" },
  H: { hi: "आधा दिन", en: "Half day" },
};
const KEY: { k: Mark | "hol"; text: { hi: string; en: string } }[] = [
  { k: "P", text: NAME.P },
  { k: "A", text: NAME.A },
  { k: "L", text: NAME.L },
  { k: "hol", text: { hi: "स्कूल अवकाश", en: "Holiday" } },
];
const WEEK = { hi: ["सो", "मं", "बु", "गु", "शु", "श", "र"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
const shift = (m: string, by: number) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1)).toISOString().slice(0, 7);
const dayLine = (iso: string, lang: Lang) => new Date(iso + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" });

/**
 * The signed-in staff member's own month, as the office marked it: a calendar where each marked day is a
 * filled colour circle (today, until marked, is an empty black ring), a colour key, and the
 * month's school holidays. `counts` shows the three totals (My Attendance); without it (the Attendance
 * tab's Teacher view) a Monthly report button opens the totals in a sheet instead.
 */
export function MyMonth({ counts = true }: { counts?: boolean }) {
  const L = useL();
  const { lang } = useLang();
  const [month, setMonth] = useState("");
  const [report, setReport] = useState(false);
  const { data, error, reload } = useApi<Month>(`/my/attendance${month ? `?month=${month}` : ""}`);
  const shown = data && (!month || data.month === month) ? data : undefined;

  if (!shown && error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
  const current = shown?.month || month;
  const lead = shown ? (new Date(shown.days[0].date + "T00:00:00").getDay() + 6) % 7 : 0;
  const t = shown?.totals;
  const holidays = shown ? shown.days.filter((d) => d.holiday && !d.sunday) : [];

  return (
    <div className="space-y-3.5">
      {!counts && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setReport(true)}
            disabled={!shown}
            className="flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] border-ink-900 bg-white px-3.5 text-[13.5px] font-semibold text-ink-900 active:bg-ink-100 disabled:opacity-40"
          >
            <FileText className="h-4 w-4" aria-hidden />
            {L({ hi: "मासिक रिपोर्ट", en: "Monthly report" })}
          </button>
        </div>
      )}

      <section className="cal font-title">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(shift(current, -1))} disabled={!shown || current <= "2026-04"} aria-label={L({ hi: "पिछला महीना", en: "Previous month" })} className="grid h-11 w-11 place-items-center rounded-full text-ink-700 active:bg-ink-100 disabled:opacity-25">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className="text-[16px] font-bold">{current ? monthYear(current, lang) : " "}</p>
          <button onClick={() => setMonth(shift(current, 1))} disabled={!shown || current >= shown.today.slice(0, 7)} aria-label={L({ hi: "अगला महीना", en: "Next month" })} className="grid h-11 w-11 place-items-center rounded-full text-ink-700 active:bg-ink-100 disabled:opacity-25">
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
                ...shown.days.map((d) => {
                  const isToday = d.date === shown.today;
                  const state = d.mark || (d.holiday && !d.sunday ? "hol" : null);
                  const dim = d.date > shown.today || d.sunday;
                  return (
                    <span key={d.date} className="relative grid h-11 place-items-center" aria-label={`${dayLine(d.date, lang)}${d.mark ? `: ${L(NAME[d.mark])}` : d.holiday ? `: ${d.holiday}` : ""}`}>
                      {/* Every marked day is a filled circle with white text; today unmarked is an empty black ring. */}
                      <span
                        className={clsx(
                          "tnum grid h-8 w-8 place-items-center rounded-full text-[14.5px] font-semibold",
                          state ? clsx("text-white", FILL[state]) : isToday ? "border-2 border-ink-900 text-ink-900" : dim ? "text-ink-300" : "text-ink-900",
                          isToday && "!font-extrabold"
                        )}
                      >
                        {+d.date.slice(8)}
                      </span>
                    </span>
                  );
                }),
              ]}
        </div>

        {/* The colour key, on one line. */}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-900/10 px-1 pt-3 text-[12.5px] text-ink-700">
          {KEY.map(({ k, text }) => (
            <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", FILL[k])} aria-hidden />
              {L(text)}
            </span>
          ))}
        </div>
      </section>

      {counts && t && (
        <div className="grid grid-cols-3 gap-2">
          {[
            [L({ hi: "उपस्थित", en: "Present" }), t.present + t.half / 2, "bg-jade-50"],
            [L({ hi: "अनुपस्थित", en: "Absent" }), t.absent, "bg-rose-50"],
            [L({ hi: "छुट्टी", en: "Leave" }), t.leave + t.half / 2, "bg-marigold-50"],
          ].map(([k, v, bg]) => (
            <div key={k as string} className={clsx("rounded-2xl px-3 py-2.5", bg as string)}>
              <p className="text-[12px] text-ink-500">{k as string}</p>
              <p className="tnum text-[22px] font-extrabold leading-tight">{num(v as number)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Only the school's holidays this month: no half days or absences here. */}
      {holidays.length > 0 && (
        <section className="pt-3">
          <h2 className="mlabel mb-2">{L({ hi: "इस महीने की स्कूल छुट्टियाँ", en: "School holidays this month" })}</h2>
          <ul className="space-y-2.5">
            {holidays.map((d) => (
              <li key={d.date} className="glass-line card-in flex min-h-[68px] items-center gap-3 !rounded-2xl px-4 py-3">
                <span className={clsx("h-3 w-3 shrink-0 rounded-full", FILL.hol)} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold text-ink-900">{d.holiday}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-500">{dayLine(d.date, lang)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report && shown && t && <Report month={monthYear(shown.month, lang)} t={t} holidays={holidays.length} onClose={() => setReport(false)} />}
    </div>
  );
}

/** The month's totals, opened from the Monthly report button. */
function Report({ month, t, holidays, onClose }: { month: string; t: Month["totals"]; holidays: number; onClose: () => void }) {
  const L = useL();
  const marked = t.present + t.absent + t.leave + t.half;
  const pct = marked ? Math.round(((t.present + t.half / 2) / marked) * 100) : null;
  const rows: [string, number, string][] = [
    [L(NAME.P), t.present, FILL.P],
    [L(NAME.A), t.absent, FILL.A],
    [L(NAME.L), t.leave, FILL.L],
    [L(NAME.H), t.half, FILL.H],
    [L({ hi: "स्कूल छुट्टियाँ", en: "School holidays" }), holidays, FILL.hol],
  ];
  return (
    <Sheet title={`${L({ hi: "मासिक रिपोर्ट", en: "Monthly report" })} · ${month}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between rounded-2xl border-[1.5px] border-ink-900 px-4 py-3.5">
          <span className="text-[14px] text-ink-700">{L({ hi: "हाज़िरी", en: "Attendance" })}</span>
          <span className="tnum text-[28px] font-extrabold leading-none text-ink-900">{pct === null ? "–" : `${pct}%`}</span>
        </div>
        <ul className="divide-y divide-ink-100">
          {rows.map(([k, v, fill]) => (
            <li key={k} className="flex min-h-[48px] items-center gap-3 text-[15px]">
              <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", fill)} aria-hidden />
              <span className="flex-1 text-ink-900">{k}</span>
              <span className="tnum font-bold text-ink-900">{num(v)}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12.5px] text-ink-500">{L({ hi: "आधा दिन, हाज़िरी % में आधा गिना जाता है।", en: "A half day counts as half present in the attendance %." })}</p>
      </div>
    </Sheet>
  );
}
