"use client";

/**
 * Student profile 360: tabs that need the "student profile 360" SQL (wallet, refunds, follow-ups,
 * discipline, edit history). Until the SQL is run each tab says so instead of failing.
 * Claude owns what these do; Codex polishes the look (docs/student-profile-360).
 */
import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate, rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, ListSkeleton, SelectBox, Status } from "@/components/ui";

const enc = encodeURIComponent;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const when = (iso: string, lang: string) => new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.message) || (e as Error)?.message || fallback;

function Gate<T extends { setupNeeded?: boolean }>({ q, children }: { q: { data?: T; error: { status: number; message?: string } | null; reload: () => unknown }; children: (d: T) => React.ReactNode }) {
  const L = useL();
  if (q.data?.setupNeeded) return <Empty>{L({ hi: "यह हिस्सा डेटाबेस अपडेट (student profile 360 SQL) के बाद चालू होगा।", en: "This starts working after the one-time database update (student profile 360 SQL)." })}</Empty>;
  if (q.data) return <>{children(q.data)}</>;
  if (q.error?.status === 403) return <Empty>{L({ hi: "यह हिस्सा सिर्फ़ ऑफ़िस (एडमिन, अकाउंटेंट) देख सकता है।", en: "Only the office (admin, accountant) can see this." })}</Empty>;
  if (q.error && q.error.status !== 401) return <ErrorCard offline={q.error.status === 0} slow={q.error.message === "timeout"} onRetry={q.reload} />;
  return <ListSkeleton rows={3} />;
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field-box">
      <small>{label}</small>
      <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))} />
    </label>
  );
}
function Text({ label, value, onChange, max = 200 }: { label: string; value: string; onChange: (v: string) => void; max?: number }) {
  return (
    <label className="field-box">
      <small>{label}</small>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/* ───────────── Wallet ───────────── */

interface Wallet {
  setupNeeded: boolean;
  balance: number;
  modes: string[];
  entries: { id: string; amount: number; kind: "deposit" | "used" | "refund" | "adjust"; mode: string | null; reference: string | null; note: string | null; receiptNo: string | null; by: string | null; at: string }[];
}

export function WalletTab({ id, balanceDue, onPaid }: { id: string; balanceDue: number; onPaid: () => void }) {
  const L = useL();
  const { lang } = useLang();
  const q = useApi<Wallet>(`/erp/student-profile/${enc(id)}/wallet`);
  const [form, setForm] = useState<"" | "add" | "pay">("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const kindText = (k: string) => ({ deposit: L({ hi: "जमा (एडवांस)", en: "Advance added" }), used: L({ hi: "फ़ीस में लगा", en: "Used for fee" }), refund: L({ hi: "वापस किया", en: "Refunded" }), adjust: L({ hi: "सुधार", en: "Adjustment" }) })[k] || k;

  async function save() {
    const n = Number(amount);
    if (!n) return toast(false, L({ hi: "रकम लिखें।", en: "Enter the amount." }));
    setBusy(true);
    try {
      if (form === "add") await api(`/erp/student-profile/${enc(id)}/wallet/deposit`, { body: { amount: n, mode, reference } });
      else await api(`/erp/student-profile/${enc(id)}/wallet/pay`, { body: { amount: n } });
      toast(true, form === "add" ? L({ hi: "वॉलेट में जमा हो गया।", en: "Added to the wallet." }) : L({ hi: "वॉलेट से फ़ीस जमा हो गई, रसीद बन गई।", en: "Fee paid from the wallet; receipt made." }));
      setForm("");
      setAmount("");
      setReference("");
      q.reload();
      if (form === "pay") onPaid();
    } catch (e) {
      toast(false, errText(e, L({ hi: "सेव नहीं हुआ।", en: "Could not save." })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gate q={q}>
      {(d) => (
        <section className="space-y-3">
          <div className="today-card flex items-end justify-between gap-3 pb-4">
            <div>
              <p className="text-[12px] text-ink-500">{L({ hi: "वॉलेट में", en: "In the wallet" })}</p>
              <p className="tnum text-[22px] font-bold">{rupees(d.balance)}</p>
            </div>
            {balanceDue > 0 && <p className="text-right text-[12.5px] text-ink-500">{L({ hi: `फ़ीस बाकी ${rupees(balanceDue)}`, en: `Fee due ${rupees(balanceDue)}` })}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" className="btn-line" onClick={() => (setForm(form === "add" ? "" : "add"), setAmount(""))}>
              {L({ hi: "एडवांस जमा करें", en: "Add advance" })}
            </button>
            <button type="button" className="btn-line" disabled={d.balance <= 0 || balanceDue <= 0} onClick={() => (setForm(form === "pay" ? "" : "pay"), setAmount(String(Math.min(d.balance, balanceDue))))}>
              {L({ hi: "वॉलेट से फ़ीस भरें", en: "Pay fee from wallet" })}
            </button>
          </div>
          {form && (
            <div className="row-card space-y-2.5 !p-3.5">
              <Money label={L({ hi: "रकम (₹)", en: "Amount (₹)" })} value={amount} onChange={setAmount} />
              {form === "add" && (
                <>
                  <SelectBox label={L({ hi: "कैसे मिला", en: "Received by" })} value={mode} onChange={setMode}>
                    {d.modes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </SelectBox>
                  <Text label={L({ hi: "रेफ़रेंस (UPI/चेक नं.)", en: "Reference (UPI/cheque no.)" })} value={reference} onChange={setReference} max={80} />
                </>
              )}
              {form === "pay" && <p className="text-[12.5px] text-ink-500">{L({ hi: "फ़ीस की रसीद बनेगी (मोड: वॉलेट)। लेट फ़ाइन हो तो फ़ीस काउंटर से लें।", en: "A fee receipt is made (mode: Wallet). If a late fine is due, use the fee counter." })}</p>}
              <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>
                {form === "add" ? L({ hi: "जमा करें", en: "Add to wallet" }) : L({ hi: "फ़ीस भरें", en: "Pay fee" })}
              </button>
            </div>
          )}
          {d.entries.length === 0 ? (
            <Empty>{L({ hi: "वॉलेट में अभी कुछ नहीं हुआ।", en: "Nothing in the wallet yet." })}</Empty>
          ) : (
            <ul className="row-card !py-1">
              {d.entries.map((e) => (
                <li key={e.id} className="flex min-h-[60px] items-center gap-3 border-b border-ink-100 py-2 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{kindText(e.kind)}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">{[when(e.at, lang), e.mode, e.receiptNo, e.reference, e.note, e.by].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={clsx("tnum text-[15px] font-semibold", e.amount > 0 ? "text-jade-700" : "text-ink-700")}>
                    {e.amount > 0 ? "+" : "−"}
                    {rupees(Math.abs(e.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Gate>
  );
}

/* ───────────── Refunds ───────────── */

interface Refunds {
  setupNeeded: boolean;
  modes: string[];
  items: { id: string; session: string; amount: number; source: "wallet" | "fee"; mode: string; reference: string | null; reason: string; on: string; by: string | null }[];
}

export function RefundsTab({ id, paid, onDone }: { id: string; paid: number; onDone: () => void }) {
  const L = useL();
  const { lang } = useLang();
  const q = useApi<Refunds>(`/erp/student-profile/${enc(id)}/refunds`);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"wallet" | "fee">("wallet");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!Number(amount)) return toast(false, L({ hi: "रकम लिखें।", en: "Enter the amount." }));
    if (reason.trim().length < 3) return toast(false, L({ hi: "वापस करने का कारण लिखें।", en: "Write why the money is refunded." }));
    setBusy(true);
    try {
      await api(`/erp/student-profile/${enc(id)}/refunds`, { body: { source, amount: Number(amount), mode, reference, reason, on: today() } });
      toast(true, L({ hi: "रिफ़ंड दर्ज हो गया।", en: "Refund recorded." }));
      setOpen(false);
      setAmount("");
      setReason("");
      setReference("");
      q.reload();
      onDone();
    } catch (e) {
      toast(false, errText(e, L({ hi: "रिफ़ंड सेव नहीं हुआ।", en: "Could not record the refund." })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gate q={q}>
      {(d) => (
        <section className="space-y-3">
          <button type="button" className="btn-line w-full" onClick={() => setOpen(!open)}>
            {L({ hi: "रिफ़ंड दर्ज करें", en: "Record a refund" })}
          </button>
          {open && (
            <div className="row-card space-y-2.5 !p-3.5">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={L({ hi: "किसमें से", en: "From" })}>
                {(["wallet", "fee"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={source === s} onClick={() => setSource(s)} className={clsx("min-h-[44px] rounded-lg border text-[13.5px] font-semibold", source === s ? "border-[#0D2A5E] bg-[#0D2A5E] text-white" : "border-ink-200 bg-white text-ink-700")}>
                    {s === "wallet" ? L({ hi: "वॉलेट से", en: "From wallet" }) : L({ hi: "जमा फ़ीस से", en: "From fee paid" })}
                  </button>
                ))}
              </div>
              {source === "fee" && <p className="text-[12.5px] text-ink-500">{L({ hi: `इस सत्र में ${rupees(paid)} फ़ीस जमा है। रिफ़ंड से जमा फ़ीस घटेगी और बाकी बढ़ेगा।`, en: `${rupees(paid)} fee paid this session. A refund lowers the fee paid and raises the balance.` })}</p>}
              <Money label={L({ hi: "रकम (₹)", en: "Amount (₹)" })} value={amount} onChange={setAmount} />
              <SelectBox label={L({ hi: "कैसे लौटाया", en: "Paid back by" })} value={mode} onChange={setMode}>
                {d.modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SelectBox>
              <Text label={L({ hi: "रेफ़रेंस (UPI/चेक नं.)", en: "Reference (UPI/cheque no.)" })} value={reference} onChange={setReference} max={80} />
              <Text label={L({ hi: "कारण", en: "Reason" })} value={reason} onChange={setReason} max={300} />
              <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>
                {L({ hi: "रिफ़ंड सेव करें", en: "Save refund" })}
              </button>
            </div>
          )}
          {d.items.length === 0 ? (
            <Empty>{L({ hi: "इस बच्चे को कोई रिफ़ंड नहीं हुआ।", en: "No refunds for this student." })}</Empty>
          ) : (
            <ul className="row-card !py-1">
              {d.items.map((r) => (
                <li key={r.id} className="flex min-h-[60px] items-center gap-3 border-b border-ink-100 py-2 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{r.reason}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {[fullDate(r.on, lang), r.source === "wallet" ? L({ hi: "वॉलेट से", en: "From wallet" }) : L({ hi: "फ़ीस से", en: "From fee" }), r.mode, r.reference, r.by].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="tnum text-[15px] font-semibold">{rupees(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Gate>
  );
}

/* ───────────── Remarks: follow-ups and discipline ───────────── */

interface Remark {
  id: string;
  kind: "followup" | "discipline";
  text: string;
  category: string | null;
  severity: "low" | "medium" | "high" | null;
  actionTaken: string | null;
  nextFollowUp: string | null;
  done: boolean;
  by: string | null;
  at: string;
}
const CATEGORIES = ["Late coming", "Uniform", "Homework", "Behaviour", "Fight", "Mobile phone", "Absent without leave", "Other"];

export function RemarksTab({ id, kind }: { id: string; kind: "followup" | "discipline" }) {
  const L = useL();
  const { lang } = useLang();
  const q = useApi<{ setupNeeded: boolean; items: Remark[] }>(`/erp/student-profile/${enc(id)}/remarks?kind=${kind}`);
  const [text, setText] = useState("");
  const [next, setNext] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("low");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const discipline = kind === "discipline";
  const sevText = (s: string | null) => ({ low: L({ hi: "हल्का", en: "Minor" }), medium: L({ hi: "मध्यम", en: "Moderate" }), high: L({ hi: "गंभीर", en: "Serious" }) })[s || "low"];

  async function add() {
    if (text.trim().length < 2) return toast(false, L({ hi: "नोट लिखें।", en: "Write the note." }));
    setBusy(true);
    try {
      await api(`/erp/student-profile/${enc(id)}/remarks`, { body: discipline ? { kind, text, category, severity, actionTaken: action } : { kind, text, nextFollowUp: next || undefined } });
      setText("");
      setNext("");
      setAction("");
      q.reload();
    } catch (e) {
      toast(false, errText(e, L({ hi: "नोट सेव नहीं हुआ।", en: "Could not save the note." })));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(r: Remark) {
    try {
      await api(`/erp/student-profile/${enc(id)}/remarks/${r.id}`, { method: "PATCH", body: { done: !r.done } });
      q.reload();
    } catch (e) {
      toast(false, errText(e, L({ hi: "बदला नहीं गया।", en: "Could not update it." })));
    }
  }

  return (
    <Gate q={q}>
      {(d) => (
        <section className="space-y-3">
          <div className="row-card space-y-2.5 !p-3.5">
            <label className="field-box !items-start">
              <small>{discipline ? L({ hi: "क्या हुआ", en: "What happened" }) : L({ hi: "बात / नोट", en: "Note" })}</small>
              <textarea rows={2} className="pt-5" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={discipline ? "" : L({ hi: "जैसे: पापा से बात हुई, 10 तारीख़ को फ़ीस देंगे", en: "e.g. Spoke to father, will pay on the 10th" })} />
            </label>
            {discipline ? (
              <>
                <SelectBox label={L({ hi: "प्रकार", en: "Category" })} value={category} onChange={setCategory}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectBox>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={L({ hi: "गंभीरता", en: "Severity" })}>
                  {(["low", "medium", "high"] as const).map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={severity === s} onClick={() => setSeverity(s)} className={clsx("min-h-[44px] rounded-lg border text-[13px] font-semibold", severity === s ? "border-[#0D2A5E] bg-[#0D2A5E] text-white" : "border-ink-200 bg-white text-ink-700")}>
                      {sevText(s)}
                    </button>
                  ))}
                </div>
                <Text label={L({ hi: "क्या कार्रवाई की", en: "Action taken" })} value={action} onChange={setAction} max={300} />
              </>
            ) : (
              <label className="field-box">
                <small>{L({ hi: "अगली बार कब बात करनी है (वैकल्पिक)", en: "Next follow-up (optional)" })}</small>
                <input type="date" min={today()} value={next} onChange={(e) => setNext(e.target.value)} />
              </label>
            )}
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={add}>
              {L({ hi: "नोट जोड़ें", en: "Add note" })}
            </button>
          </div>
          {d.items.length === 0 ? (
            <Empty>{discipline ? L({ hi: "कोई अनुशासन नोट नहीं।", en: "No discipline notes." }) : L({ hi: "कोई फ़ॉलो-अप नोट नहीं।", en: "No follow-up notes." })}</Empty>
          ) : (
            <ul className="row-card !py-1">
              {d.items.map((r) => {
                const overdue = !r.done && !!r.nextFollowUp && r.nextFollowUp < today();
                return (
                  <li key={r.id} className="flex items-start gap-3 border-b border-ink-100 py-2.5 last:border-0">
                    {!discipline && (
                      <button type="button" onClick={() => toggle(r)} aria-pressed={r.done} aria-label={r.done ? L({ hi: "पूरा नहीं", en: "Mark not done" }) : L({ hi: "पूरा हुआ", en: "Mark done" })} className={clsx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border-[1.5px]", r.done ? "border-[#12665E] bg-[#12665E] text-white" : "border-ink-300 bg-white")}>
                        {r.done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                      </button>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block text-[14.5px]", r.done && "text-ink-400 line-through")}>{r.text}</span>
                      <span className="block text-[12.5px] text-ink-500">
                        {[when(r.at, lang), r.by, discipline ? [r.category, sevText(r.severity)].filter(Boolean).join(" · ") : "", r.actionTaken ? `${L({ hi: "कार्रवाई", en: "Action" })}: ${r.actionTaken}` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {!discipline && r.nextFollowUp && !r.done && <Status tone={overdue ? "bad" : "wait"}>{fullDate(r.nextFollowUp, lang)}</Status>}
                    {discipline && r.severity === "high" && <Status tone="bad">{sevText(r.severity)}</Status>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </Gate>
  );
}

/* ───────────── Edit history ───────────── */

interface History {
  setupNeeded: boolean;
  items: { id: string; at: string; actor_name: string | null; actor_role: string | null; entity: string; action: string; changes: any; note: string | null }[];
}
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function HistoryTab({ id }: { id: string }) {
  const L = useL();
  const { lang } = useLang();
  const q = useApi<History>(`/erp/student-profile/${enc(id)}/history`);
  return (
    <Gate q={q}>
      {(d) =>
        d.items.length === 0 ? (
          <Empty>{L({ hi: "अभी तक कोई बदलाव दर्ज नहीं।", en: "No changes recorded yet." })}</Empty>
        ) : (
          <ul className="row-card !py-1">
            {d.items.map((h) => (
              <li key={h.id} className="border-b border-ink-100 py-2.5 last:border-0">
                <span className="block text-[14.5px] font-semibold">{h.action}</span>
                <span className="block text-[12.5px] text-ink-500">{[when(h.at, lang), h.actor_name, h.actor_role].filter(Boolean).join(" · ")}</span>
                {Array.isArray(h.changes) ? (
                  <ul className="mt-1 space-y-0.5 text-[12.5px]">
                    {h.changes.map((c: any, i: number) => (
                      <li key={i} className="break-words">
                        <span className="font-medium">{c.field}</span>: <span className="text-ink-400 line-through">{show(c.from)}</span> → <span>{show(c.to)}</span>
                      </li>
                    ))}
                  </ul>
                ) : h.changes ? (
                  <p className="mt-1 break-words text-[12.5px] text-ink-700">
                    {Object.entries(h.changes)
                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                      .map(([k, v]) => `${k}: ${show(v)}`)
                      .join(" · ")}
                  </p>
                ) : null}
                {h.note && <p className="mt-0.5 text-[12.5px] text-ink-500">{h.note}</p>}
              </li>
            ))}
          </ul>
        )
      }
    </Gate>
  );
}
