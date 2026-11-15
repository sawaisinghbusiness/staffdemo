"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bell, ChevronDown, ArrowRight, BusFront, UsersRound, Check, School } from "lucide-react";
import { SlideConfirm } from "./SlideConfirm";
import { askForLocation, markTripStartSound } from "@/lib/slideFeedback";
import { SIMULATE_BUS } from "@/lib/demo";
import { api, useApi } from "@/lib/api";
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
  const [stopsOpen,setStopsOpen]=useState(false);
  const [startError,setStartError]=useState("");
  const [kind, setKind] = useState<TripKind>(defaultKind);
  // The first time the driver opens the app, the phone asks for location now, not after the trip has started.
  useEffect(() => {
    if (!SIMULATE_BUS) askForLocation();
  }, []);
  const first = me?.name.split(" ")[0] || "";

  // The same top row as the parents' app: school logo and name, language, notices, and the
  // driver's own profile in the corner.
  const hour = new Date().getHours();
  const greet = hour < 12 ? L({ hi: "सुप्रभात", en: "Good morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good afternoon" }) : L({ hi: "नमस्ते", en: "Good evening" });
  const head = (
    <header className="pt-safe">
      <div className="flex items-center gap-1.5 px-4 pb-1 pt-4">
        {me ? <SchoolMark name={me.school.name} url={me.school.logoUrl} size={44} /> : <Skeleton className="h-11 w-11 rounded-xl" />}
        <div className="ml-1 min-w-0 flex-1">
          {me ? (
            <>
              {/* Two lines (user, 2026-10-26): the greeting small on top, the name under it. */}
              <p className="truncate text-[11.5px] text-drv-mute">{greet}</p>
              <p className="truncate text-[15.5px] font-semibold leading-tight">{first}</p>
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
      <div className="drv driver-home">
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
      <div className="drv driver-home">
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
  const next = order.find(s => !running?.done.includes(s.name));
  const marked = running ? Object.keys(running.marks).length : 0;
  const done = running ? order.filter(s => running.done.includes(s.name)).length : 0;
  return (
    <div className="drv driver-home driver-dispatch">
      {head}
      <div className="dispatch-main">
        <div className="dispatch-title"><h1>{L({hi:"आज का सफ़र",en:"Today's route"})}</h1><span>{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN",{day:"numeric",month:"short"})}</span></div>
        {!running && <div className="dispatch-tabs" role="radiogroup" aria-label={L({hi:"ट्रिप चुनें",en:"Which trip"})}>{(["morning","afternoon"] as const).map(x=><button key={x} role="radio" aria-checked={kind===x} onClick={()=>setKind(x)}>{x==="morning"?L({hi:"सुबह · स्कूल",en:"Morning · school"}):L({hi:"छुट्टी · घर",en:"Afternoon · home"})}</button>)}</div>}
        <section className="dispatch-sheet">
          <div className="dispatch-vehicle"><span><BusFront size={19} aria-hidden/>{r.vehicleNo || L({hi:"बस नंबर नहीं जुड़ा",en:"Vehicle not added"})}</span><span className={running?"dispatch-running":"dispatch-ready"}>{running?L({hi:"ट्रिप जारी",en:"Trip in progress"}):L({hi:"शुरू नहीं हुई",en:"Not started"})}</span></div>
          <h2>{r.name}</h2>
          <p className="dispatch-direction">{morning?L({hi:"बच्चों को स्कूल ले जाना",en:"Pick up children for school"}):L({hi:"बच्चों को घर छोड़ना",en:"Take children home"})}</p>
          <div className="dispatch-destination">
            <span className="dispatch-route-mark" aria-hidden><span/><i/><span/></span>
            <div><p>{running?L({hi:"अगला स्टॉप",en:"Next stop"}):L({hi:"यहाँ से शुरू",en:"Start from"})}</p><strong>{running?(next?.name || r.school.name):from || L({hi:"स्टॉप नहीं जुड़ा",en:"No stop added"})}</strong><p className="dispatch-end">{L({hi:"मंज़िल",en:"Finish at"})} · {to}</p></div>
          </div>
          <div className="dispatch-manifest"><span><UsersRound size={16} aria-hidden/>{kids} {L({hi:"बच्चे",en:kids===1?"child":"children"})}</span><span>{order.length} {L({hi:"स्टॉप",en:"stops"})}</span>{km && <span>{km} km <small>{L({hi:"रूट",en:"route"})}</small></span>}</div>
          {running && <p className="dispatch-recorded">{L({hi:`${done} स्टॉप पूरे · ${marked} बच्चों की एंट्री`,en:`${done} stops completed · ${marked} children marked`})}</p>}
          {startError&&<p role="alert" className="mb-3 text-[13px] text-rose-700">{startError}</p>}
          {running?<Link href="/trip/" className="dispatch-start">{L({hi:"ट्रिप जारी रखें",en:"Resume trip"})}<ArrowRight size={20}/></Link>:<SlideConfirm tone="yellow" sound="start" label={L({hi:"ट्रिप शुरू करने को स्वाइप करें",en:"Slide to start trip"})} disabled={!order.length} onConfirm={async()=>{setStartError("");try{await api("/bus/trip",{body:{kind}});markTripStartSound();window.location.assign("/trip/");return true}catch(e){setStartError(e instanceof Error?e.message:L({hi:"ट्रिप शुरू नहीं हुई",en:"Could not start trip"}));return false}}}/>}
        </section>
        {r.absent.length>0 && <p className="dispatch-absence">{L({hi:`आज ${r.absent.length} बच्चे नहीं आएँगे। लिस्ट से हटा दिए हैं।`,en:`${r.absent.length} absent today, already excluded from the list.`})}</p>}
        <section className="dispatch-stops"><h2><button type="button" className="dispatch-stops-toggle" aria-expanded={stopsOpen} aria-controls="driver-todays-stops" onClick={()=>setStopsOpen(open=>!open)}><span>{L({hi:"आज के स्टॉप",en:"Today's stops"})}</span><ChevronDown size={19} aria-hidden className={stopsOpen?"is-open":""}/></button></h2><div className="dispatch-stops-reveal" data-open={stopsOpen} aria-hidden={!stopsOpen}><div id="driver-todays-stops"><ol>
          {!morning && (<li className="dispatch-school"><School size={19} aria-hidden/><div><strong>{r.school.name}</strong><span>{morning?L({hi:"स्कूल पहुँचें",en:"Arrive at school"}):L({hi:"स्कूल से निकलें",en:"Depart from school"})}</span></div></li>)}
          {order.map((stop,i)=>{const passed=!!running?.done.includes(stop.name);const current=!!running&&next?.name===stop.name;return <li key={stop.name} className={clsx(passed&&"is-done",current&&"is-next")}><span className="dispatch-stop-number" aria-label={passed?L({hi:"पूरा",en:"Completed"}):undefined}>{passed?<Check size={15} aria-hidden/>:i+1}</span><div><strong>{stop.name}</strong><span>{stop.kids.length} {L({hi:"बच्चे",en:stop.kids.length===1?"child":"children"})}{current?` · ${L({hi:"अगला स्टॉप",en:"Next stop"})}`:""}</span></div><time>{morning&&stop.time?clock(stop.time):""}</time></li>})}
          {morning && (<li className="dispatch-school"><School size={19} aria-hidden/><div><strong>{r.school.name}</strong><span>{morning?L({hi:"स्कूल पहुँचें",en:"Arrive at school"}):L({hi:"स्कूल से निकलें",en:"Depart from school"})}</span></div></li>)}
        </ol></div></div></section>
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
