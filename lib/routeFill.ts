"use client";
/**
 * Live routes often have stops whose place nobody has saved yet (it is saved from the bus the first time it
 * stops there). Without places there is no road line, no pins, no km / minutes, and the pretend bus has
 * nowhere to drive. This fills the gaps on the phone only (nothing is written to the backend):
 *   1. a stop (or the school) with no place is looked up by its name on OpenStreetMap, within ~20 km of a
 *      place the route already knows (else Barmer); a stop that can't be found goes ~1 km on from the one before;
 *   2. the road line through all places comes from the free road service (OSRM), as the backend does.
 * Results are kept in this browser, so it is fetched once per route.
 */
import { useEffect, useMemo, useState } from "react";
import type { BusRoute, LatLng, RoutePath } from "@/lib/bus";

const BARMER: LatLng = { lat: 25.7521, lng: 71.3967 };
const placed = (p: { lat: number | null; lng: number | null }) => p.lat !== null && p.lng !== null;

function remember<T>(key: string, v?: T): T | null {
  try {
    if (v !== undefined) localStorage.setItem(key, JSON.stringify(v));
    else {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
  } catch {
    /* storage blocked: just fetched again next time */
  }
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, " ").trim();
const kmBetween = (a: LatLng, b: LatLng) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 100);

/**
 * One name look-up on OpenStreetMap data (Photon: free, no key, works from the phone). A result counts only
 * if it is within 20 km and its name has the stop's first word ("Baldev Nagar" must not land on
 * "Mahaveer Nagar Park"). "Not found" is remembered; a network or rate-limit failure is not (tried again later).
 */
async function lookUp(name: string, near: LatLng): Promise<LatLng | null> {
  const key = `sa:place2:${near.lat.toFixed(2)},${near.lng.toFixed(2)}:${norm(name)}`;
  const hit = remember<LatLng | { none: true }>(key);
  if (hit) return "none" in hit ? null : hit;
  const word = norm(name).split(" ")[0] || "";
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=5&lat=${near.lat}&lon=${near.lng}&q=${encodeURIComponent(`${name} Barmer`)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = await res.json();
    for (const f of j?.features || []) {
      const [lng, lat] = f?.geometry?.coordinates || [];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const p = { lat: Number(lat), lng: Number(lng) };
      const label = norm(`${f.properties?.name || ""} ${f.properties?.street || ""}`);
      if (kmBetween(p, near) <= 20 && word.length >= 3 && label.includes(word)) {
        remember(key, p);
        return p;
      }
    }
  } catch {
    return null;
  }
  remember(key, { none: true });
  return null;
}

/** The road line through the points (morning order), or null when the road service can't be reached. */
async function roadLine(points: LatLng[]): Promise<RoutePath | null> {
  const key = "sa:road:" + points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  const hit = remember<RoutePath>(key);
  if (hit) return hit;
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${points.map((p) => `${p.lng},${p.lat}`).join(";")}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(10000) });
    const r = (await res.json())?.routes?.[0];
    if (!r?.geometry?.coordinates?.length) return null;
    const path: RoutePath = { pts: r.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng] as [number, number]), m: Math.round(r.distance), s: Math.round(r.duration), road: true };
    remember(key, path);
    return path;
  } catch {
    return null;
  }
}

/** The route with every stop placed and a road line, or null if nothing could be added. */
export async function fillRoute(route: BusRoute): Promise<BusRoute | null> {
  const known = [...route.stops, route.school].find(placed);
  const near: LatLng = known ? { lat: known.lat!, lng: known.lng! } : BARMER;
  let changed = false;
  let prev: LatLng | null = null;
  let k = 0;
  const stops = [];
  for (const s of route.stops) {
    if (placed(s)) {
      prev = { lat: s.lat!, lng: s.lng! };
      stops.push(s);
      continue;
    }
    let p: LatLng | null = await lookUp(s.name, near);
    if (!p) {
      // About 1 km on from the stop before, turning a little each time so the stops don't sit on one line.
      const from: LatLng = prev || near;
      const a = (k++ * 70 + 30) * (Math.PI / 180);
      p = { lat: from.lat + 0.009 * Math.cos(a), lng: from.lng + 0.01 * Math.sin(a) };
    }
    prev = p;
    changed = true;
    stops.push({ ...s, lat: p.lat, lng: p.lng });
  }
  let school = route.school;
  if (!placed(school) && school.name) {
    const p = await lookUp(school.name, near);
    if (p) {
      school = { ...school, lat: p.lat, lng: p.lng };
      changed = true;
    }
  }
  let path = route.path;
  if (changed || !path?.road) {
    const points = [...stops, school].filter(placed).map((p) => ({ lat: p.lat!, lng: p.lng! }));
    if (points.length >= 2) {
      const road = await roadLine(points);
      if (road) {
        path = road;
        changed = true;
      } else if (changed) {
        let m = 0;
        for (let i = 1; i < points.length; i++) m += Math.hypot((points[i].lat - points[i - 1].lat) * 111_000, (points[i].lng - points[i - 1].lng) * 100_000);
        path = { pts: points.map((p) => [p.lat, p.lng] as [number, number]), m: Math.round(m * 1.3), s: Math.round((m * 1.3) / 5.5), road: false };
      }
    }
  }
  return changed ? { ...route, stops, school, path } : null;
}

/** What decides the filled copy: the stops, their saved places and the path the backend sent. */
const signature = (r: BusRoute) => `${r.id}|${r.school.lat},${r.school.lng}|${r.path?.road ? r.path.pts.length : 0}|` + r.stops.map((s) => `${s.name}@${s.lat},${s.lng}`).join(";");

/** The route as the backend sent it, then (a moment later) with the missing places and the road line filled in. */
export function useFilledRoute(route: BusRoute | null): BusRoute | null {
  const [filled, setFilled] = useState<{ sig: string; r: BusRoute } | null>(null);
  const sig = route ? signature(route) : "";
  useEffect(() => {
    if (!route) return;
    if (route.stops.every(placed) && placed(route.school) && route.path?.road) return;
    let gone = false;
    void fillRoute(route).then((r) => {
      if (!gone && r) setFilled({ sig, r });
    });
    return () => {
      gone = true;
    };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  // Preserve route/path identity between position updates: the simulator must not
  // repeatedly re-anchor to the preceding road vertex on every render.
  return useMemo(() => {
    if (!route) return null;
    if (filled && filled.sig === sig) {
      // Keep the backend's latest kids / absences; take the filled places and line.
      const at = new Map(filled.r.stops.map((s) => [s.name, s]));
      return { ...route, school: filled.r.school, path: filled.r.path, stops: route.stops.map((s) => (placed(s) ? s : { ...s, lat: at.get(s.name)?.lat ?? null, lng: at.get(s.name)?.lng ?? null })) };
    }
    return route;
  }, [route, filled, sig]);
}
