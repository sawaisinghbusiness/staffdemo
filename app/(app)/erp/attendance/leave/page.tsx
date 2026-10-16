"use client";

import { useState } from "react";
import { Check, Phone, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, LineTabs, ListSkeleton, Status, type Tone } from "@/components/ui";

/*
 * ERP login → Attendance → Leave requests: the ERP's page (GET /api/leave-requests, POST …/:id/decide).
 * Leave applications parents send from the parent app; the admin and teachers approve or reject.
 * Approving only records the answer: attendance is still marked as usual.
 */

type St = "pending" | "approved" | "rejected";
interface LeaveRequest {
  id: string;
  studentId: string;
  name: string;
  classSec: string;
  rollNo: string;
  fatherName: string;
  parentPhone: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: St;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}
interface ListResult {
  setupNeeded: boolean;
  pending: number;
  data: LeaveRequest[];
}
type Filter = "pending" | "decided";

const TEXT: Record<St, Bi> = { pending: { hi: "जवाब बाकी", en: "Waiting" }, approved: { hi: "मंज़ूर", en: "Approved" }, rejected: { hi: "नामंज़ूर", en: "Rejected" } };
const TONE: Record<St, Tone> = { pending: "wait", approved: "ok", rejected: "bad" };
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const dayLong = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const range = (r: LeaveRequest) => (r.from === r.to ? dayLong(r.from) : `${day(r.from)} – ${day(r.to)}`);
const phone = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

export default function ErpLeaveRequestsPage() {
  const L = useL();
  const [filter, setFilter] = useState<Filter>("pending");
  const { data: res, error, reload } = useApi<ListResult>(`/erp/leave-requests?filter=${filter}`);
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const canDecide = ["admin", "teacher"].includes(who.data?.user.role || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  const sentAgo = (iso: string) => {
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 60) return L({ hi: `${Math.max(1, mins)} मिनट पहले`, en: `${Math.max(1, mins)} min ago` });
    if (mins < 24 * 60) return L({ hi: `${Math.round(mins / 60)} घंटे पहले`, en: `${Math.round(mins / 60)} h ago` });
    return day(iso.slice(0, 10));
  };

  async function decide(r: LeaveRequest, status: "approved" | "rejected") {
    setBusy(r.id + status);
    try {
      await api(`/erp/leave-requests/${r.id}/decide`, { body: { status } });
      toast(true, L({ hi: `${r.name}: छुट्टी ${status === "approved" ? "मंज़ूर" : "नामंज़ूर"}।`, en: `${r.name}: leave ${status}.` }));
      setGone((g) => new Set(g).add(r.id));
      reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      reload();
    } finally {
      setBusy(null);
    }
  }

  if (res?.setupNeeded) return <Empty>{L({ hi: "छुट्टी की अर्ज़ियों के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261006_parent_app.sql)।", en: "Leave requests need a one-time database setup (20261006_parent_app.sql)." })}</Empty>;
  const list = (res?.data || []).filter((r) => !(filter === "pending" && gone.has(r.id)));

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "माता-पिता पेरेंट ऐप से भेजते हैं। मंज़ूर करने से हाज़िरी नहीं लगती; रजिस्टर में उस दिन L हमेशा की तरह लगाएँ।", en: "Sent by parents from the parent app. Approving does not mark attendance; mark the day as Leave in the register as usual." })}</p>
      <LineTabs
        label={L({ hi: "दिखाएँ", en: "Show" })}
        value={filter}
        onChange={setFilter}
        options={[
          { key: "pending", text: `${L({ hi: "जवाब बाकी", en: "Waiting" })}${res && filter === "pending" && list.length ? ` ${list.length}` : ""}` },
          { key: "decided", text: L({ hi: "जवाब दिया", en: "Answered" }) },
        ]}
      />
      {!res ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <Empty>{filter === "pending" ? L({ hi: "कोई अर्ज़ी जवाब के लिए नहीं। माता-पिता पेरेंट ऐप से छुट्टी माँगते हैं।", en: "No leave requests waiting. Parents apply for leave from the parent app." }) : L({ hi: "अभी किसी अर्ज़ी का जवाब नहीं दिया।", en: "No answered leave requests yet." })}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => (
            <li key={r.id} className="space-y-2 rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold">{r.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-500">
                    {r.classSec}
                    {r.rollNo ? ` · ${L({ hi: "रोल", en: "Roll" })} ${r.rollNo}` : ""}
                    {r.fatherName ? ` · ${r.fatherName}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-[14.5px] font-semibold">{range(r)}</span>
                  <span className="block text-[12px] text-ink-500">
                    {r.days} {L({ hi: "दिन", en: r.days === 1 ? "day" : "days" })}
                  </span>
                </span>
              </div>
              <p className="whitespace-pre-line break-words rounded-xl bg-ink-50 px-3 py-2 text-[14.5px] text-ink-800">{r.reason}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-500">
                {r.parentPhone && (
                  <a href={`tel:${r.parentPhone}`} className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-brand-600">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {phone(r.parentPhone)}
                  </a>
                )}
                <span>
                  {L({ hi: "भेजी", en: "sent" })} {sentAgo(r.createdAt)}
                </span>
                {r.status !== "pending" && (
                  <>
                    <Status tone={TONE[r.status]}>{L(TEXT[r.status])}</Status>
                    {r.decidedBy && (
                      <span>
                        {r.decidedBy}
                        {r.decidedAt ? ` · ${day(r.decidedAt.slice(0, 10))}` : ""}
                      </span>
                    )}
                  </>
                )}
              </div>
              {r.status === "pending" && canDecide && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={!!busy} onClick={() => decide(r, "rejected")} className="btn-line min-h-[44px]">
                    <X className="h-4 w-4 text-rose-600" aria-hidden /> {busy === r.id + "rejected" ? "…" : L({ hi: "नामंज़ूर", en: "Reject" })}
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => decide(r, "approved")} className="btn-primary min-h-[44px]">
                    <Check className="h-4 w-4" aria-hidden /> {busy === r.id + "approved" ? "…" : L({ hi: "मंज़ूर", en: "Approve" })}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {res && who.data && !canDecide && filter === "pending" && list.length > 0 && <p className="text-[13px] text-ink-500">{L({ hi: "सिर्फ़ एडमिन और टीचर मंज़ूर या नामंज़ूर कर सकते हैं।", en: "Only the admin and teachers can approve or reject leave." })}</p>}
    </div>
  );
}
