"use client";

import { ArrowRight } from "lucide-react";
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
  const { data: response, error, reload, stale } = useApi<History>(`/bus/history?date=${day}`);
  const data = response?.date === day ? response : undefined;
  const ran = new Set(data?.days || []);

  return (
    <div className="drv space-y-4">
      {stale && data && <p role="status" className="rounded-xl bg-drv-note p-3 text-[14px] text-drv-ink">{L({ hi: "\u092a\u0941\u0930\u093e\u0928\u093e \u0930\u093f\u0915\u0949\u0930\u094d\u0921 \u0926\u093f\u0916 \u0930\u0939\u093e \u0939\u0948\u0964", en: "Showing a saved record. Reconnect and refresh for updates." })}</p>}
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
              className={clsx("driver-history-date flex flex-col items-center gap-1.5 rounded-full pb-2.5 pt-2 text-[11px] font-medium", on ? "bg-drv-black text-[#B5B5B5]" : "text-drv-mute")}
            >
              {d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short" })}
              <b className={clsx("text-[14px] font-semibold", on ? "text-white" : "text-drv-ink")}>{d.getDate()}</b>
              <span className={clsx("h-1 w-1 rounded-full", ran.has(k) ? (on ? "bg-drv-yellow" : "bg-drv-mint") : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>

      <div key={day} className="driver-history-day">
      <div className="driver-history-heading">
        <h2>{weekdayDate(day, lang)}</h2>
        <p className="text-[12px] text-drv-mute">{L({ hi: "रूट की जानकारी", en: data ? `${data.trips.length} trip records` : "Loading records…" })}</p>
      </div>

      <div key={data ? `${day}:loaded` : `${day}:loading`} className="driver-history-records" aria-live="polite" aria-busy={!data}>
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
              <dt className="text-[11px] text-drv-mute">{L({ hi: "\u0930\u0942\u091f \u0915\u093e \u0905\u0928\u0941\u092e\u093e\u0928", en: "Route estimate" })}</dt>
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
          <p className="text-[13px] leading-relaxed text-drv-mute">{L({ hi: "\u0926\u0942\u0930\u0940 \u0930\u0942\u091f \u0915\u0947 \u0905\u0928\u0941\u0938\u093e\u0930 \u0905\u0928\u0941\u092e\u093e\u0928 \u0939\u0948\u0964", en: "Distance is an estimate from the route length, not measured GPS distance travelled." })}</p>
        </>
      )}
      </div></div>
    </div>
  );
}

function TripRow({ t }: { t: DayTrip }) {
  const L=useL();const morning=t.kind==="morning";const why=t.delay?DELAY_REASONS.find(r=>r.id===t.delay!.reason):null;
  return <article className="history-trip"><header><h3>{morning?L({hi:"सुबह का पिकअप",en:"Morning pickup"}):L({hi:"छुट्टी का ड्रॉप",en:"Afternoon drop"})}</h3><span className={t.endedAt?"is-complete":"is-running"}>{t.endedAt?L({hi:"पूरी हुई",en:"Completed"}):L({hi:"जारी है",en:"Running"})}</span></header><div className="history-trip-times"><div><span>{L({hi:"शुरू हुई",en:"Started"})}</span><time dateTime={t.startedAt}>{timeOf(t.startedAt)}</time></div><ArrowRight size={18} aria-hidden/><div><span>{L({hi:"बंद हुई",en:"Ended"})}</span><time dateTime={t.endedAt||undefined}>{t.endedAt?timeOf(t.endedAt):"—"}</time></div></div>{(t.firstStop||t.lastStop)&&<p className="history-trip-route">{[t.firstStop,t.lastStop].filter(Boolean).join(" → ")}</p>}<footer>{t.stopsDone} {L({hi:"स्टॉप पूरे",en:"stops completed"})}<span>·</span>{t.ticked} {morning?L({hi:"बच्चे चढ़े",en:"marked on"}):L({hi:"बच्चे उतरे",en:"marked off"})}</footer>{t.delay&&why&&<p className="history-trip-delay">{t.delay.minutes} {L({hi:"मिनट देरी",en:"min delay"})} · {L(why)}</p>}</article>;
}
