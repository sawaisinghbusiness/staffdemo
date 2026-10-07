"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { dayMonth } from "@/lib/format";
import { BackLink, ErrorCard, Skeleton } from "@/components/ui";

type Mark = "P" | "A" | "L" | "H";
interface Month {
  month: string;
  today: string;
  days: { date: string; mark: Mark | null; holiday: string | null; sunday: boolean }[];
  totals: { present: number; absent: number; leave: number; half: number };
}

const CELL: Record<Mark, string> = { P: "bg-jade-600 text-white", A: "bg-rose-500 text-white", L: "bg-marigold-400 text-ink-900", H: "bg-marigold-400 text-ink-900" };
const WEEK = { hi: ["र", "सो", "मं", "बु", "गु", "शु", "श"], en: ["S", "M", "T", "W", "T", "F", "S"] };
const shift = (m: string, by: number) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1)).toISOString().slice(0, 7);
const monthName = (m: string, lang: Lang) => new Date(m + "-01T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric" });

export default function MyAttendancePage() {
  const L = useL();
  const { lang } = useLang();
  const [month, setMonth] = useState("");
  const { data, error, reload } = useApi<Month>(`/my/attendance${month ? `?month=${month}` : ""}`);
  const shown = data && (!month || data.month === month) ? data : undefined;

  if (!shown && error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
  const current = shown?.month || month;
  const lead = shown ? new Date(shown.days[0].date + "T00:00:00").getDay() : 0;
  const t = shown?.totals;

  return (
    <div className="animate-rise space-y-3">
      <BackLink href="/me/" text={L({ hi: "मेरा", en: "Me" })} />
      <h1 className="text-xl font-bold">{L({ hi: "मेरी हाज़िरी", en: "My attendance" })}</h1>

      <section className="card p-4">
        {!t ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <ul className="grid grid-cols-4 divide-x divide-ink-100 text-center">
            {[
              [L({ hi: "उपस्थित", en: "Present" }), t.present, "bg-jade-600"],
              [L({ hi: "अनुपस्थित", en: "Absent" }), t.absent, "bg-rose-500"],
              [L({ hi: "छुट्टी", en: "Leave" }), t.leave, "bg-marigold-500"],
              [L({ hi: "आधा दिन", en: "Half" }), t.half, "bg-marigold-500"],
            ].map(([k, v, c]) => (
              <li key={k as string} className="px-1">
                <p className="tnum text-2xl font-extrabold text-ink-900">{v as number}</p>
                <p className="flex items-center justify-center gap-1.5 text-xs text-ink-600">
                  <span className={clsx("dot h-2 w-2", c as string)} aria-hidden />
                  {k as string}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(shift(current, -1))} disabled={!shown || current <= "2026-04"} aria-label={L({ hi: "पिछला महीना", en: "Previous month" })} className="grid h-11 w-11 place-items-center rounded-xl text-ink-700 disabled:opacity-30">
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
          <p className="text-lg font-bold text-ink-900">{current ? monthName(current, lang) : " "}</p>
          <button onClick={() => setMonth(shift(current, 1))} disabled={!shown || current >= shown.today.slice(0, 7)} aria-label={L({ hi: "अगला महीना", en: "Next month" })} className="grid h-11 w-11 place-items-center rounded-xl text-ink-700 disabled:opacity-30">
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5 text-center">
          {WEEK[lang].map((w, i) => (
            <span key={i} className={clsx("pb-1 text-xs font-semibold", i === 0 ? "text-rose-600" : "text-ink-500")}>
              {w}
            </span>
          ))}
          {!shown
            ? Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)
            : [
                ...Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />),
                ...shown.days.map((d) => {
                  const future = d.date > shown.today;
                  const off = !d.mark && (d.sunday || d.holiday);
                  return (
                    <span
                      key={d.date}
                      aria-label={`${dayMonth(d.date, lang)}${d.holiday ? `: ${d.holiday}` : ""}`}
                      className={clsx("tnum grid aspect-square place-items-center rounded-xl text-[15px] font-semibold", d.mark ? CELL[d.mark] : future ? "text-ink-300" : off ? "bg-ink-100 text-ink-400" : "bg-ink-50 text-ink-700", d.date === shown.today && "ring-2 ring-brand-600 ring-offset-1")}
                    >
                      {+d.date.slice(8)}
                    </span>
                  );
                }),
              ]}
        </div>
      </section>
    </div>
  );
}
