"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

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
const stamp = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

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
    <div className="animate-rise space-y-3 pb-4">
      <div>
        <p className="truncate text-[18px] font-bold">
          {t.student} <span className="font-normal text-ink-500">· {t.classSec}</span>
        </p>
        <p className="text-[13px] text-ink-500">
          {L({ hi: "माता-पिता और", en: "Parent and" })} {t.teacher}
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-ink-100/60 p-3">
        {t.messages.length === 0 && <p className="py-6 text-center text-[14px] text-ink-500">{L({ hi: "अभी कोई मैसेज नहीं।", en: "No messages yet." })}</p>}
        {t.messages.map((m) => {
          const teacher = m.from === "teacher";
          return (
            <div key={m.id} className={clsx("max-w-[82%] rounded-2xl px-3 py-2 text-[14.5px]", teacher ? "self-end rounded-br-md bg-jade-50 ring-1 ring-jade-100" : "self-start rounded-bl-md bg-white ring-1 ring-ink-100")}>
              <p className="text-[11.5px] font-semibold text-ink-500">{teacher ? t.teacher : L({ hi: "माता-पिता", en: "Parent" })}</p>
              {m.meeting ? (
                <p className="text-ink-800">
                  {L({ hi: "मिलने का समय:", en: "Meeting time:" })} {new Date(m.meeting.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, {ampm(m.meeting.time)} · {m.meeting.placeText}
                  <span className="block text-[12.5px] text-ink-500">{status[m.meeting.status]}</span>
                </p>
              ) : (
                <p className="whitespace-pre-wrap break-words text-ink-800">{m.text}</p>
              )}
              <p className="mt-0.5 text-right text-[11px] text-ink-400">{stamp(m.at)}</p>
            </div>
          );
        })}
      </div>
      <p className="flex items-center gap-2 text-[12.5px] text-ink-500">
        <Lock className="h-3.5 w-3.5" aria-hidden /> {L({ hi: "सिर्फ़ पढ़ने के लिए। जवाब टीचर अपने स्टाफ़ ऐप से देते हैं।", en: "Read only. Replies come from the teacher's staff app." })}
      </p>
    </div>
  );
}
