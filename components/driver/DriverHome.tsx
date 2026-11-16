"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { playTripEndIfNew } from "@/lib/slideFeedback";
import Link from "next/link";
import clsx from "clsx";
import { Bell, ChevronDown, ArrowRight, BusFront, UsersRound, Check, School } from "lucide-react";
import { SlideConfirm } from "./SlideConfirm";
import { useApi } from "@/lib/api";
import { useFilledRoute } from "@/lib/routeFill";
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
  // Stops with no saved place get one looked up (phone only), so the km and the route line show.
  const filledRoute = useFilledRoute(data?.route ?? null);
  const router = useRouter();
  // Back from a trip that has just ended: the end sound plays here, as Home appears.
  useEffect(() => playTripEndIfNew(), []);
  const [stopsOpen,setStopsOpen]=useState(false);
  const [startError,setStartError]=useState("");
  const [kind, setKind] = useState<TripKind>(defaultKind);
  /** Set by the Morning / Afternoon switch: the fresh card and stop list then land with the Home entrance. */
  const [switched, setSwitched] = useState(false);
  const first = me?.name.split(" ")[0] || "";
  // Opened without data (first visit, slow network): the shaped skeleton made the entrance, so when the data
  // comes the values only sharpen in place. Opened with data already kept from earlier: the page makes the entrance.
  const openedEmpty = useRef(!data).current;

  // The same top row as the parents' app: school logo and name, language, notices, and the
  // driver's own profile in the corner.
  const hour = new Date().getHours();
  const greet = hour < 12 ? L({ hi: "सुप्रभात", en: "Good morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good afternoon" }) : L({ hi: "नमस्ते", en: "Good evening" });
  const head = (
    <header className="pt-safe">
      {/* Small logo far left and a compact language switch, so "Good evening" and the name have room on a phone. */}
      <div className="flex items-center gap-1 pb-1 pl-2.5 pr-3 pt-4">
        {me ? <SchoolMark name={me.school.name} url={me.school.logoUrl} size={36} /> : <Skeleton className="h-9 w-9 rounded-xl" />}
        <div className="ml-1.5 min-w-0 flex-1">
          {/* Two lines (user, 2026-10-26): the greeting small on top, the name under it (sharpens in when it comes). */}
          <p className="truncate text-[11.5px] text-drv-mute">{greet}</p>
          <p className="truncate text-[15.5px] font-semibold leading-tight">{first ? <span className="dv-value">{first}</span> : " "}</p>
        </div>
        <div className="relative flex shrink-0 rounded-full border border-drv-line bg-white p-0.5" role="group" aria-label={L({ hi: "भाषा", en: "Language" })}>
          <span aria-hidden className="absolute left-0.5 top-0.5 h-9 w-9 rounded-full bg-drv-black transition-transform duration-300" style={{ transform: lang === "hi" ? "translateX(36px)" : "none" }} />
          {(["en", "hi"] as const).map((k) => (
            <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k} className={clsx("relative h-9 w-9 rounded-full text-[11px] font-semibold transition-colors duration-300", lang === k ? "text-white" : "text-drv-mute")}>
              {k === "en" ? "EN" : "हि"}
            </button>
          ))}
        </div>
        <Link href="/notice/" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-drv-ink active:bg-drv-soft" aria-label={L({ hi: "सूचनाएँ", en: "Notices" })}>
          <Bell className="h-[21px] w-[21px]" strokeWidth={1.9} aria-hidden />
        </Link>
        {me && (
          <Link href="/profile/" className="grid h-11 w-11 shrink-0 place-items-center rounded-full" aria-label={L({ hi: "मेरी प्रोफ़ाइल", en: "My profile" })}>
            <Face name={me.name} url={me.photoUrl} size={38} />
          </Link>
        )}
      </div>
    </header>
  );

  if (!data) {
    // 404/403: the office hasn't put this phone as any route's driver yet.
    const none = error?.status === 404 || error?.status === 403;
    if (!none && !(error && error.status !== 401))
      return (
        <div className="drv driver-home driver-dispatch" data-enter>
          {head}
          <HomeSkeleton kind={kind} />
        </div>
      );
    return (
      <div className="drv driver-home">
        {head}
        <div className="px-4 pt-4">{none ? <NoRoute /> : <ErrorCard offline={error!.status === 0} onRetry={reload} />}</div>
      </div>
    );
  }
  const r = filledRoute;
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
    <div className="drv driver-home driver-dispatch" data-enter={!openedEmpty || undefined} data-slow={openedEmpty || undefined}>
      {head}
      <div className="dispatch-main">
        <div className="dispatch-title dv-in" style={dvI(0)}><h1>{L({hi:"आज का सफ़र",en:"Today's route"})}</h1><span>{new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN",{day:"numeric",month:"short"})}</span></div>
        {!running && <div className="dispatch-tabs dv-in" style={dvI(1)} role="radiogroup" aria-label={L({hi:"ट्रिप चुनें",en:"Which trip"})}>{(["morning","afternoon"] as const).map(x=><button key={x} role="radio" aria-checked={kind===x} onClick={()=>{if(x!==kind){setKind(x);setSwitched(true)}}}>{x==="morning"?L({hi:"सुबह · स्कूल",en:"Morning · school"}):L({hi:"छुट्टी · घर",en:"Afternoon · home"})}</button>)}</div>}
        {/* dispatch-glow: the soft red glow behind the card's two bottom corners only (driver-dispatch.css). */}
        {/* key={kind}: switching Morning / Afternoon puts a fresh card in, so it lands again with the same
            entrance as when Home opens (and the stop list below re-arrives), and the switch is felt. */}
        <div key={kind} className={clsx("dispatch-glow dv-card", switched && "dv-again")}><section className="dispatch-sheet">
          <div className="dispatch-vehicle dv-in2" style={dvI(0)}><span><BusFront size={19} aria-hidden/><span className="dv-value">{r.vehicleNo || L({hi:"बस नंबर नहीं जुड़ा",en:"Vehicle not added"})}</span></span><span className={running?"dispatch-running":"dispatch-ready"}>{running?L({hi:"ट्रिप जारी",en:"Trip in progress"}):L({hi:"शुरू नहीं हुई",en:"Not started"})}</span></div>
          <h2 className="dv-in2" style={dvI(1)}><span className="dv-value">{r.name}</span></h2>
          <div className="dispatch-destination dv-in2" style={dvI(2)}>
            <span className="dispatch-route-mark dv-mark" aria-hidden><span/><i/><span/></span>
            <div><p>{running?L({hi:"अगला स्टॉप",en:"Next stop"}):L({hi:"यहाँ से शुरू",en:"Start from"})}</p><strong><span className="dv-value">{running?(next?.name || r.school.name):from || L({hi:"स्टॉप नहीं जुड़ा",en:"No stop added"})}</span></strong><p className="dispatch-end">{L({hi:"मंज़िल",en:"Finish at"})} · <span className="dv-value">{to}</span></p></div>
          </div>
          <div className="dispatch-manifest dv-in2" style={dvI(3)}><span><UsersRound size={16} aria-hidden/><span className="dv-value">{kids}</span> {L({hi:"बच्चे",en:kids===1?"child":"children"})}</span><span><span className="dv-value">{order.length}</span> {L({hi:"स्टॉप",en:"stops"})}</span>{km && <span><span className="dv-value">{km}</span> km <small>{L({hi:"रूट",en:"route"})}</small></span>}</div>
          {running && <p className="dispatch-recorded">{L({hi:`${done} स्टॉप पूरे · ${marked} बच्चों की एंट्री`,en:`${done} stops completed · ${marked} children marked`})}</p>}
          {startError&&<p role="alert" className="mb-3 text-[13px] text-rose-700">{startError}</p>}
          <div className="dv-in2" style={dvI(4)}>{running?<Link href="/trip/" className="dispatch-start">{L({hi:"ट्रिप जारी रखें",en:"Resume trip"})}<ArrowRight size={20}/></Link>:<SlideConfirm tone="yellow" sound="start" hold label={L({hi:"ट्रिप शुरू करने को स्वाइप करें",en:"Slide to start trip"})} disabled={!order.length} onConfirm={()=>{setStartError("");router.push(`/trip/?kind=${kind}`);return true}}/>}</div>
        </section></div>
        {r.absent.length>0 && <p className="dispatch-absence">{L({hi:`आज ${r.absent.length} बच्चे नहीं आएँगे। लिस्ट से हटा दिए हैं।`,en:`${r.absent.length} absent today, already excluded from the list.`})}</p>}
        <section key={`stops-${kind}`} className={clsx("dispatch-stops dv-in", switched && "dv-again")} style={dvI(3)}><h2><button type="button" className="dispatch-stops-toggle" aria-expanded={stopsOpen} aria-controls="driver-todays-stops" onClick={()=>setStopsOpen(open=>!open)}><span>{L({hi:"आज के स्टॉप",en:"Today's stops"})}</span><ChevronDown size={19} aria-hidden className={stopsOpen?"is-open":""}/></button></h2><div className="dispatch-stops-reveal" data-open={stopsOpen} aria-hidden={!stopsOpen}><div id="driver-todays-stops"><ol>
          {!morning && (<li className="dispatch-school"><School size={19} aria-hidden/><div><strong>{r.school.name}</strong><span>{morning?L({hi:"स्कूल पहुँचें",en:"Arrive at school"}):L({hi:"स्कूल से निकलें",en:"Depart from school"})}</span></div></li>)}
          {order.map((stop,i)=>{const passed=!!running?.done.includes(stop.name);const current=!!running&&next?.name===stop.name;return <li key={stop.name} className={clsx("dv-row",passed&&"is-done",current&&"is-next")} style={dvI(i)}><span className="dispatch-stop-number" aria-label={passed?L({hi:"पूरा",en:"Completed"}):undefined}>{passed?<Check size={15} aria-hidden/>:i+1}</span><div><strong>{stop.name}</strong><span>{stop.kids.length} {L({hi:"बच्चे",en:stop.kids.length===1?"child":"children"})}{current?` · ${L({hi:"अगला स्टॉप",en:"Next stop"})}`:""}</span></div><time>{morning&&stop.time?clock(stop.time):""}</time></li>})}
          {morning && (<li className="dispatch-school"><School size={19} aria-hidden/><div><strong>{r.school.name}</strong><span>{morning?L({hi:"स्कूल पहुँचें",en:"Arrive at school"}):L({hi:"स्कूल से निकलें",en:"Depart from school"})}</span></div></li>)}
        </ol></div></div></section>
      </div>
    </div>
  );
}


