"use client";
/* Copied from the ERP (components/attendance/register/PrintRegister.tsx). Keep in step. */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { MonthRegister } from "@/lib/erpRegister";
import { RegisterGrid } from "./RegisterGrid";

/**
 * Prints the register on A4 landscape: mounts a copy outside the app shell (so the sidebar
 * and header are not printed), prints, then unmounts. Same approach as PrintSheet.
 */
export function PrintRegister({ data, title, today, onDone }: { data: MonthRegister; title: string; today: string; onDone: () => void }) {
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
    <div id="print-register">
      <style jsx global>{`
        #print-register {
          display: none;
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body > *:not(#print-register) {
            display: none !important;
          }
          #print-register {
            display: block !important;
            font-family: inherit;
            color: #111;
          }
          #print-register * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #print-register .register-scroll {
            overflow: visible !important;
          }
          #print-register .register-table {
            width: 100% !important;
            font-size: 8.5px !important;
          }
          #print-register .register-table th,
          #print-register .register-table td {
            position: static !important;
            font-size: 9px !important;
            padding: 2px !important;
            min-width: 0 !important;
            line-height: 1.25 !important;
            border-bottom: 0.5px solid #d4d7de !important;
          }
          #print-register .register-table th span,
          #print-register .register-table td span {
            font-size: 9px !important;
            line-height: 1.25 !important;
          }
          #print-register .register-name {
            max-width: 34mm !important;
          }
          #print-register .register-meter {
            display: none !important;
          }
          #print-register tr {
            break-inside: avoid;
          }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3mm", fontSize: 11 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span>
          Working days marked: {data.totals.workingDays} · Average: {data.totals.averagePercent === null ? "—" : `${data.totals.averagePercent}%`} · P present, A absent, L leave, H half day
        </span>
      </div>
      <RegisterGrid data={data} today={today} />
    </div>,
    document.body
  );
}
