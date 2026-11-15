"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { Avatar, Empty, ErrorCard, ListSkeleton } from "@/components/ui";

/** ERP login → one parent–teacher chat, read only (GET /api/teacher-chats/:id). Replies come from the teacher's staff app. */

interface Msg {
  id: string;
  from: "parent" | "teacher";
  text: string;
  at: string;
  meeting: { date: string; time: string; minutes: number; placeText: string; status: "waiting" | "yes" | "other" } | null;
}
interface Thread {
  id: string;
  student: string;
  classSec: string;
  teacher: string;
  messages: Msg[];
}
const ampm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
/** The day chip above each day's messages: Today, Yesterday, or "20 Oct 2026". */
function dayLabel(iso: string, L: (b: { hi: string; en: string }) => string) {
  const d = new Date(iso).toDateString();
  const now = new Date();
  if (d === now.toDateString()) return L({ hi: "आज", en: "Today" });
  if (d === new Date(now.getTime() - 864e5).toDateString()) return L({ hi: "कल", en: "Yesterday" });
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ErpParentChatPage() {
  const L = useL();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const { data: t, error, reload } = useApi<Thread>(id ? `/erp/teacher-chats/${encodeURIComponent(id)}` : null);

  if (!t) {
    if (error && error.status !== 401) return error.status === 404 ? <Empty>{L({ hi: "यह चैट नहीं मिली।", en: "This chat was not found." })}</Empty> : <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={5} />;
  }
  const status = { waiting: L({ hi: "माता-पिता के जवाब का इंतज़ार", en: "Waiting for the parent" }), yes: L({ hi: "माता-पिता ने ठीक कहा", en: "Parent said Okay" }), other: L({ hi: "माता-पिता ने दूसरा समय माँगा", en: "Parent asked for another time" }) } as const;

  return (
    <div className="animate-rise -mx-4 -mt-1 flex min-h-[calc(100dvh-11rem)] flex-col" style={{ background: "var(--erp-canvas, #ECEEEB)" }}>
      <div className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-2.5">
        <Avatar name={t.student} size={40} />
        <span className="min-w-0">
          <span className="block truncate text-[15.5px] font-semibold">{t.student}</span>
          <span className="block truncate text-[12.5px] text-ink-500">
            {t.classSec} · {t.teacher}
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-3.5">
        {t.messages.length === 0 && <p className="py-6 text-center text-[14px] text-ink-500">{L({ hi: "अभी कोई मैसेज नहीं।", en: "No messages yet." })}</p>}
        {t.messages.map((m, i) => {
          const teacher = m.from === "teacher";
          const newDay = i === 0 || new Date(t.messages[i - 1].at).toDateString() !== new Date(m.at).toDateString();
          return (
            <div key={m.id} className="contents">
              {newDay && <span className="my-1 self-center rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-ink-600">{dayLabel(m.at, L)}</span>}
              <div className={clsx("max-w-[80%] px-3 pb-1.5 pt-2", teacher ? "self-end rounded-2xl rounded-br-md bg-[#0D2A5E] text-white" : "self-start rounded-2xl rounded-bl-md bg-white text-ink-900")}>
                {m.meeting ? (
                  <p className="text-[15px] leading-snug">
                    {L({ hi: "मिलने का समय:", en: "Meeting time:" })} {new Date(m.meeting.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, {ampm(m.meeting.time)} · {m.meeting.placeText}
                    <span className={clsx("block text-[12.5px]", teacher ? "text-[#D8E3F1]" : "text-ink-500")}>{status[m.meeting.status]}</span>
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.text}</p>
                )}
                <p className={clsx("mt-0.5 text-right text-[11px]", teacher ? "text-[#D8E3F1]" : "text-ink-500")}>{clock(m.at)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="flex items-center gap-2 border-t border-ink-100 bg-white px-4 py-3 text-[13px] text-ink-600">
        <Lock className="h-4 w-4 shrink-0" aria-hidden /> {L({ hi: "यहाँ सिर्फ़ टीचर और परिवार लिखते हैं", en: "Only the teacher and family write here" })}
      </p>
    </div>
  );
}
