"use client";
/* Copied from the ERP (components/staff/attendance/PrintStaffRegister.tsx). Keep in step. */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { StaffRegister } from "@/lib/erpStaff";
import { StaffRegisterGrid } from "./StaffRegisterGrid";

/**
 * Prints the staff register on A4 landscape: mounts a copy outside the app shell (so the
 * sidebar and header are not printed), prints, then unmounts.
 */
export function PrintStaffRegister({ data, title, today, onDone }: { data: StaffRegister; title: string; today: string; onDone: () => void }) {
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
    <div id="print-staff-register">
      <style jsx global>{`
        #print-staff-register {
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
          body > *:not(#print-staff-register) {
            display: none !important;
          }
          #print-staff-register {
            display: block !important;
            font-family: inherit;
            color: #111;
          }
          #print-staff-register * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #print-staff-register .register-scroll {
            overflow: visible !important;
          }
          #print-staff-register .register-table {
            width: 100% !important;
          }
          #print-staff-register .register-table th,
          #print-staff-register .register-table td {
            position: static !important;
            font-size: 9px !important;
            padding: 2px !important;
            min-width: 0 !important;
            line-height: 1.25 !important;
            border-bottom: 0.5px solid #d4d7de !important;
          }
          #print-staff-register .register-table th span,
          #print-staff-register .register-table td span {
            font-size: 9px !important;
            line-height: 1.25 !important;
          }
          #print-staff-register .register-code {
            width: 12mm !important;
          }
          #print-staff-register .register-name {
            max-width: 32mm !important;
          }
          #print-staff-register tr {
            break-inside: avoid;
          }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3mm", fontSize: 11 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span>
          Days marked: {data.totals.workingDays} · P present, A absent, L on leave, H half day
        </span>
      </div>
      <StaffRegisterGrid data={data} today={today} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12mm", fontSize: 11 }}>
        <span>Prepared by ____________________</span>
        <span>Principal ____________________</span>
      </div>
    </div>,
    document.body
  );
}
