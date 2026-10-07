"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { monthYear, num } from "@/lib/format";
import { ErrorCard, Skeleton } from "./ui";

type Mark = "P" | "A" | "L" | "H";
interface Month {
  month: string;
  today: string;
  days: { date: string; mark: Mark | null; holiday: string | null; sunday: boolean }[];
  totals: { present: number; absent: number; leave: number; half: number };
}

const DOT: Record<Mark | "hol", string> = { P: "bg-jade-600", A: "bg-rose-600", L: "bg-marigold-500", H: "bg-marigold-500", hol: "bg-brand-600" };
const NAME: Record<Mark, { hi: string; en: string }> = {
  P: { hi: "उपस्थित", en: "Present" },
  A: { hi: "अनुपस्थित", en: "Absent" },
  L: { hi: "छुट्टी", en: "Leave" },
  H: { hi: "आधा दिन", en: "Half day" },
};
const WEEK = { hi: ["सो", "मं", "बु", "गु", "शु", "श", "र"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };
const shift = (m: string, by: number) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1)).toISOString().slice(0, 7);
const dayLine = (iso: string, lang: Lang) => new Date(iso + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" });

/** The signed-in staff member's own month, as the office marked it: dot calendar, three counts, the odd days. */
export function MyMonth() {
  const L = useL();
  const { lang } = useLang();
  const [month, setMonth] = useState("");
  const { data, error, reload } = useApi<Month>(`/my/attendance${month ? `?month=${month}` : ""}`);
  const shown = data && (!month || data.month === month) ? data : undefined;

  if (!shown && error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
  const current = shown?.month || month;
  const lead = shown ? (new Date(shown.days[0].date + "T00:00:00").getDay() + 6) % 7 : 0;
  const t = shown?.totals;
  const notes = shown ? shown.days.filter((d) => (d.mark && d.mark !== "P") || (d.holiday && !d.sunday)) : [];

  return (
    <div className="space-y-3.5">
      <section className="cal">
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
                  <Skeleton className="h-6 w-6 rounded-lg bg-ink-200/60" />
                </span>
              ))
            : [
                ...Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />),
                ...shown.days.map((d) => {
                  const isToday = d.date === shown.today;
                  const dot = d.mark ? DOT[d.mark] : d.holiday && !d.sunday ? DOT.hol : null;
                  const dim = d.date > shown.today || d.sunday;
                  return (
                    <span key={d.date} className="relative grid h-11 place-items-center" aria-label={`${dayLine(d.date, lang)}${d.mark ? `: ${L(NAME[d.mark])}` : d.holiday ? `: ${d.holiday}` : ""}`}>
                      <span className={clsx("tnum grid h-8 w-8 place-items-center rounded-[10px] text-[14px]", isToday ? "bg-brand-600 font-bold text-white" : dim ? "text-ink-300" : "text-ink-900")}>{+d.date.slice(8)}</span>
                      {dot && !isToday && <span className={clsx("absolute bottom-0.5 h-[5px] w-[5px] rounded-full", dot)} />}
                    </span>
                  );
                }),
              ]}
        </div>
      </section>

      {t && (
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

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((d) => (
            <li key={d.date} className="flex min-h-[46px] items-center gap-2.5 rounded-xl bg-ink-50 px-3 text-[14px]">
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", d.mark ? DOT[d.mark] : DOT.hol)} aria-hidden />
              <span className="min-w-0 flex-1">
                {d.mark ? L(NAME[d.mark]) : `${L({ hi: "छुट्टी", en: "Holiday" })} · ${d.holiday}`}
                <span className="text-ink-500"> · {dayLine(d.date, lang)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
