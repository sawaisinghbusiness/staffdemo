"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Printer, X } from "lucide-react";
import { FeeTransaction, numberToWordsIndian } from "@/lib/erpFees";
import { headRows } from "@/lib/erpFeeHeads";
import { useApi } from "@/lib/api";
import type { SchoolProfile } from "@/lib/erpSettings";

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FeeTransaction | null;
  schoolName?: string;
}

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FeeReceiptModal({ isOpen, onClose, transaction, schoolName: given }: FeeReceiptModalProps) {
  // The name from ERP Settings unless the page passes one.
  const { data } = useApi<SchoolProfile>(isOpen ? "/erp/school" : null);
  const schoolProfile = data || { school_name: "", address: "", city: "", state: "", pincode: "", contact1: "", contact2: "", email: "", affiliation_no: "", board: "", school_code: "", logo_url: "" };
  const schoolName = given || schoolProfile.school_name || "School";
  // Letterhead from Settings > School, not a fixed "Barmer (Rajasthan)" (2026-11-16).
  const p = schoolProfile;
  const place = [p.address, p.city, [p.state, p.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const contact = [[p.contact1, p.contact2].filter(Boolean).join(", "), p.email].filter(Boolean).join(" · ");
  const affiliation = p.affiliation_no ? `${p.board || "CBSE"} Affiliation No. ${p.affiliation_no}${p.school_code ? ` · School code ${p.school_code}` : ""}` : "";
  const letterhead = { place, contact, affiliation, logo: p.logo_url };
  const printRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    printRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction || typeof document === "undefined") return null;

  // Portal to <body> so no page wrapper (animations, overflow) can offset or clip it,
  // and so print CSS can drop everything else with `body > *:not(#receipt-portal)`.
  return createPortal(
    <div id="receipt-portal">
      {/*
        Print: the app shell is h-screen + overflow-hidden, so merely hiding it (visibility)
        still clips the page to one screen. Remove it from layout instead, and let the
        receipt flow at natural height on A4 with both copies.
      */}
      <style jsx global>{`
        #receipt-portal .receipt-slip { border: 2px solid #1c2a5e; padding: 20px 24px; color: #17233c; font-family: Georgia, 'Times New Roman', serif; box-shadow: inset 0 0 0 4px white, inset 0 0 0 5px #d0d5e1; }
        #receipt-portal .receipt-letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #1c2a5e; }
        #receipt-portal .receipt-letterhead img { width: 62px; height: 62px; object-fit: contain; flex-shrink: 0; }
        #receipt-portal .receipt-letterhead-details { flex: 1; text-align: center; }
        #receipt-portal .receipt-school-name { font-size: 20px; font-weight: 700; line-height: 1.2; color: #1c2a5e; }
        #receipt-portal .receipt-copy { text-align: right; font: 10px Arial,sans-serif; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; color: #59647b; }
        #receipt-portal .receipt-document-title { display:flex; justify-content:space-between; align-items:center; gap:12px; border-bottom:1px solid #b8c1d1; padding:9px 0; margin-bottom:2px; }
        #receipt-portal .receipt-document-title h3 { font-size:16px; font-weight:700; letter-spacing:2px; color:#1c2a5e; }
        #receipt-portal .receipt-slip dl { font-family:Arial,sans-serif; font-size:11px; gap:9px 16px; padding:12px 0; }
        #receipt-portal .receipt-slip dl dt { width:65px; }
        #receipt-portal .receipt-slip table { font:11px Arial,sans-serif; border-color:#a6b1c6; }
        #receipt-portal .receipt-slip th { background:#eef1f8; color:#1c2a5e; padding:8px; text-transform:uppercase; font-size:10px; letter-spacing:.5px; }
        #receipt-portal .receipt-slip td { padding:7px 8px; }
        #receipt-portal .receipt-slip tr:last-child { background:#eef1f8; color:#1c2a5e; }
        #receipt-portal .receipt-amount-words { padding:9px 0; border-bottom:1px solid #d0d5e1; font-size:11px; }
        #receipt-portal .receipt-signatures { display:flex; justify-content:space-between; gap:16px; margin-top:28px; font:10px Arial,sans-serif; }
        @media(max-width:480px) { #receipt-portal .receipt-slip {padding:16px 12px;} #receipt-portal .receipt-school-name {font-size:17px;} #receipt-portal .receipt-letterhead img {width:46px;height:46px;} #receipt-portal .receipt-slip dl {grid-template-columns:1fr;} }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body > *:not(#receipt-portal) {
            display: none !important;
          }
          #receipt-portal * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #receipt-portal .receipt-overlay,
          #receipt-portal .receipt-dialog,
          #receipt-portal .receipt-body {
            position: static !important;
            display: block !important;
            max-height: none !important;
            max-width: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
            border: 0 !important;
            backdrop-filter: none !important;
            animation: none !important;
          }
          #receipt-portal .no-print {
            display: none !important;
          }
          #receipt-portal .print-only {
            display: block !important;
          }
          #receipt-portal .receipt-slip {
            break-inside: avoid;
            padding: 12px 18px;
            font-size: 11px;
            line-height: 1.2;
          }
          #receipt-portal .receipt-letterhead { padding-bottom: 8px; }
          #receipt-portal .receipt-letterhead img { width: 46px; height: 46px; }
          #receipt-portal .receipt-school-name { font-size: 18px; }
          #receipt-portal .receipt-document-title { padding: 6px 0; }
          #receipt-portal .receipt-slip dl { grid-template-columns: 1fr 1fr; padding: 8px 0; gap: 5px 16px; }
          #receipt-portal .receipt-slip td, #receipt-portal .receipt-slip th { padding: 5px 8px; }
          #receipt-portal .receipt-signatures { margin-top: 20px; }
        }
      `}</style>

      <div
        className="receipt-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 animate-fadeIn sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-title"
          onClick={(e) => e.stopPropagation()}
          className="receipt-dialog my-4 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl animate-scaleUp"
        >
          <header className="no-print flex items-center gap-3 border-b border-slate-200 px-5 py-3.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
            <div className="min-w-0 flex-1">
              <h2 id="receipt-title" className="text-[15px] font-semibold text-slate-900">
                Receipt {transaction.receipt_no}
              </h2>
              <p className="truncate text-[13px] text-slate-500">
                {inr(transaction.amount_paid).replace(".00", "")}
                {transaction.student?.name ? ` from ${transaction.student.name}` : ""}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="receipt-body flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
            <div id="printable-fee-receipt" className="mx-auto max-w-xl">
              <ReceiptSlip copy="Parent copy" schoolName={schoolName} letterhead={letterhead} t={transaction} />
              <div className="print-only hidden">
                <p className="my-5 flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="h-px flex-1 border-t border-dashed border-slate-400" />
                  cut here
                  <span className="h-px flex-1 border-t border-dashed border-slate-400" />
                </p>
                <ReceiptSlip copy="School copy" schoolName={schoolName} letterhead={letterhead} t={transaction} />
              </div>
            </div>
          </div>

          <footer className="no-print flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Prints the parent copy and school copy on one A4 sheet.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 sm:flex-none">
                Next student
              </button>
              <button ref={printRef} type="button" onClick={() => window.print()} className="btn-primary flex-1 sm:flex-none">
                <Printer className="h-4 w-4" />
                Print receipt
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ReceiptSlip({ copy, schoolName, letterhead, t }: { copy: string; schoolName: string; letterhead: { place: string; contact: string; affiliation: string; logo?: string }; t: FeeTransaction }) {
  const s = t.student;
  const rows: { key: string; label: string; amount: number }[] = headRows(t.fee_heads);
  if (!rows.length) rows.push({ key: "fee", label: "Fee payment", amount: Number(t.amount_paid) || 0 });

  const paid = new Date(String(t.payment_date).length <= 10 ? String(t.payment_date) + "T00:00:00" : t.payment_date);
  const date = paid.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const meta: [string, React.ReactNode][] = [
    ["Student", <span key="n" className="font-semibold text-slate-900">{s?.name || "—"}</span>],
    ["Class", s?.class_name ? `${s.class_name}${s.section ? " - " + s.section : ""}` : "—"],
    ["Father", s?.father_name || "—"],
    ["SR no.", s?.sr_no || "—"],
    ["Admission no.", s?.admission_no || "—"],
    ["Paid by", `${t.payment_mode}${t.transaction_id ? ` · ${t.transaction_id}` : ""}`],
    ["Received by", t.collected_by || "Fee counter"],
  ];

  return (
    <article className="receipt-slip relative overflow-hidden border border-slate-800 bg-white px-6 py-5 text-[13px] text-slate-900">
      {t.cancelled && (
        // A cancelled receipt can still be reprinted for the file, but must never pass as proof of payment.
        <div aria-label="Cancelled receipt" className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
          <span className="-rotate-[18deg] rounded border-[5px] border-rose-600 px-6 py-1 text-5xl font-black tracking-[0.2em] text-rose-600 opacity-80">CANCELLED</span>
          {t.cancel_reason && <span className="mt-6 -rotate-[18deg] bg-white/80 px-2 text-xs font-semibold text-rose-700">{t.cancel_reason}</span>}
        </div>
      )}
      <p className="receipt-copy">{copy}</p>
      <header className="receipt-letterhead">
        {letterhead.logo && <img src={letterhead.logo} alt="School logo" />}
        <div className="receipt-letterhead-details">
        <p className="receipt-school-name">{schoolName}</p>
        {letterhead.place && <p className="text-xs text-slate-600">{letterhead.place}</p>}
        {letterhead.contact && <p className="text-[11px] text-slate-600">{letterhead.contact}</p>}
        {letterhead.affiliation && <p className="text-[11px] text-slate-600">{letterhead.affiliation}</p>}
        </div>
      </header>
      <div className="receipt-document-title"><h3>FEE RECEIPT</h3><span className="text-[10px] text-slate-600">{t.cancelled ? "Cancelled record" : "Payment acknowledgement"}</span></div>

      <div className="flex justify-between py-2.5">
        <span>
          Receipt no. <span className="font-mono font-semibold">{t.receipt_no}</span>
        </span>
        <span>
          Date <span className="font-semibold">{date}</span>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-y border-slate-300 py-2.5">
        {meta.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-600">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <table className="mt-3 w-full border-collapse border border-slate-400">
        <thead>
          <tr className="border-b border-slate-400 bg-slate-50 text-left text-xs">
            <th className="w-10 border-r border-slate-400 px-2 py-1.5 text-center font-semibold">S.No.</th>
            <th className="border-r border-slate-400 px-2 py-1.5 font-semibold">Particulars</th>
            <th className="w-32 px-2 py-1.5 text-right font-semibold">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className="border-b border-slate-200 hover:bg-transparent">
              <td className="border-r border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
              <td className="border-r border-slate-400 px-2 py-1.5">{r.label}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{inr(r.amount).slice(1)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-800 font-semibold hover:bg-transparent">
            <td colSpan={2} className="border-r border-slate-400 px-2 py-1.5 text-right">Total</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{inr(t.amount_paid).slice(1)}</td>
          </tr>
        </tbody>
      </table>

      <p className="receipt-amount-words">
        <span className="text-slate-600">Rupees in words: </span>
        <span className="font-medium">{numberToWordsIndian(Number(t.amount_paid) || 0)}</span>
      </p>

      {t.remarks && <p className="mt-2 text-[10px] text-slate-600">Remarks: {t.remarks}</p>}
      <div className="receipt-signatures">
        <span className="border-t border-slate-500 px-4 pt-1">Depositor&apos;s signature</span>
        <span className="border-t border-slate-500 px-4 pt-1">Cashier (signature &amp; seal)</span>
      </div>
    </article>
  );
}
