"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, LineTabs, ListSkeleton, Sheet } from "@/components/ui";

/*
 * ERP login → Meetings & PTM: the ERP's page (GET/DELETE /api/meetings). Parents see these in the parent app;
 * for a PTM they pick a free time, for other meetings they answer if they will come. + makes a new one.
 * Look (user, 2026-10-26): Upcoming / Past, a date block per meeting, and "Who booked" in a bottom sheet
 * (the old in-card list jumped as it opened).
 */

interface Booked {
  time: string;
  student: string;
}
interface Meeting {
  id: string;
  title: string;
  kind: "general" | "ptm";
  host: string | null;
  date: string;
  start: string;
  end: string;
  place: string | null;
  onlineUrl: string | null;
  agenda: string | null;
  slotMinutes: number | null;
  audience: string;
  yes: number;
  no: number;
  booked: Booked[];
  slotCount: number;
}

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const ampm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dayPart = (iso: string, part: "weekday" | "day" | "month") => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { [part]: part === "day" ? "numeric" : "short" }).toUpperCase();

export default function ErpMeetingsPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ setupNeeded: boolean; data: Meeting[] }>("/erp/meetings");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const canManage = ["admin", "teacher"].includes(who.data?.user.role || "");
  const [booked, setBooked] = useState<Meeting | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancelling, setCancelling] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState(false);
  const t = todayIST();
  const rows = data?.data;
  const upcoming = useMemo(() => (rows || []).filter((m) => m.date >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [rows, t]);
  const past = useMemo(() => (rows || []).filter((m) => m.date < t).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)), [rows, t]);
  const shown = tab === "upcoming" ? upcoming : past;

  async function cancel() {
    if (!cancelling || !canManage) return;
    setBusy(true);
    try {
      await api(`/erp/meetings/${cancelling.id}`, { method: "DELETE" });
      toast(true, L({ hi: "मीटिंग रद्द हुई।", en: "Meeting cancelled." }));
      setCancelling(null);
      reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "रद्द नहीं हुई।", en: "Could not cancel." }));
    } finally {
      setBusy(false);
    }
  }

  if (data?.setupNeeded) return <Empty>{L({ hi: "मीटिंग के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261012_meetings.sql)।", en: "Meetings need a one-time database setup (20261012_meetings.sql)." })}</Empty>;

  return (
    <div className="animate-rise space-y-3 pb-4">
      {!rows ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} slow={error.message === "timeout"} onRetry={reload} /> : <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <Empty>{L({ hi: "अभी कोई मीटिंग नहीं। ऊपर + से PTM या मीटिंग बनाएँ; माता-पिता को ऐप में दिखेगी।", en: "No meetings yet. Make a PTM or a meeting with + above; parents see it in their app." })}</Empty>
      ) : (
        <>
          <LineTabs
            label={L({ hi: "मीटिंग", en: "Meetings" })}
            value={tab}
            onChange={setTab}
            options={[
              { key: "upcoming", text: `${L({ hi: "आने वाली", en: "Upcoming" })} ${upcoming.length}` },
              { key: "past", text: `${L({ hi: "हो चुकी", en: "Past" })} ${past.length}` },
            ]}
          />
          {shown.length === 0 && <Empty>{tab === "upcoming" ? L({ hi: "कोई आने वाली मीटिंग नहीं।", en: "No upcoming meetings." }) : L({ hi: "कोई पुरानी मीटिंग नहीं।", en: "No past meetings." })}</Empty>}
          <ul className="space-y-2.5">
            {shown.map((m) => {
              const over = m.date < t;
              const pct = m.slotCount ? Math.round((m.booked.length / m.slotCount) * 100) : 0;
              const where = [m.place, m.onlineUrl ? L({ hi: "ऑनलाइन", en: "Online" }) : null].filter(Boolean).join(" · ");
              return (
                <li key={m.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
                  <div className="flex gap-3 px-3.5 pb-3 pt-3.5">
                    <span className={clsx("flex w-[52px] shrink-0 flex-col items-center justify-center rounded-xl py-1.5", over ? "bg-ink-100 text-ink-700" : "bg-[#E8EFF7] text-[#0D2A5E]")}>
                      <small className="text-[11px] font-semibold">{dayPart(m.date, "weekday")}</small>
                      <b className="tnum text-[20px] font-extrabold leading-tight">{dayPart(m.date, "day")}</b>
                      <small className="text-[11px] font-semibold">{dayPart(m.date, "month")}</small>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <b className="text-[16px] font-semibold leading-snug">{m.title}</b>
                      <span className="text-[13.5px] text-ink-600">
                        {ampm(m.start)} – {ampm(m.end)}
                        {where ? ` · ${where}` : ""}
                      </span>
                      <span className="truncate text-[13.5px] text-ink-600">
                        {m.audience}
                        {m.host ? ` · ${m.host}` : ""}
                      </span>
                    </span>
                  </div>
                  {m.agenda && <p className="mx-3.5 mb-3 whitespace-pre-line rounded-xl bg-ink-50 px-3 py-2 text-[13.5px] text-ink-700">{m.agenda}</p>}
                  <div className="px-3.5 pb-3">
                    {m.kind === "ptm" ? (
                      <>
                        <div className="mb-1.5 flex justify-between text-[12.5px] text-ink-600">
                          <span>{L({ hi: "माता-पिता ने बुक किया", en: "Parents booked" })}</span>
                          <b className="tnum text-ink-900">{L({ hi: `${m.slotCount} में से ${m.booked.length}`, en: `${m.booked.length} of ${m.slotCount} slots` })}</b>
                        </div>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                          <span className="block h-full rounded-full bg-[#0D2A5E]" style={{ width: `${pct}%` }} />
                        </span>
                      </>
                    ) : (
                      <p className="text-[13.5px] font-semibold text-ink-800">{L({ hi: `${m.yes} आएँगे · ${m.no} नहीं आ पाएँगे`, en: `${m.yes} coming · ${m.no} can't` })}</p>
                    )}
                  </div>
                  {((m.kind === "ptm" && m.booked.length > 0) || (!over && canManage)) && (
                    <div className="flex border-t border-ink-100">
                      {m.kind === "ptm" && m.booked.length > 0 && (
                        <button type="button" onClick={() => setBooked(m)} className="min-h-[46px] flex-1 text-[14px] font-semibold text-ink-900 active:bg-ink-50">
                          {L({ hi: "किसने बुक किया", en: "Who booked" })}
                        </button>
                      )}
                      {!over && canManage && (
                        <button type="button" onClick={() => setCancelling(m)} aria-label={`${L({ hi: "रद्द करें", en: "Cancel" })} ${m.title}`} className="min-h-[46px] flex-1 border-l border-ink-100 text-[14px] font-semibold text-rose-700 first:border-l-0 active:bg-ink-50">
                          {L({ hi: "रद्द करें", en: "Cancel" })}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {booked && (
        <Sheet title={L({ hi: `किसने बुक किया · ${booked.booked.length}`, en: `Who booked · ${booked.booked.length}` })} onClose={() => setBooked(null)}>
          <p className="-mt-1 mb-2 text-[13px] text-ink-600">{L({ hi: `${booked.slotCount - booked.booked.length} समय अभी खाली`, en: `${booked.slotCount - booked.booked.length} times still free` })}</p>
          <ul>
            {[...booked.booked]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((b) => (
                <li key={b.time} className="flex min-h-[52px] items-center gap-3 border-b border-ink-100 last:border-b-0">
                  <b className="tnum w-[76px] shrink-0 text-[14px] font-semibold">{ampm(b.time)}</b>
                  <span className="min-w-0 truncate text-[15px]">{b.student}</span>
                </li>
              ))}
          </ul>
        </Sheet>
      )}

      {cancelling && (
        <Sheet title={L({ hi: `"${cancelling.title}" रद्द करें?`, en: `Cancel "${cancelling.title}"?` })} onClose={() => !busy && setCancelling(null)}>
          <p className="mb-4 text-[14.5px] text-ink-600">{L({ hi: "माता-पिता को यह दिखना बंद हो जाएगा।", en: "Parents will stop seeing it." })}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setCancelling(null)} disabled={busy} className="btn-line">
              {L({ hi: "रखें", en: "Keep" })}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className="btn-primary !bg-rose-600">
              {busy ? "…" : L({ hi: "रद्द करें", en: "Cancel meeting" })}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
