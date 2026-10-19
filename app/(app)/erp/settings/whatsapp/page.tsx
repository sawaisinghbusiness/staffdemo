"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { LogOut, Moon, RotateCcw, RotateCw, Send, Smartphone } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { KIND_LABEL, OUT_STATUS, outboxWhen, WA_STATE, type OutboxRow, type OutboxStatus, type WaSettings, type WaStatus } from "@/lib/erpSettings";
import { Empty, ErrorCard, ListSkeleton, Sheet, Status } from "@/components/ui";

/*
 * ERP login → Settings → WhatsApp: the ERP's app/settings/messaging page. GET /api/whatsapp/status (polled fast while a
 * QR is showing), GET /api/whatsapp/outbox, and the admin-only POST connect / logout / test, PUT settings;
 * POST retry is admin + accountant. The school's phone links once by scanning the QR, like WhatsApp Web.
 */

type Filter = "all" | OutboxStatus;
const FILTERS: { key: Filter; label: Bi }[] = [
  { key: "all", label: { hi: "सभी", en: "All" } },
  { key: "pending", label: { hi: "इंतज़ार में", en: "Waiting" } },
  { key: "sent", label: { hi: "भेजे", en: "Sent" } },
  { key: "failed", label: { hi: "नहीं गए", en: "Failed" } },
  { key: "skipped", label: { hi: "WhatsApp पर नहीं", en: "Not on WhatsApp" } },
];
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError && e.message) || fallback;
const statusOf = async () => {
  try {
    return await api<WaStatus>("/erp/whatsapp/status");
  } catch {
    return null;
  }
};

