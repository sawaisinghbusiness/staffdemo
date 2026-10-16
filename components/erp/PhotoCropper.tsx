"use client";
/* Copied from the ERP (components/ui/PhotoCropper.tsx); only the button classes are the staff app's. Keep in step. */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Minus, Move, Plus, X } from "lucide-react";

/**
 * Crop a photo before it is saved: drag it inside the 3:4 frame (the ID card shape), zoom with the
 * slider, and see how it will look as the round photo in the apps. Returns the same small 360×480
 * JPEG data URL that shrinkPhoto makes, or null if the person cancels.
 *
 *   const image = await cropPhoto(file);
 *   if (!image) return; // cancelled
 */
const OUT_W = 360;
const OUT_H = 480;
const FRAME_W = 270;
const FRAME_H = 360;
/** The apps draw a round photo from the 3:4 picture, a little above its middle (object-position 50% 22%). */
const ROUND_Y = 0.22;

export function cropPhoto(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("This is not a photo."));
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error("This photo is too big (over 25 MB)."));
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: string | null, err?: Error) => {
      root.unmount();
      host.remove();
      if (err) reject(err);
      else resolve(v);
    };
    root.render(<Cropper file={file} onDone={(v) => done(v)} onError={(e) => done(null, e)} />);
  });
}

function Cropper({ file, onDone, onError }: { file: File; onDone: (v: string | null) => void; onError: (e: Error) => void }) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [src, setSrc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // The photo as a bitmap (honours the phone's rotation) and as an <img> for the frame.
  useEffect(() => {
    let url = "";
    let live = true;
    createImageBitmap(file)
      .then((b) => {
        if (!live) return b.close();
        url = URL.createObjectURL(file);
        setSrc(url);
        setBmp(b);
      })
      .catch(() => onError(new Error("This photo format can't be used. Save it as JPG or PNG.")));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, onError]);

  const base = bmp ? Math.max(FRAME_W / bmp.width, FRAME_H / bmp.height) : 1;
  const scale = base * zoom;
  const dw = bmp ? bmp.width * scale : FRAME_W;
  const dh = bmp ? bmp.height * scale : FRAME_H;
  const clamp = useCallback((x: number, y: number) => ({ x: Math.min(0, Math.max(FRAME_W - dw, x)), y: Math.min(0, Math.max(FRAME_H - dh, y)) }), [dw, dh]);

  // First look: centred across, leaning toward the top so the face is in.
  useEffect(() => {
    if (!bmp) return;
    const s = Math.max(FRAME_W / bmp.width, FRAME_H / bmp.height);
    setPos({ x: (FRAME_W - bmp.width * s) / 2, y: (FRAME_H - bmp.height * s) * 0.2 });
  }, [bmp]);

  // Zoom around the middle of the frame.
  const setZoomKeep = (z: number) => {
    if (!bmp) return;
    const nz = Math.min(4, Math.max(1, z));
    const cx = (FRAME_W / 2 - pos.x) / scale;
    const cy = (FRAME_H / 2 - pos.y) / scale;
    const ns = base * nz;
    const nw = bmp.width * ns;
    const nh = bmp.height * ns;
    setZoom(nz);
    setPos({ x: Math.min(0, Math.max(FRAME_W - nw, FRAME_W / 2 - cx * ns)), y: Math.min(0, Math.max(FRAME_H - nh, FRAME_H / 2 - cy * ns)) });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const save = () => {
    if (!bmp) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onError(new Error("Could not process the photo on this device."));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(bmp, -pos.x / scale, -pos.y / scale, FRAME_W / scale, FRAME_H / scale, 0, 0, OUT_W, OUT_H);
    bmp.close();
    let q = 0.85;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 300_000 && q > 0.4) {
      q -= 0.15;
      out = canvas.toDataURL("image/jpeg", q);
    }
    onDone(out);
  };

  // The round preview shows the square the apps cut from the 3:4 picture.
  const R = 84;
  const k = R / FRAME_W;
  const roundTop = (FRAME_H * k - R) * ROUND_Y;
  const img = (w: number, h: number, x: number, y: number) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: w, height: h, left: x, top: y }} />
    ) : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Adjust photo">
      <div className="w-full max-w-[560px] overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <p className="text-[15px] font-bold text-slate-900">Adjust photo</p>
            <p className="text-[12.5px] text-slate-500">Drag to place the face in the frame, zoom if needed.</p>
          </div>
          <button type="button" onClick={() => onDone(null)} aria-label="Cancel" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 px-5 py-5 sm:flex-row sm:items-start sm:justify-center">
          {/* The frame: drag the photo inside it. */}
          <div
            className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 active:cursor-grabbing"
            style={{ width: FRAME_W, height: FRAME_H }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (d) setPos(clamp(d.x + e.clientX - d.px, d.y + e.clientY - d.py));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => setZoomKeep(zoom - e.deltaY * 0.002)}
          >
            {img(dw, dh, pos.x, pos.y)}
            {/* Thirds, and the circle the apps show */}
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33.2%,rgba(255,255,255,.45)_33.3%,transparent_33.5%,transparent_66.5%,rgba(255,255,255,.45)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgba(255,255,255,.45)_33.3%,transparent_33.5%,transparent_66.5%,rgba(255,255,255,.45)_66.6%,transparent_66.8%)]" />
            <span aria-hidden className="pointer-events-none absolute left-0 rounded-full ring-2 ring-white/90" style={{ width: FRAME_W, height: FRAME_W, top: (FRAME_H - FRAME_W) * ROUND_Y }} />
            {!bmp && <span className="absolute inset-0 grid place-items-center text-sm text-slate-500">Loading…</span>}
          </div>

          {/* How it will look */}
          <div className="flex gap-5 sm:flex-col sm:gap-4">
            <figure className="text-center">
              <div className="relative overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200" style={{ width: R, height: R }}>
                {img(dw * k, dh * k, pos.x * k, pos.y * k - roundTop)}
              </div>
              <figcaption className="mt-1.5 text-[12px] text-slate-500">In the apps</figcaption>
            </figure>
            <figure className="text-center">
              <div className="relative overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200" style={{ width: 63, height: 84 }}>
                {img(dw * (63 / FRAME_W), dh * (63 / FRAME_W), pos.x * (63 / FRAME_W), pos.y * (63 / FRAME_W))}
              </div>
              <figcaption className="mt-1.5 text-[12px] text-slate-500">ID card</figcaption>
            </figure>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 pb-2">
          <button type="button" onClick={() => setZoomKeep(zoom - 0.2)} aria-label="Zoom out" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Minus className="h-4 w-4" />
          </button>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomKeep(Number(e.target.value))} aria-label="Zoom" className="h-2 flex-1 accent-emerald-700" />
          <button type="button" onClick={() => setZoomKeep(zoom + 0.2)} aria-label="Zoom in" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="flex items-center justify-center gap-1.5 pb-3 text-[12px] text-slate-400">
          <Move className="h-3.5 w-3.5" /> Drag the photo · scroll or slide to zoom
        </p>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button type="button" onClick={() => onDone(null)} className="btn-line">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!bmp || busy} className="btn-primary">
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
