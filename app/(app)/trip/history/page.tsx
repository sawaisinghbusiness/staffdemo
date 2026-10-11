"use client";

import { useState } from "react";
import clsx from "clsx";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { weekdayDate } from "@/lib/format";
import { DELAY_REASONS, type DayTrip, type History } from "@/lib/bus";
import { ErrorCard, Skeleton } from "@/components/ui";
import { Pin, timeOf } from "@/components/driver/parts";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The driver's record: pick a day in the last week and see both runs, when they started and ended. */
export default function TripHistoryPage() {
  const L = useL();
  const { lang } = useLang();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d;
  });
  const [day, setDay] = useState(iso(week[6]));
  const { data, error, reload } = useApi<History>(`/bus/history?date=${day}`);
  const ran = new Set(data?.days || []);

  return (
    <div className="drv space-y-4">
      <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label={L({ hi: "दिन चुनें", en: "Pick a day" })}>
        {week.map((d) => {
          const k = iso(d);
          const on = k === day;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={on}
              onClick={() => setDay(k)}
              className={clsx("flex flex-col items-center gap-1.5 rounded-full pb-2.5 pt-2 text-[11px] font-medium", on ? "bg-drv-black text-[#B5B5B5]" : "text-drv-mute")}
            >
              {d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short" })}
              <b className={clsx("text-[14px] font-semibold", on ? "text-white" : "text-drv-ink")}>{d.getDate()}</b>
              <span className={clsx("h-1 w-1 rounded-full", ran.has(k) ? (on ? "bg-drv-yellow" : "bg-drv-mint") : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-[14px] font-semibold">{weekdayDate(day, lang)}</h2>
        <p className="text-[12px] text-drv-mute">{L({ hi: "रूट की जानकारी", en: "Route info" })}</p>
      </div>

      {!data ? (
        error && error.status !== 401 ? (
          <ErrorCard offline={error.status === 0} onRetry={reload} />
        ) : (
          <Skeleton className="h-48 w-full rounded-[14px]" />
        )
      ) : data.trips.length === 0 ? (
        <p className="rounded-[12px] bg-drv-soft px-3.5 py-4 text-[13px] text-drv-mute">{L({ hi: "इस दिन कोई ट्रिप नहीं चली।", en: "No trips on this day." })}</p>
      ) : (
        <>
          <div className="space-y-5">
            {data.trips.map((t) => (
              <TripRow key={t.id} t={t} />
            ))}
          </div>
          <dl className="grid grid-cols-3 rounded-[12px] bg-drv-soft py-2.5 text-center">
            <div>
              <dd className="text-[15px] font-semibold">{data.km !== null ? `${(data.km * data.trips.length).toFixed(1)} km` : "—"}</dd>
              <dt className="text-[11px] text-drv-mute">{L({ hi: "कुल दूरी", en: "Distance" })}</dt>
            </div>
            <div className="border-l border-[#E2E2DE]">
              <dd className="text-[15px] font-semibold">{data.trips.filter((t) => t.delay).length}</dd>
              <dt className="text-[11px] text-drv-mute">{L({ hi: "देरी", en: "Delays" })}</dt>
            </div>
            <div className="border-l border-[#E2E2DE]">
              <dd className="text-[15px] font-semibold">{data.trips.reduce((a, t) => a + t.ticked, 0)}</dd>
              <dt className="text-[11px] text-drv-mute">{L({ hi: "चढ़े / उतरे", en: "On / off" })}</dt>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}

function TripRow({ t }: { t: DayTrip }) {
  const L = useL();
  const morning = t.kind === "morning";
  const why = t.delay ? DELAY_REASONS.find((r) => r.id === t.delay!.reason) : null;
  return (
    <section>
      <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-drv-faint">{morning ? L({ hi: "सुबह · स्कूल ले जाना", en: "Morning · to school" }) : L({ hi: "छुट्टी · घर छोड़ना", en: "Afternoon · home" })}</h3>
      <div className="grid grid-cols-[30px_1fr] gap-x-2.5">
        <div className="relative flex flex-col items-center pt-0.5">
          <Pin tone="start" />
          <svg className="my-1" width="26" height="40" viewBox="0 0 26 40" aria-hidden>
            <path d="M13 0 C 2 14, 24 26, 13 40" fill="none" stroke="#C4C4C0" strokeWidth="1.4" strokeDasharray="3 4" />
          </svg>
          <Pin tone="end" />
        </div>
        <div>
          <div className="pb-3">
            <p className="text-[12px] font-medium text-drv-mute">{morning ? L({ hi: "निकले", en: "Started" }) : L({ hi: "स्कूल से निकले", en: "Left school" })}</p>
            <p className="text-[17px] font-semibold leading-tight text-drv-green">{timeOf(t.startedAt)}</p>
            <p className="text-[12px] text-drv-mute">{morning && t.firstStop ? t.firstStop : L({ hi: `${t.stopsDone} स्टॉप पूरे`, en: `${t.stopsDone} stops done` })}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-drv-mute">{t.endedAt ? (morning ? L({ hi: "स्कूल पहुँचे", en: "Reached school" }) : L({ hi: "आखिरी ड्रॉप", en: "Last drop" })) : L({ hi: "अभी चल रही है", en: "Still running" })}</p>
            <p className="text-[17px] font-semibold leading-tight text-drv-gold">{t.endedAt ? timeOf(t.endedAt) : "—"}</p>
            <p className="text-[12px] text-drv-mute">
              {morning ? L({ hi: `${t.ticked} बच्चे चढ़े`, en: `${t.ticked} got on` }) : `${t.lastStop ? t.lastStop + " · " : ""}${L({ hi: `${t.ticked} बच्चे उतरे`, en: `${t.ticked} got off` })}`}
            </p>
          </div>
          {t.delay && why && <p className="mt-2 text-[12px] text-drv-gold">{L({ hi: `${t.delay.minutes} मिनट देरी · ${why.hi}`, en: `${t.delay.minutes} min late · ${why.en}` })}</p>}
        </div>
      </div>
    </section>
  );
}