export default function ErpWhatsAppPage() {
  const L = useL();
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const school = useApi<Record<string, string>>("/erp/school");
  const role = who.data?.user.role || "";
  const isAdmin = role === "admin";
  const canRetry = role === "admin" || role === "accountant";
  const schoolName = school.data?.school_name || "School";

  const [status, setStatus] = useState<WaStatus | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<OutboxRow[] | null>(null);

  const loadStatus = useCallback(async () => {
    const s = await statusOf();
    setUnreachable(!s);
    if (s) setStatus(s);
    return s;
  }, []);
  const loadOutbox = useCallback(async () => {
    try {
      const r = await api<{ data: OutboxRow[]; setupNeeded: boolean }>(`/erp/whatsapp/outbox${filter === "all" ? "" : `?status=${filter}`}`);
      setRows(r.data || []);
    } catch {
      setRows([]);
    }
  }, [filter]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    setRows(null);
    loadOutbox();
  }, [loadOutbox]);

  // Fast while a QR is on screen (codes change every ~20s), slow otherwise.
  const linking = status?.state === "qr" || status?.state === "connecting";
  useEffect(() => {
    const t = setInterval(() => {
      loadStatus();
      if (!linking) loadOutbox();
    }, linking ? 2000 : 15000);
    return () => clearInterval(t);
  }, [linking, loadStatus, loadOutbox]);

  const connect = async () => {
    setBusy(true);
    try {
      await api("/erp/whatsapp/connect", { method: "POST" });
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "शुरू नहीं हुआ।", en: "Could not start." })));
    }
    setBusy(false);
    loadStatus();
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await api("/erp/whatsapp/logout", { method: "POST" });
      toast(true, L({ hi: "WhatsApp हटा दिया।", en: "WhatsApp disconnected." }));
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "नहीं हटा।", en: "Could not disconnect." })));
    }
    setBusy(false);
    setConfirmOff(false);
    loadStatus();
  };
  const setSwitch = async (key: keyof Pick<WaSettings, "auto_absent" | "auto_receipt">, on: boolean) => {
    if (!status?.settings) return;
    setStatus({ ...status, settings: { ...status.settings, [key]: on } });
    try {
      await api("/erp/whatsapp/settings", { method: "PUT", body: { [key]: on } });
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "सेव नहीं हुआ।", en: "Could not save." })));
      loadStatus();
    }
  };
  const retry = async () => {
    try {
      const r = await api<{ count?: number }>("/erp/whatsapp/retry", { method: "POST" });
      const n = r.count || 0;
      toast(true, L({ hi: `${n} मैसेज फिर से कतार में।`, en: `${n} message${n === 1 ? "" : "s"} back in the queue.` }));
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "दोबारा नहीं हुआ।", en: "Could not retry." })));
    }
    loadStatus();
    loadOutbox();
  };

  const s = status;
  if (!s) return unreachable ? <ErrorCard onRetry={loadStatus} /> : <ListSkeleton rows={4} />;

  if (s.setupNeeded)
    return (
      <div className="animate-rise space-y-3">
        <div className="row-card flex flex-col items-center gap-2 py-6 text-center">
          <Smartphone className="h-8 w-8 text-ink-300" aria-hidden />
          <p className="text-[16px] font-semibold">{L({ hi: "WhatsApp के लिए डेटाबेस में एक बार का सेटअप चाहिए", en: "WhatsApp needs a one-time database setup" })}</p>
          <p className="text-[13px] text-ink-500">
            {L({ hi: "बैकएंड फ़ोल्डर की", en: "Run" })} <span className="break-all font-mono text-[12.5px]">supabase/migrations/20261002_whatsapp.sql</span> {L({ hi: "Supabase SQL एडिटर में चलाएँ, फिर दोबारा देखें।", en: "(in the backend folder) in the Supabase SQL editor, then check again." })}
          </p>
          <button type="button" onClick={loadStatus} className="btn-line mt-2">
            <RotateCw className="h-4 w-4" aria-hidden /> {L({ hi: "फिर देखें", en: "Check again" })}
          </button>
        </div>
      </div>
    );

  const st = WA_STATE[s.state];

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "गैरहाज़िरी, फ़ीस रसीद और याद स्कूल के अपने WhatsApp नंबर से माता-पिता को जाते हैं।", en: "Absent alerts, fee receipts and reminders go to parents from the school's own WhatsApp number." })}</p>

      {/* ── The school's phone ── */}
      <section className="row-card space-y-3" aria-label={L({ hi: "कनेक्शन", en: "Connection" })}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold">{L({ hi: "स्कूल का WhatsApp", en: "School's WhatsApp" })}</h2>
          <Status tone={st.tone}>{L(st.label)}</Status>
        </div>

        {s.state === "open" && s.me ? (
          <>
            <div>
              <p className="tnum text-[22px] font-bold tracking-tight">+{s.me.number.replace(/^91(\d{5})(\d{5})$/, "91 $1 $2")}</p>
              {s.me.name && <p className="text-[13.5px] text-ink-500">{s.me.name}</p>}
            </div>
            {isAdmin && <TestForm school={schoolName} />}
            {isAdmin && (
              <button type="button" onClick={() => setConfirmOff(true)} className="btn-line w-full">
                <LogOut className="h-4 w-4" aria-hidden /> {L({ hi: "हटाएँ", en: "Disconnect" })}
              </button>
            )}
          </>
        ) : s.state === "qr" && s.qr ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.qr} alt={L({ hi: "WhatsApp जोड़ने का QR कोड", en: "QR code to link WhatsApp" })} className="mx-auto h-[240px] w-[240px] rounded-lg bg-white ring-1 ring-ink-200" />
            <ol className="list-decimal space-y-1.5 pl-5 text-[14px] text-ink-700">
              <li>{L({ hi: "स्कूल के फ़ोन में WhatsApp खोलें।", en: "Open WhatsApp on the school's phone." })}</li>
              <li>{L({ hi: "⋮ (Android) या Settings (iPhone) दबाएँ, फिर Linked devices।", en: "Tap ⋮ (Android) or Settings (iPhone), then Linked devices." })}</li>
              <li>{L({ hi: "Link a device दबाकर फ़ोन को इस कोड पर रखें।", en: "Tap Link a device and point the phone at this code." })}</li>
            </ol>
            <p className="text-[12.5px] text-ink-500">{L({ hi: "कोड हर कुछ सेकंड में बदलता है; यह स्क्रीन साथ-साथ बदलती है। स्कूल का फ़ोन किसी दूसरी स्क्रीन से स्कैन करे।", en: "The code changes every few seconds; this page keeps up. Scan it with the school's phone from another screen." })}</p>
          </div>
        ) : s.state === "connecting" || s.state === "qr" ? (
          <p className="text-[14px] text-ink-600">{L({ hi: "WhatsApp से जुड़ रहा है…", en: "Connecting to WhatsApp…" })}</p>
        ) : (
          <>
            <p className="text-[14px] text-ink-600">{L({ hi: "स्कूल का फ़ोन एक बार QR कोड स्कैन करके जोड़ें, WhatsApp Web की तरह। उसके बाद जुड़ा रहता है।", en: "Link the school's phone once by scanning a QR code, like WhatsApp Web. It stays linked after that." })}</p>
            {s.lastError && <p className="text-[13px] text-marigold-700">{s.lastError}</p>}
            {isAdmin ? (
              <button type="button" onClick={connect} disabled={busy} className="btn-primary w-full">
                <Smartphone className="h-4 w-4" aria-hidden /> {busy ? "…" : L({ hi: "WhatsApp जोड़ें", en: "Connect WhatsApp" })}
              </button>
            ) : (
              <p className="text-[13px] text-ink-500">{L({ hi: "WhatsApp सिर्फ़ एडमिन जोड़ सकते हैं।", en: "Only an admin can connect WhatsApp." })}</p>
            )}
            <p className="text-[12.5px] text-ink-500">{L({ hi: "स्कूल के लिए अलग नंबर रखें, किसी का निजी WhatsApp नहीं।", en: "Use a separate number for the school, not someone's personal WhatsApp." })}</p>
          </>
        )}
      </section>

      {/* ── What goes out on its own ── */}
      <div className="sec-head pt-1">
        <h2>{L({ hi: "अपने आप भेजें", en: "Send on their own" })}</h2>
      </div>
      <p className="-mt-2 text-[13px] text-ink-500">
        {L({ hi: "हर मैसेज कतार में लगता है और कुछ सेकंड के अंतर से जाता है", en: "Each message is queued and leaves a few seconds apart" })}
        {s.state !== "open" ? L({ hi: ", WhatsApp जुड़ने के बाद।", en: ", once WhatsApp is connected." }) : "."}
      </p>
      <AutoRow
        title={L({ hi: "आज गैरहाज़िर", en: "Absent today" })}
        note={L({ hi: "हाज़िरी सेव होते ही गैरहाज़िर बच्चों के माता-पिता को जाता है। जाने से पहले हाज़िर कर दें तो वापस हो जाता है।", en: "When attendance is saved, the parents of absent students get this. Changing someone to present before it goes takes it back." })}
        sample={`प्रिय अभिभावक, आज (2 Oct) Laxman Garg (कक्षा Nursery-A) स्कूल में अनुपस्थित है। कृपया कारण बताएं। – ${schoolName}`}
        on={!!s.settings?.auto_absent}
        disabled={!isAdmin}
        onChange={(v) => setSwitch("auto_absent", v)}
      />
      <AutoRow
        title={L({ hi: "फ़ीस मिली", en: "Fee received" })}
        note={L({ hi: "काउंटर पर हर भुगतान के बाद माता-पिता को रकम, रसीद नंबर और बाकी फ़ीस जाती है।", en: "After each payment at the counter, the parent gets the amount, receipt number and what is still due." })}
        sample={`प्रिय अभिभावक, Laxman Garg (कक्षा Nursery-A) की फीस ₹5,000 प्राप्त हुई। रसीद नं. 1042, दिनांक 2 Oct। शेष बकाया: ₹7,500। धन्यवाद – ${schoolName}`}
        on={!!s.settings?.auto_receipt}
        disabled={!isAdmin}
        onChange={(v) => setSwitch("auto_receipt", v)}
      />
      {who.data && !isAdmin && <p className="text-[12.5px] text-ink-500">{L({ hi: "ये सिर्फ़ एडमिन चालू या बंद कर सकते हैं।", en: "Only an admin can switch these on or off." })}</p>}

      {/* ── Outbox ── */}
      <div className="sec-head pt-1">
        <h2>{L({ hi: "आउटबॉक्स", en: "Outbox" })}</h2>
      </div>
      <p className="tnum -mt-2 text-[13px] text-ink-600">
        <b className="font-semibold text-ink-900">{s.counts.pending}</b> {L({ hi: "इंतज़ार में", en: "waiting" })} · <b className="font-semibold text-ink-900">{s.counts.sentToday}</b> {L({ hi: "आज भेजे", en: "sent today" })}
        {s.counts.failed > 0 && (
          <>
            {" "}
            · <b className="font-semibold text-rose-600">{s.counts.failed}</b> {L({ hi: "नहीं गए", en: "failed" })}
          </>
        )}
      </p>
      {s.quietHours && s.counts.pending > 0 && (
        <p className="flex items-center gap-1.5 text-[13px] text-ink-500">
          <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {L({ hi: "रात 9 से सुबह 7 तक कुछ नहीं जाता; ये सुबह जाएँगे।", en: "Nothing goes out 9 pm – 7 am; these leave in the morning." })}
        </p>
      )}
      {s.counts.failed > 0 && canRetry && (
        <button type="button" onClick={retry} className="btn-line w-full">
          <RotateCcw className="h-4 w-4" aria-hidden /> {L({ hi: "न गए मैसेज फिर भेजें", en: "Retry failed" })}
        </button>
      )}

      <div className="no-scrollbar stick-chips flex gap-1.5 overflow-x-auto" role="tablist" aria-label={L({ hi: "हालत", en: "Status" })}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={clsx("min-h-[38px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold", filter === f.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-600")}>
            {L(f.label)}
          </button>
        ))}
      </div>

      {rows === null ? (
        <ListSkeleton rows={4} />
      ) : !rows.length ? (
        <Empty>{filter === "all" ? L({ hi: "अभी कोई मैसेज नहीं। ऊपर कोई मैसेज चालू करें, या टेस्ट भेजें।", en: "No message yet. Switch on a message above, or send a test." }) : L({ hi: "यहाँ कुछ नहीं।", en: "Nothing here." })}</Empty>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-b border-ink-100 py-2.5">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{r.student_name || `+91 ${r.phone}`}</span>
                  <span className="tnum block truncate text-[12.5px] text-ink-500">
                    {L(KIND_LABEL[r.kind])} · {outboxWhen(r.sent_at || r.created_at)}
                    {r.student_name ? ` · ${r.class_sec ? `${r.class_sec} · ` : ""}${r.phone}` : ""}
                  </span>
                </span>
                <Status tone={OUT_STATUS[r.status].tone}>{L(OUT_STATUS[r.status].label)}</Status>
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] text-ink-600">{r.body}</p>
              {r.error && r.status !== "sent" && <p className="mt-0.5 text-[12px] text-rose-600">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {confirmOff && (
        <Sheet title={L({ hi: "WhatsApp हटाएँ?", en: "Disconnect WhatsApp?" })} onClose={() => !busy && setConfirmOff(false)}>
          <p className="mb-4 text-[14.5px] text-ink-600">{L({ hi: "जब तक कोई नया QR कोड स्कैन न करे, मैसेज नहीं जाएँगे। कतार के मैसेज आउटबॉक्स में रहेंगे।", en: "Messages stop going out until someone scans a new QR code. Messages already waiting stay in the outbox." })}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setConfirmOff(false)} disabled={busy} className="btn-line">
              {L({ hi: "रहने दें", en: "Cancel" })}
            </button>
            <button type="button" onClick={disconnect} disabled={busy} className="btn-primary !bg-rose-600">
              {busy ? "…" : L({ hi: "हटाएँ", en: "Disconnect" })}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function AutoRow({ title, note, sample, on, disabled, onChange }: { title: string; note: string; sample: string; on: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row-card space-y-2">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{title}</span>
          <span className="block text-[12.5px] text-ink-500">{note}</span>
        </span>
        <button type="button" role="switch" aria-checked={on} aria-label={title} disabled={disabled} onClick={() => onChange(!on)} className="-m-2 grid h-11 w-[60px] shrink-0 place-items-center disabled:opacity-50">
          <span className={clsx("relative h-6 w-11 rounded-full transition", on ? "bg-[#28d72a]" : "bg-ink-300")}>
            <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
          </span>
        </button>
      </div>
      <p className="rounded-xl bg-ink-50 px-3 py-2 text-[13px] leading-relaxed text-ink-700">{sample}</p>
    </div>
  );
}

function TestForm({ school }: { school: string }) {
  const L = useL();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api("/erp/whatsapp/test", { body: { phone, text: `${school}: WhatsApp से संदेश भेजने की जाँच। यह एक टेस्ट संदेश है।` } });
      toast(true, L({ hi: `${phone} पर टेस्ट मैसेज गया।`, en: `Test message sent to ${phone}.` }));
    } catch (err) {
      toast(false, errMsg(err, L({ hi: "नहीं गया।", en: "Could not send." })));
    }
    setSending(false);
  };
  return (
    <form onSubmit={send} className="flex gap-2">
      <label className="field-box min-h-[50px] flex-1">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={L({ hi: "टेस्ट के लिए मोबाइल नं.", en: "Mobile no. for a test" })} aria-label={L({ hi: "टेस्ट मैसेज के लिए मोबाइल नंबर", en: "Mobile number for a test message" })} className="text-[16px]" />
      </label>
      <button type="submit" disabled={sending || phone.replace(/\D/g, "").length < 10} className="btn-line min-h-[50px] px-3.5">
        <Send className="h-4 w-4" aria-hidden /> {sending ? "…" : L({ hi: "भेजें", en: "Send" })}
      </button>
    </form>
  );
}
