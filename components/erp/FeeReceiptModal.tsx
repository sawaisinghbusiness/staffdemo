"use client";
/* Copied from the ERP (components/fees/FeeReceiptModal.tsx) so app receipts print the same; only button classes are the staff app's. Keep in step. */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Printer, X } from "lucide-react";
import { FeeTransaction, numberToWordsIndian } from "@/lib/erpFees";
import { headRows } from "@/lib/erpFeeHeads";

interface FeeReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FeeTransaction | null;
  schoolName?: string;
}

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FeeReceiptModal({ isOpen, onClose, transaction, schoolName = "St. Paul School" }: FeeReceiptModalProps) {
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
          }
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
              <ReceiptSlip copy="Parent copy" schoolName={schoolName} t={transaction} />
              <div className="print-only hidden">
                <p className="my-5 flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="h-px flex-1 border-t border-dashed border-slate-400" />
                  cut here
                  <span className="h-px flex-1 border-t border-dashed border-slate-400" />
                </p>
                <ReceiptSlip copy="School copy" schoolName={schoolName} t={transaction} />
              </div>
            </div>
          </div>

          <footer className="no-print flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Prints the parent copy and school copy on one A4 sheet.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-line flex-1 sm:flex-none">
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

function ReceiptSlip({ copy, schoolName, t }: { copy: string; schoolName: string; t: FeeTransaction }) {
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
      <header className="relative border-b border-slate-800 pb-3 text-center">
        <span className="absolute right-0 top-0 text-[11px] text-slate-600">{copy}</span>
        <p className="text-base font-bold uppercase tracking-wide">{schoolName}</p>
        <p className="text-xs text-slate-600">Barmer (Rajasthan)</p>
        <p className="mt-2 inline-block border border-slate-800 px-3 py-0.5 text-xs font-semibold">FEE RECEIPT</p>
      </header>

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

      <p className="mt-2">
        <span className="text-slate-600">Rupees in words: </span>
        <span className="font-medium">{numberToWordsIndian(Number(t.amount_paid) || 0)}</span>
      </p>

      <div className="mt-10 flex items-end justify-between text-xs text-slate-600">
        <span className="border-t border-slate-500 px-4 pt-1">Depositor&apos;s signature</span>
        <span className="border-t border-slate-500 px-4 pt-1">Cashier (signature &amp; seal)</span>
      </div>
    </article>
  );
}
