"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bus, ChevronDown, ChevronLeft, ChevronRight, Info, MapPin, Play, RefreshCw, TriangleAlert, X } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { DEMO } from "@/lib/demo";
import { useL } from "@/lib/i18n";
import { readAlertClose } from "@/lib/driverPrefs";
import {
  AT_M,
  DELAY_REASONS,
  NEAR_M,
  along,
  defaultKind,
  distText,
  metres,
  minutesFor,
  nearestIdx,
  tripPath,
  tripStops,
  type BusRoute,
  type LatLng,
  type RouteData,
  type Trip,
  type TripKind,
} from "@/lib/bus";
import { BusMap, type MapStop } from "@/components/BusMap";
import { ErrorCard, Skeleton } from "@/components/ui";
import { DropAlert } from "@/components/driver/DropAlert";
import { StopSheet } from "@/components/driver/StopSheet";
import { DelaySheet } from "@/components/driver/DelaySheet";
import { Faces, ding, timeOf } from "@/components/driver/parts";

const SEND_EVERY_MS = 10_000;
/** In manual-close mode the alert still goes once the bus has stood at the stop and driven this far on. */
const LEFT_STOP_M = 80;

// Demo only: where the unsaved stop really is, so the pretend bus has somewhere to drive.
const DEMO_UNSAVED: Record<string, LatLng> = { "Mahabar Road": { lat: 25.7446, lng: 71.4079 } };

