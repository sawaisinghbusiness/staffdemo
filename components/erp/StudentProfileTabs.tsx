"use client";

/**
 * Student profile 360: the tabs that read data the ERP already keeps (no database change).
 * Claude owns what these show and which API they call; Codex polishes the look
 * (see docs/student-profile-360). Each tab loads only when it is opened.
 */
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, monthYear, rupees } from "@/lib/format";
import type { ErpStudentFull } from "@/lib/erpStudents";
import { Avatar, Empty, ErrorCard, ListSkeleton, Status } from "@/components/ui";

const payMode = (m: string) => (/upi|qr/i.test(m) ? "UPI" : /cheque|dd/i.test(m) ? "Cheque" : /razorpay|online/i.test(m) ? "Online" : "Cash");
const enc = encodeURIComponent;

/** Loading, error and "office only" states shared by every tab. */
function Loading<T>({ q, children }: { q: { data?: T; error: { status: number } | null; reload: () => unknown }; children: (d: T) => React.ReactNode }) {
  const L = useL();
  if (q.data) return <>{children(q.data)}</>;
  if (q.error?.status === 403) return <Empty>{L({ hi: "यह हिस्सा सिर्फ़ ऑफ़िस (एडमिन, अकाउंटेंट) देख सकता है।", en: "Only the office (admin, accountant) can see this." })}</Empty>;
  if (q.error && q.error.status !== 401) return <ErrorCard offline={q.error.status === 0} onRetry={q.reload} />;
  return <ListSkeleton rows={3} />;
}

/* ───────────── Payments: every receipt ───────────── */

interface Receipt {
  id: string;
  receipt_no: string;
  amount_paid: number;
  payment_mode: string;
  payment_date: string;
  transaction_id?: string | null;
  fee_heads?: { late_fine?: number };
  collected_by?: string;
  remarks?: string | null;
  cancelled: boolean;
  cancel_reason?: string | null;
}

