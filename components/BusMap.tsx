"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, Map as MapIcon, Navigation } from "lucide-react";
import { splitPath, type LatLng } from "@/lib/bus";

/** Where the map starts before the route or the bus is known. */
const BARMER: [number, number] = [71.3967, 25.7521];
/** Free vector map (OpenFreeMap, OpenStreetMap data), light grey so the route stands out. No key. */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export interface MapStop {
  name: string;
  lat: number;
  lng: number;
  /** start = where the run begins (green), end = where it finishes (yellow). */
  state: "done" | "next" | "later" | "start" | "end";
}

const GREEN = "#4DCB7F";
const YELLOW = "#FFCB00";

function pinEl(s: MapStop) {
  const [fill, stroke, dot] = {
    start: [GREEN, "#0F6E57", "#fff"],
    end: [YELLOW, "#A07800", "#fff"],
    done: ["#fff", "#12896C", GREEN],
    next: ["#0A0A0A", "#0A0A0A", YELLOW],
    later: ["#fff", "#1A1A1A", "#1A1A1A"],
  }[s.state];
  const k = s.state === "next" || s.state === "start" || s.state === "end" ? 1 : 0.85;
  const el = document.createElement("div");
  el.title = s.name;
  el.innerHTML = `<svg class="d-pin" width="${24 * k}" height="${30 * k}" viewBox="-11 -27 22 28"><path d="M0 0C-5-7-9-11-9-16a9 9 0 0 1 18 0C9-11 5-7 0 0Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cy="-16" r="3.4" fill="${dot}"/></svg>`;
  return el;
}

function busEl() {
  const el = document.createElement("div");
  // An arrow pointing the way the bus drives (the marker turns with the bus).
  el.innerHTML =
    '<span class="d-bus"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 20 21l-8-4.2L4 21z"/></svg></span>';
  return el;
}

const line = (pts: [number, number][]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: pts.map(([lat, lng]) => [lng, lat]) },
});

/**
 * The map. "overview" shows the whole route from above (before the trip, and for office or
 * parents). "nav" is the driver's view while driving, like a navigation app: close in, tilted,
 * turned so the road ahead points up, following the bus. The route is green where the bus has
 * been and yellow ahead. Dragging stops the following until the locate button is tapped.
 */
