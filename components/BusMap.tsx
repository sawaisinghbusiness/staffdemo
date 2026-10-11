"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "lucide-react";
import { splitPath, type LatLng } from "@/lib/bus";

/** Where the map starts before the route or the bus is known. */
const BARMER: [number, number] = [25.7521, 71.3967];

export interface MapStop {
  name: string;
  lat: number;
  lng: number;
  /** start = where the run begins (green), end = where it finishes (yellow). */
  state: "done" | "next" | "later" | "start" | "end";
}

const GREEN = "#4DCB7F";
const YELLOW = "#FFCB00";

/** A map pin, tip at the bottom centre. */
function pinSvg(state: MapStop["state"]) {
  const [fill, stroke, dot] = {
    start: [GREEN, "#0F6E57", "#fff"],
    end: [YELLOW, "#A07800", "#fff"],
    done: ["#fff", "#12896C", GREEN],
    next: ["#0A0A0A", "#0A0A0A", YELLOW],
    later: ["#fff", "#1A1A1A", "#1A1A1A"],
  }[state];
  const big = state === "next" || state === "start" || state === "end";
  const s = big ? 1 : 0.85;
  return `<svg class="d-pin" width="${22 * s}" height="${28 * s}" viewBox="-11 -27 22 28"><path d="M0 0C-5-7-9-11-9-16a9 9 0 0 1 18 0C9-11 5-7 0 0Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cy="-16" r="3.4" fill="${dot}"/></svg>`;
}

const BUS_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';

/**
 * A quiet grey map (OpenStreetMap, desaturated) with the route along the roads: green where
 * the bus has been, yellow ahead. Follows the bus while it moves; once dragged it stays put until
 * the locate button is tapped. Leaflet loads in the browser only (it needs `window`).
 */
export function BusMap({
  stops,
  path,
  bus,
  className,
  label,
  locateClass,
}: {
  stops: MapStop[];
  path: [number, number][];
  bus: LatLng | null;
  className?: string;
  label: string;
  /** Where the "back to the bus" button sits (it must clear the sheets drawn over the map). */
  locateClass?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const line = useRef<Leaflet.LayerGroup | null>(null);
  const busMarker = useRef<Leaflet.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);
  const fitted = useRef(false);

  useEffect(() => {
    let gone = false;
    import("leaflet").then((mod) => {
      if (gone || !box.current || map.current) return;
      L.current = mod;
      const m = mod.map(box.current, { zoomControl: false, attributionControl: true });
      // OpenStreetMap tiles, toned down to grey in CSS (`.d-map`) so the route stands out.
      mod
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(m);
      m.attributionControl.setPrefix(false);
      // A view before anything is known, so Leaflet never draws without one.
      m.setView(BARMER, 13);
      m.on("dragstart", () => setFollow(false));
      line.current = mod.layerGroup().addTo(m);
      layer.current = mod.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Pins, and the first fit to the whole route.
  useEffect(() => {
    const mod = L.current;
    const m = map.current;
    if (!ready || !mod || !m || !layer.current) return;
    layer.current.clearLayers();
    for (const s of stops) {
      mod
        .marker([s.lat, s.lng], {
          icon: mod.divIcon({ className: "", html: pinSvg(s.state), iconSize: [22, 28], iconAnchor: [11, 27] }),
          title: s.name,
          keyboard: false,
          zIndexOffset: s.state === "next" ? 500 : 0,
        })
        .bindTooltip(s.name, { direction: "top", offset: [0, -26] })
        .addTo(layer.current);
    }
    const pts: [number, number][] = [...path, ...stops.map((s) => [s.lat, s.lng] as [number, number])];
    if (!fitted.current && pts.length) {
      m.fitBounds(mod.latLngBounds(bus ? [...pts, [bus.lat, bus.lng]] : pts), { padding: [48, 48], maxZoom: 16 });
      fitted.current = true;
    }
  }, [ready, stops, path]); // eslint-disable-line react-hooks/exhaustive-deps

  // The road line, cut at the bus.
  useEffect(() => {
    const mod = L.current;
    if (!ready || !mod || !line.current) return;
    line.current.clearLayers();
    const [done, ahead] = splitPath(path, bus);
    const draw = (p: [number, number][], color: string) => {
      if (p.length < 2) return;
      mod.polyline(p, { color: "#fff", weight: 9, opacity: 1, lineJoin: "round", lineCap: "round" }).addTo(line.current!);
      mod.polyline(p, { color, weight: 5, opacity: 1, lineJoin: "round", lineCap: "round" }).addTo(line.current!);
    };
    draw(ahead, bus ? YELLOW : GREEN);
    draw(done, GREEN);
  }, [ready, path, bus?.lat, bus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // The bus.
  useEffect(() => {
    const mod = L.current;
    const m = map.current;
    if (!ready || !mod || !m) return;
    if (!bus) {
      busMarker.current?.remove();
      busMarker.current = null;
      return;
    }
    if (!busMarker.current) {
      busMarker.current = mod
        .marker([bus.lat, bus.lng], { icon: mod.divIcon({ className: "", html: `<span class="d-bus">${BUS_ICON}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000, keyboard: false })
        .addTo(m);
    } else busMarker.current.setLatLng([bus.lat, bus.lng]);
    if (!fitted.current) {
      // Nothing to frame yet: go straight to the bus.
      m.setView([bus.lat, bus.lng], 16);
      fitted.current = true;
    } else if (follow) m.panTo([bus.lat, bus.lng], { animate: true, duration: 0.8 });
  }, [ready, bus?.lat, bus?.lng, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // `className` sets the position too (the trip screen passes `absolute inset-0`).
    <div className={`isolate ${className || "relative"}`}>
      <div ref={box} className="d-map h-full w-full bg-[#F2F2EF]" role="img" aria-label={label} />
      {bus && !follow && (
        <button
          onClick={() => {
            setFollow(true);
            map.current?.setView([bus.lat, bus.lng], Math.max(map.current.getZoom(), 16));
          }}
          className={`absolute right-3 z-[500] grid h-10 w-10 place-items-center rounded-[10px] bg-white text-drv-ink shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_14px_rgba(0,0,0,.10)] active:bg-drv-soft ${locateClass || "bottom-3"}`}
          aria-label="Back to the bus"
        >
          <Navigation className="h-[18px] w-[18px]" aria-hidden />
        </button>
      )}
    </div>
  );
}
