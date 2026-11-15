"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, LocateFixed, Search, Trash2, X } from "lucide-react";
import { useL } from "@/lib/i18n";

const BARMER: [number, number] = [71.3967, 25.7521];
const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export interface Place {
  lat: number;
  lng: number;
}

/**
 * Pick a bus stop's place on a real street map: tap the map (or drag the pin), search by name, or use this
 * phone's location while standing at the stop. Save gives the place back; Remove clears it.
 * `near` centres the map when the stop has no place yet (another stop of the route, or the town).
 */
export function StopPlacePicker({ name, value, near, onSave, onClose }: { name: string; value: Place | null; near: Place | null; onSave: (p: Place | null) => void; onClose: () => void }) {
  const L = useL();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);
  const [at, setAt] = useState<Place | null>(value);
  const [q, setQ] = useState(name);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const put = (p: Place, fly = false) => {
    setAt(p);
    const m = map.current;
    const mod = ml.current;
    if (!m || !mod) return;
    if (!pin.current) {
      pin.current = new mod.Marker({ color: "#D93636", draggable: true }).setLngLat([p.lng, p.lat]).addTo(m);
      pin.current.on("dragend", () => {
        const ll = pin.current!.getLngLat();
        setAt({ lat: Math.round(ll.lat * 1e6) / 1e6, lng: Math.round(ll.lng * 1e6) / 1e6 });
      });
    } else pin.current.setLngLat([p.lng, p.lat]);
    if (fly) m.flyTo({ center: [p.lng, p.lat], zoom: 16 });
  };

  useEffect(() => {
    let gone = false;
    import("maplibre-gl").then((raw) => {
      if (gone || !box.current || map.current) return;
      const mod = ((raw as any).default ?? raw) as typeof import("maplibre-gl");
      ml.current = mod;
      const start = value || near;
      const m = new mod.Map({ container: box.current, style: STYLE, center: start ? [start.lng, start.lat] : BARMER, zoom: start ? 15 : 13, attributionControl: { compact: true } });
      map.current = m;
      m.on("click", (e) => put({ lat: Math.round(e.lngLat.lat * 1e6) / 1e6, lng: Math.round(e.lngLat.lng * 1e6) / 1e6 }));
      m.on("load", () => value && put(value));
    });
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function find() {
    if (!q.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const c = map.current?.getCenter();
      const around = c ? `&viewbox=${c.lng - 0.25},${c.lat + 0.25},${c.lng + 0.25},${c.lat - 0.25}` : "";
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1${around}&q=${encodeURIComponent(q.trim())}`, { headers: { "Accept-Language": "en" } });
      const j = res.ok ? await res.json() : [];
      if (j?.[0]?.lat) put({ lat: Number(j[0].lat), lng: Number(j[0].lon) }, true);
      else setMsg(L({ hi: "यह नाम नक्शे पर नहीं मिला। नक्शे पर छूकर जगह चुनें।", en: "Not found on the map. Tap the map to choose the place." }));
    } catch {
      setMsg(L({ hi: "खोज नहीं हो पाई। नक्शे पर छूकर जगह चुनें।", en: "Search did not work. Tap the map to choose the place." }));
    } finally {
      setBusy(false);
    }
  }

  function here() {
    if (!("geolocation" in navigator)) return setMsg(L({ hi: "इस फ़ोन में लोकेशन नहीं है।", en: "This device has no location." }));
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (g) => {
        setBusy(false);
        put({ lat: Math.round(g.coords.latitude * 1e6) / 1e6, lng: Math.round(g.coords.longitude * 1e6) / 1e6 }, true);
      },
      () => {
        setBusy(false);
        setMsg(L({ hi: "लोकेशन नहीं मिली। फ़ोन में लोकेशन चालू करें।", en: "Could not get the location. Turn location on." }));
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={L({ hi: `${name} की जगह`, en: `Place of ${name}` })}>
      <div className="pt-safe flex items-center gap-2 border-b border-ink-100 px-3 py-2">
        <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full active:bg-ink-100" aria-label={L({ hi: "बंद करें", en: "Close" })}>
          <X className="h-5 w-5" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-[16px] font-semibold">{name}</p>
      </div>
      <form
        className="flex gap-2 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label className="field-box min-h-[44px] flex-1">
          <Search className="h-4 w-4" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "जगह का नाम खोजें", en: "Search a place" })} aria-label={L({ hi: "जगह खोजें", en: "Search a place" })} />
        </label>
        <button type="submit" disabled={busy} className="btn-line min-h-[44px] px-3">
          {L({ hi: "खोजें", en: "Find" })}
        </button>
      </form>
      <div className="relative min-h-0 flex-1">
        <div ref={box} className="absolute inset-0" />
        <button type="button" onClick={here} disabled={busy} className="absolute right-3 top-3 z-[5] grid h-11 w-11 place-items-center rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_4px_14px_rgba(0,0,0,.10)]" aria-label={L({ hi: "मेरी जगह", en: "My location" })}>
          <LocateFixed className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="pb-safe space-y-2 border-t border-ink-100 px-3 pt-2">
        <p className="text-[13px] text-ink-600">
          {msg ||
            (at
              ? L({ hi: `जगह चुनी: ${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}। पिन खिसका कर ठीक कर सकते हैं।`, en: `Place chosen: ${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}. Drag the pin to adjust.` })
              : L({ hi: "नक्शे पर स्टॉप की जगह छूएँ, नाम से खोजें, या स्टॉप पर खड़े होकर 'मेरी जगह' दबाएँ।", en: "Tap the stop's place on the map, search by name, or stand at the stop and press My location." }))}
        </p>
        <div className="flex gap-2 pb-2">
          {value && (
            <button type="button" onClick={() => onSave(null)} className="btn-line min-h-[48px] px-3 text-rose-700">
              <Trash2 className="h-4 w-4" aria-hidden /> {L({ hi: "हटाएँ", en: "Remove" })}
            </button>
          )}
          <button type="button" disabled={!at} onClick={() => at && onSave(at)} className="btn-primary min-h-[48px] flex-1">
            <Check className="h-4 w-4" aria-hidden /> {L({ hi: "यह जगह रखें", en: "Use this place" })}
          </button>
        </div>
      </div>
    </div>
  );
}