export function BusMap({
  stops,
  path,
  bus,
  heading = null,
  mode = "overview",
  className,
  label,
  bottomInset = 0,
}: {
  stops: MapStop[];
  path: [number, number][];
  bus: LatLng | null;
  /** Degrees from north the bus is driving. */
  heading?: number | null;
  mode?: "overview" | "nav";
  className?: string;
  label: string;
  /** Height covered by a sheet at the bottom, so the bus and route stay above it. */
  bottomInset?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);
  const pins = useRef<Marker[]>([]);
  const pinsKey = useRef("");
  const busMarker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(false);
  const [follow, setFollow] = useState(true);
  // The driver can flip to the whole route and back.
  const [view, setView] = useState(mode);
  useEffect(() => setView(mode), [mode]);
  const fitted = useRef(false);

  useEffect(() => {
    let gone = false;
    import("maplibre-gl")
      .then((raw) => {
        if (gone || !box.current || map.current) return;
        // The package is a UMD bundle: the API sits on `default` once bundled.
        const mod = ((raw as any).default ?? raw) as typeof import("maplibre-gl");
        ml.current = mod;
        const m = new mod.Map({ container: box.current, style: STYLE, center: BARMER, zoom: 12.5, attributionControl: { compact: true } });
        map.current = m;
        // Only the person's own gestures stop the following, not our camera moves.
        const stop = (e: any) => e?.originalEvent && setFollow(false);
        m.on("dragstart", stop);
        m.on("rotatestart", stop);
        m.on("pitchstart", stop);
        m.on("load", () => {
          if (gone) return;
          m.addSource("ahead", { type: "geojson", data: line([]) });
          m.addSource("done", { type: "geojson", data: line([]) });
          const lay = (id: string, src: string, color: string, width: number) =>
            m.addLayer({ id, type: "line", source: src, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": width } });
          lay("ahead-case", "ahead", "#ffffff", 10);
          lay("ahead-line", "ahead", YELLOW, 6);
          lay("done-case", "done", "#ffffff", 10);
          lay("done-line", "done", GREEN, 6);
          setReady(true);
        });
      })
      .catch(() => setBroken(true));
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Pins, redrawn only when they change.
  useEffect(() => {
    const m = map.current;
    const mod = ml.current;
    if (!ready || !m || !mod) return;
    const key = JSON.stringify(stops);
    if (key === pinsKey.current) return;
    pinsKey.current = key;
    pins.current.forEach((p) => p.remove());
    pins.current = stops.map((s) => new mod.Marker({ element: pinEl(s), anchor: "bottom" }).setLngLat([s.lng, s.lat]).addTo(m));
  }, [ready, stops]);

  // The route line, cut at the bus.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const [done, ahead] = splitPath(path, bus);
    (m.getSource("ahead") as any)?.setData(line(ahead));
    (m.getSource("done") as any)?.setData(line(done));
    m.setPaintProperty("ahead-line", "line-color", bus ? YELLOW : GREEN);
  }, [ready, path, bus?.lat, bus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // The whole route in view: first time, and whenever the driver switches to it.
  useEffect(() => {
    const m = map.current;
    const mod = ml.current;
    if (!ready || !m || !mod || view !== "overview") return;
    const pts: [number, number][] = [...path.map(([a, b]) => [b, a] as [number, number]), ...stops.map((s) => [s.lng, s.lat] as [number, number]), ...(bus ? [[bus.lng, bus.lat] as [number, number]] : [])];
    if (!pts.length) return;
    if (fitted.current && follow && mode === "overview") return;
    const b = new mod.LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => b.extend(p));
    m.fitBounds(b, { padding: { top: 90, bottom: bottomInset + 40, left: 40, right: 40 }, maxZoom: 16, pitch: 0, bearing: 0, duration: fitted.current ? 700 : 0 });
    fitted.current = true;
  }, [ready, view, path, stops.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // The bus, and the driver's camera.
  useEffect(() => {
    const m = map.current;
    const mod = ml.current;
    if (!ready || !m || !mod) return;
    if (!bus) {
      busMarker.current?.remove();
      busMarker.current = null;
      return;
    }
    if (!busMarker.current) busMarker.current = new mod.Marker({ element: busEl(), rotationAlignment: "map", pitchAlignment: "viewport" }).setLngLat([bus.lng, bus.lat]).addTo(m);
    else busMarker.current.setLngLat([bus.lng, bus.lat]);
    if (heading !== null) busMarker.current.setRotation(heading);
    if (!follow) return;
    if (view === "nav") {
      const h = m.getContainer().clientHeight;
      m.easeTo({
        center: [bus.lng, bus.lat],
        zoom: 17,
        pitch: 58,
        bearing: heading ?? m.getBearing(),
        // The bus sits low on the screen, so the road ahead fills the view.
        padding: { top: Math.round(h * 0.38), bottom: bottomInset + 24, left: 0, right: 0 },
        duration: 900,
      });
    } else if (fitted.current) m.easeTo({ center: [bus.lng, bus.lat], duration: 800 });
  }, [ready, bus?.lat, bus?.lng, heading, follow, view, bottomInset]); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = "grid h-10 w-10 place-items-center rounded-[10px] bg-white text-drv-ink shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_14px_rgba(0,0,0,.10)] active:bg-drv-soft";

  return (
    // `className` sets the position too (the trip screen passes `absolute inset-0`).
    <div className={`isolate ${className || "relative"}`}>
      <div ref={box} className="h-full w-full bg-[#F2F2EF]" role="img" aria-label={label} />
      {broken && <p className="absolute inset-x-4 top-1/3 text-center text-[13px] text-drv-mute">The map could not open on this phone.</p>}
      {bus && mode === "nav" && (
        <div className="absolute right-3 z-[5] flex flex-col gap-2 transition-[bottom] duration-300" style={{ bottom: bottomInset + 12 }}>
          <button onClick={() => { setView(view === "nav" ? "overview" : "nav"); setFollow(true); }} className={btn} aria-label={view === "nav" ? "Whole route" : "Driving view"}>
            {view === "nav" ? <MapIcon className="h-[18px] w-[18px]" aria-hidden /> : <Navigation className="h-[18px] w-[18px]" aria-hidden />}
          </button>
          {!follow && (
            <button onClick={() => setFollow(true)} className={btn} aria-label="Back to the bus">
              <LocateFixed className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
