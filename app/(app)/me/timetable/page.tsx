"use client";

import { useState } from "react";
import clsx from "clsx";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { BackLink, ErrorCard, Skeleton } from "@/components/ui";

interface Week {
  periods: { id: string; label: string; start: string; end: string; isBreak: boolean }[];
  days: Record<string, Record<string, { classSec: string; subject: string }>>;
  todayDay: number;
}
const DAYS = {
  hi: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export default function MyTimetablePage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Week>("/my/timetable");
  const [picked, setPicked] = useState<number | null>(null);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-64 w-full" />;
  const day = picked ?? (data.todayDay >= 1 ? data.todayDay : 1);
  const cells = data.days[day] || {};

  return (
    <div className="animate-rise space-y-3">
      <BackLink href="/me/" text={L({ hi: "मेरा", en: "Me" })} />
      <h1 className="text-xl font-bold">{L({ hi: "मेरी टाइम टेबल", en: "My timetable" })}</h1>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist">
        {DAYS[lang].map((d, i) => {
          const n = i + 1;
          return (
            <button key={d} role="tab" aria-selected={day === n} onClick={() => setPicked(n)} className={clsx("min-h-[44px] min-w-[58px] shrink-0 rounded-xl px-3 text-[15px] font-semibold", day === n ? "bg-night-900 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200")}>
              {d}
              {data.todayDay === n && <span className="ml-1 text-marigold-400">●</span>}
            </button>
          );
        })}
      </div>
      <section className="card p-4">
        <ul className="divide-y divide-ink-100">
          {data.periods.map((p) =>
            p.isBreak ? (
              <li key={p.id} className="py-2 text-center text-sm text-ink-400">
                {p.label} · {p.start}–{p.end}
              </li>
            ) : (
              <li key={p.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                <span className="tnum w-[112px] shrink-0 whitespace-nowrap text-sm text-ink-500">
                  {p.start}–{p.end}
                </span>
                {cells[p.id] ? (
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-900">{cells[p.id].classSec}</span>
                    <span className="block text-sm text-ink-600">{cells[p.id].subject}</span>
                  </span>
                ) : (
                  <span className="text-ink-400">{L({ hi: "खाली", en: "Free" })}</span>
                )}
              </li>
            )
          )}
        </ul>
      </section>
    </div>
  );
}
