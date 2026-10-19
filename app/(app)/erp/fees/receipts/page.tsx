"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Ban, CalendarDays, Search, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { toTransaction, type Receipt, type ReceiptList } from "@/lib/erpReceipts";
import { useSchoolInfo } from "@/lib/erpCerts";
import { FeeReceiptModal } from "@/components/erp/FeeReceiptModal";
import { Empty, ErrorCard, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Fees → Receipts: the ERP's receipt register (GET /api/fees/receipts). Pick the dates, search,
 * tap a receipt to print it again. The admin can cancel one (POST /api/fees/receipts/:id/cancel), which takes
 * the money back off the student's paid fee; the number stays in the register, marked cancelled.
 * Excel export stays on the ERP website.
 */

type Range = "today" | "week" | "month" | "session" | "custom";
type ModeFilter = "all" | "Cash" | "UPI" | "Cheque" | "Other";
const MODE_COLOR = { Cash: "#2a78d6", UPI: "#eb6834", Cheque: "#1baf7a" } as const;
const lakh = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : rupees(n));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const time = (s: string) => new Date(s).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const modeKey = (m: string): Exclude<ModeFilter, "all"> => (/upi|qr/i.test(m) ? "UPI" : /cheque|dd/i.test(m) ? "Cheque" : /cash/i.test(m) ? "Cash" : "Other");
const PAGE = 100;

/** Start and end dates (inclusive) for a preset. The session runs April to March (ERP rangeDates). */
function rangeDates(r: Exclude<Range, "custom">): [string, string] {
  const now = new Date();
  const today = iso(now);
  if (r === "today") return [today, today];
  if (r === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return [iso(d), today];
  }
  if (r === "month") return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), today];
  return ["2026-04-01", "2027-03-31"];
}

const CANCEL_REASONS = ["Wrong amount entered", "Wrong student selected", "Cheque bounced", "Entered twice", "Refunded to parent"];
const RANGES: [Range, Bi][] = [
  ["today", { hi: "आज", en: "Today" }],
  ["week", { hi: "इस हफ़्ते", en: "This week" }],
  ["month", { hi: "इस महीने", en: "This month" }],
  ["session", { hi: "पूरा सत्र", en: "This session" }],
  ["custom", { hi: "तारीख चुनें", en: "Custom" }],
];

