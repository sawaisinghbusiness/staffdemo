"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import type { ErpStudent } from "@/lib/erpStudents";
import { SelectBox, Sheet } from "@/components/ui";

export interface GatePass {
  id: string;
  pass_no: string;
  reason: string;
  escort: string;
  issued_by_name?: string;
  issued_at: string;
}

/** The ERP's reasons, word for word (ERP components/search/GatePassModal). */
const REASONS = ["Not feeling well", "Doctor / hospital visit", "Family emergency", "Family function or travel", "Sports or school event", "Principal's permission"];

/** ERP login: issue a gate pass (POST /api/gate-passes), as the ERP's gate pass popup does. */
export function GatePassSheet({ student: s, onClose, onIssued }: { student: ErpStudent; onClose: () => void; onIssued: (p: GatePass) => void }) {
  const L = useL();
  const { lang } = useLang();
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [escort, setEscort] = useState("father");
  const [otherEscort, setOtherEscort] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<GatePass | null>(null);

  const escortText = escort === "father" ? `Father (${s.fatherName})` : escort === "mother" ? `Mother (${s.motherName})` : otherEscort.trim();
  const reasonText = reason === "other" ? otherReason.trim() : reason;

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonText) return toast(false, L({ hi: "जाने का कारण लिखें।", en: "Write the reason for leaving." }));
    if (!escortText) return toast(false, L({ hi: "बच्चे को कौन ले जा रहा है, रिश्ते के साथ लिखें।", en: "Write who is taking the student, with their relation." }));
    setBusy(true);
    try {
      const res = await api<{ success: boolean; data: GatePass }>("/erp/gate-passes", { body: { studentId: s.id, reason: reasonText, escort: escortText } });
      setIssued(res.data);
      onIssued(res.data);
      toast(true, L({ hi: `गेट पास ${res.data.pass_no} बन गया`, en: `Gate pass ${res.data.pass_no} issued` }));
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "गेट पास नहीं बना। दोबारा कोशिश करें।", en: "Could not issue the gate pass." }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: "गेट पास", en: "Gate pass" })} onClose={onClose}>
      <p className="mb-3 truncate text-[13.5px] text-ink-500">
        {s.name} · {s.classSec}
      </p>
      {issued ? (
        <div className="space-y-4">
          <dl className="kv">
            {(
              [
                [L({ hi: "पास नं.", en: "Pass no." }), issued.pass_no],
                [L({ hi: "समय", en: "Time" }), new Date(issued.issued_at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })],
                [L({ hi: "साथ में", en: "Going with" }), issued.escort],
                [L({ hi: "कारण", en: "Reason" }), issued.reason],
                [L({ hi: "किसने दिया", en: "Issued by" }), issued.issued_by_name || L({ hi: "ऑफ़िस", en: "Office" })],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={onClose} className="btn-primary w-full">
            {L({ hi: "ठीक है", en: "Done" })}
          </button>
        </div>
      ) : (
        <form onSubmit={issue} className="space-y-3" noValidate>
          <SelectBox label={L({ hi: "कारण", en: "Reason" })} value={reason} onChange={setReason}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="other">{L({ hi: "कुछ और…", en: "Other…" })}</option>
          </SelectBox>
          {reason === "other" && (
            <label className="field-box">
              <small>{L({ hi: "कारण लिखें", en: "Write the reason" })}</small>
              <input id="gp-other-reason" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} autoFocus />
            </label>
          )}
          <SelectBox label={L({ hi: "किसके साथ जा रहा है", en: "Going with" })} value={escort} onChange={setEscort}>
            <option value="father">
              {L({ hi: "पिता", en: "Father" })}
              {s.fatherName ? ` (${s.fatherName})` : ""}
            </option>
            {s.motherName && (
              <option value="mother">
                {L({ hi: "माता", en: "Mother" })} ({s.motherName})
              </option>
            )}
            <option value="other">{L({ hi: "कोई और…", en: "Someone else…" })}</option>
          </SelectBox>
          {escort === "other" && (
            <label className="field-box">
              <small>{L({ hi: "नाम और रिश्ता", en: "Name and relation" })}</small>
              <input id="gp-other-escort" value={otherEscort} onChange={(e) => setOtherEscort(e.target.value)} placeholder="Suresh Jain (uncle)" />
            </label>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "…" : L({ hi: "गेट पास दें", en: "Issue gate pass" })}
          </button>
        </form>
      )}
    </Sheet>
  );
}
