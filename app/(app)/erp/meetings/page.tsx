"use client";

import { useState } from "react";
import clsx from "clsx";
import { CalendarClock, Clock3, MapPin, Trash2, Users, Video } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, ListSkeleton, Sheet } from "@/components/ui";

/*
 * ERP login → Meetings & PTM: the ERP's page (GET/DELETE /api/meetings). Parents see these in the parent app;
 * for a PTM they pick a free time, for other meetings they answer if they will come. + makes a new one.
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
const dayLong = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default function ErpMeetingsPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ setupNeeded: boolean; data: Meeting[] }>("/erp/meetings");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState(false);
  const t = todayIST();
  const rows = data?.data;

  async function cancel() {
    if (!cancelling) return;
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
      <p className="text-[13px] text-ink-500">{L({ hi: "माता-पिता पेरेंट ऐप में देखते हैं। PTM में वे खाली समय चुनते हैं; बाकी मीटिंग में बताते हैं कि आएँगे या नहीं।", en: "Parents see these in the parent app. For a PTM they pick a free time; for other meetings they answer if they will come." })}</p>
      {!rows ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <Empty>{L({ hi: "अभी कोई मीटिंग नहीं। ऊपर + से PTM या मीटिंग बनाएँ; माता-पिता को ऐप में दिखेगी।", en: "No meetings yet. Make a PTM or a meeting with + above; parents see it in their app." })}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((m) => {
            const over = m.date < t;
            return (
              <li key={m.id} className={clsx("rounded-2xl border border-ink-100 bg-white px-3.5 py-3", over && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    {m.kind === "ptm" ? <Users className="h-5 w-5" aria-hidden /> : <CalendarClock className="h-5 w-5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15.5px] font-semibold">
                      {m.title}
                      {over && <span className="ml-2 text-[12px] font-medium text-ink-400">{L({ hi: "हो चुकी", en: "Over" })}</span>}
                    </p>
                    <p className="meta mt-0.5">
                      <span>
                        <Clock3 aria-hidden />
                        {dayLong(m.date)} · {ampm(m.start)} – {ampm(m.end)}
                      </span>
                    </p>
                    <p className="meta mt-0.5">
                      <span>{m.audience}</span>
                      {m.host && <span>{m.host}</span>}
                      {m.place && (
                        <span>
                          <MapPin aria-hidden />
                          {m.place}
                        </span>
                      )}
                      {m.onlineUrl && (
                        <span>
                          <Video aria-hidden />
                          {L({ hi: "ऑनलाइन", en: "Online" })}
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-[13.5px] font-semibold text-ink-800">
                      {m.kind === "ptm" ? L({ hi: `${m.slotCount} में से ${m.booked.length} समय बुक`, en: `${m.booked.length} of ${m.slotCount} times booked` }) : L({ hi: `${m.yes} आएँगे · ${m.no} नहीं आ पाएँगे`, en: `${m.yes} coming · ${m.no} can't` })}
                    </p>
                  </div>
                </div>
                {m.agenda && <p className="mt-2 whitespace-pre-line rounded-xl bg-ink-50 px-3 py-2 text-[13.5px] text-ink-700">{m.agenda}</p>}
                <div className="mt-2 flex gap-2">
                  {m.kind === "ptm" && m.booked.length > 0 && (
                    <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="btn-line min-h-[38px] flex-1 text-[13.5px]">
                      {open === m.id ? L({ hi: "सूची छिपाएँ", en: "Hide list" }) : L({ hi: "किसने बुक किया", en: "Who booked" })}
                    </button>
                  )}
                  {!over && (
                    <button type="button" onClick={() => setCancelling(m)} aria-label={`${L({ hi: "रद्द करें", en: "Cancel" })} ${m.title}`} className="btn-line min-h-[38px] px-3 text-[13.5px] text-rose-600">
                      <Trash2 className="h-4 w-4" aria-hidden /> {L({ hi: "रद्द", en: "Cancel" })}
                    </button>
                  )}
                </div>
                {open === m.id && (
                  <ul className="mt-2 space-y-1 rounded-xl bg-ink-50 p-3 text-[13.5px]">
                    {m.booked.map((b) => (
                      <li key={b.time} className="flex gap-3">
                        <span className="tnum w-[72px] shrink-0 font-semibold">{ampm(b.time)}</span>
                        <span className="min-w-0 truncate text-ink-600">{b.student}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
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
