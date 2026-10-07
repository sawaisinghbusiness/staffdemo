"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { dayMonth } from "@/lib/format";
import { BackLink, ErrorCard, Skeleton } from "@/components/ui";

interface Req {
  id: string;
  student: string;
  classSec: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  parentPhone: string;
  status: "pending" | "approved" | "rejected";
}

export default function RequestsPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<{ requests: Req[] }>("/leave-requests");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-64 w-full" />;
  const pending = data.requests.filter((r) => r.status === "pending");
  const done = data.requests.filter((r) => r.status !== "pending");

  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(id);
    setMsg("");
    try {
      await api("/leave-requests", { body: { id, status } });
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError && e.message ? e.message : L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    } finally {
      setBusy("");
    }
  }

  const dates = (r: Req) => `${dayMonth(r.from, lang)}${r.to !== r.from ? ` – ${dayMonth(r.to, lang)}` : ""} · ${r.days} ${L({ hi: "दिन", en: r.days === 1 ? "day" : "days" })}`;

  return (
    <div className="animate-rise space-y-3">
      <BackLink href="/me/" text={L({ hi: "मेरा", en: "Me" })} />
      <h1 className="text-xl font-bold">{L({ hi: "बच्चों की छुट्टी की अर्ज़ियाँ", en: "Students' leave applications" })}</h1>
      {msg && (
        <p className="font-medium text-rose-700" role="alert">
          {msg}
        </p>
      )}

      <section className="card p-4">
        <p className="card-title">{L({ hi: "जवाब का इंतज़ार", en: "Waiting for your answer" })}</p>
        {pending.length === 0 ? (
          <p className="mt-1 text-ink-600">{L({ hi: "कोई अर्ज़ी बाकी नहीं।", en: "Nothing is waiting." })}</p>
        ) : (
          <ul className="mt-1 divide-y divide-ink-100">
            {pending.map((r) => (
              <li key={r.id} className="py-3 first:pt-2 last:pb-0">
                <p className="font-semibold text-ink-900">
                  {r.student} <span className="font-normal text-ink-500">· {r.classSec}</span>
                </p>
                <p className="text-sm text-ink-600">{dates(r)}</p>
                <p className="mt-1 text-ink-800">{r.reason}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => decide(r.id, "rejected")} disabled={busy === r.id} className="btn-quiet text-rose-700">
                    <X className="h-5 w-5" aria-hidden /> {L({ hi: "नामंज़ूर", en: "Reject" })}
                  </button>
                  <button onClick={() => decide(r.id, "approved")} disabled={busy === r.id} className="btn-primary">
                    <Check className="h-5 w-5" aria-hidden /> {L({ hi: "मंज़ूर", en: "Approve" })}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="card p-4">
          <p className="card-title">{L({ hi: "जवाब दिए गए", en: "Answered" })}</p>
          <ul className="mt-1 divide-y divide-ink-100">
            {done.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{r.student}</p>
                  <p className="text-sm text-ink-500">{dates(r)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-sm font-semibold text-ink-700">
                  <span className={clsx("dot h-2 w-2", r.status === "approved" ? "bg-jade-600" : "bg-rose-500")} aria-hidden />
                  {L(r.status === "approved" ? { hi: "मंज़ूर", en: "Approved" } : { hi: "नामंज़ूर", en: "Rejected" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
