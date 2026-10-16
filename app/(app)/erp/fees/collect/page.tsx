"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Banknote, Check, Landmark, Phone, Printer, QrCode, Search, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { duesFor, planFor, splitPayment } from "@/lib/erpFeeEngine";
import { headLabel, headRows } from "@/lib/erpFeeHeads";
import { numberToWordsIndian, type DaySummary, type FeePosition, type FeeTransaction } from "@/lib/erpFees";
import type { ErpStudent } from "@/lib/erpStudents";
import { useSchoolInfo } from "@/lib/erpCerts";
import { FeeReceiptModal } from "@/components/erp/FeeReceiptModal";
import { Avatar, Empty, ErrorCard, ListSkeleton, Skeleton } from "@/components/ui";

/*
 * ERP login → Fees → Collect fee: the ERP's fee counter. The instalments, the split of a payment across
 * fee heads and the late fine are worked out with the ERP's own fee engine (copied, lib/erpFeeEngine),
 * and POST /api/fees/pay is what actually decides and saves them, exactly as on the ERP. Then the same receipt.
 */

type Mode = "Cash" | "UPI" | "Cheque";
// Payment-mode colours: the ERP's validated categorical trio (labels always shown).
const MODES: { key: Mode; text: Bi; icon: typeof Banknote; color: string }[] = [
  { key: "Cash", text: { hi: "नकद", en: "Cash" }, icon: Banknote, color: "#2a78d6" },
  { key: "UPI", text: { hi: "UPI", en: "UPI" }, icon: QrCode, color: "#eb6834" },
  { key: "Cheque", text: { hi: "चेक", en: "Cheque" }, icon: Landmark, color: "#1baf7a" },
];
const MODE_ICON: Record<Mode, typeof Banknote> = { Cash: Banknote, UPI: QrCode, Cheque: Landmark };
const modeKind = (m: string): Mode => (/upi|qr/i.test(m) ? "UPI" : /cheque|dd/i.test(m) ? "Cheque" : "Cash");
const digits = (s: string) => Math.max(0, parseInt(String(s).replace(/\D/g, "") || "0", 10));
const todayKey = () => new Date().toLocaleDateString("en-CA");
const dm = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function ErpCollectFeePage() {
  const L = useL();
  const school = useSchoolInfo();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [student, setStudent] = useState<ErpStudent | null>(null);
  const [position, setPosition] = useState<FeePosition | null>(null);
  const [positionError, setPositionError] = useState(false);
  const [amount, setAmount] = useState("");
  const [fineText, setFineText] = useState("");
  const [fineEdited, setFineEdited] = useState(false);
  const [waiveReason, setWaiveReason] = useState("");
  const [mode, setMode] = useState<Mode>("Cash");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<FeeTransaction | null>(null);

  const summary = useApi<{ data: DaySummary }>("/erp/fees/summary");
  const topDues = useApi<{ data: ErpStudent[] }>(student ? null : "/erp/fees/top-dues?limit=8");
  const recent = useApi<{ data: FeeTransaction[] }>("/erp/fees/transactions?limit=12");
  const history = useApi<{ data: FeeTransaction[] }>(student ? `/erp/fees/transactions?limit=20&studentId=${encodeURIComponent(student.id)}` : null);
  const found = useApi<{ data: ErpStudent[] }>(term ? `/erp/students?q=${encodeURIComponent(term)}&limit=8` : null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  /** The student's fee position; on a new pick, suggest paying whatever is overdue (ERP loadPosition). */
  const loadPosition = useCallback(async (id: string, suggest: boolean) => {
    setPosition(null);
    setPositionError(false);
    try {
      const p = await api<FeePosition>(`/erp/fees/position/${encodeURIComponent(id)}`);
      setPosition(p);
      if (suggest) {
        const d = duesFor(p.config, planFor(p.config, p.input), p.ledger.net, p.ledger.paid, p.asOf);
        setAmount(d.dueNow > 0 ? String(d.dueNow) : "");
      }
    } catch {
      setPositionError(true);
    }
  }, []);

  const select = useCallback(
    (s: ErpStudent) => {
      setStudent(s);
      setQ("");
      setTerm("");
      setReference("");
      setRemarks("");
      setMode("Cash");
      setAmount("");
      setFineEdited(false);
      setWaiveReason("");
      loadPosition(s.id, true);
      window.scrollTo(0, 0);
    },
    [loadPosition]
  );

  // Deep link from a student's profile: /erp/fees/collect/?student=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("student");
    if (id)
      api<{ data: ErpStudent }>(`/erp/students/${encodeURIComponent(id)}`)
        .then((r) => select(r.data))
        .catch(() => null);
  }, [select]);

  // Everything below is worked out with the same fee engine the server uses.
  const calc = useMemo(() => {
    if (!position) return null;
    const p = position;
    const plan = planFor(p.config, p.input);
    const dues = duesFor(p.config, plan, p.ledger.net, p.ledger.paid, p.asOf);
    const amt = digits(amount);
    const split = splitPayment(p.config, plan, p.ledger.net, p.ledger.paid, Math.min(amt, p.ledger.balance), p.asOf);
    const nextIdx = dues.instalments.findIndex((i) => i.due > p.asOf && i.outstanding > 0);
    const upTo = nextIdx >= 0 ? dues.instalments.slice(0, nextIdx + 1).reduce((s, i) => s + i.outstanding, 0) : 0;
    return { plan, dues, amt, split, nextIdx, upTo };
  }, [position, amount]);

  // The fine follows the amount unless the cashier has changed it.
  const maxFine = calc?.split.fine || 0;
  const fine = fineEdited ? Math.min(digits(fineText), maxFine) : maxFine;
  useEffect(() => {
    if (!fineEdited) setFineText(maxFine ? String(maxFine) : "");
  }, [maxFine, fineEdited]);

  const balance = position?.ledger.balance ?? 0;
  const amt = calc?.amt ?? 0;
  const over = amt > balance;
  const waived = maxFine - fine;
  const total = (over ? 0 : amt) + fine;
  const needsRef = mode !== "Cash";

  async function submit() {
    if (!student || !position) return toast(false, L({ hi: "पहले बच्चा चुनें।", en: "Pick a student first." }));
    if (amt <= 0) return toast(false, L({ hi: "जमा हो रही फ़ीस लिखें।", en: "Enter the fee amount being paid." }));
    if (over) return toast(false, L({ hi: `इस सत्र में सिर्फ़ ${rupees(balance)} बाकी है।`, en: `Only ${rupees(balance)} is due for the session.` }));
    if (waived > 0 && waiveReason.trim().length < 3) return toast(false, L({ hi: `लेट फ़ाइन के ${rupees(waived)} क्यों छोड़े जा रहे हैं, लिखें।`, en: `Write why ${rupees(waived)} of the late fine is being let go.` }));
    if (needsRef && !reference.trim()) return toast(false, mode === "UPI" ? L({ hi: "UPI का UTR नंबर लिखें।", en: "Enter the UPI reference (UTR) number." }) : L({ hi: "चेक नंबर लिखें।", en: "Enter the cheque number." }));
    setBusy(true);
    try {
      const res = await api<{ success: boolean; transaction: FeeTransaction; newDue?: number }>("/erp/fees/pay", {
        body: { studentId: student.id, amount: amt, fine, waiveReason: waived > 0 ? waiveReason.trim() : undefined, paymentMode: mode, transactionId: reference.trim() || undefined, remarks: remarks.trim() || undefined },
      });
      const newDue = res.newDue ?? Math.max(0, balance - amt);
      setStudent({ ...student, balanceFee: newDue, paidFee: student.paidFee + amt });
      setReference("");
      setRemarks("");
      setFineEdited(false);
      setWaiveReason("");
      setReceipt(res.transaction);
      toast(true, L({ hi: `${student.name} से ${rupees(total)} मिले`, en: `${rupees(total)} received from ${student.name}` }));
      summary.reload();
      recent.reload();
      history.reload();
      loadPosition(student.id, false);
      setAmount("");
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "पैसा सेव नहीं हुआ। दोबारा कोशिश करें।", en: "The payment was not saved. Try again." }));
    } finally {
      setBusy(false);
    }
  }

  const net = position?.ledger.net ?? student?.totalFee ?? 0;
  const paid = position?.ledger.paid ?? student?.paidFee ?? 0;
  const paidPct = net > 0 ? Math.min(100, Math.round((paid / net) * 100)) : 0;
  const results = term ? found.data?.data : undefined;

  return (
    <div className="animate-rise space-y-4 pb-6">
      {/* Student search */}
      <div className="space-y-2">
        <label className="field-box min-h-[52px]">
          <Search aria-hidden />
          <input id="fee-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={student ? L({ hi: "दूसरे बच्चे से फ़ीस लें…", en: "Collect from another student…" }) : L({ hi: "नाम, SR नं., पिता या मोबाइल", en: "Name, SR no., father or mobile" })} autoComplete="off" enterKeyHint="search" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
              <X className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
        </label>
        {term &&
          (!results ? (
            <ListSkeleton rows={2} />
          ) : results.length === 0 ? (
            <Empty>{L({ hi: `“${term}” से कोई नहीं मिला। SR नंबर या मोबाइल से खोजें।`, en: `No student matches “${term}”. Try the SR number or mobile.` })}</Empty>
          ) : (
            <ul className="rounded-2xl border border-ink-100 bg-white px-3">
              {results.map((s) => (
                <li key={s.id}>
                  <StudentRow s={s} onPick={select} />
                </li>
              ))}
            </ul>
          ))}
      </div>

      {student ? (
        <>
          {/* Selected student */}
          <section className="today-card pb-4">
            <div className="flex items-start gap-3">
              <Avatar name={student.name} url={student.photoUrl || null} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[18px] font-bold">{student.name}</p>
                <p className="truncate text-[13px] text-ink-500">
                  {student.classSec} · {student.srNo} · {student.fatherName}
                </p>
                {position?.input.concession && <p className="text-[12.5px] font-semibold text-jade-700">{position.config.concessions.find((c) => c.code === position.input.concession)?.name || position.input.concession} {L({ hi: "छूट", en: "concession" })}</p>}
                <a href={`tel:${student.mobile}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {student.mobile}
                </a>
              </div>
              <button type="button" onClick={() => (setStudent(null), setPosition(null), setAmount(""))} className="btn-line min-h-[38px] px-3 text-[13px]">
                {L({ hi: "बदलें", en: "Change" })}
              </button>
            </div>
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <Figure label={L({ hi: "सत्र की फ़ीस", en: "Session fee" })} value={rupees(net)} />
              <Figure label={L({ hi: "जमा", en: "Paid" })} value={rupees(paid)} />
              <Figure label={balance > 0 ? L({ hi: "बाकी", en: "Still due" }) : L({ hi: "बाकी", en: "Balance" })} value={balance > 0 ? rupees(balance) : L({ hi: "कुछ नहीं", en: "Nil" })} due={balance > 0} />
            </div>
            <div className="mt-3 flex justify-between text-[12px] text-ink-500">
              <span>
                {L({ hi: "सत्र 2026-27", en: "Session 2026-27" })}
                {position && position.ledger.finePaid > 0 ? ` · ${L({ hi: "लेट फ़ाइन दिया", en: "late fine paid" })} ${rupees(position.ledger.finePaid)}` : ""}
              </span>
              <span className="tnum">
                {paidPct}% {L({ hi: "जमा", en: "paid" })}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-jade-500 transition-[width] duration-500" style={{ width: `${paidPct}%` }} />
            </div>

            {/* Instalments */}
            {positionError ? (
              <div className="mt-4">
                <ErrorCard onRetry={() => loadPosition(student.id, true)} />
              </div>
            ) : !calc ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[70px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {calc.dues.instalments.map((ins, i) => {
                  const now = calc.split.perInstalment[i] || 0;
                  const cleared = calc.split.cleared.includes(i);
                  const tone = ins.outstanding === 0 ? "paid" : ins.overdue ? "late" : "open";
                  return (
                    <div key={ins.name} className={clsx("rounded-xl border px-3 py-2.5", now > 0 ? "border-brand-500 ring-2 ring-brand-100" : "border-ink-100", tone === "paid" ? "bg-jade-50" : tone === "late" ? "bg-rose-50" : "bg-white")}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[13px] font-semibold">{ins.name}</span>
                        <span className="shrink-0 text-[11.5px] text-ink-500">{dm(ins.due)}</span>
                      </div>
                      {tone === "paid" ? (
                        <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-jade-700">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> {L({ hi: "जमा", en: "Paid" })} {rupees(ins.amount)}
                        </p>
                      ) : (
                        <p className={clsx("tnum mt-1 text-[13px] font-bold", tone === "late" ? "text-rose-600" : "text-ink-900")}>
                          {rupees(ins.outstanding)}
                          <span className="ml-1 text-[11.5px] font-medium">{tone === "late" ? `· ${ins.daysLate}${L({ hi: " दिन देर", en: "d late" })}` : ins.paid > 0 ? L({ hi: "बाकी", en: "left" }) : ""}</span>
                        </p>
                      )}
                      {now > 0 && <p className="mt-0.5 text-[11.5px] font-semibold text-brand-700">{cleared ? L({ hi: "इस पेमेंट से पूरी", en: "Cleared by this payment" }) : `${rupees(now)} ${L({ hi: "इस पेमेंट से", en: "from this payment" })}`}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Payment */}
          {calc && balance > 0 && (
            <section className="space-y-3">
              <h2 className="text-[16px] font-bold text-brand-800">{L({ hi: "जमा हो रही फ़ीस", en: "Fee being paid" })}</h2>
              <div className="flex flex-wrap gap-1.5">
                {calc.dues.dueNow > 0 && <Chip on={amt === calc.dues.dueNow} onClick={() => setAmount(String(calc.dues.dueNow))} label={`${L({ hi: "देर वाली", en: "Overdue" })} ${rupees(calc.dues.dueNow)}`} />}
                {calc.nextIdx >= 0 && calc.upTo !== calc.dues.dueNow && <Chip on={amt === calc.upTo} onClick={() => setAmount(String(calc.upTo))} label={`${L({ hi: "तक", en: "Up to" })} ${calc.dues.instalments[calc.nextIdx].name} ${rupees(calc.upTo)}`} />}
                {balance !== calc.upTo && <Chip on={amt === balance} onClick={() => setAmount(String(balance))} label={`${L({ hi: "पूरा सत्र", en: "Full session" })} ${rupees(balance)}`} />}
              </div>
              <label className={clsx("field-box min-h-[60px]", over && "!border-rose-400")}>
                <span className="text-[22px] text-ink-400">₹</span>
                <input id="fee-amount" inputMode="numeric" value={amount ? Number(digits(amount)).toLocaleString("en-IN") : ""} onChange={(e) => setAmount(String(digits(e.target.value)))} placeholder="0" className="tnum text-[26px] font-extrabold" aria-label={L({ hi: "जमा हो रही फ़ीस", en: "Fee being paid" })} />
              </label>
              {over && <p className="text-[13px] font-medium text-rose-700">{L({ hi: `इस सत्र में सिर्फ़ ${rupees(balance)} बाकी है।`, en: `Only ${rupees(balance)} is due for the session.` })}</p>}

              {/* Where the money goes */}
              {!over && (
                <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
                  {headRows(calc.split.heads).map((r) => (
                    <div key={r.key} className="flex items-center justify-between border-b border-ink-100 px-4 py-2 text-[14px]">
                      <span className="text-ink-700">{r.label}</span>
                      <span className="tnum font-semibold">{rupees(r.amount)}</span>
                    </div>
                  ))}
                  {maxFine > 0 && (
                    <div className="border-b border-ink-100 bg-marigold-50 px-4 py-2.5 text-[14px]">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="fee-fine" className="min-w-0 text-ink-700">
                          {headLabel("late_fine")}
                          <span className="block text-[12px] text-ink-500">
                            {calc.split.cleared
                              .map((i) => calc.dues.instalments[i])
                              .filter((x) => x.overdue)
                              .map((x) => `${x.name} ${x.daysLate} days late`)
                              .join(" · ")}{" "}
                            ({L({ hi: "ज़्यादा से ज़्यादा", en: "up to" })} {rupees(maxFine)})
                          </span>
                        </label>
                        <span className="field-box !min-h-[42px] w-28 shrink-0">
                          <span className="text-ink-400">₹</span>
                          <input
                            id="fee-fine"
                            inputMode="numeric"
                            value={fineText}
                            onChange={(e) => {
                              setFineEdited(true);
                              setFineText(String(Math.min(digits(e.target.value), maxFine)));
                            }}
                            className="tnum text-right font-semibold"
                          />
                        </span>
                      </div>
                      {waived > 0 && (
                        <input
                          id="fee-waive"
                          value={waiveReason}
                          onChange={(e) => setWaiveReason(e.target.value)}
                          placeholder={L({ hi: `${rupees(waived)} फ़ाइन क्यों छोड़ा? (रसीद पर छपेगा)`, en: `Why is ${rupees(waived)} of the fine being let go? (printed on the receipt)` })}
                          className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand-500"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3 bg-brand-50 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">{L({ hi: "कुल लेना है", en: "Total to collect" })}</span>
                      <span className="block truncate text-[12px] text-brand-800/80">{total > 0 ? numberToWordsIndian(total) : L({ hi: "ऊपर फ़ीस लिखें", en: "Enter the fee amount above" })}</span>
                    </div>
                    <span className="tnum text-[24px] font-extrabold text-brand-700">{rupees(total)}</span>
                  </div>
                </div>
              )}

              <h2 className="pt-1 text-[16px] font-bold text-brand-800">{L({ hi: "कैसे दिया", en: "Paid by" })}</h2>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={L({ hi: "कैसे दिया", en: "Paid by" })}>
                {MODES.map((m) => (
                  <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} onClick={() => setMode(m.key)} className={clsx("flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg text-[14px] font-semibold", mode === m.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
                    <m.icon className="h-4 w-4" aria-hidden /> {L(m.text)}
                  </button>
                ))}
              </div>
              {needsRef && (
                <label className="field-box">
                  <small>{mode === "UPI" ? L({ hi: "UTR नंबर", en: "UTR number" }) : L({ hi: "चेक नं. और बैंक", en: "Cheque no. and bank" })}</small>
                  <input id="fee-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={mode === "UPI" ? "423589102456" : "918234, SBI Barmer"} className="tnum" />
                </label>
              )}
              <label className="field-box">
                <small>{L({ hi: "नोट, अगर हो", en: "Note, optional" })}</small>
                <input id="fee-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={L({ hi: "जैसे: पिता ने दिया", en: "e.g. Paid by father" })} />
              </label>
              <button type="button" onClick={submit} disabled={busy || total <= 0 || over} className="btn-primary min-h-[52px] w-full text-[16px]">
                <Printer className="h-5 w-5" aria-hidden /> {busy ? "…" : L({ hi: `${rupees(total)} लें और रसीद छापें`, en: `Collect ${rupees(total)} & print` })}
              </button>
            </section>
          )}
          {calc && balance <= 0 && (
            <p className="flex items-center gap-2 rounded-2xl bg-jade-50 px-4 py-3.5 text-[14.5px] font-medium text-jade-800">
              <Check className="h-5 w-5 shrink-0 text-jade-600" strokeWidth={3} aria-hidden /> {L({ hi: "इस सत्र की पूरी फ़ीस जमा है। लेने को कुछ नहीं।", en: "The whole session's fee is paid. Nothing to collect." })}
            </p>
          )}

          <ReceiptList title={L({ hi: `${student.name.split(" ")[0]} की रसीदें`, en: `${student.name.split(" ")[0]}'s receipts` })} list={history.data?.data} error={!!history.error} onOpen={setReceipt} showStudent={false} />
        </>
      ) : (
        <>
          <TodayCard summary={summary.data?.data} />
          <section className="space-y-1">
            <h2 className="text-[16px] font-bold text-brand-800">{L({ hi: "सबसे ज़्यादा बाकी", en: "Highest balances" })}</h2>
            <p className="text-[13px] text-ink-500">{L({ hi: "जिनकी सबसे ज़्यादा फ़ीस बाकी है। फ़ीस लेने के लिए छुएँ।", en: "Students with the most fee pending. Tap one to collect." })}</p>
            {!topDues.data ? (
              topDues.error && topDues.error.status !== 401 ? <ErrorCard offline={topDues.error.status === 0} onRetry={topDues.reload} /> : <ListSkeleton rows={4} />
            ) : topDues.data.data.length === 0 ? (
              <Empty>{L({ hi: "इस सत्र में कोई फ़ीस बाकी नहीं।", en: "No fees pending this session." })}</Empty>
            ) : (
              <ul>
                {topDues.data.data.map((s) => (
                  <li key={s.id}>
                    <StudentRow s={s} onPick={select} pct />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ReceiptList title={L({ hi: "हाल की रसीदें", en: "Latest receipts" })} list={recent.data?.data} error={!!recent.error} onOpen={setReceipt} />

      <FeeReceiptModal isOpen={!!receipt} onClose={() => setReceipt(null)} transaction={receipt} schoolName={school.name} />
    </div>
  );
}

function StudentRow({ s, onPick, pct }: { s: ErpStudent; onPick: (s: ErpStudent) => void; pct?: boolean }) {
  const L = useL();
  const paidPct = s.totalFee > 0 ? Math.round((s.paidFee / s.totalFee) * 100) : 0;
  return (
    <button type="button" onClick={() => onPick(s)} className="flex min-h-[62px] w-full items-center gap-3 border-b border-ink-100 text-left last:border-0 active:bg-ink-50">
      <Avatar name={s.name} url={s.photoUrl || null} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{s.name}</span>
        <span className="block truncate text-[12.5px] text-ink-400">
          {s.classSec} · {s.fatherName}
          {pct ? ` · ${paidPct}% ${L({ hi: "जमा", en: "paid" })}` : ` · ${s.srNo}`}
        </span>
      </span>
      {s.balanceFee > 0 ? <span className="tnum shrink-0 text-[13.5px] font-bold text-rose-600">{rupees(s.balanceFee)}</span> : <span className="shrink-0 text-[13px] font-semibold text-jade-700">{L({ hi: "पूरी", en: "Paid" })}</span>}
    </button>
  );
}

function Figure({ label, value, due }: { label: string; value: string; due?: boolean }) {
  return (
    <div className={clsx("rounded-xl px-2.5 py-2", due ? "bg-rose-50" : "bg-ink-50")}>
      <p className={clsx("text-[11.5px] font-semibold", due ? "text-rose-600" : "text-ink-500")}>{label}</p>
      <p className={clsx("tnum mt-0.5 truncate text-[15.5px] font-extrabold", due ? "text-rose-700" : "text-ink-900")}>{value}</p>
    </div>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={clsx("min-h-[36px] whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold", on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-700")}>
      {label}
    </button>
  );
}

function TodayCard({ summary }: { summary: DaySummary | undefined }) {
  const L = useL();
  const total = summary?.total ?? 0;
  return (
    <section className="today-card pb-4" aria-label={L({ hi: "आज काउंटर पर", en: "Today at the counter" })}>
      <p className="text-[13px] font-semibold text-ink-500">{L({ hi: "आज जमा हुए", en: "Collected today" })}</p>
      {summary ? (
        <>
          <p className="tnum mt-0.5 text-[28px] font-extrabold leading-tight">{rupees(total)}</p>
          <p className="text-[13px] text-ink-500">
            {summary.count} {L({ hi: "रसीदें", en: summary.count === 1 ? "receipt" : "receipts" })}
          </p>
          <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded bg-ink-100" role="img" aria-label={L({ hi: "किस तरह से जमा", en: "Split by payment mode" })}>
            {total > 0 && MODES.map((m) => (summary.byMode[m.key] > 0 ? <span key={m.key} style={{ width: `${(summary.byMode[m.key] / total) * 100}%`, background: m.color }} /> : null))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {MODES.map((m) => (
              <li key={m.key} className="flex items-center gap-2.5 text-[14px]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />
                <span className="flex-1 text-ink-700">{L(m.text)}</span>
                <span className="tnum font-semibold">{rupees(summary.byMode[m.key])}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-full" />
        </div>
      )}
    </section>
  );
}

function ReceiptList({ title, list, error, onOpen, showStudent = true }: { title: string; list: FeeTransaction[] | undefined; error: boolean; onOpen: (t: FeeTransaction) => void; showStudent?: boolean }) {
  const L = useL();
  return (
    <section className="space-y-1">
      <h2 className="text-[16px] font-bold text-brand-800">{title}</h2>
      {!list ? (
        error ? <Empty>{L({ hi: "रसीदें नहीं आईं।", en: "Could not load receipts." })}</Empty> : <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <Empty>{L({ hi: "अभी कोई रसीद नहीं।", en: "No receipts yet." })}</Empty>
      ) : (
        <ul>
          {list.map((t) => {
            const kind = modeKind(t.payment_mode);
            const Icon = MODE_ICON[kind];
            const day = String(t.payment_date).slice(0, 10);
            return (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t)} className="flex min-h-[58px] w-full items-center gap-3 border-b border-ink-100 text-left active:bg-ink-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block truncate text-[15px] font-medium", t.cancelled && "text-ink-400 line-through")}>{showStudent ? t.student?.name || "—" : kind}</span>
                    <span className="block truncate text-[12.5px] text-ink-400">
                      {day === todayKey() ? L({ hi: "आज", en: "Today" }) : dm(day)} · #{String(t.receipt_no).split("/").pop()}
                      {showStudent && t.student?.class_name ? ` · ${t.student.class_name}` : ""}
                    </span>
                  </span>
                  <span className={clsx("tnum text-[15px] font-bold", t.cancelled && "text-ink-400 line-through")}>{rupees(Number(t.amount_paid))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
