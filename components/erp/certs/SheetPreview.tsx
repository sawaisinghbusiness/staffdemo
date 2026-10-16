"use client";
/* Copied from the ERP (components/certificates/SheetPreview.tsx). Keep in step. */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHEET_W = 794;
const SHEET_H = 1123;

/** Shows an A4 sheet scaled down to whatever width it is given. */
export function SheetPreview({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / SHEET_W)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      <div className="mx-auto overflow-hidden rounded-md shadow-lg ring-1 ring-slate-900/10" style={{ height: SHEET_H * scale, width: SHEET_W * scale }}>
        <div style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Prints one A4 sheet: mounts it outside the app shell, prints, then unmounts.
 * Render it only while printing; `onDone` fires after the print dialog closes.
 */
export function PrintSheet({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      window.print();
      onDone();
    }, 60);
    return () => clearTimeout(t);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  return createPortal(
    <div id="print-sheet">
      <style jsx global>{`
        #print-sheet {
          display: none;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body > *:not(#print-sheet) {
            display: none !important;
          }
          #print-sheet {
            display: block !important;
          }
          #print-sheet * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #print-sheet .cert-sheet {
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden;
          }
        }
      `}</style>
      {children}
    </div>,
    document.body
  );
}