/** Stagger index for the entrance (see .dv-in / .dv-in2 / .dv-row in driver-dispatch.css). */
const dvI = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Home while the route is still coming (first open, slow network): the real card with its labels already in
 * place; only the values are grey bars of about their size, under one shared light sweep. When the data comes,
 * the bars become the values in the same place (nothing jumps).
 */
function HomeSkeleton({ kind }: { kind: TripKind }) {
  const L = useL();
  const bar = (w: string, block = false) => <i className={clsx("dv-bar", block && "dv-bar-block")} style={{ width: w }} aria-hidden />;
  return (
    <div className="dispatch-main" aria-busy="true">
      <div className="dispatch-title dv-in" style={dvI(0)}><h1>{L({hi:"आज का सफ़र",en:"Today's route"})}</h1>{bar("44px")}</div>
      <div className="dispatch-tabs dv-in" style={dvI(1)} aria-hidden>{(["morning","afternoon"] as const).map(x=><button key={x} tabIndex={-1} aria-checked={kind===x} role="radio">{x==="morning"?L({hi:"सुबह · स्कूल",en:"Morning · school"}):L({hi:"छुट्टी · घर",en:"Afternoon · home"})}</button>)}</div>
      <div className="dispatch-glow dv-card"><section className="dispatch-sheet">
        <div className="dispatch-vehicle dv-in2" style={dvI(0)}><span><BusFront size={19} aria-hidden/>{bar("92px")}</span>{bar("64px")}</div>
        <h2 className="dv-in2" style={dvI(1)}>{bar("86%", true)}{bar("52%", true)}</h2>
        <div className="dispatch-destination dv-in2" style={dvI(2)}>
          <span className="dispatch-route-mark dv-mark" aria-hidden><span/><i/><span/></span>
          <div className="min-w-0 flex-1"><p>{L({hi:"यहाँ से शुरू",en:"Start from"})}</p><strong>{bar("58%")}</strong><p className="dispatch-end">{L({hi:"मंज़िल",en:"Finish at"})} · {bar("110px")}</p></div>
        </div>
        <div className="dispatch-manifest dv-in2" style={dvI(3)}><span><UsersRound size={16} aria-hidden/>{bar("18px")} {L({hi:"बच्चे",en:"children"})}</span><span>{bar("10px")} {L({hi:"स्टॉप",en:"stops"})}</span><span>{bar("24px")} km</span></div>
        <div className="dv-in2 dv-slide-wait" style={dvI(4)} aria-hidden />
      </section></div>
      <section className="dispatch-stops dv-in" style={dvI(3)}><h2><span className="dispatch-stops-toggle"><span>{L({hi:"आज के स्टॉप",en:"Today's stops"})}</span><ChevronDown size={19} aria-hidden/></span></h2></section>
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
