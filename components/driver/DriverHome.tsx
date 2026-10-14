"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bell, ChevronRight, Play } from "lucide-react";
import { useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { clock } from "@/lib/format";
import { defaultKind, tripStops, type RouteData, type TripKind } from "@/lib/bus";
import { ErrorCard, SchoolMark, Skeleton } from "@/components/ui";
import { Face } from "./parts";

/**
 * The driver's Home: today's route in one card (children coming today, stops, the road distance),
 * morning or afternoon, one yellow button, and today's stops in the order the bus reaches them.
 */
export function DriverHome() {
  const L = useL();
  const { lang, setLang } = useLang();
  const { me } = useStaff();
  const { data, error, reload } = useApi<RouteData>("/bus/route");
  const [kind, setKind] = useState<TripKind>(defaultKind);
  const first = me?.name.split(" ")[0] || "";

  // The same top row as the parents' app: school logo and name, language, notices, and the
  // driver's own profile in the corner.
  const head = (
    <header className="pt-safe">
      <div className="flex items-center gap-1.5 px-4 pb-1 pt-4">
        {me ? <SchoolMark name={me.school.name} url={me.school.logoUrl} size={44} /> : <Skeleton className="h-11 w-11 rounded-xl" />}
        <div className="ml-1 min-w-0 flex-1">
          {me ? (
            <>
              <p className="line-clamp-2 text-[13.5px] font-semibold leading-tight">{me.school.name}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-drv-mute">{L({ hi: `नमस्ते, ${first}`, en: `Hello, ${first}` })}</p>
            </>
          ) : (
            <Skeleton className="h-4 w-28" />
          )}
        </div>
        <div className="relative flex shrink-0 rounded-full border border-drv-line bg-white p-0.5" role="group" aria-label={L({ hi: "भाषा", en: "Language" })}>
          <span aria-hidden className="absolute left-0.5 top-0.5 h-7 w-[30px] rounded-full bg-drv-black transition-transform duration-300" style={{ transform: lang === "hi" ? "translateX(30px)" : "none" }} />
          {(["en", "hi"] as const).map((k) => (
            <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k} className={clsx("relative h-7 w-[30px] rounded-full text-[12px] font-semibold transition-colors duration-300", lang === k ? "text-white" : "text-drv-mute")}>
              {k === "en" ? "EN" : "हि"}
            </button>
          ))}
        </div>
        <Link href="/notice/" className="grid h-10 w-9 shrink-0 place-items-center rounded-full text-drv-ink active:bg-drv-soft" aria-label={L({ hi: "सूचनाएँ", en: "Notices" })}>
          <Bell className="h-[21px] w-[21px]" strokeWidth={1.9} aria-hidden />
        </Link>
        {me && (
          <Link href="/profile/" className="ml-0.5 shrink-0 rounded-full" aria-label={L({ hi: "मेरी प्रोफ़ाइल", en: "My profile" })}>
            <Face name={me.name} url={me.photoUrl} size={38} />
          </Link>
        )}
      </div>
    </header>
  );

  if (!data) {
    // 404/403: the office hasn't put this phone as any route's driver yet.
    const none = error?.status === 404 || error?.status === 403;
    return (
      <div className="drv">
        {head}
        <div className="px-4 pt-4">
          {none ? (
            <NoRoute />
          ) : error && error.status !== 401 ? (
            <ErrorCard offline={error.status === 0} onRetry={reload} />
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-[148px] w-full rounded-[14px]" />
              <Skeleton className="h-11 w-full rounded-[12px]" />
              <Skeleton className="h-[52px] w-full rounded-[12px]" />
            </div>
          )}
        </div>
      </div>
    );
  }
  const r = data.route;
  if (!r)
    return (
      <div className="drv">
        {head}
        <div className="px-4 pt-4">
          <NoRoute />
        </div>
      </div>
    );

  const running = data.trip;
  const k = running?.kind || kind;
  const order = tripStops(r, k);
  const kids = order.reduce((a, s) => a + s.kids.length, 0);
  const morning = k === "morning";
  const firstStop = order[0]?.name;
  const lastStop = order[order.length - 1]?.name;
  const from = morning ? firstStop : r.school.name;
  const to = morning ? r.school.name : lastStop;
  const km = r.path ? (r.path.m / 1000).toFixed(1) : null;
  const short = (s?: string) => (s && s.length > 22 ? s.slice(0, 21) + "…" : s || "");

  return (
    <div className="drv">
      {head}
      <div className="space-y-3 px-4 pt-4">
        <section className="d-card px-4 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-[16px] font-semibold">{r.name}</h2>
            {running && (
              <span className="d-chip">
                <span className="d-live" />
                {L({ hi: "ट्रिप चल रही है", en: "Trip running" })}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-drv-mute">
            {r.vehicleNo}
            {from && to ? ` · ${short(from)} → ${short(to)}` : ""}
          </p>
          <dl className="mt-3 grid grid-cols-3 border-t border-drv-line text-center">
            <div className="py-2.5">
              <dd className="text-[17px] font-semibold">{kids}</dd>
              <dt className="text-[11.5px] text-drv-mute">
                {L({ hi: "बच्चे", en: "Children" })}
                {r.absent.length > 0 && <span className="font-medium text-drv-gold"> · {L({ hi: `${r.absent.length} अनुपस्थित`, en: `${r.absent.length} absent` })}</span>}
              </dt>
            </div>
            <div className="border-l border-drv-line py-2.5">
              <dd className="text-[17px] font-semibold">{order.length}</dd>
              <dt className="text-[11.5px] text-drv-mute">{L({ hi: "स्टॉप", en: "Stops" })}</dt>
            </div>
            <div className="border-l border-drv-line py-2.5">
              <dd className="text-[17px] font-semibold">{km ? `${km}` : "—"}</dd>
              <dt className="text-[11.5px] text-drv-mute">{L({ hi: "किलोमीटर", en: "km" })}</dt>
            </div>
          </dl>
        </section>

        {running ? (
          <Link href="/trip/" className="d-btn d-btn-y w-full">
            {L({ hi: "चल रही ट्रिप खोलें", en: "Open the running trip" })}
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        ) : (
          <>
            <div className="grid grid-cols-2 rounded-[12px] bg-drv-soft p-[3px]" role="radiogroup" aria-label={L({ hi: "कौन सी ट्रिप", en: "Which trip" })}>
              {(["morning", "afternoon"] as const).map((x) => (
                <button
                  key={x}
                  role="radio"
                  aria-checked={kind === x}
                  onClick={() => setKind(x)}
                  className={clsx("h-[38px] rounded-[10px] text-[13px] transition-colors", kind === x ? "bg-white font-semibold text-drv-ink shadow-[0_1px_3px_rgba(0,0,0,.1)]" : "font-medium text-drv-mute")}
                >
                  {x === "morning" ? L({ hi: "सुबह · स्कूल ले जाना", en: "Morning · to school" }) : L({ hi: "छुट्टी · घर छोड़ना", en: "Afternoon · home" })}
                </button>
              ))}
            </div>
            <Link href={`/trip/?kind=${kind}`} className="d-btn d-btn-y w-full">
              <Play className="h-[14px] w-[14px]" fill="currentColor" aria-hidden />
              {L({ hi: "ट्रिप शुरू करें", en: "Start trip" })}
            </Link>
          </>
        )}

        <section className="pt-1">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">{L({ hi: "आज के स्टॉप", en: "Today's stops" })}</h2>
            <span className="text-[12px] font-medium text-drv-mute">{L({ hi: `${kids} बच्चे`, en: `${kids} children` })}</span>
          </div>
          <ol>
            {[
              ...(morning ? [] : [{ key: "school", name: r.school.name, time: "", note: L({ hi: "यहाँ से निकलना", en: "Leave from here" }) }]),
              ...order.map((s) => ({
                key: s.name,
                name: s.name,
                time: morning ? s.time : "",
                note: L({ hi: `${s.kids.length} बच्चे`, en: `${s.kids.length} ${s.kids.length === 1 ? "child" : "children"}` }),
              })),
              ...(morning ? [{ key: "school", name: r.school.name, time: "", note: L({ hi: "स्कूल पहुँचना", en: "Reach school" }) }] : []),
            ].map((s, i, all) => {
              const tone = i === 0 ? "border-drv-green bg-drv-mint" : i === all.length - 1 ? "border-drv-gold bg-drv-yellow" : "border-drv-ink bg-white";
              return (
                <li key={s.key + i} className="relative grid h-11 grid-cols-[52px_14px_1fr_auto] items-center gap-x-2.5">
                  <span className="text-[12.5px] text-drv-mute">{s.time ? clock(s.time) : ""}</span>
                  <span className={clsx("relative z-[1] h-2.5 w-2.5 justify-self-center rounded-full border-2", tone)} aria-hidden />
                  {i < all.length - 1 && <span className="absolute left-[68px] top-[27px] h-[34px] border-l-[1.5px] border-dashed border-[#CFCFCB]" aria-hidden />}
                  <span className="truncate text-[13.5px] font-medium">{s.name}</span>
                  <span className="text-[12px] text-drv-mute">{s.note}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}

function NoRoute() {
  const L = useL();
  return (
    <section className="d-card px-4 py-4">
      <p className="text-[15px] font-semibold">{L({ hi: "आपको अभी कोई रूट नहीं दिया गया।", en: "No route is assigned to you yet." })}</p>
      <p className="mt-1 text-[13px] leading-snug text-drv-mute">{L({ hi: "ऑफ़िस से ट्रांसपोर्ट में अपना मोबाइल नंबर ड्राइवर के रूप में लगवा लें।", en: "Ask the office to put your mobile as the driver in Transport." })}</p>
    </section>
  );
}
