"use client";
/* Copied from the ERP (components/exams/report/PrintReportCards.tsx). Keep in step. */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Prints one or many A4 report cards, one per page: mounts them outside the
 * app shell, waits for the logo images, prints, then unmounts via `onDone`.
 * Each child should be a `.report-sheet`; a page break follows every sheet.
 */
export function PrintReportCards({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const imgs = Array.from(ref.current?.querySelectorAll("img") || []);
    const loaded = Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.addEventListener("load", () => r(), { once: true });
              img.addEventListener("error", () => r(), { once: true });
            })
      )
    );
    const timeout = new Promise<void>((r) => setTimeout(r, 4000));
    Promise.race([loaded, timeout]).then(() =>
      setTimeout(() => {
        if (cancelled) return;
        window.print();
        onDone();
      }, 60)
    );
    return () => {
      cancelled = true;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  return createPortal(
    <div id="report-print" ref={ref}>
      <style jsx global>{`
        #report-print {
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
          body > *:not(#report-print) {
            display: none !important;
          }
          #report-print {
            display: block !important;
          }
          #report-print * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #report-print .report-sheet {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
          }
          #report-print .report-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
      {children}
    </div>,
    document.body
  );
}
