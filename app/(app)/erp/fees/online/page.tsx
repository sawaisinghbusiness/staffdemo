"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, Settings2, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { FeeTransaction } from "@/lib/erpFees";
import { useSchoolInfo } from "@/lib/erpCerts";
import { FeeReceiptModal } from "@/components/erp/FeeReceiptModal";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Fees → Online payments: the ERP's page. Parents pay the school's UPI ID from the parent app and
 * send the UTR. Nothing is money until someone finds that UTR in the bank statement and presses Verify
 * (POST /api/fee-claims/:id/verify), which makes a normal receipt dated the day the parent paid; the backend
 * works the fine out again. Reject tells the parent why. The admin sets the UPI ID here too.
 */

interface Split {
  fee: number;
  fine: number;
  waived: number;
  excess: number;
}
interface Claim {
  id: string;
  studentId: string;
  student: { name: string; srNo: string; classSec: string; fatherName: string } | null;
  parentPhone: string;
  amount: number;
  utr: string;
  paidOn: string;
  note: string;
  status: Status;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
  sentAt: string;
  suggestion: Split | null;
}
interface Settings {
  setupNeeded: boolean;
  upiId?: string;
  upiName?: string;
  officePhone?: string;
  updatedBy?: string | null;
}
type Status = "pending" | "verified" | "rejected";

