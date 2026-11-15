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

/**
 * The road line through these points (morning order), asked for from this phone's browser when the backend
 * could only give straight lines (its server could not reach the road service). The same free road service
 * (OSRM) the backend uses; kept in this browser so it is asked for once per set of stop places.
 * Null if it cannot be reached either: the straight lines stay.
 */
export async function roadPathFromPhone(points: [number, number][]): Promise<RoutePath | null> {
  if (points.length < 2) return null;
  const key = "sa:road-path:" + points.map((p) => p.map((x) => x.toFixed(5)).join(",")).join("|");
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as RoutePath;
  } catch {
    /* storage blocked: ask again */
  }
  try {
    const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const r = (await res.json())?.routes?.[0];
    if (!r?.geometry?.coordinates?.length) return null;
    const path: RoutePath = {
      pts: r.geometry.coordinates.map(([lng, lat]: number[]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5] as [number, number]),
      m: Math.round(r.distance),
      s: Math.round(r.duration),
      road: true,
    };
    try {
      localStorage.setItem(key, JSON.stringify(path));
    } catch {
      /* not kept: asked again next time */
    }
    return path;
  } catch {
    return null;
  }
}

/**
 * Places for stops the school has not saved yet, so the pretend bus (demo) can drive to every stop and the
 * pick-up / drop-off alert can come at each one. Looked up by the stop's name on OpenStreetMap (Nominatim),
 * only within about 20 km of a place the route already knows. A name that cannot be found gets a point about
 * a kilometre further on from the stop before it; the road service then puts it on the nearest road.
 * Kept in this browser. The real place is saved from the bus the first time it stops there.
 */
export async function guessStopPlaces(stops: { name: string; lat: number | null; lng: number | null }[], anchor: LatLng): Promise<Record<string, LatLng>> {
  const out: Record<string, LatLng> = {};
  let prev: LatLng = anchor;
  let k = 0;
  for (const s of stops) {
    if (s.lat !== null && s.lng !== null) {
      prev = { lat: s.lat, lng: s.lng };
      continue;
    }
    const key = `sa:stop-guess:${anchor.lat.toFixed(3)},${anchor.lng.toFixed(3)}:${s.name.toLowerCase()}`;
    let hit: LatLng | null = null;
    try {
      const saved = localStorage.getItem(key);
      if (saved) hit = JSON.parse(saved);
    } catch {
      /* storage blocked */
    }
    if (!hit) {
      try {
        const d = 0.18; // about 20 km around the known place
        const box = [anchor.lng - d, anchor.lat + d, anchor.lng + d, anchor.lat - d].join(",");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&bounded=1&viewbox=${box}&q=${encodeURIComponent(s.name)}`, {
          signal: AbortSignal.timeout(8000),
          headers: { "Accept-Language": "en" },
        });
        const j = res.ok ? await res.json() : [];
        if (j?.[0]?.lat) hit = { lat: Number(j[0].lat), lng: Number(j[0].lon) };
      } catch {
        /* not found or offline */
      }
      if (hit) {
        try {
          localStorage.setItem(key, JSON.stringify(hit));
        } catch {
          /* not kept */
        }
      }
      await new Promise((r) => setTimeout(r, 1100)); // the map service allows about one look-up a second
    }
    if (!hit) {
      // About 1 km on from the stop before, turning a little each time so the stops do not sit on one line.
      const a = (k++ * 70 + 30) * (Math.PI / 180);
      hit = { lat: prev.lat + 0.009 * Math.cos(a), lng: prev.lng + 0.01 * Math.sin(a) };
    }
    out[s.name] = hit;
    prev = hit;
  }
  return out;
}
