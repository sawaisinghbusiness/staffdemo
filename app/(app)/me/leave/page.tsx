"use client";

import { useState } from "react";
import clsx from "clsx";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { dayMonth } from "@/lib/format";
import { BackLink, ErrorCard, Skeleton } from "@/components/ui";

interface Row {
  id: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
}
interface Data {
  rules: { today: string; minFrom: string; maxFrom: string };
  requests: Row[];
}
const DOT = { pending: "bg-marigold-500", approved: "bg-jade-600", rejected: "bg-rose-500" };

export default function MyLeavePage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Data>("/my/leave");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-64 w-full" />;
  const day = from || data.rules.today;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/my/leave", { body: { from: day, to: to || day, reason } });
      setReason("");
      setFrom("");
      setTo("");
      setMsg({ ok: true, text: L({ hi: "अर्ज़ी भेज दी गई।", en: "Application sent." }) });
      reload();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.message ? err.message : L({ hi: "भेजा नहीं जा सका।", en: "Could not send." }) });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await api(`/my/leave/${id}`, { method: "DELETE" }).catch(() => null);
    reload();
  }

  return (
    <div className="animate-rise space-y-3">
      <BackLink href="/me/" text={L({ hi: "मेरा", en: "Me" })} />
      <h1 className="text-xl font-bold">{L({ hi: "मेरी छुट्टी की अर्ज़ी", en: "My leave" })}</h1>

      <form onSubmit={send} className="card space-y-3 p-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "किस दिन से", en: "From" })}</span>
            <input type="date" value={day} min={data.rules.minFrom} max={data.rules.maxFrom} onChange={(e) => { setFrom(e.target.value); if (to && to < e.target.value) setTo(""); }} className="field" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "किस दिन तक", en: "To" })}</span>
            <input type="date" value={to || day} min={day} max={data.rules.maxFrom} onChange={(e) => setTo(e.target.value)} className="field" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "छुट्टी का कारण", en: "Reason" })}</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className="field py-3" />
        </label>
        {msg && (
          <p className={clsx("font-medium", msg.ok ? "text-jade-700" : "text-rose-700")} role="alert">
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "अर्ज़ी भेजें", en: "Send application" })}
        </button>
      </form>

      <section className="card p-4">
        <p className="card-title">{L({ hi: "पिछली अर्ज़ियाँ", en: "Earlier applications" })}</p>
        {data.requests.length === 0 ? (
          <p className="mt-1 text-ink-600">{L({ hi: "अभी तक कोई अर्ज़ी नहीं भेजी।", en: "No applications yet." })}</p>
        ) : (
          <ul className="mt-1 divide-y divide-ink-100">
            {data.requests.map((r) => (
              <li key={r.id} className="py-3 first:pt-2 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink-900">
                    {dayMonth(r.from, lang)}
                    {r.to !== r.from ? ` – ${dayMonth(r.to, lang)}` : ""} · {r.days} {L({ hi: "दिन", en: r.days === 1 ? "day" : "days" })}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-sm font-semibold text-ink-700">
                    <span className={clsx("dot h-2 w-2", DOT[r.status])} aria-hidden />
                    {L(r.status === "pending" ? { hi: "इंतज़ार में", en: "Waiting" } : r.status === "approved" ? { hi: "मंज़ूर", en: "Approved" } : { hi: "नामंज़ूर", en: "Rejected" })}
                  </span>
                </div>
                <p className="mt-0.5 text-ink-700">{r.reason}</p>
                {r.status === "pending" && (
                  <button onClick={() => cancel(r.id)} className="link text-sm text-rose-700">
                    {L({ hi: "अर्ज़ी वापस लें", en: "Withdraw" })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
