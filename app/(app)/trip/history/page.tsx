"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { weekdayDate } from "@/lib/format";
import { DELAY_REASONS, type DayTrip, type History } from "@/lib/bus";
import { ErrorCard } from "@/components/ui";
import { timeOf } from "@/components/driver/parts";

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
  // Which way the record slides in: from the right for a later day, from the left for an earlier one.
  const [dir, setDir] = useState<1 | -1>(1);
  const { data: response, error, reload, stale } = useApi<History>(`/bus/history?date=${day}`);
  const fresh = response?.date === day ? response : undefined;
  // While the new day loads, the last day stays on screen (a little faded) instead of a grey box,
  // and the new day slides in once, when its own record has arrived.
  const [shown, setShown] = useState<History | undefined>(fresh);
  useEffect(() => {
    if (fresh) setShown(fresh);
  }, [fresh]);
  const data = fresh || shown;
  const loading = !fresh;
  const failed = !fresh && !!error && error.status !== 401;
  const ran = new Set(data?.days || []);
  const picked = Math.max(0, week.findIndex((d) => iso(d) === day));
  const pick = (k: string) => {
    if (k === day) return;
    setDir(k > day ? 1 : -1);
    setDay(k);
  };

  return (
    <div className="drv driver-history space-y-4">
      {stale && fresh && <p role="status" className="rounded-xl bg-drv-note p-3 text-[14px] text-drv-ink">{L({ hi: "पुराना रिकॉर्ड दिख रहा है।", en: "Showing a saved record. Reconnect and refresh for updates." })}</p>}
      <div className="driver-history-week relative grid grid-cols-7 gap-1" role="radiogroup" aria-label={L({ hi: "दिन चुनें", en: "Pick a day" })} style={{ ["--picked" as string]: picked }}>
        {/* One dark pill that glides to the picked day, so the switch is seen, not just the colour flipping. */}
        <span className="driver-history-pill" aria-hidden />
        {week.map((d) => {
          const k = iso(d);
          const on = k === day;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={on}
              onClick={() => pick(k)}
              className={clsx("driver-history-date relative z-[1] flex flex-col items-center gap-1.5 rounded-full pb-2.5 pt-2 text-[12px] font-medium", on ? "text-[#B5B5B5]" : "text-drv-mute")}
            >
              {d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short" })}
              <b className={clsx("text-[14px] font-semibold", on ? "text-white" : "text-drv-ink")}>{d.getDate()}</b>
              <span className={clsx("h-1 w-1 rounded-full", ran.has(k) ? (on ? "bg-drv-yellow" : "bg-drv-mint") : "bg-transparent")} aria-hidden />
            </button>
          );
        })}
      </div>

      {failed ? (
        <ErrorCard offline={error!.status === 0} slow={error!.message === "timeout"} onRetry={reload} />
      ) : !data ? (
        <HistoryWait />
      ) : (
        <div key={data.date} className="driver-history-day" data-dir={dir} data-loading={loading} aria-busy={loading}>
          <div className="driver-history-heading">
            <h2>{weekdayDate(data.date, lang)}</h2>
            <p className="text-[12px] text-drv-mute">{L({ hi: `${data.trips.length} ट्रिप`, en: `${data.trips.length} trip${data.trips.length === 1 ? "" : "s"}` })}</p>
          </div>

          <div className="driver-history-records" aria-live="polite">
            {data.trips.length === 0 ? (
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
                    <dt className="text-[12px] text-drv-mute">{L({ hi: "रूट का अनुमान", en: "Route estimate" })}</dt>
                  </div>
                  <div className="border-l border-[#E2E2DE]">
                    <dd className="text-[15px] font-semibold">{data.trips.filter((t) => t.delay).length}</dd>
                    <dt className="text-[12px] text-drv-mute">{L({ hi: "देरी", en: "Delays" })}</dt>
                  </div>
                  <div className="border-l border-[#E2E2DE]">
                    <dd className="text-[15px] font-semibold">{data.trips.reduce((a, t) => a + t.ticked, 0)}</dd>
                    <dt className="text-[12px] text-drv-mute">{L({ hi: "चढ़े / उतरे", en: "Board / drop entries" })}</dt>
                  </div>
                </dl>
                <p className="text-[13px] leading-relaxed text-drv-mute">{L({ hi: "दूरी रूट के अनुसार अनुमान है।", en: "Planned route distance · not GPS distance." })}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** While the day is coming: one trip card in its real shape (labels in place, bars where the times and counts go). */
function HistoryWait() {
  const L = useL();
  const bar = (w: string) => <i className="dv-bar" style={{ width: w }} aria-hidden />;
  return (
    <div aria-busy="true">
      <div className="driver-history-heading"><h2>{bar("150px")}</h2>{bar("40px")}</div>
      <div className="driver-history-records">
        <article className="history-trip"><header><h3>{bar("120px")}</h3>{bar("60px")}</header><div className="history-trip-times"><div><span>{L({hi:"शुरू हुई",en:"Started"})}</span><time>{bar("64px")}</time></div><ArrowRight size={18} aria-hidden/><div><span>{L({hi:"बंद हुई",en:"Ended"})}</span><time>{bar("64px")}</time></div></div><footer>{bar("170px")}</footer></article>
      </div>
    </div>
  );
}

function TripRow({ t }: { t: DayTrip }) {
  const L=useL();const morning=t.kind==="morning";const why=t.delay?DELAY_REASONS.find(r=>r.id===t.delay!.reason):null;
  return <article className="history-trip"><header><h3>{morning?L({hi:"सुबह का पिकअप",en:"Morning pickup"}):L({hi:"छुट्टी का ड्रॉप",en:"Afternoon drop"})}</h3><span className={t.endedAt?"is-complete":"is-running"}>{t.endedAt?L({hi:"पूरी हुई",en:"Completed"}):L({hi:"जारी है",en:"Running"})}</span></header><div className="history-trip-times"><div><span>{L({hi:"शुरू हुई",en:"Started"})}</span><time dateTime={t.startedAt}>{timeOf(t.startedAt)}</time></div><ArrowRight size={18} aria-hidden/><div><span>{L({hi:"बंद हुई",en:"Ended"})}</span><time dateTime={t.endedAt||undefined}>{t.endedAt?timeOf(t.endedAt):"—"}</time></div></div>{(t.firstStop||t.lastStop)&&<p className="history-trip-route">{[t.firstStop,t.lastStop].filter(Boolean).join(" → ")}</p>}<footer>{t.stopsDone} {L({hi:"स्टॉप पूरे",en:"stops completed"})}<span>·</span>{t.ticked} {morning?L({hi:"बच्चे चढ़े",en:"marked on"}):L({hi:"बच्चे उतरे",en:"marked off"})}</footer>{t.delay&&why&&<p className="history-trip-delay">{t.delay.minutes} {L({hi:"मिनट देरी",en:"min delay"})} · {L(why)}</p>}</article>;
}
