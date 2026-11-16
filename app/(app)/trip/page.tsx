"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Bus, ChevronDown, ChevronLeft, ChevronRight, Info, MapPin, Play, RefreshCw, TriangleAlert, X } from "lucide-react";
import { api, patchMemory, useApi } from "@/lib/api";
import { useDialog } from "@/lib/useDialog";
import { PRETEND_BUS } from "@/lib/demo";
import { useFilledRoute } from "@/lib/routeFill";
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
import { SlideConfirm } from "@/components/driver/SlideConfirm";
import { markTripEndSound, markTripStartSound, playTripStartIfNew, startTripClicks } from "@/lib/slideFeedback";
import { ALERT_BUZZ, DONE_BUZZ, useHapticsReady, vibrate } from "@/lib/haptics";
import { BusMap, type MapStop } from "@/components/BusMap";
import { ErrorCard } from "@/components/ui";
import { DropAlert } from "@/components/driver/DropAlert";
import { StopSheet } from "@/components/driver/StopSheet";
import { DelaySheet } from "@/components/driver/DelaySheet";
import { Faces, ding, timeOf } from "@/components/driver/parts";

const SEND_EVERY_MS = 10_000;
/** Never publish a stationary old fix as a current bus position. */
const MAX_FIX_AGE_MS = 30_000;
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
  const router = useRouter();
  const { data, error, reload } = useApi<RouteData>("/bus/route");
  const [rawRoute, setRoute] = useState<BusRoute | null>(null);
  // Stops with no saved place get one looked up (phone only), so the line, pins, km and the bus all work.
  const route = useFilledRoute(rawRoute);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [planKind, setPlanKind] = useState<TripKind>(defaultKind);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);
  // The bottom sheet's real height, measured, so the map buttons and the bus always sit just above it
  // (the sheet grows with "Can't swipe?", a delay line or a long stop name; a fixed number hid the buttons).
  const [sheetH, setSheetH] = useState(0);
  const sheetObs = useRef<ResizeObserver | null>(null);
  const sheetRef = useCallback((el: HTMLDivElement | null) => {
    sheetObs.current?.disconnect();
    sheetObs.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSheetH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    sheetObs.current = ro;
  }, []);
  const [gps, setGps] = useState<"wait" | "on" | "off">("wait");
  const [gpsTry, setGpsTry] = useState(0);
  const [gpsProblem, setGpsProblem] = useState<"denied" | "timeout" | "unavailable" | "stale" | "unsupported" | null>(null);
  const [syncState, setSyncState] = useState<"waiting" | "sending" | "synced" | "error">("waiting");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const lastFix = useRef<(LatLng & { receivedAt: number }) | null>(null);
  const mutation = useRef(false);
  const confirmation = useRef<HTMLDivElement>(null);
  const [alertFor, setAlertFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"stop" | "delay" | null>(null);
  const [card, setCard] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [fail, setFail] = useState("");
  const [, tick] = useState(0);
  const closeConfirmation = useCallback(() => { if (!mutation.current) setSure(false); }, []);
  useDialog(sure, confirmation, closeConfirmation, busy);

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
    let active = true;
    let requesting = false;
    const ask = async () => {
      if (!active || requesting || lock?.released === false || document.visibilityState !== "visible") return;
      requesting = true;
      try {
        const acquired = await (navigator as any).wakeLock?.request("screen");
        if (!active) { await acquired?.release?.(); return; }
        lock = acquired;
      } catch {
        /* Unsupported or battery-constrained: the rest of the trip remains usable. */
      } finally {
        requesting = false;
      }
    };
    const back = () => document.visibilityState === "visible" && ask();
    ask();
    document.addEventListener("visibilitychange", back);
    return () => {
      active = false;
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
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return;
    lastFix.current = { ...p, receivedAt: Date.now() };
    setGpsProblem(null);
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
    lastFix.current = null;
    lastTurn.current = null;
    setPos(null);
    setHeading(null);
    setKmh(null);
    setGpsProblem(null);
    if (PRETEND_BUS) {
      // A pretend bus that drives along the road line towards the next stop and waits there.
      // It starts at the beginning of the road line. No fixed fallback point any more: until the line (or the
      // next stop's place) is known, the bus waits; when the line arrives or changes, the bus is put on it.
      let cur = ptsRef.current;
      const start = (): LatLng | null => (cur.length ? { lat: cur[0][0], lng: cur[0][1] } : target.current || schoolAt);
      let p: LatLng | null = start();
      let i = 0;
      let lastStep = 0;
      if (p) place(p);
      setGps("on");
      setKmh(28);
      const t = setInterval(() => {
        if (ptsRef.current !== cur) {
          cur = ptsRef.current;
          if (cur.length && (!p || metres(p, { lat: cur[nearestIdx(cur, p)][0], lng: cur[nearestIdx(cur, p)][1] }) > 150)) {
            p = { lat: cur[0][0], lng: cur[0][1] };
            i = 0;
            place(p);
          } else if (cur.length && p) i = nearestIdx(cur, p);
        }
        if (!p) {
          p = start();
          if (p) place(p);
          return;
        }
        const to = target.current;
        if (!to) return;
        const ln = ptsRef.current;
        const ti = ln.length ? nearestIdx(ln, to) : -1;
        // Speed (user, 2026-11-16): twice as quick on the open road (30 m a step), easing smoothly down to the old
        // 15 m between 650 m and 350 m before the stop, then the same slowing as before to a crawl where the
        // children get on or off. Speeding up again after a stop is gradual too (at most 2 m more each step),
        // so there is no jerk either way.
        const left = metres(p, to);
        const want = left > 650 ? 30 : left > 350 ? 15 + ((left - 350) / 300) * 15 : left > 40 ? 4 + ((left - 40) / 310) * 11 : 3;
        const step = Math.min(want, lastStep + 2);
        lastStep = step;
        let budget = step;
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
        setKmh(metres(p, to) < 8 ? 0 : Math.round((step / 0.7) * 3.6));
      }, 700);
      return () => clearInterval(t);
    }
    if (!("geolocation" in navigator)) {
      setGps("off");
      setGpsProblem("unsupported");
      return;
    }
    setGps("wait");
    let last: { p: LatLng; t: number } | null = null;
    let watching = true;
    const id = navigator.geolocation.watchPosition(
      (g) => {
        if (!watching) return;
        if (!Number.isFinite(g.coords.latitude) || !Number.isFinite(g.coords.longitude) || Math.abs(g.coords.latitude) > 90 || Math.abs(g.coords.longitude) > 180) return;
        if (Date.now() - g.timestamp > MAX_FIX_AGE_MS) {
          lastFix.current = null;
          setPos(null);
          setKmh(null);
          setGps("off");
          setGpsProblem("stale");
          return;
        }
        const p = { lat: g.coords.latitude, lng: g.coords.longitude };
        place(p);
        if (g.coords.heading !== null && !Number.isNaN(g.coords.heading) && (g.coords.speed || 0) > 1.5) setHeading(g.coords.heading);
        setGps("on");
        // The phone's own speed when it gives one, else from the last two places.
        if (g.coords.speed !== null && g.coords.speed >= 0) setKmh(Math.round(g.coords.speed * 3.6));
        else if (last && g.timestamp > last.t) setKmh(Math.round((metres(last.p, p) / ((g.timestamp - last.t) / 1000)) * 3.6));
        last = { p, t: g.timestamp };
      },
      (problem) => {
        if (!watching) return;
        lastFix.current = null;
        last = null;
        setPos(null);
        setHeading(null);
        setKmh(null);
        setGps("off");
        setGpsProblem(problem.code === 1 ? "denied" : problem.code === 3 ? "timeout" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    return () => { watching = false; navigator.geolocation.clearWatch(id); };
  }, [trip?.id, route?.id, gpsTry]); // eslint-disable-line react-hooks/exhaustive-deps

  // A soft snap on every tap while the trip screen is open.
  useEffect(() => startTripClicks(), []);

  // A trip was just started from "Slide to confirm": once the running trip screen is up with its route loaded,
  // play the start sound (with a buzz) once. A short pause lets the screen draw first.
  useEffect(() => {
    if (!trip || !route) return;
    const t = setTimeout(playTripStartIfNew, 350);
    return () => clearTimeout(t);
  }, [trip?.id, !!route]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish only fresh fixes; a response failure must not be presented as live sharing.
  useEffect(() => {
    if (!trip) return;
    let active = true;
    let sending = false;
    setSyncState("waiting");
    setLastSyncedAt(null);
    const send = async () => {
      if (!active || sending) return;
      const fix = lastFix.current;
      if (!fix) return;
      if (Date.now() - fix.receivedAt > MAX_FIX_AGE_MS) {
        lastFix.current = null;
        setPos(null);
        setKmh(null);
        setGps("off");
        setGpsProblem("stale");
        setSyncState("waiting");
        return;
      }
      sending = true;
      setSyncState("sending");
      try {
        const result = await api<{ success: boolean }>("/bus/position", { body: { tripId: trip.id, lat: fix.lat, lng: fix.lng } });
        if (!result.success) throw new Error("The trip is no longer accepting location updates.");
        if (active) { setSyncState("synced"); setLastSyncedAt(Date.now()); }
      } catch {
        if (active) setSyncState("error");
      } finally { sending = false; }
    };
    void send();
    const timer = setInterval(() => { void send(); }, SEND_EVERY_MS);
    return () => { active = false; clearInterval(timer); };
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
    vibrate(ALERT_BUZZ);
  }, [next?.name, dist !== null && dist <= NEAR_M]); // eslint-disable-line react-hooks/exhaustive-deps
  // The alert keeps buzzing every few seconds until it is closed, so a glance away does not miss it.
  useEffect(() => {
    if (!alertFor) return;
    const id = setInterval(() => vibrate(ALERT_BUZZ), 3500);
    return () => clearInterval(id);
  }, [alertFor]);
  const hapticsReady = useHapticsReady();
  // Manual mode: once the bus has stood at the stop and driven on, the alert goes by itself.
  const reached = useRef(false);
  useEffect(() => { warned.current = null; reached.current = false; setAlertFor(null); }, [trip?.id]);
  useEffect(() => {
    if (!alertFor || dist === null) return;
    if (dist <= AT_M) reached.current = true;
    else if (reached.current && dist > LEFT_STOP_M) setAlertFor(null);
  }, [alertFor, dist]);

  /* ── actions ── */
  const act = useCallback(
    async (path: string, body: unknown, before?: { path: string; body: unknown }) => {
      if (mutation.current) return false;
      mutation.current = true;
      setBusy(true);
      setFail("");
      try {
        if (before) {
          const prepared = await api<{ route?: BusRoute }>(before.path, { body: before.body });
          if (prepared.route) setRoute(prepared.route);
        }
        const r = await api<{ trip?: Trip; route?: BusRoute }>(path, { body });
        if (r.trip) setTrip(r.trip);
        if (r.route) setRoute(r.route);
        return true;
      } catch (e: any) {
        setFail(e?.status === 0 ? L({ hi: "इंटरनेट नहीं है, फिर दबाएँ।", en: "No internet. Tap again." }) : e?.message || L({ hi: "नहीं हो पाया, फिर दबाएँ।", en: "Could not save. Tap again." }));
        return false;
      } finally {
        mutation.current = false;
        setBusy(false);
      }
    },
    [L]
  );

  /** A stop without a saved place gets the bus's place the first time the driver works there. */
  function newStopPlace() {
    const fix = lastFix.current;
    if (next && !nextAt && fix && Date.now() - fix.receivedAt <= MAX_FIX_AGE_MS) {
      return { path: "/bus/stop-location", body: { stop: next.name, lat: fix.lat, lng: fix.lng } };
    }
    return undefined;
  }

  async function start() {
    const saved=await act("/bus/trip", { kind: planKind });
    // The trip starts on this screen's "Slide to confirm"; the start sound plays when the running trip screen is up.
    if(saved){markTripStartSound();window.history.replaceState(null,"","/trip/")}
    return saved;
  }

  function endTrip() {
    if (mutation.current) return;
    setFail("");
    setSure(true);
  }

  async function confirmEndTrip() {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setFail("");
    try {
      await api("/bus/trip/end", { body: {} });
      // Home opens at once (no page reload) and already knows the trip is over; it plays the end sound itself.
      markTripEndSound();
      patchMemory<RouteData>("/bus/route", (old) => ({ ...old, trip: null }));
      router.replace("/");
    } catch (problem: any) {
      setFail(problem?.message || L({ hi: "\u091f\u094d\u0930\u093f\u092a \u092c\u0902\u0926 \u0928\u0939\u0940\u0902 \u0939\u0941\u0908", en: "Could not end the trip. Try again." }));
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }

  /* ── screens ── */
  if (!data || !route) {
    const none = error?.status === 404 || error?.status === 403 || (data && data.route === null);
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
            <ErrorCard offline={error.status === 0} slow={error.message === "timeout"} onRetry={reload} />
          ) : (
            <TripWait />
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
          <Link href="/" className="mt-3 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.08)]" aria-label={L({ hi: "होम", en: "Home" })}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <button
            onClick={() => setPlanKind(morning ? "afternoon" : "morning")}
            disabled={busy}
            className="mt-3 flex min-h-[48px] min-w-0 flex-1 items-center gap-2 rounded-full bg-white pl-4 pr-3 text-left text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_14px_rgba(0,0,0,.08)]"
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
          <div className="my-4"><SlideConfirm tone="yellow" sound="start" hold label={L({hi:"कन्फ़र्म करने को स्वाइप करें",en:"Slide to confirm"})} disabled={busy||!order.length} onConfirm={start}/></div>
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
  const inset = sheetH || (!next ? 250 : open ? 440 : 235);

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
            "d-card mt-2 origin-top-left px-3.5 pt-3 transition-[opacity,transform] duration-200 ease-[cubic-bezier(.16,1,.3,1)]",
            card ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-[.97] opacity-0"
          )}
          aria-hidden={!card}
        >
          <div className="flex items-start gap-2.5">
            <Link href="/" tabIndex={card ? 0 : -1} className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-drv-soft" aria-label={L({ hi: "होम", en: "Home" })}>
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
              <p className="break-words text-[14px] font-semibold leading-snug">{from}</p>
              <p className="text-[11.5px] text-drv-mute">{timeOf(trip.startedAt)}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-drv-mute" aria-hidden />
            <div className="min-w-0 text-right">
              <p className="break-words text-[14px] font-semibold leading-snug">{to}</p>
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
          <p role="status" className="border-t border-drv-line py-2 text-[12.5px] leading-snug text-drv-mute">
            {syncState === "error" ? L({hi:"\u0932\u094b\u0915\u0947\u0936\u0928 \u0928\u0939\u0940\u0902 \u092d\u0947\u091c\u0940 \u0917\u0908",en:"Location not sent"}) : syncState === "sending" ? L({hi:"\u0932\u094b\u0915\u0947\u0936\u0928 \u092d\u0947\u091c \u0930\u0939\u0947 \u0939\u0948\u0902...",en:"Sending location..."}) : lastSyncedAt ? L({hi:"\u0906\u0916\u093c\u093f\u0930\u0940 \u0905\u092a\u0921\u0947\u091f",en:"Last location sent"}) + ": " + timeOf(new Date(lastSyncedAt).toISOString()) : L({hi:"\u0932\u094b\u0915\u0947\u0936\u0928 \u0905\u092d\u0940 \u0928\u0939\u0940\u0902 \u092d\u0947\u091c\u0940",en:"No location sent yet"})}
          </p>
          <div className="flex items-center justify-between border-t border-drv-line py-2.5">
            <span className="text-[12px] text-drv-mute">
              {label} · {L({ hi: `${sinceMin} मिनट से`, en: `${sinceMin} min` })}
            </span>
            <button onClick={endTrip} disabled={busy || !card} tabIndex={card ? 0 : -1} className="min-h-[48px] rounded-[10px] px-3 text-[13px] font-semibold text-rose-700 active:bg-rose-50">
              {sure ? L({ hi: "पक्का, बंद करें", en: "Yes, end" }) : L({ hi: "ट्रिप बंद करें", en: "End trip" })}
            </button>
          </div>
        </section>
      </div>

      {/* What the map can't show yet: no GPS, or a route with no saved stop places. */}
      {(gps !== "on" || syncState === "error" || (!pts.length && !pins.length)) && !card && (
        <div className="pt-safe pointer-events-none absolute inset-x-3 top-0 z-[590] flex justify-center">
          {gps === "off" ? (
            <div className="pointer-events-auto mt-[68px] w-full rounded-[14px] bg-drv-black px-3.5 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,.25)]">
              <p className="text-[14px] font-semibold">{L({ hi: "फ़ोन की लोकेशन नहीं मिल रही", en: "Can't get the phone's location" })}</p>
              <p className="mt-1 text-[13px] leading-snug text-white/85">
                {gpsProblem === "denied" ? L({ hi: "\u0932\u094b\u0915\u0947\u0936\u0928 \u0915\u0940 \u0907\u091c\u093e\u091c\u093c\u0924 \u0926\u0947\u0902\u0964", en: "Location permission is blocked. Allow it in your browser or phone settings." }) : gpsProblem === "stale" ? L({ hi: "\u0928\u0908 \u0932\u094b\u0915\u0947\u0936\u0928 \u0915\u093e \u0907\u0902\u0924\u091c\u093c\u093e\u0930 \u0939\u0948\u0964", en: "The last location is too old. Waiting for a fresh fix." }) : L({hi:"फ़ोन की Location चालू करें और इस ऐप को अनुमति दें।",en:"Turn on Location and allow this app to use it."})}
              </p>
              <button onClick={() => setGpsTry((x) => x + 1)} className="mt-2.5 min-h-[48px] rounded-[10px] bg-drv-yellow px-3.5 py-2 text-[14px] font-semibold text-black active:translate-y-px">
                {L({ hi: "फिर कोशिश करें", en: "Try again" })}
              </button>
            </div>
          ) : syncState === "error" ? (
            <div role="status" className="pointer-events-auto mt-[68px] w-full rounded-[14px] bg-drv-black px-4 py-3 text-white">
              <p className="text-[14px] font-semibold">{L({ hi: "\u0932\u094b\u0915\u0947\u0936\u0928 \u0928\u0939\u0940\u0902 \u092d\u0947\u091c\u0940 \u0917\u0908", en: "Location has not reached the school" })}</p>
              <p className="mt-1 text-[13px] leading-snug text-white/85">{L({ hi: "\u0907\u0902\u091f\u0930\u0928\u0947\u091f \u091c\u093e\u0901\u091a\u0947\u0902\u0964", en: "Check your connection. Fresh location updates will retry automatically." })}{lastSyncedAt ? ` ${L({hi:"\u0906\u0916\u093c\u093f\u0930\u0940 \u0905\u092a\u0921\u0947\u091f",en:"Last sent"})}: ${timeOf(new Date(lastSyncedAt).toISOString())}` : ""}</p>
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
      <div ref={sheetRef} className="pb-safe absolute inset-x-0 bottom-0 z-[600] rounded-t-[20px] bg-white px-4 shadow-[0_-4px_20px_rgba(0,0,0,.08)]">
        <button onClick={() => setOpen((o) => !o)} className="flex min-h-[44px] w-full justify-center pb-2 pt-2.5" aria-expanded={open} aria-label={open ? L({ hi: "छोटा करें", en: "Show less" }) : L({ hi: "और दिखाएँ", en: "Show more" })}>
          <span className="h-1 w-9 rounded-full bg-[#DEDEDA]" aria-hidden />
        </button>

        {next ? (
          <>
            <div className="flex w-full items-start justify-between gap-3 text-left">
              <span className="min-w-0">
                <span className="block text-[11.5px] font-semibold text-drv-green">
                  {L({ hi: `अगला स्टॉप · ${nextIdx + 1}/${order.length}`, en: `Next stop · ${nextIdx + 1}/${order.length}` })}
                </span>
                <span className="block break-words text-[17px] font-semibold leading-snug">{next.name}</span>
                <span className="block text-[12.5px] text-drv-mute">
                  {morning ? L({ hi: `${next.kids.length} बच्चे चढ़ेंगे`, en: `${next.kids.length} getting on` }) : L({ hi: `${next.kids.length} बच्चे उतरेंगे`, en: `${next.kids.length} getting off` })}
                  {minsNext !== null ? L({ hi: ` · करीब ${minsNext} मिनट`, en: ` · about ${minsNext} min` }) : ""}
                </span>
              </span>
              {toNext !== null && <span className="shrink-0 pt-3 text-[20px] font-semibold text-drv-green">{distText(toNext)}</span>}
            </div>

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
                    <span className="min-w-0 flex-1">{L({ hi: `देरी की जानकारी: ${trip.delay.minutes} मिनट देर · ${delay.hi}`, en: `Delay update: ${trip.delay.minutes} min late · ${delay.en}` })}</span>
                  </button>
                )}
              </div>
            </div>

            {fail && !sheet && <p className="mt-2 text-[13px] text-rose-600">{fail}</p>}
            <div className="mt-3 pb-3"><SlideConfirm label={L({hi:"स्टॉप पर पहुँचने पर स्वाइप करें",en:"Slide at the stop"})} disabled={busy} onConfirm={()=>setSheet("stop")}/><div className="flex items-center justify-between"><button onClick={()=>setSheet("delay")} className="driver-trip-secondary"><TriangleAlert size={16} aria-hidden/>{L({hi:"देरी की जानकारी",en:"Report delay"})}</button><button onClick={()=>setOpen(o=>!o)} className="driver-trip-secondary" aria-label={open?"Show less":"Show more"}><ChevronDown className={open?"rotate-180":""} size={18}/>{open?L({hi:"कम दिखाएँ",en:"Less"}):L({hi:"और दिखाएँ",en:"More"})}</button></div></div>
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

      {sure && (
        <div role="dialog" aria-modal="true" aria-labelledby="finish-trip-title" className="absolute inset-0 z-[1000] flex items-end justify-center bg-black/50 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div ref={confirmation} tabIndex={-1} className="w-full max-w-[520px] rounded-[16px] bg-white p-5 outline-none">
            <h2 id="finish-trip-title" className="text-[20px] font-semibold">{L({ hi: "\u091f\u094d\u0930\u093f\u092a \u092c\u0902\u0926 \u0915\u0930\u0947\u0902?", en: "End this trip?" })}</h2>
            <p className="mt-2 text-[15px] text-drv-mute">{doneCount} / {order.length} {L({hi:"\u0938\u094d\u091f\u0949\u092a \u092a\u0942\u0930\u0947",en:"stops recorded"})}. {ticked} / {kidsAll.length} {L({hi:"\u092c\u091a\u094d\u091a\u0947 \u091f\u093f\u0915 \u0939\u0941\u090f",en:"children marked"})}.</p>
            <p className="mt-3 text-[14px] leading-relaxed">{L({hi:"\u092c\u0938 \u091c\u093e\u0901\u091a\u0915\u0930 \u092a\u0915\u094d\u0915\u093e \u0915\u0930\u0947\u0902 \u0915\u093f \u0938\u092d\u0940 \u092c\u091a\u094d\u091a\u0947 \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924 \u0939\u0948\u0902\u0964",en:"Check the bus and confirm every child is accounted for before ending."})}</p>
            {fail && <p role="alert" className="mt-3 text-[14px] leading-relaxed text-rose-700">{fail}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={closeConfirmation} disabled={busy} className="d-btn d-btn-line">{L({hi:"\u0935\u093e\u092a\u0938",en:"Keep trip open"})}</button>
              <button type="button" onClick={confirmEndTrip} disabled={busy} className="d-btn bg-rose-700 text-white">{busy ? L({hi:"\u092c\u0902\u0926 \u0939\u094b \u0930\u0939\u0940 \u0939\u0948...",en:"Ending..."}) : L({hi:"\u0939\u093e\u0901, \u092c\u0902\u0926 \u0915\u0930\u0947\u0902",en:"End trip"})}</button>
            </div>
          </div>
        </div>
      )}

      {!hapticsReady && (
        <p className="pointer-events-none absolute inset-x-4 top-16 z-[700] rounded-[10px] bg-[#111] px-3 py-2 text-center text-[12.5px] font-medium text-white shadow-lg" role="status">
          {L({ hi: "वाइब्रेशन चालू करने के लिए स्क्रीन को एक बार छूएँ।", en: "Touch the screen once to turn vibration on." })}
        </p>
      )}
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
            await act("/bus/mark", { kidId, on }, newStopPlace());
          }}
          onDone={async () => {
            if (await act("/bus/stop-done", { stop: next.name }, newStopPlace())) setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "delay" && (
        <DelaySheet
          routeName={route.name}
          onBoard={onBoard}
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

/**
 * While the route is coming: no big grey box. The screen is already the map's colour (Shell), and the bottom
 * sheet rises into its real place with its label, a bar where "5 stops · 13 children" will be, and the slider's spot.
 */
function TripWait() {
  const L = useL();
  return (
    <div className="dv-trip-wait" aria-busy="true">
      <p className="text-[13px] text-drv-mute">{L({ hi: "आज का रास्ता", en: "Today's route" })}</p>
      <i className="dv-bar dv-bar-block mt-2 text-[19px]" style={{ width: "58%" }} aria-hidden />
      <div className="dv-slide-wait mt-5" aria-hidden />
    </div>
  );
}

/** Full screen over the app's bars: the trip is all the driver needs while driving. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="drv fixed inset-0 z-30 mx-auto max-w-[560px] overflow-hidden bg-[#F2F2EF]">{children}</div>;
}