export function PaymentsTab({ id }: { id: string }) {
  const L = useL();
  const { lang } = useLang();
  const q = useApi<{ data: Receipt[] }>(`/erp/fees/transactions?limit=200&studentId=${enc(id)}`);
  return (
    <Loading q={q}>
      {(d) => {
        const live = d.data.filter((t) => !t.cancelled);
        const total = live.reduce((n, t) => n + Number(t.amount_paid), 0);
        return d.data.length === 0 ? (
          <Empty>{L({ hi: "इस बच्चे की अभी कोई फ़ीस जमा नहीं हुई।", en: "No fee collected from this student yet." })}</Empty>
        ) : (
          <section className="space-y-2">
            <p className="text-[13px] text-ink-500">{L({ hi: `${live.length} रसीदें · कुल ${rupees(total)}`, en: `${live.length} receipt${live.length === 1 ? "" : "s"} · ${rupees(total)} in all` })}</p>
            <ul className="row-card !py-1">
              {d.data.map((t) => {
                const fine = Number(t.fee_heads?.late_fine) || 0;
                return (
                  <li key={t.id} className="flex min-h-[64px] items-center gap-3 border-b border-ink-100 py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className={clsx("tnum block text-[15.5px] font-semibold", t.cancelled && "text-ink-400 line-through")}>{rupees(Number(t.amount_paid))}</span>
                      <span className="block truncate text-[12.5px] text-ink-500">
                        {fullDate(String(t.payment_date).slice(0, 10), lang)} · {payMode(t.payment_mode)} · {t.receipt_no}
                      </span>
                      {(fine > 0 || t.transaction_id || (t.cancelled && t.cancel_reason)) && (
                        <span className="block truncate text-[12px] text-ink-400">
                          {[fine > 0 ? L({ hi: `लेट फ़ाइन ${rupees(fine)}`, en: `Late fine ${rupees(fine)}` }) : "", t.transaction_id ? `Ref ${t.transaction_id}` : "", t.cancelled && t.cancel_reason ? t.cancel_reason : ""].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {t.cancelled ? <Status tone="mute">{L({ hi: "रद्द", en: "Cancelled" })}</Status> : <Status tone="ok">{L({ hi: "जमा", en: "Paid" })}</Status>}
                  </li>
                );
              })}
            </ul>
            <Link href="/erp/fees/receipts/" className="btn-line w-full">
              {L({ hi: "रसीद रजिस्टर (दोबारा प्रिंट)", en: "Receipt register (reprint)" })}
            </Link>
          </section>
        );
      }}
    </Loading>
  );
}

/* ───────────── Ledger: line by line with a running balance ───────────── */

interface LedgerEntry {
  date: string;
  kind: "charge" | "concession" | "fine" | "payment" | "earlier";
  text: string;
  debit: number;
  credit: number;
  balance: number;
  receiptNo?: string;
  mode?: string;
  cancelled?: boolean;
  cancelReason?: string | null;
}
interface Ledger {
  session: string;
  setupNeeded: boolean;
  entries: LedgerEntry[];
  totals: { charged: number; concession: number; paid: number; finePaid: number; balance: number } | null;
}

export function LedgerTab({ id }: { id: string }) {
  const L = useL();
  const { lang } = useLang();
  const q = useApi<Ledger>(`/erp/student-profile/${enc(id)}/ledger`);
  const text = (e: LedgerEntry) =>
    e.kind === "charge" ? L({ hi: `सत्र ${q.data?.session} की फ़ीस`, en: e.text }) : e.kind === "concession" ? L({ hi: e.text.replace(/^Concession/, "छूट"), en: e.text }) : e.kind === "fine" ? L({ hi: "लेट फ़ाइन", en: "Late fine" }) : e.kind === "earlier" ? L({ hi: "पहले जमा (इस ERP से पहले)", en: e.text }) : L({ hi: `रसीद ${e.receiptNo}`, en: e.text });
  return (
    <Loading q={q}>
      {(d) =>
        d.setupNeeded || !d.totals ? (
          <Empty>{L({ hi: "इस सत्र में इस बच्चे की फ़ीस अभी तय नहीं है।", en: "No fee is set for this student this session." })}</Empty>
        ) : (
          <section className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [L({ hi: "लगी फ़ीस", en: "Charged" }), d.totals.charged, ""],
                [L({ hi: "छूट", en: "Concession" }), d.totals.concession, ""],
                [L({ hi: "जमा", en: "Paid" }), d.totals.paid, "text-jade-700"],
                [L({ hi: "बाकी", en: "Balance" }), d.totals.balance, d.totals.balance > 0 ? "text-rose-600" : ""],
              ].map(([k, v, c]) => (
                <div key={k as string} className="row-card !p-3">
                  <dt className="text-[12px] text-ink-500">{k}</dt>
                  <dd className={clsx("tnum text-[16px] font-bold", c as string)}>{rupees(v as number)}</dd>
                </div>
              ))}
            </dl>
            <div className="row-card !p-0 overflow-x-auto">
              <table className="w-full min-w-[420px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-[12px] text-ink-500">
                    <th className="px-3 py-2 font-medium">{L({ hi: "तारीख़", en: "Date" })}</th>
                    <th className="px-3 py-2 font-medium">{L({ hi: "विवरण", en: "Details" })}</th>
                    <th className="px-3 py-2 text-right font-medium">{L({ hi: "नामे", en: "Debit" })}</th>
                    <th className="px-3 py-2 text-right font-medium">{L({ hi: "जमा", en: "Credit" })}</th>
                    <th className="px-3 py-2 text-right font-medium">{L({ hi: "बाकी", en: "Balance" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.entries.map((e, i) => (
                    <tr key={i} className={clsx("border-b border-ink-100 last:border-0", e.cancelled && "text-ink-400")}>
                      <td className="whitespace-nowrap px-3 py-2">{fullDate(e.date.slice(0, 10), lang)}</td>
                      <td className="px-3 py-2">
                        <span className={clsx(e.cancelled && "line-through")}>{text(e)}</span>
                        {e.mode && <span className="block text-[12px] text-ink-400">{payMode(e.mode)}</span>}
                        {e.cancelled && <span className="block text-[12px]">{L({ hi: "रद्द", en: "Cancelled" })}{e.cancelReason ? ` · ${e.cancelReason}` : ""}</span>}
                      </td>
                      <td className="tnum px-3 py-2 text-right">{e.debit ? rupees(e.debit) : ""}</td>
                      <td className="tnum px-3 py-2 text-right">{e.credit ? rupees(e.credit) : ""}</td>
                      <td className="tnum px-3 py-2 text-right font-semibold">{e.cancelled ? "" : rupees(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {d.totals.finePaid > 0 && <p className="text-[12.5px] text-ink-500">{L({ hi: `इस सत्र में ${rupees(d.totals.finePaid)} लेट फ़ाइन जमा हुआ।`, en: `${rupees(d.totals.finePaid)} late fine paid this session.` })}</p>}
          </section>
        )
      }
    </Loading>
  );
}

/* ───────────── Attendance: one month, with month switcher ───────────── */

interface Attendance {
  month: string;
  today: string;
  firstMonth: string;
  days: { date: string; mark: "P" | "A" | "L" | "H" | null; holiday: string | null; sunday: boolean }[];
  totals: { present: number; absent: number; leave: number; half: number; workingDays: number; percent: number | null };
  session: { percent: number | null; workingDays: number };
}
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const MARK_CLASS: Record<string, string> = { P: "bg-jade-500 text-white", A: "bg-rose-600 text-white", L: "bg-marigold-400 text-ink-900", H: "bg-sky-500 text-white" };

export function AttendanceTab({ id }: { id: string }) {
  const L = useL();
  const { lang } = useLang();
  const [month, setMonth] = useState("");
  const q = useApi<Attendance>(`/erp/student-profile/${enc(id)}/attendance${month ? `?month=${month}` : ""}`);
  const markWord = (m: string) => ({ P: L({ hi: "हाज़िर", en: "Present" }), A: L({ hi: "ग़ैरहाज़िर", en: "Absent" }), L: L({ hi: "छुट्टी", en: "Leave" }), H: L({ hi: "आधा दिन", en: "Half day" }) })[m] || "";
  return (
    <Loading q={q}>
      {(d) => {
        const lead = (new Date(`${d.days[0]?.date || d.month + "-01"}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday first
        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn-quiet !min-h-[44px] !px-3" disabled={d.month <= d.firstMonth} onClick={() => setMonth(shiftMonth(d.month, -1))} aria-label={L({ hi: "पिछला महीना", en: "Previous month" })}>
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <p className="text-[15px] font-semibold">{monthYear(`${d.month}-01`, lang)}</p>
              <button type="button" className="btn-quiet !min-h-[44px] !px-3" disabled={d.month >= d.today.slice(0, 7)} onClick={() => setMonth(shiftMonth(d.month, 1))} aria-label={L({ hi: "अगला महीना", en: "Next month" })}>
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center">
              {[
                [L({ hi: "हाज़िर", en: "Present" }), d.totals.present],
                [L({ hi: "ग़ैरहाज़िर", en: "Absent" }), d.totals.absent],
                [L({ hi: "छुट्टी", en: "Leave" }), d.totals.leave],
                [L({ hi: "महीना %", en: "Month %" }), d.totals.percent === null ? "—" : `${d.totals.percent}%`],
              ].map(([k, v]) => (
                <div key={k as string} className="row-card !p-2.5">
                  <dd className="tnum text-[16px] font-bold">{v}</dd>
                  <dt className="text-[11.5px] text-ink-500">{k}</dt>
                </div>
              ))}
            </dl>
            <div className="row-card !p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-500">
                {(lang === "hi" ? ["सो", "मं", "बु", "गु", "शु", "श", "र"] : ["M", "T", "W", "T", "F", "S", "S"]).map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`x${i}`} />
                ))}
                {d.days.map((day) => (
                  <span
                    key={day.date}
                    title={day.holiday || (day.mark ? markWord(day.mark) : "")}
                    className={clsx("tnum grid aspect-square place-items-center rounded-md text-[12.5px] font-semibold", day.mark ? MARK_CLASS[day.mark] : day.holiday || day.sunday ? "bg-ink-100 text-ink-400" : day.date > d.today ? "text-ink-300" : "text-ink-700")}
                    aria-label={`${day.date.slice(8)} ${day.holiday || (day.mark ? markWord(day.mark) : day.sunday ? "Sunday" : "")}`}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-ink-500">
              {d.session.percent === null
                ? L({ hi: "इस सत्र में अभी कोई हाज़िरी नहीं लगी।", en: "No attendance marked this session yet." })
                : L({ hi: `पूरे सत्र में ${d.session.percent}% हाज़िरी (${d.session.workingDays} दिन)`, en: `${d.session.percent}% attendance this session (${d.session.workingDays} days)` })}
            </p>
          </section>
        );
      }}
    </Loading>
  );
}

/* ───────────── Results: every exam of the session ───────────── */

interface Card {
  exam: { id: string; title: string; max: number };
  subjects: { subject: string; total: number | null; absent: boolean; grade: string; passed: boolean; entered: boolean }[];
  grand: number;
  outOf: number;
  percent: number | null;
  grade: string;
  result: string;
  complete: boolean;
  rank: number | null;
  classSize: number;
}
interface Results {
  setupNeeded: boolean;
  exams: { id: string; title: string; startDate: string | null; locked: boolean; card: Card | null }[];
}

export function ResultsTab({ id }: { id: string }) {
  const L = useL();
  const q = useApi<Results>(`/erp/student-profile/${enc(id)}/results`);
  return (
    <Loading q={q}>
      {(d) =>
        d.setupNeeded || d.exams.length === 0 ? (
          <Empty>{L({ hi: "इस सत्र में इस कक्षा की कोई परीक्षा नहीं बनी।", en: "No exams for this class this session yet." })}</Empty>
        ) : (
          <section className="space-y-3">
            {d.exams.map((e) => (
              <article key={e.id} className="row-card space-y-2 !p-3.5">
                <header className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">{e.title}</h3>
                  {e.locked ? <Status tone="ok">{L({ hi: "फ़ाइनल", en: "Final" })}</Status> : <Status tone="wait">{L({ hi: "नंबर चढ़ रहे हैं", en: "Marks in progress" })}</Status>}
                </header>
                {!e.card ? (
                  <p className="text-[13px] text-ink-500">{L({ hi: "अभी नंबर नहीं चढ़े।", en: "No marks entered yet." })}</p>
                ) : (
                  <>
                    <ul className="text-[13.5px]">
                      {e.card.subjects.map((s) => (
                        <li key={s.subject} className="flex items-center justify-between border-b border-ink-100 py-1.5 last:border-0">
                          <span>{s.subject}</span>
                          <span className={clsx("tnum font-semibold", !s.passed && s.entered && "text-rose-600")}>
                            {!s.entered ? "—" : s.absent ? L({ hi: "ग़ैरहाज़िर", en: "Absent" }) : `${s.total ?? "—"} / ${e.card!.exam.max}`}
                            {s.entered && s.grade && <span className="ml-2 text-[12px] font-medium text-ink-500">{s.grade}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="tnum text-[13.5px] font-semibold">
                      {L({ hi: "कुल", en: "Total" })} {e.card.grand} / {e.card.outOf}
                      {e.card.percent !== null && ` · ${e.card.percent}%`}
                      {e.card.grade && ` · ${e.card.grade}`}
                      {e.card.rank && e.card.complete ? ` · ${L({ hi: "रैंक", en: "Rank" })} ${e.card.rank}/${e.card.classSize}` : ""}
                    </p>
                    {e.card.result && <p className="text-[12.5px] text-ink-500">{e.card.result}</p>}
                  </>
                )}
              </article>
            ))}
            <Link href="/erp/exams/report-cards/" className="btn-line w-full">
              {L({ hi: "रिपोर्ट कार्ड प्रिंट करें", en: "Print report cards" })}
            </Link>
          </section>
        )
      }
    </Loading>
  );
}

/* ───────────── Siblings ───────────── */

interface Sibling {
  id: string;
  name: string;
  classSec: string;
  srNo: string;
  fatherName: string;
  photoUrl: string | null;
  status: string;
  balance: number | null;
}

export function SiblingsTab({ id }: { id: string }) {
  const L = useL();
  const q = useApi<{ siblings: Sibling[] }>(`/erp/student-profile/${enc(id)}/siblings`);
  return (
    <Loading q={q}>
      {(d) => {
        const due = d.siblings.reduce((n, s) => n + (s.balance || 0), 0);
        return d.siblings.length === 0 ? (
          <Empty>{L({ hi: "इस बच्चे के कोई भाई-बहन जुड़े नहीं हैं। जोड़ने के लिए जानकारी बदलें।", en: "No brothers or sisters linked. Use Edit details to link them." })}</Empty>
        ) : (
          <section className="space-y-2">
            <ul className="row-card !py-1">
              {d.siblings.map((s) => (
                <li key={s.id}>
                  <Link href={`/erp/students/detail/?id=${enc(s.id)}`} onClick={() => setTimeout(() => window.location.reload(), 0)} className="flex min-h-[64px] items-center gap-3 border-b border-ink-100 py-2 last:border-0">
                    <Avatar name={s.name} url={s.photoUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-500">
                        {s.classSec} · {s.srNo}
                        {s.status !== "Active" ? ` · ${s.status}` : ""}
                      </span>
                    </span>
                    {s.balance !== null && <span className={clsx("tnum text-[14px] font-semibold", s.balance > 0 ? "text-rose-600" : "text-jade-700")}>{s.balance > 0 ? rupees(s.balance) : L({ hi: "पूरी जमा", en: "Paid up" })}</span>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            {due > 0 && <p className="text-[13px] text-ink-500">{L({ hi: `भाई-बहनों का कुल बाकी ${rupees(due)}`, en: `Brothers and sisters owe ${rupees(due)} in all` })}</p>}
          </section>
        );
      }}
    </Loading>
  );
}

/* ───────────── Timetable: the student's section week ───────────── */

interface Timetable {
  classSec: string;
  setupNeeded: boolean;
  todayDay: number;
  periods: { id: string; label: string; start: string; end: string; isBreak: boolean }[];
  days: Record<string, Record<string, { subject: string; teacher: string | null }>>;
}

export function TimetableTab({ id }: { id: string }) {
  const L = useL();
  const q = useApi<Timetable>(`/erp/student-profile/${enc(id)}/timetable`);
  const [day, setDay] = useState<number | null>(null);
  const DAYS = [L({ hi: "सोम", en: "Mon" }), L({ hi: "मंगल", en: "Tue" }), L({ hi: "बुध", en: "Wed" }), L({ hi: "गुरु", en: "Thu" }), L({ hi: "शुक्र", en: "Fri" }), L({ hi: "शनि", en: "Sat" })];
  return (
    <Loading q={q}>
      {(d) => {
        if (d.setupNeeded || d.periods.length === 0) return <Empty>{L({ hi: "टाइम टेबल अभी नहीं बना।", en: "The timetable has not been made yet." })}</Empty>;
        const pick = day ?? (d.todayDay >= 1 && d.todayDay <= 6 ? d.todayDay : 1);
        const lessons = d.days[String(pick)] || {};
        return (
          <section className="space-y-2">
            <div className="grid grid-cols-6 gap-1" role="tablist" aria-label={L({ hi: "दिन", en: "Day" })}>
              {DAYS.map((w, i) => (
                <button key={w} type="button" role="tab" aria-selected={pick === i + 1} onClick={() => setDay(i + 1)} className={clsx("min-h-[40px] rounded-lg text-[13px] font-semibold", pick === i + 1 ? "bg-[#0D2A5E] text-white" : "bg-ink-100 text-ink-700")}>
                  {w}
                </button>
              ))}
            </div>
            <ul className="row-card !py-1">
              {d.periods.map((p) => {
                const l = lessons[p.id];
                return (
                  <li key={p.id} className={clsx("flex min-h-[52px] items-center gap-3 border-b border-ink-100 py-1.5 last:border-0", p.isBreak && "text-ink-400")}>
                    <span className="tnum w-[92px] shrink-0 text-[12.5px] text-ink-500">
                      {p.start}–{p.end}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{p.isBreak ? p.label || L({ hi: "ब्रेक", en: "Break" }) : l?.subject || "—"}</span>
                      {!p.isBreak && l?.teacher && <span className="block truncate text-[12.5px] text-ink-500">{l.teacher}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      }}
    </Loading>
  );
}

/* ───────────── SR register: the student's Scholar Register entry ───────────── */

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function SrRegisterTab({ s }: { s: ErpStudentFull }) {
  const L = useL();
  const { lang } = useLang();
  const date = (v?: string) => (v ? fullDate(v.slice(0, 10), lang) : "");
  const left = s.status && s.status !== "Active";
  const rows: [string, string][] = [
    [L({ hi: "एस.आर. नं.", en: "SR no." }), s.srNo],
    [L({ hi: "प्रवेश नं.", en: "Admission no." }), s.admissionNo],
    [L({ hi: "प्रवेश तिथि", en: "Date of admission" }), date(s.admissionDate)],
    [L({ hi: "विद्यार्थी का नाम", en: "Student's name" }), [s.name, s.nameHi].filter(Boolean).join(" / ")],
    [L({ hi: "पिता का नाम", en: "Father's name" }), s.fatherName],
    [L({ hi: "माता का नाम", en: "Mother's name" }), s.motherName || ""],
    [L({ hi: "जन्म तिथि", en: "Date of birth" }), date(s.dob)],
    [L({ hi: "श्रेणी / जाति", en: "Category / caste" }), [s.category, s.caste].filter(Boolean).join(" · ")],
    [L({ hi: "धर्म", en: "Religion" }), s.religion || ""],
    [L({ hi: "पता", en: "Address" }), [s.address, s.city, s.district, s.pincode].filter(Boolean).join(", ")],
    [L({ hi: "पिछला स्कूल", en: "Previous school" }), [s.prevSchool, s.prevClass].filter(Boolean).join(" · ")],
    [L({ hi: "वर्तमान कक्षा", en: "Present class" }), s.classSec],
    ["PEN", s.penNo || ""],
    [L({ hi: "आधार", en: "Aadhaar" }), s.aadhaarNo || ""],
    [L({ hi: "शाला दर्पण ID", en: "Shala Darpan ID" }), s.shalaDarpanId || ""],
    [L({ hi: "स्थिति", en: "Status" }), left ? L({ hi: "छोड़ गया", en: "Left" }) : L({ hi: "पढ़ रहा है", en: "Studying" })],
    [L({ hi: "टी.सी. नं. / तिथि", en: "TC no. / date" }), [s.tcNo, date(s.tcDate)].filter(Boolean).join(" · ")],
    [L({ hi: "छोड़ने का कारण", en: "Reason for leaving" }), s.leavingReason || ""],
  ];

  function print() {
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return;
    const body = rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v) || "&nbsp;"}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>SR ${esc(s.srNo)}</title>
<style>@page{size:A4;margin:16mm}body{font:14px/1.5 system-ui,"Noto Sans Devanagari",sans-serif;color:#000}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#333}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:7px 9px;text-align:left;vertical-align:top}th{width:38%;font-weight:600;background:#f2f2f2}
.sign{display:flex;justify-content:space-between;margin-top:48px}</style></head><body>
<h1>${esc(L({ hi: "स्कॉलर रजिस्टर (एस.आर.) प्रविष्टि", en: "Scholar Register (SR) entry" }))}</h1><p>${esc(s.name)} · ${esc(s.classSec)}</p>
<table>${body}</table><div class="sign"><span>${esc(L({ hi: "कक्षा अध्यापक", en: "Class teacher" }))}</span><span>${esc(L({ hi: "प्रधानाचार्य", en: "Principal" }))}</span></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <section className="space-y-3">
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || <span className="font-normal text-ink-400">{L({ hi: "नहीं जोड़ा", en: "Not added" })}</span>}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={print} className="btn-line w-full">
        <Printer className="h-4 w-4" aria-hidden /> {L({ hi: "एस.आर. प्रविष्टि प्रिंट करें", en: "Print SR entry" })}
      </button>
    </section>
  );
}