const day = (s: string) => new Date(s.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const REJECT_REASONS = ["UTR not found in the bank statement", "Amount in bank is different", "This UTR was already used", "Paid to a different account"];

export default function ErpOnlinePaymentsPage() {
  const L = useL();
  const school = useSchoolInfo();
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";
  const [status, setStatus] = useState<Status>("pending");
  const { data, error, reload } = useApi<{ setupNeeded: boolean; data: Claim[] }>(`/erp/fee-claims?status=${status}`);
  const settings = useApi<Settings>("/erp/fee-claims/settings");
  const [verifying, setVerifying] = useState<Claim | null>(null);
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [printing, setPrinting] = useState<FeeTransaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rows = data?.data;
  const s = settings.data;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "माता-पिता ने पेरेंट ऐप से UPI से जो फ़ीस भेजी। बैंक स्टेटमेंट में UTR मिलाएँ, फिर पक्का करें।", en: "UPI payments parents reported in the parent app. Find the UTR in the bank statement, then verify." })}</p>
      <button type="button" onClick={() => setSettingsOpen(true)} className="btn-line w-full">
        <Settings2 className="h-4 w-4" aria-hidden /> {L({ hi: "UPI सेटिंग", en: "UPI settings" })}
        {s?.upiId ? <span className="truncate font-normal text-ink-500">· {s.upiId}</span> : null}
      </button>
      {s && !s.setupNeeded && !s.upiId && (
        <p className="rounded-xl bg-marigold-50 px-3 py-2.5 text-[13.5px] text-ink-800">
          {L({ hi: "स्कूल का UPI ID नहीं डला, इसलिए माता-पिता अभी ऑनलाइन नहीं दे सकते।", en: "Parents can't pay online yet: the school's UPI ID is not set." })}{" "}
          <button type="button" onClick={() => setSettingsOpen(true)} className="font-semibold underline">
            {L({ hi: "अभी डालें", en: "Set it now" })}
          </button>
        </p>
      )}
      {data?.setupNeeded && <p className="rounded-xl bg-marigold-50 px-3 py-2.5 text-[13.5px] text-ink-800">{L({ hi: "ऑनलाइन पेमेंट के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261006_parent_app.sql)।", en: "Online payments need a one-time database update: run supabase/migrations/20261006_parent_app.sql." })}</p>}

      <LineTabs
        label={L({ hi: "स्थिति", en: "Status" })}
        value={status}
        onChange={setStatus}
        options={[
          { key: "pending", text: `${L({ hi: "जाँचना है", en: "To check" })}${status === "pending" && rows ? ` ${rows.length}` : ""}` },
          { key: "verified", text: L({ hi: "पक्के", en: "Verified" }) },
          { key: "rejected", text: L({ hi: "नहीं मिले", en: "Rejected" }) },
        ]}
      />

      {!rows ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <Empty>{status === "pending" ? L({ hi: "जाँचने को कुछ नहीं। माता-पिता के नए पेमेंट यहाँ आएँगे।", en: "Nothing to check. New payments from parents will show here." }) : L({ hi: "अभी कोई नहीं।", en: "None yet." })}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((c) => (
            <li key={c.id} className="rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15.5px] font-semibold">{c.student?.name || "—"}</p>
                  <p className="truncate text-[12.5px] text-ink-500">
                    {c.student?.classSec} · {c.student?.srNo} · {c.parentPhone}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[17px] font-bold">{rupees(c.amount)}</p>
                  {c.suggestion && c.suggestion.fine > 0 && (
                    <p className="tnum text-[12px] text-ink-500">
                      {L({ hi: "फ़ाइन सहित", en: "incl. fine" })} {rupees(c.suggestion.fine)}
                    </p>
                  )}
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-ink-50 px-3 py-2 text-[12.5px]">
                <div className="min-w-0">
                  <dt className="text-ink-500">UTR</dt>
                  <dd className="tnum truncate font-semibold tracking-wide">{c.utr}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-ink-500">{L({ hi: "कब दिया", en: "Paid on" })}</dt>
                  <dd className="font-semibold">{day(c.paidOn)}</dd>
                </div>
              </dl>
              <p className="mt-1.5 text-[12px] text-ink-400">
                {L({ hi: "भेजा", en: "sent" })} {when(c.sentAt)}
                {c.note ? ` · ${c.note}` : ""}
              </p>
              {c.status === "pending" ? (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRejecting(c)} className="btn-line min-h-[42px]">
                    <X className="h-4 w-4" aria-hidden /> {L({ hi: "नहीं मिला", en: "Reject" })}
                  </button>
                  <button type="button" onClick={() => setVerifying(c)} className="btn-primary min-h-[42px]">
                    <Check className="h-4 w-4" aria-hidden /> {L({ hi: "पक्का करें", en: "Verify" })}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[12.5px] text-ink-500">
                  <span className={clsx("font-semibold", c.status === "verified" ? "text-jade-700" : "text-rose-600")}>{c.status === "verified" ? L({ hi: "पक्का", en: "Verified" }) : L({ hi: "नहीं मिला", en: "Rejected" })}</span> · {c.decidedBy} · {c.decidedAt ? when(c.decidedAt) : ""}
                  {c.rejectReason && <span className="block text-ink-600">{c.rejectReason}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {verifying && (
        <VerifySheet
          claim={verifying}
          onClose={() => setVerifying(null)}
          onDone={(tx) => {
            setVerifying(null);
            toast(true, L({ hi: `रसीद ${tx.receipt_no} बनी।`, en: `Receipt ${tx.receipt_no} made.` }));
            setPrinting(tx);
            reload();
          }}
        />
      )}
      {rejecting && (
        <RejectSheet
          claim={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            toast(true, L({ hi: "\"नहीं मिला\" लिख दिया। माता-पिता को कारण दिखेगा।", en: "Marked as not received. The parent will see the reason." }));
            reload();
          }}
        />
      )}
      {settingsOpen && <SettingsSheet isAdmin={isAdmin} settings={s || null} onClose={() => setSettingsOpen(false)} onSaved={() => settings.reload()} />}
      <FeeReceiptModal isOpen={!!printing} onClose={() => setPrinting(null)} transaction={printing} schoolName={school.name} />
    </div>
  );
}

function VerifySheet({ claim, onClose, onDone }: { claim: Claim; onClose: () => void; onDone: (tx: FeeTransaction) => void }) {
  const L = useL();
  const sg = claim.suggestion;
  const [fee, setFee] = useState(String(sg ? sg.fee : claim.amount));
  const [fine, setFine] = useState(String(sg ? sg.fine : 0));
  const [reason, setReason] = useState(sg && sg.waived > 0 ? "Parent paid online without the full late fine" : "");
  const [busy, setBusy] = useState(false);
  const feeN = Math.round(Number(fee) || 0);
  const fineN = Math.round(Number(fine) || 0);
  const sumOk = feeN + fineN === claim.amount;
  // How much fine is let go is worked out again by the server; this only shows the office what it will see (ERP VerifyModal).
  const waived = sg && feeN === sg.fee ? Math.max(0, sg.fine + sg.waived - fineN) : 0;

  async function go() {
    setBusy(true);
    try {
      const r = await api<{ transaction: FeeTransaction }>(`/erp/fee-claims/${claim.id}/verify`, { body: { fee: feeN, fine: fineN, waiveReason: reason.trim() || undefined } });
      onDone(r.transaction);
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "पक्का नहीं हुआ।", en: "Could not verify." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: `${claim.student?.name || "माता-पिता"} से ${rupees(claim.amount)} पक्का करें?`, en: `Verify ${rupees(claim.amount)} from ${claim.student?.name || "parent"}?` })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3 text-[14px]">
          <div>
            <dt className="text-[12px] text-ink-500">UTR</dt>
            <dd className="tnum font-semibold">{claim.utr}</dd>
          </div>
          <div className="text-right">
            <dt className="text-[12px] text-ink-500">{L({ hi: "कब दिया", en: "Paid on" })}</dt>
            <dd className="font-semibold">{day(claim.paidOn)}</dd>
          </div>
        </dl>
        <p className="text-[13.5px] text-ink-600">
          {L({
            hi: `पहले स्कूल के बैंक स्टेटमेंट में इस UTR से ${rupees(claim.amount)} ढूँढें। रसीद ${day(claim.paidOn)} की बनेगी और लेट फ़ाइन उसी दिन के हिसाब से लगेगा।`,
            en: `First find ${rupees(claim.amount)} with this UTR in the school's bank statement. The receipt is dated ${day(claim.paidOn)} and late fine is worked out for that day.`,
          })}
        </p>
        {sg && sg.excess > 0 && (
          <p className="flex gap-2 rounded-xl bg-rose-50 p-3 text-[13.5px] text-ink-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            {L({ hi: `माता-पिता ने पूरे साल की फ़ीस और फ़ाइन से ${rupees(sg.excess)} ज़्यादा दिए। इसे "नहीं मिला" करें, और काउंटर पर लें / ज़्यादा पैसा लौटाएँ।`, en: `The parent paid ${rupees(sg.excess)} more than the whole year's fee and fine. Reject this, and collect at the counter / refund the extra.` })}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field-box">
            <small>{L({ hi: "फ़ीस का हिस्सा", en: "Fee part" })}</small>
            <input id="ov-fee" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="tnum" />
          </label>
          <label className="field-box">
            <small>{L({ hi: "लेट फ़ाइन का हिस्सा", en: "Late fine part" })}</small>
            <input id="ov-fine" value={fine} onChange={(e) => setFine(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="tnum" />
          </label>
        </div>
        {!sumOk && <p className="text-[13px] font-medium text-rose-700">{L({ hi: `फ़ीस + फ़ाइन ${rupees(claim.amount)} होना चाहिए।`, en: `Fee + fine must add up to ${rupees(claim.amount)}.` })}</p>}
        <label className="field-box">
          <small>{waived > 0 ? L({ hi: `लेट फ़ाइन के ${rupees(waived)} क्यों छोड़े?`, en: `Why is ${rupees(waived)} of the late fine let go?` }) : L({ hi: "फ़ाइन छोड़ा हो तो क्यों?", en: "If any late fine is let go, why?" })}</small>
          <input id="ov-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn-line">
            {L({ hi: "अभी नहीं", en: "Not now" })}
          </button>
          <button type="button" onClick={go} disabled={busy || !sumOk || !!(sg && sg.excess > 0)} className="btn-primary">
            {busy ? "…" : L({ hi: "बैंक में मिला · रसीद बनाएँ", en: "Found in bank · make receipt" })}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function RejectSheet({ claim, onClose, onDone }: { claim: Claim; onClose: () => void; onDone: () => void }) {
  const L = useL();
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await api(`/erp/fee-claims/${claim.id}/reject`, { body: { reason: reason === "other" ? other : reason } });
      onDone();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: `नहीं मिला: ${rupees(claim.amount)}, UTR ${claim.utr}`, en: `Not received: ${rupees(claim.amount)}, UTR ${claim.utr}` })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <SelectBox label={L({ hi: "क्यों (माता-पिता को दिखेगा)", en: "Why (the parent sees this)" })} value={reason} onChange={setReason}>
          {REJECT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="other">{L({ hi: "कुछ और…", en: "Something else…" })}</option>
        </SelectBox>
        {reason === "other" && (
          <label className="field-box">
            <small>{L({ hi: "कारण लिखें", en: "Write the reason" })}</small>
            <input id="or-other" value={other} onChange={(e) => setOther(e.target.value)} autoFocus />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn-line">
            {L({ hi: "वापस", en: "Back" })}
          </button>
          <button type="button" onClick={go} disabled={busy} className="btn-primary !bg-rose-600">
            {busy ? "…" : L({ hi: "नहीं मिला", en: "Reject" })}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsSheet({ isAdmin, settings, onClose, onSaved }: { isAdmin: boolean; settings: Settings | null; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [upiId, setUpiId] = useState(settings?.upiId || "");
  const [upiName, setUpiName] = useState(settings?.upiName || "");
  const [officePhone, setOfficePhone] = useState(settings?.officePhone || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setUpiId(settings?.upiId || "");
    setUpiName(settings?.upiName || "");
    setOfficePhone(settings?.officePhone || "");
  }, [settings]);

  async function save() {
    setBusy(true);
    try {
      await api("/erp/fee-claims/settings", { method: "PUT", body: { upiId, upiName, officePhone } });
      toast(true, L({ hi: "सेव हो गया। पेरेंट ऐप में तुरंत दिखेगा।", en: "Saved. The parent app shows it at once." }));
      onSaved();
      onClose();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: "पेरेंट ऐप: पेमेंट और संपर्क", en: "Parent app: payment & contact" })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <label className="field-box">
          <small>{L({ hi: "स्कूल का UPI ID", en: "School's UPI ID" })}</small>
          <input id="up-id" value={upiId} onChange={(e) => setUpiId(e.target.value.trim())} placeholder="schoolname@sbi" disabled={!isAdmin} autoCapitalize="none" />
        </label>
        <p className="-mt-1 text-[12.5px] text-ink-500">{L({ hi: "स्कूल का अपना बैंक खाता डालें। माता-पिता इसी ID पर देंगे। खाली छोड़ें तो ऑनलाइन पेमेंट बंद।", en: "Use the school's own bank account. Parents pay this ID. Leave empty to switch online payment off." })}</p>
        <label className="field-box">
          <small>{L({ hi: "UPI पर दिखने वाला नाम", en: "Name shown on UPI" })}</small>
          <input id="up-name" value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder={L({ hi: "जैसा बैंक दिखाता है", en: "As the bank shows it" })} disabled={!isAdmin} />
        </label>
        <label className="field-box">
          <small>{L({ hi: "माता-पिता के लिए ऑफ़िस फ़ोन", en: "Office phone for parents" })}</small>
          <input id="up-phone" value={officePhone} onChange={(e) => setOfficePhone(e.target.value)} placeholder="94600 62543" inputMode="tel" disabled={!isAdmin} className="tnum" />
        </label>
        {!isAdmin && <p className="text-[12.5px] text-ink-500">{L({ hi: "इन्हें सिर्फ़ एडमिन बदल सकते हैं।", en: "Only the administrator can change these." })}</p>}
        {isAdmin ? (
          <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
            {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
          </button>
        ) : (
          <button type="button" onClick={onClose} className="btn-line w-full">
            {L({ hi: "बंद करें", en: "Close" })}
          </button>
        )}
      </div>
    </Sheet>
  );
}
