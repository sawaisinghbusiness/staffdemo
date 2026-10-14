"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { waited, when, type Inbox, type InboxRow } from "@/lib/messages";
import { Avatar, ErrorCard, Skeleton } from "@/components/ui";

/** Parent messages, laid out like the parent app's Ask Teacher: waiting for a reply first, then the rest. */
export default function MessagesPage() {
  const L = useL();
  const { data, error, reload } = useApi<Inbox>("/chats");
  const [cls, setCls] = useState("");
  const pick = (rows: InboxRow[]) => (cls ? rows.filter((r) => r.classSec === cls) : rows);
  const waiting = data ? pick(data.waiting) : [];
  const replied = data ? pick(data.replied) : [];

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return (
      <div className="space-y-3">
        <Skeleton className="h-[76px] w-full rounded-[20px]" />
        <Skeleton className="h-[200px] w-full rounded-[20px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.classes.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label={L({ hi: "कक्षा", en: "Class" })}>
          {["", ...data.classes].map((c) => (
            <button
              key={c || "all"}
              role="tab"
              aria-selected={cls === c}
              onClick={() => setCls(c)}
              className={clsx("h-9 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors", cls === c ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-200 bg-white text-ink-700")}
            >
              {c || L({ hi: "सभी", en: "All" })}
            </button>
          ))}
        </div>
      )}

      {waiting.length + replied.length === 0 ? (
        <p className="rounded-[20px] border border-ink-100 bg-white px-4 py-5 text-[15px] text-ink-500">{L({ hi: "अभी किसी अभिभावक ने संदेश नहीं भेजा। जब भेजेंगे, यहाँ दिखेगा।", en: "No messages from parents yet. They will show here." })}</p>
      ) : (
        <>
          {waiting.length > 0 && <Group title={L({ hi: "आपके जवाब का इंतज़ार", en: "Waiting for your reply" })} rows={waiting} pending />}
          {replied.length > 0 && <Group title={L({ hi: "जवाब दे दिया", en: "Replied" })} rows={replied} />}
        </>
      )}
    </div>
  );
}

/** Each enquiry its own card: a light red edge while it waits for a reply, light green once replied. */
function Group({ title, rows, pending }: { title: string; rows: InboxRow[]; pending?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-0.5 text-[13.5px] font-semibold text-ink-500">
        <span className={clsx("h-2 w-2 rounded-full", pending ? "bg-rose-500" : "bg-jade-600")} aria-hidden />
        {title}
        <span className="ml-auto tabular-nums">{rows.length}</span>
      </h2>
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <Row key={r.id} r={r} i={i} />
        ))}
      </ul>
    </section>
  );
}

/** Only the start of the last message; the rest is in the chat. */
const short = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > 24 ? s.slice(0, 24).trimEnd() + "…" : s;
};

/** One child's parent: name and class, the last message, and a count when there are new ones. */
function Row({ r, i }: { r: InboxRow; i: number }) {
  const L = useL();
  const { lang } = useLang();
  return (
    <li className="card-in" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
      <Link
        href={`/messages/chat/?id=${r.id}`}
        className={clsx(
          "glass-card press flex min-h-[76px] items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3",
          "border-ink-900"
        )}
      >
        <Avatar name={r.student} size={44} tint={i} />
        {/* Top: name · class, and the new-message count in the corner. Bottom: the message, and how long ago. */}
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[16px] font-semibold text-ink-900">
              {r.student} <span className="text-[13.5px] font-medium text-ink-500">· {r.classSec}</span>
            </span>
            {r.unread > 0 ? (
              <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-[#ff3040] px-1.5 text-[12px] font-bold text-white" aria-label={L({ hi: `${r.unread} नए संदेश`, en: `${r.unread} new` })}>
                {r.unread}
              </span>
            ) : (
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
            )}
          </span>
          <span className="flex items-baseline justify-between gap-2">
            <span className={clsx("min-w-0 truncate text-[13.5px]", r.unread > 0 ? "font-semibold text-ink-900" : "text-ink-500")}>
              {r.last && (r.last.from === "teacher" ? L({ hi: "आप: ", en: "You: " }) : "")}
              {r.last && (r.last.text ? short(r.last.text) : L({ hi: "मिलने का समय", en: "Meeting time" }))}
            </span>
            {r.waitingSince ? <span className="shrink-0 text-[14px] font-bold text-ink-900">{waited(r.waitingSince, lang)}</span> : r.last && <span className="shrink-0 text-[14px] font-bold text-ink-900">{when(r.last.at, lang)}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}
