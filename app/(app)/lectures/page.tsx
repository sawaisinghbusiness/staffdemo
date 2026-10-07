"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Clock3 } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { clock, fullDate } from "@/lib/format";
import { DAYS_FULL, nowHHMM, todayIso, type Week } from "@/lib/timetable";
import { ErrorCard, ListSkeleton } from "@/components/ui";

/** Every period today, free ones included; the one going on now is outlined. */
export default function LecturesPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Week>("/my/timetable");
  const [now, setNow] = useState(nowHHMM);
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={5} />;
  }
  const day = data.todayDay;
  const cells = day ? data.days[day] || {} : {};
  const lessons = data.periods.filter((p) => !p.isBreak);
  const lastUsed = lessons.reduce((last, p, i) => (cells[p.id] ? i : last), -1);
  const rows = lessons.slice(0, lastUsed + 1);

  return (
    <div className="animate-rise space-y-2.5">
      <p className="mlabel">
        {day ? `${DAYS_FULL[lang][day - 1]}, ` : ""}
        {fullDate(todayIso(), lang)}
      </p>
      {rows.length === 0 ? (
        <p className="row-card text-[15px] text-ink-500">{L({ hi: "आज आपकी कोई कक्षा नहीं है।", en: "You have no classes today." })}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const c = cells[p.id];
            const live = p.start <= now && now < p.end;
            const over = p.end <= now;
            return (
              <li key={p.id} className={clsx("rounded-2xl px-3.5 py-3", live ? "bg-brand-50 ring-[1.5px] ring-inset ring-brand-600" : "bg-ink-50", (over || !c) && !live && "text-ink-400")}>
                <p className="text-[15.5px] font-bold">
                  {c ? `${c.subject} · ${c.classSec}` : L({ hi: "खाली पीरियड", en: "Free period" })}
                  {live && <span className="ml-1.5 text-[11px] font-bold uppercase text-brand-600">{L({ hi: "अभी", en: "Now" })}</span>}
                  {over && c && <span className="ml-1.5 text-[12px] font-medium">{L({ hi: "हो गई", en: "done" })}</span>}
                </p>
                <p className="meta mt-1">
                  <span>
                    <Clock3 aria-hidden />
                    {clock(p.start)} – {clock(p.end)} · {p.label}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
