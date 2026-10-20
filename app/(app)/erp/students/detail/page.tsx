"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Camera, Check, ExternalLink, IndianRupee, Pencil, Phone, Ticket, Trash2 } from "lucide-react";
import { GatePassSheet, type GatePass } from "@/components/erp/GatePassSheet";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, phoneText, rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { DOCS, shrinkScan } from "@/lib/erpDocs";
import type { ErpStudentFull } from "@/lib/erpStudents";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton, Status } from "@/components/ui";

type Tab = "details" | "fees" | "passes" | "docs";

interface Receipt {
  id: string;
  receipt_no: string;
  amount_paid: number;
  payment_mode: string;
  payment_date: string;
  cancelled: boolean;
}

/**
 * Documents: what the parent gave (ticked in the admission form) and the scans. Scans are in a private
 * store; the backend hands out 30-minute links to the office (admin, accountant) only.
 */
function DocsTab({ id, received, onChange }: { id: string; received: Record<string, boolean>; onChange: () => void }) {
  const L = useL();
  const files = useApi<{ files: Record<string, string> }>(`/erp/student-documents/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const forKey = useRef("");
  const links = files.data?.files || {};
  const officeOnly = files.error?.status === 403;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const key = forKey.current;
    e.target.value = "";
    if (!file || !key) return;
    setBusy(key);
    try {
      const image = await shrinkScan(file);
      await api(`/erp/student-documents/${encodeURIComponent(id)}`, { body: { key, image } });
      toast(true, L({ hi: "फ़ोटो सेव हो गई।", en: "Scan saved." }));
      files.reload();
      onChange();
    } catch (er) {
      toast(false, (er instanceof ApiError && er.message) || (er as Error)?.message || L({ hi: "फ़ोटो सेव नहीं हुई।", en: "Could not save the scan." }));
    } finally {
      setBusy("");
    }
  }
  async function remove(key: string) {
    setBusy(key);
    try {
      await api(`/erp/student-documents/${encodeURIComponent(id)}/${key}`, { method: "DELETE" });
      toast(true, L({ hi: "फ़ोटो हटा दी।", en: "Scan removed." }));
      files.reload();
    } catch (er) {
      toast(false, (er instanceof ApiError && er.message) || L({ hi: "हटाई नहीं गई।", en: "Could not remove it." }));
    } finally {
      setBusy("");
    }
  }

  const got = DOCS.filter((d) => received[d.key]).length;
  return (
    <section className="space-y-2">
      <p className="text-[13px] text-ink-500">{L({ hi: `${DOCS.length} में से ${got} कागज़ मिले।`, en: `${got} of ${DOCS.length} documents received.` })}</p>
      {officeOnly && <p className="text-[13px] text-ink-500">{L({ hi: "कागज़ की फ़ोटो सिर्फ़ ऑफ़िस (एडमिन, अकाउंटेंट) देख सकता है।", en: "Only the office (admin, accountant) can see the scans." })}</p>}
      {files.error && !officeOnly && files.error.status !== 401 &&
        (files.error.status === 400 && files.error.message ? (
          <p className="rounded-xl border-[1.5px] border-marigold-300 bg-marigold-50 px-3 py-2.5 text-[13px] text-ink-700">{files.error.message}</p>
        ) : (
          <ErrorCard offline={files.error.status === 0} onRetry={files.reload} />
        ))}
      <ul className="row-card !py-1">
        {DOCS.map((d) => {
          const on = !!received[d.key];
          const link = links[d.key];
          return (
            <li key={d.key} className="flex min-h-[56px] items-center gap-2.5 border-b border-ink-100 py-1.5 last:border-0">
              <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-md border-[1.5px]", on ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-300 bg-white")} aria-label={on ? L({ hi: "मिला", en: "Received" }) : L({ hi: "नहीं मिला", en: "Not received" })}>
                {on && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-medium">{L(d.text)}</span>
                <span className="block text-[12px] text-ink-500">{link ? L({ hi: "फ़ोटो लगी है", en: "Scan added" }) : on ? L({ hi: "मिला, फ़ोटो नहीं", en: "Received, no scan" }) : L({ hi: "नहीं मिला", en: "Not received" })}</span>
              </span>
              {!officeOnly && d.key !== "photos" && (
                <span className="flex shrink-0 items-center gap-1">
                  {link && (
                    <>
                      <a href={link} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-lg text-[#3099a4]" aria-label={L({ hi: `${L(d.text)} देखें`, en: `View ${L(d.text)}` })}>
                        <ExternalLink className="h-[18px] w-[18px]" aria-hidden />
                      </a>
                      <button type="button" disabled={!!busy} onClick={() => remove(d.key)} className="grid h-10 w-10 place-items-center rounded-lg text-ink-500 disabled:opacity-40" aria-label={L({ hi: `${L(d.text)} की फ़ोटो हटाएँ`, en: `Remove ${L(d.text)} scan` })}>
                        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      forKey.current = d.key;
                      input.current?.click();
                    }}
                    className="flex min-h-[38px] items-center gap-1 rounded-lg border-[1.5px] border-ink-200 px-2.5 text-[12.5px] font-semibold text-ink-900 disabled:opacity-40"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                    {busy === d.key ? "…" : link ? L({ hi: "बदलें", en: "Replace" }) : L({ hi: "फ़ोटो", en: "Add photo" })}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
    </section>
  );
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
  const { data, error, reload } = useApi<{ data: ErpStudentFull }>(id ? `/erp/students/${enc}` : null);
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

  /** A row only when there is something to show (the long admission form leaves many fields empty). */
  const opt = (k: string, v: React.ReactNode): [string, React.ReactNode][] => (v ? [[k, v]] : []);
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
          { key: "passes", text: L({ hi: "गेट पास", en: "Passes" }) },
          { key: "docs", text: L({ hi: "कागज़", en: "Documents" }) },
        ]}
      />

      {tab === "details" && (
        <>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "बच्चा", en: "Student" })}</h2>
            {kv([
              ...opt(L({ hi: "हिंदी में नाम", en: "Name in Hindi" }), s.nameHi),
              [L({ hi: "जन्म तिथि", en: "Date of birth" }), s.dob ? fullDate(s.dob, lang) : ""],
              ...opt(L({ hi: "जन्म स्थान", en: "Place of birth" }), s.birthPlace),
              [L({ hi: "लिंग", en: "Gender" }), s.gender],
              [L({ hi: "श्रेणी", en: "Category" }), [s.category, s.caste].filter(Boolean).join(" · ")],
              ...opt(L({ hi: "धर्म", en: "Religion" }), s.religion),
              ...opt(L({ hi: "मातृभाषा", en: "Mother tongue" }), s.motherTongue),
              ...opt(L({ hi: "आधार", en: "Aadhaar" }), s.aadhaarNo),
              ...opt(L({ hi: "ब्लड ग्रुप", en: "Blood group" }), s.bloodGroup),
              ...opt(L({ hi: "सेहत", en: "Health" }), [s.healthNotes, s.cwsn ? "CWSN" : ""].filter(Boolean).join(" · ")),
              ...opt(L({ hi: "पहचान चिह्न", en: "Identification mark" }), s.idMark),
              [L({ hi: "स्थिति", en: "Status" }), s.status === "Inactive" ? L({ hi: "छोड़ गया", en: "Left" }) : L({ hi: "पढ़ रहा है", en: "Active" })],
            ])}
          </section>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "प्रवेश और रजिस्टर", en: "Admission & register" })}</h2>
            {kv([
              [L({ hi: "प्रवेश नं.", en: "Admission no." }), s.admissionNo],
              ...opt(L({ hi: "प्रवेश तिथि", en: "Admission date" }), s.admissionDate ? fullDate(s.admissionDate, lang) : ""),
              ...opt(L({ hi: "प्रकार", en: "Type" }), [s.admissionType, s.rte ? "RTE" : ""].filter(Boolean).join(" · ")),
              ...opt(L({ hi: "माध्यम", en: "Medium" }), s.medium),
              [L({ hi: "हाउस", en: "House" }), s.house],
              ["PEN", s.penNo],
              ...opt(L({ hi: "शाला दर्पण ID", en: "Shala Darpan ID" }), s.shalaDarpanId),
            ])}
          </section>
          {s.prevSchool && (
            <section className="space-y-1">
              <h2 className="mlabel">{L({ hi: "पिछला स्कूल", en: "Last school" })}</h2>
              {kv([
                [L({ hi: "स्कूल", en: "School" }), [s.prevSchool, s.prevBoard].filter(Boolean).join(" · ")],
                ...opt(L({ hi: "पास कक्षा", en: "Class passed" }), [s.prevClass, s.prevYear, s.prevResult].filter(Boolean).join(" · ")),
                ...opt("TC", [s.tcNo, s.tcDate ? fullDate(s.tcDate, lang) : ""].filter(Boolean).join(" · ")),
                ...opt(L({ hi: "छोड़ने का कारण", en: "Reason for leaving" }), s.leavingReason),
              ])}
            </section>
          )}
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "परिवार", en: "Family" })}</h2>
            {kv([
              [L({ hi: "पिता", en: "Father" }), [s.fatherName, s.fatherOccupation, s.fatherEducation].filter(Boolean).join(" · ")],
              [L({ hi: "मोबाइल", en: "Mobile" }), s.mobile ? phoneText(s.mobile) : ""],
              ...opt(L({ hi: "पिता का आधार", en: "Father's Aadhaar" }), s.fatherAadhaar),
              ...opt(L({ hi: "ईमेल", en: "Email" }), s.fatherEmail),
              [L({ hi: "माता", en: "Mother" }), [s.motherName, s.motherOccupation, s.motherEducation].filter(Boolean).join(" · ")],
              ...opt(L({ hi: "माता का मोबाइल", en: "Mother's mobile" }), s.motherMobile ? phoneText(s.motherMobile) : s.contact && s.contact !== s.mobile ? phoneText(s.contact) : ""),
              ...opt(L({ hi: "माता का आधार", en: "Mother's Aadhaar" }), s.motherAadhaar),
              ...opt("WhatsApp", s.whatsappTo === "Mother" ? L({ hi: "माता", en: "Mother" }) : s.whatsappTo === "Both" ? L({ hi: "दोनों", en: "Both" }) : s.whatsappTo ? L({ hi: "पिता", en: "Father" }) : ""),
              ...(s.guardianName && s.guardianName !== s.fatherName
                ? ([[L({ hi: "अभिभावक", en: "Guardian" }), [s.guardianName, s.guardianRelation, s.guardianMobile && phoneText(s.guardianMobile)].filter(Boolean).join(" · ")]] as [string, string][])
                : []),
              ...opt(L({ hi: "सालाना आय", en: "Yearly income" }), [s.familyIncome, s.bpl ? "BPL" : ""].filter(Boolean).join(" · ")),
              ...opt(L({ hi: "जन आधार", en: "Jan Aadhaar" }), s.janAadhaar),
              ...opt(
                L({ hi: "भाई-बहन", en: "Siblings" }),
                (s.siblings || []).length ? (
                  <span className="flex flex-col items-end gap-0.5">
                    {(s.siblings || []).map((b) => (
                      <Link key={b.id} href={`/erp/students/detail/?id=${encodeURIComponent(b.id)}`} onClick={() => setTimeout(() => window.location.reload(), 0)} className="text-[#3099a4] underline-offset-2 hover:underline">
                        {b.name} ({b.classSec.replace(" - ", " ")})
                      </Link>
                    ))}
                  </span>
                ) : (
                  ""
                )
              ),
            ])}
          </section>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "पता", en: "Address" })}</h2>
            {kv([
              [
                L({ hi: "घर", en: "Home" }),
                // Old addresses already end in "Barmer": don't say the city twice.
                [s.address, s.city && !(s.address || "").toLowerCase().includes(s.city.toLowerCase()) ? s.city : "", s.tehsil && s.tehsil !== s.city ? `${L({ hi: "तहसील", en: "Tehsil" })} ${s.tehsil}` : "", s.district && s.district !== s.city ? s.district : "", s.pincode]
                  .filter(Boolean)
                  .join(", "),
              ],
              ...opt(L({ hi: "चिट्ठी का पता", en: "Address for letters" }), s.lettersAddress),
              ...opt(L({ hi: "इमरजेंसी", en: "Emergency" }), [s.emergencyName, s.emergencyRelation, s.emergencyMobile && phoneText(s.emergencyMobile)].filter(Boolean).join(" · ")),
            ])}
          </section>
          <section className="space-y-1">
            <h2 className="mlabel">{L({ hi: "स्कूल बस", en: "School bus" })}</h2>
            {kv([
              [L({ hi: "रूट", en: "Route" }), s.transportOpted ? s.busRoute || L({ hi: "स्कूल बस", en: "School bus" }) : L({ hi: "बस नहीं लेता", en: "Not using the bus" })],
              ...(s.transportOpted ? opt(L({ hi: "स्टॉप", en: "Stop" }), s.busStop) : []),
            ])}
          </section>
          {s.bankAccount && (
            <section className="space-y-1">
              <h2 className="mlabel">{L({ hi: "छात्रवृत्ति बैंक खाता", en: "Scholarship bank account" })}</h2>
              {kv([
                [L({ hi: "खाताधारक", en: "Holder" }), s.bankHolder],
                [L({ hi: "खाता नं.", en: "Account no." }), s.bankAccount],
                ["IFSC", s.bankIfsc],
              ])}
            </section>
          )}
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

      {tab === "docs" && <DocsTab id={s.id} received={s.documents || {}} onChange={reload} />}

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
