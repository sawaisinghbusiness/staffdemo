"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { clock } from "@/lib/format";
import { addDays, DAYS, DAYS_FULL, nowHHMM, todayIso, type Week } from "@/lib/timetable";
import { ErrorCard, ListSkeleton } from "@/components/ui";

/** The teacher's week: pick a day, then a timeline of periods with the class for each. */
export default function TimetablePage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Week>("/my/timetable");
  const [day, setDay] = useState<number | null>(null);
  const [now, setNow] = useState(nowHHMM);
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={5} />;
  }

  const today = data.todayDay;
  const shown = day ?? (today >= 1 && today <= 6 ? today : 1);
  const t = todayIso();
  const monday = today === 0 ? addDays(t, 1) : addDays(t, -(today - 1));
  const cells = data.days[shown] || {};
  const lastUsed = data.periods.reduce((last, p, i) => (cells[p.id] ? i : last), -1);
  const rows = data.periods.slice(0, Math.max(lastUsed + 1, 0));

  return (
    <div className="animate-rise space-y-3">
      <div className="grid grid-cols-6 gap-1.5" role="tablist" aria-label={L({ hi: "दिन", en: "Day" })}>
        {DAYS[lang].map((d, i) => {
          const n = i + 1;
          const on = n === shown;
          return (
            <button key={n} role="tab" aria-selected={on} aria-label={DAYS_FULL[lang][i]} onClick={() => setDay(n)} className={clsx("flex min-h-[54px] flex-col items-center justify-center rounded-xl text-[11.5px] leading-tight", on ? "bg-brand-600 text-brand-100" : "bg-ink-50 text-ink-500")}>
              {d}
              <b className={clsx("tnum text-[16px]", on ? "text-white" : n === today ? "text-brand-600" : "text-ink-900")}>{+addDays(monday, i).slice(8)}</b>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="row-card text-[15px] text-ink-500">{L({ hi: "इस दिन आपकी कोई कक्षा नहीं।", en: "No classes on this day." })}</p>
      ) : (
        <ol aria-label={DAYS_FULL[lang][shown - 1]}>
          {rows.map((p) => {
            const c = cells[p.id];
            const live = shown === today && p.start <= now && now < p.end;
            return (
              <li key={p.id} className="grid grid-cols-[46px_14px_1fr] gap-x-1.5">
                <span className="tnum pt-3.5 text-[13px] text-ink-500">{clock(p.start)}</span>
                <span className="relative" aria-hidden>
                  <span className="absolute inset-y-0 left-[6px] w-0.5 bg-brand-100" />
                  <span className={clsx("absolute left-[2px] top-[18px] h-2.5 w-2.5 rounded-full ring-2 ring-white", p.isBreak || !c ? "bg-ink-300" : "bg-brand-600")} />
                </span>
                <div className={clsx("my-1 rounded-xl border px-3 py-2.5 text-[15px]", p.isBreak ? "border-dashed border-ink-200 bg-ink-50 font-medium text-ink-400" : live ? "border-brand-600 bg-brand-50 font-semibold" : c ? "border-ink-100 font-semibold" : "border-ink-100 font-medium text-ink-400")}>
                  {p.isBreak ? p.label : c ? c.subject : L({ hi: "खाली", en: "Free" })}
                  {c && <span className="ml-1.5 text-[13px] font-normal text-ink-500">{c.classSec}</span>}
                  {live && <span className="ml-1.5 text-[11px] font-bold uppercase text-brand-600">{L({ hi: "अभी", en: "Now" })}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
