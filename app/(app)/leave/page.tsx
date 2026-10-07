"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarX2, Clock3, Plus } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang, type Lang } from "@/lib/i18n";
import { monthYear, num, weekdayDate } from "@/lib/format";
import { LEAVE_TYPES, type LeaveType } from "@/lib/leave";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton, Status, type Tone } from "@/components/ui";

type St = "pending" | "approved" | "rejected";
interface Mine {
  id: string;
  from: string;
  to: string;
  days: number;
  type?: LeaveType | null;
  halfDay?: boolean;
  reason: string;
  status: St;
}
interface Req {
  id: string;
  student: string;
  classSec: string;
  from: string;
  to: string;
  days: number;
  type?: LeaveType | null;
  halfDay?: boolean;
  reason: string;
  parentPhone: string;
  status: St;
}

const TONE: Record<St, Tone> = { pending: "wait", approved: "ok", rejected: "bad" };
const WORD: Record<St, { hi: string; en: string }> = {
  pending: { hi: "इंतज़ार में", en: "Waiting" },
  approved: { hi: "मंज़ूर", en: "Approved" },
  rejected: { hi: "नामंज़ूर", en: "Not approved" },
};
const range = (from: string, to: string, lang: Lang) => (from === to ? weekdayDate(from, lang) : `${weekdayDate(from, lang)} – ${weekdayDate(to, lang)}`);

type Tab = "mine" | "requests";

/** Own leave (everyone), and for teachers the parents' leave requests to approve. */
export default function LeavePage() {
  const { me } = useStaff();
  const L = useL();
  const [tab, setTab] = useState<Tab>("mine");
  const teacher = me?.role === "teacher";
  const reqs = useApi<{ requests: Req[] }>(teacher ? "/leave-requests" : null);
  const waiting = reqs.data?.requests.filter((r) => r.status === "pending").length || 0;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "requests") setTab("requests");
  }, []);

  return (
    <div className="animate-rise space-y-4">
      {teacher && (
        <LineTabs
          label={L({ hi: "छुट्टी", en: "Leave" })}
          value={tab}
          onChange={setTab}
          options={[
            { key: "mine", text: L({ hi: "मेरी छुट्टी", en: "My leave" }) },
            { key: "requests", text: `${L({ hi: "अर्ज़ियाँ", en: "Requests" })}${waiting ? ` (${waiting})` : ""}` },
          ]}
        />
      )}
      {teacher && tab === "requests" ? <Requests data={reqs.data} error={reqs.error} reload={reqs.reload} /> : <MyLeave />}
    </div>
  );
}

function MyLeave() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<{ requests: Mine[] }>("/my/leave");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sent") === "1") {
      setSent(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Mine[]>();
    for (const q of (data?.requests || []).slice().sort((a, b) => b.from.localeCompare(a.from))) m.set(q.from.slice(0, 7), [...(m.get(q.from.slice(0, 7)) || []), q]);
    return Array.from(m.entries());
  }, [data]);

  async function cancel(id: string) {
    if (!window.confirm(L({ hi: "यह अर्ज़ी वापस लें?", en: "Withdraw this application?" }))) return;
    await api(`/my/leave/${id}`, { method: "DELETE" }).catch(() => null);
    reload();
  }

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton />;
  }

  return (
    <div className="space-y-3">
      {sent && <p className="rounded-xl bg-jade-50 px-3.5 py-2.5 text-[14px] font-medium text-jade-800">{L({ hi: "अर्ज़ी भेज दी गई। ऑफ़िस जवाब देगा।", en: "Application sent. The office will answer." })}</p>}
      {groups.length === 0 ? (
        <>
          <Empty>{L({ hi: "अभी तक कोई अर्ज़ी नहीं भेजी।", en: "No applications yet." })}</Empty>
          <Link href="/leave/apply/" className="btn-primary w-full">
            <Plus className="h-5 w-5" aria-hidden /> {L({ hi: "छुट्टी की अर्ज़ी भेजें", en: "Apply for leave" })}
          </Link>
        </>
      ) : (
        groups.map(([month, list]) => (
          <section key={month} className="space-y-2">
            <h2 className="mlabel">{monthYear(month, lang)}</h2>
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.id} className="row-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-bold leading-snug">{range(r.from, r.to, lang)}</p>
                    <Status tone={TONE[r.status]}>{L(WORD[r.status])}</Status>
                  </div>
                  <p className="meta mt-1.5">
                    <span>
                      <CalendarX2 aria-hidden />
                      {r.type ? L(LEAVE_TYPES[r.type]) : L({ hi: "छुट्टी", en: "Leave" })}
                    </span>
                    <span>
                      <Clock3 aria-hidden />
                      {r.halfDay ? L({ hi: "आधा दिन", en: "Half day" }) : r.days === 1 ? L({ hi: "पूरा दिन", en: "Full day" }) : `${num(r.days)} ${L({ hi: "दिन", en: "days" })}`}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[14px] text-ink-700">{r.reason}</p>
                  {r.status === "pending" && (
                    <button onClick={() => cancel(r.id)} className="link -mb-2 text-[14px] !text-ink-500">
                      {L({ hi: "अर्ज़ी वापस लें", en: "Withdraw" })}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Requests({ data, error, reload }: { data?: { requests: Req[] }; error: ApiError | null; reload: () => void }) {
  const L = useL();
  const { lang } = useLang();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton />;
  }
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

  const when = (r: Req) => `${range(r.from, r.to, lang)} · ${r.halfDay ? L({ hi: "आधा दिन", en: "Half day" }) : `${num(r.days)} ${L({ hi: "दिन", en: r.days === 1 ? "day" : "days" })}`}`;

  return (
    <div className="space-y-4">
      {msg && (
        <p className="text-[14px] font-medium text-rose-700" role="alert">
          {msg}
        </p>
      )}
      {pending.length === 0 ? (
        <Empty>{L({ hi: "कोई अर्ज़ी जवाब के इंतज़ार में नहीं।", en: "Nothing is waiting for you." })}</Empty>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li key={r.id} className="row-card">
              <div className="flex items-center gap-2.5">
                <Avatar name={r.student} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{r.student}</p>
                  <p className="text-[12.5px] text-ink-500">
                    {r.classSec} · {when(r)}
                    {r.type ? ` · ${L(LEAVE_TYPES[r.type])}` : ""}
                  </p>
                </div>
              </div>
              <p className="mb-3 mt-2 text-[14px]">{r.reason}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => decide(r.id, "approved")} disabled={busy === r.id} className="btn-primary min-h-[44px]">
                  {L({ hi: "मंज़ूर", en: "Approve" })}
                </button>
                <button onClick={() => decide(r.id, "rejected")} disabled={busy === r.id} className="btn-line min-h-[44px]">
                  {L({ hi: "नामंज़ूर", en: "Not approve" })}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="mlabel">{L({ hi: "जवाब दिए गए", en: "Answered" })}</h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.id} className="row-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{r.student}</p>
                  <p className="text-[12.5px] text-ink-500">{when(r)}</p>
                </div>
                <Status tone={TONE[r.status]}>{L(WORD[r.status])}</Status>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
