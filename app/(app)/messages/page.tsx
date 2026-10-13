"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { initials, shade, waited, when, type Inbox, type InboxRow } from "@/lib/messages";
import { AjrakhHeader } from "@/components/AjrakhHeader";
import { ErrorCard, Skeleton } from "@/components/ui";

/** Parent messages: the ones waiting for this teacher's reply first (longest wait on top), then the rest. */
export default function MessagesPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Inbox>("/chats");
  const [cls, setCls] = useState("");
  const pick = (rows: InboxRow[]) => (cls ? rows.filter((r) => r.classSec === cls) : rows);
  const waiting = data ? pick(data.waiting) : [];
  const replied = data ? pick(data.replied) : [];

  const Row = ({ r }: { r: InboxRow }) => (
    <li>
      <Link href={`/messages/chat/?id=${r.id}`} className="flex items-start gap-3 rounded-2xl border-[1.5px] border-ajk-sand2 bg-white px-3.5 py-3 active:bg-ajk-sand/60">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: shade(r.student) }}>
          {initials(r.student)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[16px] font-bold leading-tight">{r.student}</span>
            {r.waitingSince ? (
              <span className="shrink-0 text-[12.5px] font-bold text-marigold-600">{waited(r.waitingSince, lang)}</span>
            ) : (
              r.last && <span className="shrink-0 text-[12px] text-ajk-mute">{when(r.last.at, lang)}</span>
            )}
          </span>
          <span className="block text-[13px] text-ajk-mute">{r.classSec}</span>
          {r.last && (
            <span className="mt-1 flex items-center gap-2.5">
              <span className={clsx("min-w-0 flex-1 truncate text-[14px]", r.unread ? "font-semibold text-ajk-ink" : "text-ajk-mute")}>
                {r.last.from === "teacher" && L({ hi: "आप: ", en: "You: " })}
                {r.last.text}
              </span>
              {r.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ajk-m px-1.5 text-[11.5px] font-bold text-white">{r.unread}</span>}
            </span>
          )}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="font-ajk text-ajk-ink">
      <AjrakhHeader back="/">
        <h1 className="text-[25px] font-extrabold leading-tight">{L({ hi: "अभिभावकों के संदेश", en: "Parent messages" })}</h1>
      </AjrakhHeader>

      <div className="space-y-3 px-4 pt-4">
        {data && data.classes.length > 1 && (
          <div className="flex gap-1 overflow-x-auto rounded-xl border-[1.5px] border-ajk-sand2 bg-white p-1" role="tablist" aria-label={L({ hi: "कक्षा", en: "Class" })}>
            {["", ...data.classes].map((c) => (
              <button
                key={c || "all"}
                role="tab"
                aria-selected={cls === c}
                onClick={() => setCls(c)}
                className={clsx("h-9 shrink-0 grow rounded-lg px-3 text-[14px] font-semibold transition-colors", cls === c ? "bg-ajk-m text-white" : "text-ajk-mute")}
              >
                {c || L({ hi: "सभी", en: "All" })}
              </button>
            ))}
          </div>
        )}

        {!data ? (
          error && error.status !== 401 ? (
            <ErrorCard offline={error.status === 0} onRetry={reload} />
          ) : (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[92px] w-full rounded-2xl" />
              ))}
            </div>
          )
        ) : waiting.length + replied.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-ajk-sand2 bg-white px-4 py-5 text-[15px] text-ajk-mute">
            {L({ hi: "अभी किसी अभिभावक ने संदेश नहीं भेजा। जब भेजेंगे, यहाँ दिखेगा।", en: "No messages from parents yet. They will show here." })}
          </p>
        ) : (
          <>
            {waiting.length > 0 && (
              <section className="space-y-2">
                <h2 className="flex justify-between px-0.5 text-[14px] font-bold text-ajk-mute">
                  <span>{L({ hi: "आपके जवाब का इंतज़ार", en: "Waiting for your reply" })}</span>
                  <span>{waiting.length}</span>
                </h2>
                <ul className="space-y-2">
                  {waiting.map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                </ul>
              </section>
            )}
            {replied.length > 0 && (
              <section className="space-y-2 pt-1">
                <h2 className="px-0.5 text-[14px] font-bold text-ajk-mute">{L({ hi: "जवाब दे दिया", en: "Replied" })}</h2>
                <ul className="space-y-2">
                  {replied.map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
