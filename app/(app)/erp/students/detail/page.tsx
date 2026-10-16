"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IndianRupee, Pencil, Phone, Ticket } from "lucide-react";
import { GatePassSheet, type GatePass } from "@/components/erp/GatePassSheet";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, phoneText, rupees } from "@/lib/format";
import type { ErpStudent } from "@/lib/erpStudents";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton, Status } from "@/components/ui";

type Tab = "details" | "fees" | "passes";

interface Receipt {
  id: string;
  receipt_no: string;
  amount_paid: number;
  payment_mode: string;
  payment_date: string;
  cancelled: boolean;
}

const payMode = (m: string) => (/upi|qr/i.test(m) ? "UPI" : /cheque|dd/i.test(m) ? "Cheque" : "Cash");

/** ERP login → one student: the ERP's student profile (details, fees with receipts, gate passes). */
export default function ErpStudentDetailPage() {
  const L = useL();
  const { lang } = useLang();
  const [id, setId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [gateOpen, setGateOpen] = useState(false);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const enc = id ? encodeURIComponent(id) : "";
  const { data, error, reload } = useApi<{ data: ErpStudent }>(id ? `/erp/students/${enc}` : null);
  const receipts = useApi<{ data: Receipt[] }>(id && tab === "fees" ? `/erp/fees/transactions?limit=50&studentId=${enc}` : null);
  const passes = useApi<{ data: GatePass[] }>(id && tab === "passes" ? `/erp/gate-passes?studentId=${enc}&limit=20` : null);

  if (!data) {
    if (error?.status === 404) return <Empty>{L({ hi: "यह बच्चा नहीं मिला।", en: "This student was not found." })}</Empty>;
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }
  const s = data.data;
  const total = s.totalFee || s.paidFee + s.balanceFee;
  const pct = total > 0 ? Math.min(100, Math.round((s.paidFee / total) * 100)) : 100;
  const notAdded = L({ hi: "नहीं जोड़ा", en: "Not added" });

  const kv = (rows: [string, React.ReactNode][]) => (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || <span className="font-normal text-ink-400">{notAdded}</span>}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="animate-rise space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={s.name} url={s.photoUrl || null} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-bold">{s.name}</p>
          <p className="truncate text-[13px] text-ink-500">
            {s.classSec} · {L({ hi: "रोल", en: "Roll" })} {s.rollNo || "—"} · {s.srNo}
          </p>
        </div>
      </div>

      <LineTabs
        label={L({ hi: "प्रोफ़ाइल", en: "Profile" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "details", text: L({ hi: "जानकारी", en: "Details" }) },
          { key: "fees", text: L({ hi: "फ़ीस", en: "Fees" }) },
          { key: "passes", text: L({ hi: "गेट पास", en: "Gate passes" }) },
        ]}
      />

      {tab === "details" && (
        <>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "बच्चा", en: "Student" })}</h2>
            {kv([
              [L({ hi: "जन्म तिथि", en: "Date of birth" }), s.dob ? fullDate(s.dob, lang) : ""],
              [L({ hi: "लिंग", en: "Gender" }), s.gender],
              [L({ hi: "श्रेणी", en: "Category" }), s.category],
              [L({ hi: "हाउस", en: "House" }), s.house],
              [L({ hi: "प्रवेश नं.", en: "Admission no." }), s.admissionNo],
              ["PEN", s.penNo],
              [L({ hi: "स्थिति", en: "Status" }), s.status === "Inactive" ? L({ hi: "छोड़ गया", en: "Left" }) : L({ hi: "पढ़ रहा है", en: "Active" })],
            ])}
          </section>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "परिवार", en: "Family" })}</h2>
            {kv([
              [L({ hi: "पिता", en: "Father" }), s.fatherName],
              [L({ hi: "माता", en: "Mother" }), s.motherName],
              ...(s.guardianName && s.guardianName !== s.fatherName ? ([[L({ hi: "अभिभावक", en: "Guardian" }), s.guardianName]] as [string, string][]) : []),
              [L({ hi: "मोबाइल", en: "Mobile" }), s.mobile ? phoneText(s.mobile) : ""],
              ...(s.contact && s.contact !== s.mobile ? ([[L({ hi: "दूसरा फ़ोन", en: "Other phone" }), phoneText(s.contact)]] as [string, string][]) : []),
              [L({ hi: "पता", en: "Address" }), s.address],
            ])}
          </section>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "स्कूल बस", en: "School bus" })}</h2>
            {kv([[L({ hi: "रूट", en: "Route" }), s.transportOpted ? s.busRoute || L({ hi: "स्कूल बस", en: "School bus" }) : L({ hi: "बस नहीं लेता", en: "Not using the bus" })]])}
          </section>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href={`/erp/students/admission/?id=${enc}`} className="btn-line col-span-2">
              <Pencil className="h-4 w-4" aria-hidden /> {L({ hi: "जानकारी बदलें", en: "Edit details" })}
            </Link>
            <button type="button" onClick={() => setGateOpen(true)} className="btn-line">
              <Ticket className="h-4 w-4" aria-hidden /> {L({ hi: "गेट पास", en: "Gate pass" })}
            </button>
            {s.mobile && (
              <a href={`tel:${s.mobile}`} className="btn-line">
                <Phone className="h-4 w-4" aria-hidden /> {L({ hi: "कॉल करें", en: "Call parent" })}
              </a>
            )}
          </div>
        </>
      )}

      {tab === "fees" && (
        <>
          <section className="today-card pb-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[12px] text-ink-500">{L({ hi: "कुल फ़ीस", en: "Total fee" })}</p>
                <p className="tnum text-[17px] font-bold">{rupees(total)}</p>
              </div>
              <div>
                <p className="text-[12px] text-ink-500">{L({ hi: "जमा", en: "Paid" })}</p>
                <p className="tnum text-[17px] font-bold text-jade-700">{rupees(s.paidFee)}</p>
              </div>
              <div>
                <p className="text-[12px] text-ink-500">{L({ hi: "बाकी", en: "Due" })}</p>
                <p className={s.balanceFee > 0 ? "tnum text-[17px] font-bold text-rose-600" : "tnum text-[17px] font-bold"}>{s.balanceFee > 0 ? rupees(s.balanceFee) : L({ hi: "कुछ नहीं", en: "Nil" })}</p>
              </div>
            </div>
            <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-jade-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[12.5px] text-ink-500">{L({ hi: `इस सत्र की ${pct}% फ़ीस जमा`, en: `${pct}% of this session's fee paid` })}</p>
          </section>
          <Link href={`/erp/fees/collect/?student=${enc}`} className="btn-primary w-full">
            <IndianRupee className="h-4 w-4" aria-hidden /> {s.balanceFee > 0 ? L({ hi: `${rupees(s.balanceFee)} फ़ीस लें`, en: `Collect ${rupees(s.balanceFee)}` }) : L({ hi: "फ़ीस काउंटर", en: "Fee counter" })}
          </Link>

          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "रसीदें", en: "Receipts" })}</h2>
            {!receipts.data ? (
              receipts.error && receipts.error.status !== 401 ? <ErrorCard offline={receipts.error.status === 0} onRetry={receipts.reload} /> : <ListSkeleton rows={3} />
            ) : receipts.data.data.length === 0 ? (
              <Empty>{L({ hi: "इस बच्चे की अभी कोई फ़ीस जमा नहीं हुई।", en: "No fee collected from this student yet." })}</Empty>
            ) : (
              <ul>
                {receipts.data.data.map((t) => (
                  <li key={t.id} className="flex min-h-[60px] items-center gap-3 border-b border-ink-100 py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className={t.cancelled ? "tnum block text-[15.5px] font-semibold text-ink-400 line-through" : "tnum block text-[15.5px] font-semibold"}>{rupees(Number(t.amount_paid))}</span>
                      <span className="block truncate text-[12.5px] text-ink-400">
                        {fullDate(String(t.payment_date).slice(0, 10), lang)} · {payMode(t.payment_mode)} · {t.receipt_no}
                      </span>
                    </span>
                    {t.cancelled && <Status tone="mute">{L({ hi: "रद्द", en: "Cancelled" })}</Status>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "passes" && (
        <section className="space-y-2">
          <button type="button" onClick={() => setGateOpen(true)} className="btn-primary w-full">
            <Ticket className="h-4 w-4" aria-hidden /> {L({ hi: "नया गेट पास", en: "New gate pass" })}
          </button>
          {!passes.data ? (
            passes.error && passes.error.status !== 401 ? <ErrorCard offline={passes.error.status === 0} onRetry={passes.reload} /> : <ListSkeleton rows={2} />
          ) : passes.data.data.length === 0 ? (
            <Empty>{L({ hi: "इस बच्चे का कोई गेट पास नहीं बना।", en: "No gate pass issued to this student." })}</Empty>
          ) : (
            <ul>
              {passes.data.data.map((p) => (
                <li key={p.id} className="border-b border-ink-100 py-2.5 last:border-0">
                  <span className="block text-[15.5px] font-semibold">{p.reason}</span>
                  <span className="block truncate text-[12.5px] text-ink-400">
                    {new Date(p.issued_at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })} · {L({ hi: "साथ", en: "with" })} {p.escort} · {p.pass_no}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {gateOpen && (
        <GatePassSheet
          student={s}
          onClose={() => setGateOpen(false)}
          onIssued={() => {
            if (tab === "passes") passes.reload();
            else setTab("passes");
          }}
        />
      )}
    </div>
  );
}
