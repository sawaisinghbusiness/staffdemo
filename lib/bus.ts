/** School bus: the route the driver runs, today's trip, and the sums for distance and time. */

export type TripKind = "morning" | "afternoon";

export interface BusKid {
  id: string;
  name: string;
  classSec: string;
  photoUrl: string | null;
}
export interface BusStop {
  name: string;
  /** Pickup time on the morning run, "07:05". */
  time: string;
  /** Saved from the bus the first time it stops here; null until then. */
  lat: number | null;
  lng: number | null;
  /** Only the children coming today: absent and on-leave children are left out by the school. */
  kids: BusKid[];
}
/** The route along real roads, morning order (first stop → school). */
export interface RoutePath {
  pts: [number, number][];
  m: number;
  s: number;
  road: boolean;
}
export interface BusRoute {
  id: string;
  name: string;
  vehicleNo: string;
  /** In morning pickup order. The afternoon run goes the other way. */
  stops: BusStop[];
  /** null until a driver saves it standing at the school gate. */
  school: { name: string; lat: number | null; lng: number | null };
  /** Not coming today (absent or on leave). */
  absent: { name: string; stop: string }[];
  path: RoutePath | null;
}
export interface Delay {
  reason: string;
  minutes: number;
  at: string;
}
export interface Trip {
  id: string;
  kind: TripKind;
  startedAt: string;
  /** Kid id -> when they got on (morning) / off (afternoon). */
  marks: Record<string, string>;
  /** Stop names already done on this trip. */
  done: string[];
  delay: Delay | null;
}
export interface RouteData {
  route: BusRoute | null;
  trip: Trip | null;
}
export interface DayTrip {
  id: string;
  kind: TripKind;
  startedAt: string;
  endedAt: string | null;
  ticked: number;
  stopsDone: number;
  firstStop: string | null;
  lastStop: string | null;
  delay: Delay | null;
}
export interface History {
  date: string;
  trips: DayTrip[];
  days: string[];
  km: number | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Stops in the order this trip reaches them, skipping stops with no child today. */
export const tripStops = (r: BusRoute, kind: TripKind) => (kind === "morning" ? r.stops : r.stops.slice().reverse()).filter((s) => s.kids.length > 0);

/** The road line in the order this trip drives it. */
export const tripPath = (r: BusRoute, kind: TripKind): [number, number][] => {
  const p = r.path?.pts || [];
  return kind === "morning" ? p : p.slice().reverse();
};

/** Metres between two points (haversine). */
export function metres(a: LatLng, b: LatLng) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const at = (p: [number, number]): LatLng => ({ lat: p[0], lng: p[1] });

/** Index of the path point nearest to a place. */
export function nearestIdx(pts: [number, number][], p: LatLng) {
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const m = metres(at(pts[i]), p);
    if (m < d) {
      d = m;
      best = i;
    }
  }
  return best;
}

/** Metres along the road from one path point to a later one. */
export function along(pts: [number, number][], from: number, to: number) {
  let m = 0;
  for (let i = from; i < to; i++) m += metres(at(pts[i]), at(pts[i + 1]));
  return m;
}

/**
 * The path cut at the bus: the part already driven and the part still ahead.
 * Without a bus both halves are the whole line drawn as "ahead".
 */
export function splitPath(pts: [number, number][], bus: LatLng | null): [[number, number][], [number, number][]] {
  if (!bus || pts.length < 2) return [[], pts];
  const i = nearestIdx(pts, bus);
  const b: [number, number] = [bus.lat, bus.lng];
  return [[...pts.slice(0, i + 1), b], [b, ...pts.slice(i + 1)]];
}

/** Town driving at about 20 km/h. Straight-line metres are first stretched ×1.3 for bends. */
export const minutesFor = (m: number, straight = true) => Math.max(1, Math.round((((straight ? m * 1.3 : m) / 1000) / 20) * 60));

/** "350 m" / "1.2 km" */
export const distText = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);

/** The full-screen drop / pickup alert opens when the bus is this close to a child's stop. */
export const NEAR_M = 100;
/** Counts as "at the stop". */
export const AT_M = 40;

export const defaultKind = (): TripKind => (new Date().getHours() < 11 ? "morning" : "afternoon");

/** Why the bus is late, as the driver picks it and the parents read it. */
export const DELAY_REASONS: { id: string; hi: string; en: string; why: { hi: string; en: string } }[] = [
  { id: "traffic", hi: "ट्रैफ़िक जाम है", en: "Traffic jam", why: { hi: "ट्रैफ़िक जाम की वजह से", en: "Because of a traffic jam" } },
  { id: "breakdown", hi: "बस ख़राब हो गई", en: "Bus broke down", why: { hi: "बस ख़राब होने की वजह से", en: "Because the bus broke down" } },
  { id: "puncture", hi: "टायर पंक्चर", en: "Flat tyre", why: { hi: "टायर पंक्चर होने की वजह से", en: "Because of a flat tyre" } },
  { id: "road", hi: "रास्ता बंद है, दूसरे रास्ते से", en: "Road closed, taking another way", why: { hi: "रास्ता बंद होने की वजह से", en: "Because a road is closed" } },
  { id: "other", hi: "दूसरी वजह", en: "Something else", why: { hi: "किसी वजह से", en: "For a reason on the road" } },
];
export const DELAY_MINUTES = [10, 20, 30];