/** Degrees from north going from a to b. */
function bearing(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/**
 * The driver's trip. Before it starts: the whole route from above and one Start button.
 * While it runs: a driving view of the map (close, tilted, turning with the bus), a small sheet
 * below with the next stop, and the trip card behind a button on the top left. About 100 m before
 * a stop a full screen alert shows the child. A stop's place is saved by itself the first time the
 * driver ticks a child there. The screen stays on and the phone's place goes to the school every 10 s.
 */
export default function TripPage() {
  const L = useL();
  const { data, error, reload } = useApi<RouteData>("/bus/route");
  const [route, setRoute] = useState<BusRoute | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [planKind, setPlanKind] = useState<TripKind>(defaultKind);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);
  const [gps, setGps] = useState<"wait" | "on" | "off">("wait");
  const [gpsTry, setGpsTry] = useState(0);
  const [alertFor, setAlertFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"stop" | "delay" | null>(null);
  const [card, setCard] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [fail, setFail] = useState("");
  const [, tick] = useState(0);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("kind");
    if (k === "morning" || k === "afternoon") setPlanKind(k);
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!data) return;
    setRoute(data.route);
    setTrip(data.trip);
  }, [data]);

  const kind = trip?.kind || planKind;
  const morning = kind === "morning";
  const order = useMemo(() => (route ? tripStops(route, kind) : []), [route, kind]);
  const pts = useMemo(() => (route ? tripPath(route, kind) : []), [route, kind]);
  const nextIdx = trip ? order.findIndex((s) => !trip.done.includes(s.name)) : -1;
  const next = nextIdx >= 0 ? order[nextIdx] : null;
  const nextAt: LatLng | null = next && next.lat !== null && next.lng !== null ? { lat: next.lat, lng: next.lng } : null;
  const schoolAt: LatLng | null = route && route.school.lat !== null && route.school.lng !== null ? { lat: route.school.lat, lng: route.school.lng } : null;
  const dist = pos && nextAt ? metres(pos, nextAt) : null;

  /* ── keep the screen on while a trip runs ── */
  useEffect(() => {
    if (!trip) return;
    let lock: any = null;
    const ask = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        /* not allowed (low battery, old phone): the driver keeps it on by hand */
      }
    };
    const back = () => document.visibilityState === "visible" && ask();
    ask();
    document.addEventListener("visibilitychange", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      lock?.release?.().catch(() => {});
    };
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── where the bus is, and which way it faces ── */
  const target = useRef<LatLng | null>(null);
  target.current = nextAt || (next && DEMO_UNSAVED[next.name]) || (morning && !next ? schoolAt : null);
  const ptsRef = useRef(pts);
  ptsRef.current = pts;
  const lastTurn = useRef<LatLng | null>(null);
  const place = useCallback((p: LatLng) => {
    setPos(p);
    // Turn only after a few metres, so standing still (GPS wobble) doesn't spin the map.
    const from = lastTurn.current;
    if (!from) lastTurn.current = p;
    else if (metres(from, p) > 6) {
      setHeading(bearing(from, p));
      lastTurn.current = p;
    }
  }, []);

  useEffect(() => {
    if (!trip || !route) return;
    if (DEMO) {
      // A pretend bus that drives along the road line towards the next stop and waits there.
      const line = ptsRef.current;
      let p: LatLng = line.length ? { lat: line[0][0] - 0.0009, lng: line[0][1] - 0.0007 } : schoolAt || { lat: 25.75, lng: 71.4 };
      let i = 0;
      place(p);
      setGps("on");
      setKmh(28);
      const t = setInterval(() => {
        const to = target.current;
        if (!to) return;
        const ln = ptsRef.current;
        const ti = ln.length ? nearestIdx(ln, to) : -1;
        let budget = 45;
        for (let guard = 0; guard < 80 && budget > 0; guard++) {
          const goal: LatLng = ti >= 0 && i <= ti ? { lat: ln[i][0], lng: ln[i][1] } : to;
          const d = metres(p, goal);
          if (d <= budget) {
            p = goal;
            budget -= d;
            if (ti >= 0 && i <= ti) i++;
            else break;
          } else {
            p = { lat: p.lat + ((goal.lat - p.lat) * budget) / d, lng: p.lng + ((goal.lng - p.lng) * budget) / d };
            budget = 0;
          }
        }
        place(p);
        setKmh(metres(p, to) < 8 ? 0 : 28 + Math.round(Math.random() * 6));
      }, 700);
      return () => clearInterval(t);
    }
    if (!("geolocation" in navigator)) {
      setGps("off");
      return;
    }
    setGps("wait");
    let last: { p: LatLng; t: number } | null = null;
    const id = navigator.geolocation.watchPosition(
      (g) => {
        const p = { lat: g.coords.latitude, lng: g.coords.longitude };
        place(p);
        if (g.coords.heading !== null && !Number.isNaN(g.coords.heading) && (g.coords.speed || 0) > 1.5) setHeading(g.coords.heading);
        setGps("on");
        // The phone's own speed when it gives one, else from the last two places.
        if (g.coords.speed !== null && g.coords.speed >= 0) setKmh(Math.round(g.coords.speed * 3.6));
        else if (last && g.timestamp > last.t) setKmh(Math.round((metres(last.p, p) / ((g.timestamp - last.t) / 1000)) * 3.6));
        last = { p, t: g.timestamp };
      },
      () => setGps("off"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [trip?.id, route?.id, gpsTry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the school where the bus is, every 10 seconds.
  const lastPos = useRef<LatLng | null>(null);
  lastPos.current = pos;
  useEffect(() => {
    if (!trip) return;
    const t = setInterval(() => {
      const p = lastPos.current;
      if (p) api("/bus/position", { body: { tripId: trip.id, lat: p.lat, lng: p.lng } }).catch(() => {});
    }, SEND_EVERY_MS);
    return () => clearInterval(t);
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── about 100 m before a stop: the full screen alert, once per stop ── */
  useEffect(() => setAlertFor(null), [next?.name]);
  const warned = useRef<string | null>(null);
  const autoClose = useRef(true);
  useEffect(() => {
    if (!next || dist === null || dist > NEAR_M || warned.current === next.name || sheet === "stop") return;
    warned.current = next.name;
    autoClose.current = readAlertClose() === "auto";
    reached.current = false;
    setAlertFor(next.name);
    ding(2);
    navigator.vibrate?.([300, 120, 300, 120, 300]);
  }, [next?.name, dist !== null && dist <= NEAR_M]); // eslint-disable-line react-hooks/exhaustive-deps
  // Manual mode: once the bus has stood at the stop and driven on, the alert goes by itself.
  const reached = useRef(false);
  useEffect(() => {
    if (!alertFor || dist === null) return;
    if (dist <= AT_M) reached.current = true;
    else if (reached.current && dist > LEFT_STOP_M) setAlertFor(null);
  }, [alertFor, dist]);

  /* ── actions ── */
  const act = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true);
      setFail("");
      try {
        const r = await api<{ trip?: Trip; route?: BusRoute }>(path, { body });
        if (r.trip) setTrip(r.trip);
        if (r.route) setRoute(r.route);
        return true;
      } catch (e: any) {
        setFail(e?.status === 0 ? L({ hi: "इंटरनेट नहीं है, फिर दबाएँ।", en: "No internet. Tap again." }) : e?.message || L({ hi: "नहीं हो पाया, फिर दबाएँ।", en: "Could not save. Tap again." }));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [L]
  );

  /** A stop without a saved place gets the bus's place the first time the driver works there. */
  async function savePlaceIfNew() {
    if (next && !nextAt && pos) await act("/bus/stop-location", { stop: next.name, lat: pos.lat, lng: pos.lng });
  }

  async function start() {
    if (await act("/bus/trip", { kind: planKind })) window.history.replaceState(null, "", "/trip/");
  }

  async function endTrip() {
    if (!sure) {
      setSure(true);
      setTimeout(() => setSure(false), 4000);
      return;
    }
    setBusy(true);
    try {
      await api("/bus/trip/end", { body: {} });
      window.location.replace("/");
    } catch {
      setBusy(false);
      setFail(L({ hi: "ट्रिप बंद नहीं हुई, फिर दबाएँ।", en: "Could not end the trip. Tap again." }));
    }
  }

  /* ── screens ── */
  if (!data || !route) {
    const none = error?.status === 404 || error?.status === 403 || (data && !route);
    return (
      <Shell>
        <div className="pt-safe space-y-3 p-4">
          {none ? (
            <>
              <p className="text-[15px] font-semibold">{L({ hi: "आपको अभी कोई रूट नहीं दिया गया।", en: "No route is assigned to you yet." })}</p>
              <Link href="/" className="d-btn d-btn-k w-full">
                {L({ hi: "होम पर जाएँ", en: "Go to Home" })}
              </Link>
            </>
          ) : error && error.status !== 401 ? (
            <ErrorCard offline={error.status === 0} onRetry={reload} />
          ) : (
            <Skeleton className="h-[60dvh] w-full rounded-[14px]" />
          )}
        </div>
      </Shell>
    );
  }

  // Pins in driving order: the school starts the afternoon run and ends the morning one.
  const stopPins: MapStop[] = order
    .filter((s) => s.lat !== null && s.lng !== null)
    .map((s) => ({ name: s.name, lat: s.lat!, lng: s.lng!, state: trip ? (trip.done.includes(s.name) ? "done" : s === next ? "next" : "later") : "later" }));
  const schoolPin: MapStop[] = schoolAt ? [{ name: route.school.name, ...schoolAt, state: morning ? "end" : "start" }] : [];
  if (!morning && stopPins.length && stopPins[stopPins.length - 1].state === "later") stopPins[stopPins.length - 1].state = "end";
  if (morning && stopPins.length && stopPins[0].state === "later" && !trip) stopPins[0].state = "start";
  const pins = morning ? [...stopPins, ...schoolPin] : [...schoolPin, ...stopPins];

  const kidsAll = order.flatMap((s) => s.kids);
  const kmTotal = route.path ? route.path.m / 1000 : null;
  const label = morning ? L({ hi: "सुबह · स्कूल ले जाना", en: "Morning · to school" }) : L({ hi: "छुट्टी · घर छोड़ना", en: "Afternoon · home" });

  /* Before the trip: the whole route and one Start button. */
  if (!trip)
    return (
      <Shell>
        <BusMap stops={pins} path={pts} bus={null} className="absolute inset-0" label={L({ hi: "रूट का नक्शा", en: "Route map" })} bottomInset={230} />
        <div className="pt-safe absolute inset-x-4 top-0 z-[600] flex gap-2">
          <Link href="/" className="mt-3 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.08)]" aria-label={L({ hi: "होम", en: "Home" })}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <button
            onClick={() => setPlanKind(morning ? "afternoon" : "morning")}
            className="mt-3 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-4 pr-3 text-left text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.08)]"
            aria-label={L({ hi: "सुबह / छुट्टी बदलें", en: "Switch morning / afternoon" })}
          >
            <span className="min-w-0 flex-1 truncate">
              {route.name} · {label}
            </span>
            <RefreshCw className="h-4 w-4 shrink-0 text-drv-mute" aria-hidden />
          </button>
        </div>
        <div className="pb-safe absolute inset-x-0 bottom-0 z-[600] rounded-t-[20px] bg-white px-4 pt-4 shadow-[0_-4px_20px_rgba(0,0,0,.08)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] text-drv-mute">{L({ hi: "आज का रास्ता", en: "Today's route" })}</p>
              <p className="text-[16px] font-semibold">{L({ hi: `${order.length} स्टॉप · ${kidsAll.length} बच्चे`, en: `${order.length} stops · ${kidsAll.length} children` })}</p>
            </div>
            {kmTotal !== null && (
              <div className="text-right">
                <p className="text-[12px] text-drv-mute">{kmTotal.toFixed(1)} km</p>
                <p className="text-[16px] font-semibold">~{minutesFor(route.path!.m, false)} {L({ hi: "मिनट", en: "min" })}</p>
              </div>
            )}
          </div>
          {route.absent.length > 0 && (
            <p className="mt-3 flex gap-2 rounded-[10px] bg-drv-note px-3 py-2.5 text-[12.5px] leading-snug text-[#4A3F00]">
              <Info className="mt-px h-[15px] w-[15px] shrink-0 text-drv-gold" aria-hidden />
              <span>
                {L({ hi: `${route.absent.map((a) => a.name).join(", ")} आज नहीं आ रहे। ये लिस्ट में नहीं हैं और इनके स्टॉप पर अलर्ट नहीं बजेगा।`, en: `${route.absent.map((a) => a.name).join(", ")} not coming today. Not in the list, and no alert for them.` })}
              </span>
            </p>
          )}
          {fail && <p className="mt-2 text-[13px] text-rose-600">{fail}</p>}
          <button onClick={start} disabled={busy || !order.length} className="d-btn d-btn-y my-4 w-full">
            <Play className="h-[14px] w-[14px]" fill="currentColor" aria-hidden />
            {L({ hi: "ट्रिप शुरू करें", en: "Start trip" })}
          </button>
        </div>
      </Shell>
    );

  /* The trip is running. */
  const doneCount = order.filter((s) => trip.done.includes(s.name)).length;
  const ticked = kidsAll.filter((k) => trip.marks[k.id]).length;
  const onBoard = morning ? ticked : kidsAll.length - ticked;
  const bi = pts.length > 1 && pos ? nearestIdx(pts, pos) : null;
  const left = bi !== null ? along(pts, bi, pts.length - 1) : null;
  const toNext = (() => {
    if (!nextAt) return null;
    if (bi === null) return dist;
    const si = nearestIdx(pts, nextAt);
    return si >= bi ? Math.max(dist || 0, along(pts, bi, si)) : dist;
  })();
  const minsNext = toNext !== null ? minutesFor(toNext, false) : null;
  const endAt = left !== null ? timeOf(new Date(Date.now() + minutesFor(left, false) * 60_000).toISOString()) : null;
  const sinceMin = Math.max(0, Math.round((Date.now() - Date.parse(trip.startedAt)) / 60_000));
  const from = morning ? order[0]?.name : route.school.name;
  const to = morning ? route.school.name : order[order.length - 1]?.name;
  const delay = trip.delay ? DELAY_REASONS.find((r) => r.id === trip.delay!.reason) : null;
  const alertStop = alertFor ? order.find((s) => s.name === alertFor) || null : null;
  const pct = order.length ? Math.round((doneCount / order.length) * 100) : 0;
  // How much of the map the bottom sheet covers (the driving view keeps the bus above it).
  const inset = !next ? 250 : open ? 380 : 172;

  return (
    <Shell>
      <BusMap stops={pins} path={pts} bus={pos} heading={heading} mode="nav" className="absolute inset-0" label={L({ hi: "लाइव नक्शा", en: "Live map" })} bottomInset={inset} />

      {/* Top left: the trip card opens from this button. */}
      <div className="pt-safe absolute inset-x-3 top-0 z-[600]">
        <button
          onClick={() => setCard((c) => !c)}
          aria-expanded={card}
          aria-label={card ? L({ hi: "ट्रिप कार्ड बंद करें", en: "Close the trip card" }) : L({ hi: "ट्रिप की जानकारी", en: "Trip details" })}
          className="relative mt-3 grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_14px_rgba(0,0,0,.12)] active:bg-drv-soft"
        >
          {card ? <X className="h-5 w-5" aria-hidden /> : <Bus className="h-5 w-5" aria-hidden />}
          <span className={clsx("absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white", gps === "on" ? "bg-drv-mint" : gps === "off" ? "bg-rose-600" : "bg-drv-faint")} aria-hidden />
        </button>

        <section
          className={clsx(
            "d-card mt-2 origin-top-left px-3.5 pt-3 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]",
            card ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-[.97] opacity-0"
          )}
          aria-hidden={!card}
        >
          <div className="flex items-start gap-2.5">
            <Link href="/" tabIndex={card ? 0 : -1} className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full active:bg-drv-soft" aria-label={L({ hi: "होम", en: "Home" })}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] text-drv-mute">{L({ hi: "गाड़ी नंबर", en: "Vehicle number" })}</p>
              <p className="truncate text-[16px] font-semibold tracking-[0.01em]">{route.vehicleNo || route.name}</p>
            </div>
            <span className={gps === "on" ? "d-live mt-2" : clsx("mt-2 h-[7px] w-[7px] rounded-full", gps === "off" ? "bg-rose-600" : "bg-drv-faint")} aria-label={gps === "on" ? "GPS on" : "GPS off"} />
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{from}</p>
              <p className="text-[11.5px] text-drv-mute">{timeOf(trip.startedAt)}</p>
            </div>
            <div className="relative grid h-[18px] w-16 place-items-center before:absolute before:inset-x-0 before:top-1/2 before:border-t-[1.5px] before:border-dashed before:border-[#D3D3CF]">
              <Bus className="relative h-[15px] w-[26px] bg-white px-[5px] text-drv-green" aria-hidden />
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-[13px] font-semibold">{to}</p>
              <p className="text-[11.5px] text-drv-mute">{endAt ? `~${endAt}` : "—"}</p>
            </div>
          </div>
          <dl className="mt-2.5 grid grid-cols-3 border-t border-drv-line text-center">
            <div className="py-2">
              <dt className="text-[11px] text-drv-mute">{L({ hi: "बची दूरी", en: "Distance left" })}</dt>
              <dd className="text-[14px] font-semibold">{left !== null ? distText(left) : "—"}</dd>
            </div>
            <div className="border-l border-drv-line py-2">
              <dt className="text-[11px] text-drv-mute">{L({ hi: "रफ़्तार", en: "Speed" })}</dt>
              <dd className="text-[14px] font-semibold">{kmh !== null ? `${kmh} km/h` : "—"}</dd>
            </div>
            <div className="border-l border-drv-line py-2">
              <dt className="text-[11px] text-drv-mute">{L({ hi: "बस में", en: "On board" })}</dt>
              <dd className="text-[14px] font-semibold">{onBoard}</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between border-t border-drv-line py-2.5">
            <span className="text-[12px] text-drv-mute">
              {label} · {L({ hi: `${sinceMin} मिनट से`, en: `${sinceMin} min` })}
            </span>
            <button onClick={endTrip} disabled={busy} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-semibold", sure ? "bg-rose-600 text-white" : "text-rose-600 active:bg-rose-50")}>
              {sure ? L({ hi: "पक्का, बंद करें", en: "Yes, end" }) : L({ hi: "ट्रिप बंद करें", en: "End trip" })}
            </button>
          </div>
        </section>
      </div>

      {/* What the map can't show yet: no GPS, or a route with no saved stop places. */}
      {(gps !== "on" || (!pts.length && !pins.length)) && !card && (
        <div className="pt-safe pointer-events-none absolute inset-x-3 top-0 z-[590] flex justify-center">
          {gps === "off" ? (
            <div className="pointer-events-auto mt-[68px] w-full rounded-[14px] bg-drv-black px-3.5 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,.25)]">
              <p className="text-[14px] font-semibold">{L({ hi: "फ़ोन की लोकेशन नहीं मिल रही", en: "Can't get the phone's location" })}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-white/70">
                {L({ hi: "फ़ोन में Location चालू करें और इस ऐप को लोकेशन की इजाज़त दें। तभी बस नक्शे पर दिखेगी और स्टॉप का अलर्ट आएगा।", en: "Turn on Location and allow this app to use it. Only then the bus shows on the map and stop alerts come." })}
              </p>
              <button onClick={() => setGpsTry((x) => x + 1)} className="mt-2.5 rounded-[10px] bg-drv-yellow px-3.5 py-2 text-[13px] font-semibold text-black active:translate-y-px">
                {L({ hi: "फिर कोशिश करें", en: "Try again" })}
              </button>
            </div>
          ) : gps === "wait" ? (
            <span className="d-chip mt-[72px] bg-white px-3 py-1.5 text-[12.5px] shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_14px_rgba(0,0,0,.10)]">{L({ hi: "बस की लोकेशन ढूँढ रहे हैं…", en: "Finding the bus's location…" })}</span>
          ) : (
            <span className="d-chip mt-[72px] max-w-full whitespace-normal bg-white px-3 py-1.5 text-center text-[12.5px] leading-snug shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_14px_rgba(0,0,0,.10)]">
              {L({ hi: "पहली ट्रिप: हर स्टॉप पर बच्चे टिक करते ही वो स्टॉप नक्शे पर जुड़ जाएगा", en: "First trip: each stop joins the map as you tick children there" })}
            </span>
          )}
        </div>
      )}

      {/* Bottom sheet: small while driving; the handle opens the rest. */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-[600] rounded-t-[20px] bg-white px-4 shadow-[0_-4px_20px_rgba(0,0,0,.08)]">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full justify-center pb-2 pt-2.5" aria-expanded={open} aria-label={open ? L({ hi: "छोटा करें", en: "Show less" }) : L({ hi: "और दिखाएँ", en: "Show more" })}>
          <span className="h-1 w-9 rounded-full bg-[#DEDEDA]" aria-hidden />
        </button>

        {next ? (
          <>
            <button onClick={() => setSheet("stop")} className="flex w-full items-start justify-between gap-3 text-left">
              <span className="min-w-0">
                <span className="block text-[11.5px] font-semibold text-drv-green">
                  {L({ hi: `अगला स्टॉप · ${nextIdx + 1}/${order.length}`, en: `Next stop · ${nextIdx + 1}/${order.length}` })}
                </span>
                <span className="block truncate text-[17px] font-semibold">{next.name}</span>
                <span className="block text-[12.5px] text-drv-mute">
                  {morning ? L({ hi: `${next.kids.length} बच्चे चढ़ेंगे`, en: `${next.kids.length} getting on` }) : L({ hi: `${next.kids.length} बच्चे उतरेंगे`, en: `${next.kids.length} getting off` })}
                  {minsNext !== null ? L({ hi: ` · करीब ${minsNext} मिनट`, en: ` · about ${minsNext} min` }) : ""}
                </span>
              </span>
              {toNext !== null && <span className="shrink-0 pt-3 text-[20px] font-semibold text-drv-green">{distText(toNext)}</span>}
            </button>

            <div className={clsx("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="min-h-0 overflow-hidden">
                <div className="flex items-center justify-between pt-3">
                  <Faces kids={next.kids} more={(n) => L({ hi: `+${n} और`, en: `+${n} more` })} />
                  <span className="text-[12px] text-drv-mute">{L({ hi: `बस में ${onBoard}`, en: `${onBoard} on board` })}</span>
                </div>
                <div className="mb-1.5 mt-4 h-1 overflow-hidden rounded-full bg-[#EDEDEA]">
                  <div className="h-full rounded-full bg-drv-mint transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[12px] text-drv-mute">
                  <b className="mr-1.5 text-[13px] font-semibold text-drv-green">{pct}%</b>
                  {L({ hi: `${order.length} में से ${doneCount} स्टॉप पूरे`, en: `${doneCount} of ${order.length} stops done` })}
                </p>
                {delay && trip.delay && (
                  <button onClick={() => setSheet("delay")} className="mt-3 flex w-full items-center gap-2 rounded-[10px] bg-drv-note px-3 py-2 text-left text-[12.5px] text-[#4A3F00]">
                    <TriangleAlert className="h-4 w-4 shrink-0 text-drv-gold" aria-hidden />
                    <span className="min-w-0 flex-1">{L({ hi: `पैरेंट्स को बताया: ${trip.delay.minutes} मिनट देर · ${delay.hi}`, en: `Parents told: ${trip.delay.minutes} min late · ${delay.en}` })}</span>
                  </button>
                )}
              </div>
            </div>

            {fail && !sheet && <p className="mt-2 text-[13px] text-rose-600">{fail}</p>}
            <div className="mt-3 flex gap-2 pb-4">
              <button onClick={() => setSheet("delay")} className="d-btn d-btn-line shrink-0 px-3.5">
                <TriangleAlert className="h-4 w-4 text-drv-gold" aria-hidden />
                {L({ hi: "देरी", en: "Late" })}
              </button>
              <button onClick={() => setSheet("stop")} className="d-btn d-btn-k flex-1">
                {L({ hi: "स्टॉप पर पहुँचे", en: "At the stop" })}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={() => setOpen((o) => !o)} className="d-btn d-btn-line shrink-0 px-3" aria-label={open ? L({ hi: "छोटा करें", en: "Show less" }) : L({ hi: "और दिखाएँ", en: "Show more" })}>
                <ChevronDown className={clsx("h-4 w-4 transition-transform duration-300", !open && "rotate-180")} aria-hidden />
              </button>
            </div>
          </>
        ) : (
          <div className="pb-4">
            <p className="text-[16px] font-semibold">{L({ hi: "सारे स्टॉप हो गए", en: "All stops done" })}</p>
            <p className="mt-0.5 text-[12.5px] text-drv-mute">
              {ticked} / {kidsAll.length} {morning ? L({ hi: "बच्चे चढ़े", en: "children got on" }) : L({ hi: "बच्चे उतरे", en: "children got off" })}
            </p>
            {!morning && ticked < kidsAll.length && <p className="mt-1.5 text-[12.5px] font-semibold text-rose-600">{L({ hi: "बस में कोई बच्चा रह तो नहीं गया? एक बार देख लें।", en: "Is any child still on the bus? Check once." })}</p>}
            {morning && !schoolAt && (
              <button disabled={!pos || busy} onClick={() => pos && act("/bus/school-location", { lat: pos.lat, lng: pos.lng })} className="d-btn d-btn-line mt-3 w-full">
                <MapPin className="h-4 w-4" aria-hidden />
                {L({ hi: "बस स्कूल पर है, जगह सेव करें", en: "The bus is at school, save its place" })}
              </button>
            )}
            {fail && !sheet && <p className="mt-2 text-[13px] text-rose-600">{fail}</p>}
            <button onClick={endTrip} disabled={busy} className={clsx("d-btn mt-3 w-full", sure ? "bg-rose-600 text-white" : "d-btn-y")}>
              {sure ? L({ hi: "पक्का, ट्रिप बंद करें", en: "Yes, end the trip" }) : L({ hi: "ट्रिप पूरी करें", en: "Finish the trip" })}
            </button>
          </div>
        )}
      </div>

      {alertStop && (
        <DropAlert
          key={alertStop.name}
          stop={alertStop}
          kind={trip.kind}
          dist={dist}
          auto={autoClose.current}
          onClose={() => setAlertFor(null)}
          onOk={() => {
            setAlertFor(null);
            setSheet("stop");
          }}
        />
      )}

      {sheet === "stop" && next && (
        <StopSheet
          stop={next}
          no={nextIdx + 1}
          trip={trip}
          absent={route.absent.filter((a) => a.stop === next.name).map((a) => a.name)}
          busy={busy}
          fail={fail}
          onTick={async (kidId, on) => {
            await savePlaceIfNew();
            act("/bus/mark", { kidId, on });
          }}
          onDone={async () => {
            await savePlaceIfNew();
            if (await act("/bus/stop-done", { stop: next.name })) setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "delay" && (
        <DelaySheet
          routeName={route.name}
          onBoard={kidsAll.length}
          current={trip.delay}
          busy={busy}
          fail={fail}
          onSend={async (reason, minutes) => {
            if (await act("/bus/delay", { reason, minutes })) setSheet(null);
          }}
          onClear={async () => {
            if (await act("/bus/delay", { reason: "clear" })) setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </Shell>
  );
}

/** Full screen over the app's bars: the trip is all the driver needs while driving. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="drv fixed inset-0 z-30 mx-auto max-w-[560px] overflow-hidden bg-[#F2F2EF]">{children}</div>;
}
