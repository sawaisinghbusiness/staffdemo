"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Copy, MessageCircle, Search, Trash2, Undo2 } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { whatsappUrl, type Message, type Recipient } from "@/lib/erpMessages";
import { Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

/*
 * ERP login → one message: the ERP's SendDrawer. Send it to each parent on WhatsApp in turn ("Send next"),
 * each one ticked off here (POST /api/messages/:id/recipients/:rid), undo a wrong tick, copy the numbers still
 * to send, and the admin can delete the message.
 */

type View = "pending" | "sent" | "skipped";
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function ErpMessageDetailPage() {
  const L = useL();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const { data, error, reload } = useApi<{ message: Message; recipients: Recipient[] }>(id ? `/erp/messages/${encodeURIComponent(id)}` : null);
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const canDelete = who.data?.user.role === "admin";
  const [rows, setRows] = useState<Recipient[] | null>(null);
  const [view, setView] = useState<View>("pending");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (data) setRows(data.recipients);
  }, [data]);

  const counts = useMemo(() => {
    const c = { pending: 0, sent: 0, skipped: 0 };
    for (const r of rows || []) c[r.status]++;
    return c;
  }, [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) => r.status === view && (!t || [r.student_name, r.parent_name, r.phone, r.class_sec].some((v) => (v || "").toLowerCase().includes(t))));
  }, [rows, view, q]);

  const message = data?.message;
  if (!message || !rows) {
    if (error && error.status !== 401) return error.status === 404 ? <Empty>{L({ hi: "यह मैसेज नहीं मिला।", en: "This message was not found." })}</Empty> : <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={6} />;
  }
  const total = counts.pending + counts.sent;
  const pct = total ? Math.round((counts.sent / total) * 100) : 0;
  const next = rows.find((r) => r.status === "pending");

  async function setStatus(r: Recipient, status: "sent" | "pending") {
    setRows((prev) => (prev || []).map((x) => (x.id === r.id ? { ...x, status, sent_at: status === "sent" ? new Date().toISOString() : null } : x)));
    try {
      await api(`/erp/messages/${message!.id}/recipients/${r.id}`, { body: { status } });
    } catch (e) {
      setRows((prev) => (prev || []).map((x) => (x.id === r.id ? r : x)));
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    }
  }
  const send = (r: Recipient) => {
    window.open(whatsappUrl(r.phone, r.text), "_blank", "noopener");
    setStatus(r, "sent");
  };
  async function copyNumbers() {
    try {
      await navigator.clipboard.writeText(rows!.filter((r) => r.status === "pending").map((r) => r.phone).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(false, L({ hi: "कॉपी नहीं हुआ। नंबर हाथ से चुनें।", en: "Could not copy. Select the numbers by hand." }));
    }
  }
  async function remove() {
    setDeleting(true);
    try {
      await api(`/erp/messages/${message!.id}`, { method: "DELETE" });
      toast(true, L({ hi: "मैसेज हटा दिया।", en: "Message deleted." }));
      window.location.replace("/erp/messages/");
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "नहीं हटा।", en: "Could not delete." }));
      setDeleting(false);
    }
  }

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div>
        <p className="text-[18px] font-bold">{message.title}</p>
        <p className="text-[12.5px] text-ink-500">
          {message.audience_label} · {when(message.created_at)}
          {message.created_by_name ? ` · ${message.created_by_name.split(" (")[0]}` : ""}
        </p>
      </div>

      <section className="today-card space-y-3 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12.5px] text-ink-500">{L({ hi: "भेजे", en: "Sent" })}</p>
            <p className="tnum text-[24px] font-extrabold">
              {counts.sent.toLocaleString("en-IN")} <span className="text-[15px] font-semibold text-ink-400">/ {total.toLocaleString("en-IN")}</span>
            </p>
          </div>
          {!next && (
            <span className="flex items-center gap-1 text-[13.5px] font-semibold text-jade-700">
              <Check className="h-4 w-4" aria-hidden /> {L({ hi: "सबको मिल गया", en: "Everyone has it" })}
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-jade-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {next && (
          <button type="button" onClick={() => send(next)} className="btn-primary w-full !bg-[#1FA855]">
            <MessageCircle className="h-4 w-4" aria-hidden /> {L({ hi: "अगला भेजें:", en: "Send next:" })} {next.student_name.split(/,| और | and /)[0]}
          </button>
        )}
        <p className="text-[12.5px] leading-relaxed text-ink-500">{L({ hi: "WhatsApp मैसेज लिखकर खुलेगा। वहाँ भेजें दबाएँ, फिर अगले के लिए यहाँ लौटें। हर एक यहाँ टिक होता जाएगा।", en: "WhatsApp opens with the message typed in. Press send there, then come back for the next parent. Each one is ticked off here as you go." })}</p>
      </section>

      <details className="rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
        <summary className="cursor-pointer text-[14.5px] font-semibold">{L({ hi: "मैसेज", en: "Message text" })}</summary>
        <p lang={message.lang} className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-700">
          {message.body}
        </p>
      </details>

      <LineTabs
        label={L({ hi: "माता-पिता", en: "Parents" })}
        value={view}
        onChange={setView}
        options={[
          { key: "pending", text: `${L({ hi: "भेजना है", en: "To send" })} ${counts.pending}` },
          { key: "sent", text: `${L({ hi: "भेजे", en: "Sent" })} ${counts.sent}` },
          { key: "skipped", text: `${L({ hi: "नंबर नहीं", en: "No number" })} ${counts.skipped}` },
        ]}
      />
      <div className="flex gap-2">
        <label className="field-box min-h-[46px] flex-1">
          <Search aria-hidden />
          <input id="msg-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, कक्षा या मोबाइल", en: "Name, class or mobile" })} autoComplete="off" />
        </label>
        {view === "pending" && counts.pending > 0 && (
          <button type="button" onClick={copyNumbers} className="btn-line shrink-0 px-3 text-[13px]">
            {copied ? <Check className="h-4 w-4 text-jade-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? L({ hi: "कॉपी हुआ", en: "Copied" }) : L({ hi: "नंबर कॉपी", en: "Copy numbers" })}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <Empty>{q ? L({ hi: "कोई नहीं मिला।", en: "Nobody matches." }) : view === "pending" ? L({ hi: "भेजने को कोई नहीं बचा।", en: "Nobody left to send to." }) : view === "sent" ? L({ hi: "अभी कोई नहीं भेजा।", en: "None sent yet." }) : L({ hi: "इस समूह में सबका मोबाइल है।", en: "Every child in this group has a mobile number." })}</Empty>
      ) : (
        <ul>
          {shown.slice(0, 400).map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-ink-100 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{r.student_name}</p>
                <p className="truncate text-[12.5px] text-ink-500">
                  {r.class_sec}
                  {r.parent_name && ` · ${r.parent_name}`}
                  {r.phone && <span className="tnum"> · {r.phone}</span>}
                  {r.status === "sent" && r.sent_at && <span> · {when(r.sent_at)}</span>}
                </p>
              </div>
              {r.status === "pending" && (
                <button type="button" onClick={() => send(r)} className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-[13px] font-semibold">
                  <MessageCircle className="h-4 w-4 text-[#1FA855]" aria-hidden /> WhatsApp
                </button>
              )}
              {r.status === "sent" && (
                <button type="button" onClick={() => setStatus(r, "pending")} className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-[13px] font-semibold text-ink-600">
                  <Undo2 className="h-4 w-4" aria-hidden /> {L({ hi: "वापस", en: "Undo" })}
                </button>
              )}
            </li>
          ))}
          {shown.length > 400 && <li className="py-3 text-center text-[12.5px] text-ink-500">{L({ hi: `${shown.length} में से 400 दिख रहे। खोजकर ढूँढें।`, en: `Showing 400 of ${shown.length}. Search to find someone.` })}</li>}
        </ul>
      )}

      {canDelete &&
        (confirmDelete ? (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-[14px]">
            <span className="flex-1">{L({ hi: "हमेशा के लिए हटाएँ?", en: "Delete for good?" })}</span>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-line min-h-[38px] px-3">
              {L({ hi: "रखें", en: "Keep" })}
            </button>
            <button type="button" onClick={remove} disabled={deleting} className="btn-primary min-h-[38px] !bg-rose-600 px-3">
              {deleting ? "…" : L({ hi: "हटाएँ", en: "Delete" })}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className={clsx("flex min-h-[40px] items-center gap-1.5 text-[13.5px] font-semibold text-rose-600")}>
            <Trash2 className="h-4 w-4" aria-hidden /> {L({ hi: "मैसेज हटाएँ", en: "Delete message" })}
          </button>
        ))}
    </div>
  );
}