export default function ErpReceiptsPage() {
  const L = useL();
  const school = useSchoolInfo();
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";
  const [range, setRange] = useState<Range>("month");
  const [custom, setCustom] = useState<[string, string]>(rangeDates("month"));
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [showCancelled, setShowCancelled] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [printing, setPrinting] = useState<Receipt | null>(null);
  const [cancelling, setCancelling] = useState<Receipt | null>(null);

  const [from, to] = range === "custom" ? custom : rangeDates(range);
  const { data: list, error, reload } = useApi<ReceiptList>(`/erp/fees/receipts?from=${from}&to=${to}`);
  useEffect(() => setLimit(PAGE), [from, to]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list?.receipts || []).filter((r) => {
      if (!showCancelled && r.cancelled) return false;
      if (mode !== "all" && modeKey(r.mode) !== mode) return false;
      if (!t) return true;
      return [r.receiptNo, r.student?.name, r.student?.srNo, r.student?.fatherName, r.ref, r.student?.mobile].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [list, q, mode, showCancelled]);
  const shownLive = shown.filter((r) => !r.cancelled);
  const tt = list?.totals;
  const split = tt ? (["Cash", "UPI", "Cheque"] as const).map((k) => ({ k, v: tt.byMode[k], pct: tt.total ? (tt.byMode[k] / tt.total) * 100 : 0 })) : [];

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="no-scrollbar stick-chips flex gap-1.5 overflow-x-auto" role="tablist" aria-label={L({ hi: "तारीख", en: "Date range" })}>
        {RANGES.map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={clsx("min-h-[38px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold", range === k ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-600")}>
            {L(t)}
          </button>
        ))}
      </div>
      {range === "custom" ? (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field-box">
            <small>{L({ hi: "से", en: "From" })}</small>
            <input id="rc-from" type="date" value={custom[0]} max={custom[1]} onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])} />
            <CalendarDays aria-hidden />
          </label>
          <label className="field-box">
            <small>{L({ hi: "तक", en: "To" })}</small>
            <input id="rc-to" type="date" value={custom[1]} min={custom[0]} onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])} />
            <CalendarDays aria-hidden />
          </label>
        </div>
      ) : (
        <p className="text-[13px] text-ink-500">{from === to ? day(from) : `${day(from)} – ${day(to)}`}</p>
      )}
      {error && !list && error.status !== 401 && <ErrorCard offline={error.status === 0} onRetry={reload} />}

      {/* Totals */}
      <section className="today-card pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-medium text-ink-500">{L({ hi: "जमा हुए", en: "Collected" })}</p>
            <p className="tnum text-[26px] font-extrabold leading-tight">{tt ? lakh(tt.total) : "…"}</p>
            <p className="text-[12.5px] text-ink-500">{tt ? `${tt.count.toLocaleString("en-IN")} ${L({ hi: "रसीदें", en: "receipts" })}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-[12.5px] font-medium text-ink-500">{L({ hi: "रद्द", en: "Cancelled" })}</p>
            <p className="tnum text-[20px] font-extrabold text-rose-600">{tt ? tt.cancelledCount : "…"}</p>
            <p className="text-[12px] text-ink-500">{tt ? `${rupees(tt.cancelledAmount)} ${L({ hi: "गिना नहीं", en: "not counted" })}` : ""}</p>
          </div>
        </div>
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-ink-100">
          {split.map((s) => (
            <span key={s.k} style={{ width: `${s.pct}%`, background: MODE_COLOR[s.k] }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {split.map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5 text-ink-600">
              <i className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[s.k] }} />
              {s.k} <b className="tnum text-ink-900">{rupees(s.v)}</b>
              <span className="tnum text-ink-400">{Math.round(s.pct)}%</span>
            </span>
          ))}
        </div>
      </section>

      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="rc-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "रसीद नं., बच्चा, SR नं. या UTR", en: "Receipt no., student, SR no. or UTR" })} autoComplete="off" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>
      <div className="grid grid-cols-2 items-center gap-2.5">
        <SelectBox label={L({ hi: "कैसे", en: "Mode" })} value={mode} onChange={(v) => setMode(v as ModeFilter)}>
          <option value="all">{L({ hi: "सभी", en: "All" })}</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Cheque">Cheque</option>
          <option value="Other">Other</option>
        </SelectBox>
        <label className="flex min-h-[48px] items-center gap-2 text-[14px] text-ink-700">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          {L({ hi: "रद्द भी दिखाएँ", en: "Show cancelled" })}
        </label>
      </div>

      {!list ? (
        !error ? <ListSkeleton rows={6} /> : null
      ) : shown.length === 0 ? (
        <Empty>{list.receipts.length ? L({ hi: "कोई रसीद नहीं मिली।", en: "No receipt matches." }) : L({ hi: "इन तारीखों में कोई रसीद नहीं।", en: "No receipt in these dates." })}</Empty>
      ) : (
        <>
          <ul>
            {shown.slice(0, limit).map((r) => (
              <li key={r.id} className={clsx("flex items-center border-b border-ink-100", r.cancelled && "bg-rose-50/60")}>
                <button type="button" onClick={() => setPrinting(r)} aria-label={`${L({ hi: "प्रिंट", en: "Print" })} ${r.receiptNo}`} className="flex min-h-[66px] min-w-0 flex-1 items-center gap-3 py-2 text-left active:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{r.student?.name || "—"}</span>
                    <span className="block truncate text-[12.5px] text-ink-400">
                      <span className={clsx("tnum", r.cancelled && "line-through")}>{r.receiptNo}</span> · {r.student?.classSec} · {modeKey(r.mode)}
                    </span>
                    <span className="block text-[12px] text-ink-400">
                      {day(r.date)}
                      {r.createdAt && r.createdAt.slice(0, 10) === r.date ? ` · ${time(r.createdAt)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={clsx("tnum block text-[15px] font-bold", r.cancelled && "text-ink-400 line-through")}>{rupees(r.amount)}</span>
                    {r.cancelled && <span className="block text-[12px] font-semibold text-rose-600">{L({ hi: "रद्द", en: "Cancelled" })}</span>}
                  </span>
                </button>
                {isAdmin && !r.cancelled && list.canCancel && (
                  <button type="button" onClick={() => setCancelling(r)} aria-label={`${L({ hi: "रद्द करें", en: "Cancel" })} ${r.receiptNo}`} className="grid h-11 w-11 shrink-0 place-items-center text-ink-400 active:bg-rose-50 active:text-rose-600">
                    <Ban className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-500">
            <span>
              {Math.min(limit, shown.length).toLocaleString("en-IN")} / {shown.length.toLocaleString("en-IN")}
            </span>
            <span className="tnum">
              {L({ hi: "इनका कुल", en: "Total of these" })} <b className="text-ink-900">{rupees(shownLive.reduce((a, r) => a + r.amount, 0))}</b>
              {shown.length !== shownLive.length && L({ hi: " (रद्द नहीं गिने)", en: " (cancelled not counted)" })}
            </span>
          </div>
          {shown.length > limit && (
            <button type="button" onClick={() => setLimit(limit + PAGE)} className="btn-line w-full">
              {L({ hi: "और दिखाएँ", en: "Show more" })} ({Math.min(PAGE, shown.length - limit)})
            </button>
          )}
        </>
      )}
      {list && !list.canCancel && isAdmin && (
        <p className="flex items-center gap-2 rounded-xl bg-marigold-50 px-3 py-2.5 text-[13px] text-ink-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          {L({ hi: "रसीद रद्द करने के लिए डेटाबेस में एक बार का बदलाव चाहिए (receipt cancel SQL)।", en: "Cancelling receipts needs a one-time database update (receipt cancel SQL)." })}
        </p>
      )}

      <FeeReceiptModal isOpen={!!printing} onClose={() => setPrinting(null)} transaction={printing ? toTransaction(printing) : null} schoolName={school.name} />
      {cancelling && (
        <CancelSheet
          receipt={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Cancelling takes the money back off the student's paid fee, so it asks for a reason and a clear yes (ERP CancelModal). */
function CancelSheet({ receipt, onClose, onDone }: { receipt: Receipt; onClose: () => void; onDone: () => void }) {
  const L = useL();
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const text = reason === "other" ? other.trim() : reason;

  async function go() {
    if (text.length < 3) return toast(false, L({ hi: "यह रसीद क्यों रद्द हो रही है, लिखें।", en: "Write why this receipt is being cancelled." }));
    setBusy(true);
    try {
      await api(`/erp/fees/receipts/${receipt.id}/cancel`, { body: { reason: text } });
      toast(true, L({ hi: `रसीद ${receipt.receiptNo} रद्द हुई। ${rupees(receipt.amount)} ${receipt.student?.name || "बच्चे"} की जमा फ़ीस से हटे।`, en: `Receipt ${receipt.receiptNo} cancelled. ${rupees(receipt.amount)} taken off ${receipt.student?.name || "the student"}'s paid fee.` }));
      onDone();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "रद्द नहीं हुई।", en: "Could not cancel." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: `रसीद ${receipt.receiptNo} रद्द करें?`, en: `Cancel receipt ${receipt.receiptNo}?` })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 rounded-xl bg-ink-50 p-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{receipt.student?.name}</p>
            <p className="text-[12.5px] text-ink-500">{receipt.student?.classSec}</p>
          </div>
          <div className="text-right">
            <p className="tnum text-[18px] font-bold">{rupees(receipt.amount)}</p>
            <p className="text-[12px] text-ink-500">
              {modeKey(receipt.mode)} · {day(receipt.date)}
            </p>
          </div>
        </div>
        <SelectBox label={L({ hi: "क्यों", en: "Why" })} value={reason} onChange={setReason}>
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="other">{L({ hi: "कुछ और…", en: "Something else…" })}</option>
        </SelectBox>
        {reason === "other" && (
          <label className="field-box">
            <small>{L({ hi: "कारण लिखें", en: "Write the reason" })}</small>
            <input id="rc-other" value={other} onChange={(e) => setOther(e.target.value)} autoFocus />
          </label>
        )}
        <p className="rounded-xl bg-rose-50 p-3 text-[13.5px] leading-relaxed text-ink-800">
          {L({
            hi: `${rupees(receipt.amount)} ${receipt.student?.name || "बच्चे"} की जमा फ़ीस से हट जाएँगे, यानी फिर से बाकी दिखेंगे। रसीद नंबर रजिस्टर में "रद्द" लिखा रहेगा। यह वापस नहीं होगा; ज़रूरत हो तो नई रसीद से फिर लें।`,
            en: `${rupees(receipt.amount)} will be taken off ${receipt.student?.name || "the student"}'s paid fee, so it shows as due again. The receipt number stays in the register, marked cancelled. This cannot be undone; collect again with a new receipt if needed.`,
          })}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn-line">
            {L({ hi: "रसीद रखें", en: "Keep receipt" })}
          </button>
          <button type="button" onClick={go} disabled={busy} className="btn-primary !bg-rose-600">
            {busy ? "…" : L({ hi: "रद्द करें", en: "Cancel receipt" })}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
