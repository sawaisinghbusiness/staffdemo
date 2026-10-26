"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import type { Message } from "@/lib/erpMessages";
import { Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Messages: the ERP's register of notices and reminders to parents on WhatsApp (GET /api/messages)
 * and how many parents have each one. Tap a message to keep sending it; + writes a new one (admin, accountant).
 * Drawn like the parent app (user, 2026-10-26): All / Sending / Sent, grouped "This week" and "Earlier".
 */

const fmt = (n: number) => n.toLocaleString("en-IN");
const shortDay = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (days < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function ErpMessagesPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: Message[]; setupNeeded: boolean }>("/erp/messages");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const canWrite = ["admin", "accountant"].includes(who.data?.user.role || "");
  const list = data?.data;
  const [tab, setTab] = useState<"all" | "sending" | "sent">("all");
  const isDone = (m: Message) => m.total > 0 && m.sent >= m.total;
  const sending = useMemo(() => (list || []).filter((m) => !isDone(m)).length, [list]);
  const groups = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5;
    const shown = (list || []).filter((m) => tab === "all" || (tab === "sent" ? isDone(m) : !isDone(m)));
    return [
      { key: "week", title: L({ hi: "इस हफ़्ते", en: "This week" }), items: shown.filter((m) => new Date(m.created_at).getTime() >= weekAgo) },
      { key: "earlier", title: L({ hi: "पहले", en: "Earlier" }), items: shown.filter((m) => new Date(m.created_at).getTime() < weekAgo) },
    ].filter((g) => g.items.length);
  }, [list, tab, L]);

  if (data?.setupNeeded) return <Empty>{L({ hi: "मैसेज के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261001_messages.sql)।", en: "Messages need a one-time database setup (20261001_messages.sql)." })}</Empty>;

  return (
    <div className="animate-rise space-y-3 pb-4">
      {who.data && !canWrite && <p className="text-[13px] text-ink-500">{L({ hi: "नया मैसेज सिर्फ़ एडमिन और अकाउंटेंट लिख सकते हैं।", en: "Only the admin and the accountant can write a new message." })}</p>}
      {!list ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <Empty>{L({ hi: "अभी कोई मैसेज नहीं भेजा। छुट्टी, मीटिंग, परीक्षा या फ़ीस की याद: एक बार लिखें, हर माता-पिता को बच्चे के नाम के साथ जाएगा।", en: "No message sent yet. Holiday notices, meeting dates, exam and fee reminders: written once, sent to every parent with their child's name." })}</Empty>
      ) : (
        <>
          <LineTabs
            label={L({ hi: "मैसेज", en: "Messages" })}
            value={tab}
            onChange={setTab}
            options={[
              { key: "all", text: `${L({ hi: "सभी", en: "All" })} ${list.length}` },
              { key: "sending", text: `${L({ hi: "जा रहे", en: "Sending" })} ${sending}` },
              { key: "sent", text: `${L({ hi: "भेजे गए", en: "Sent" })} ${list.length - sending}` },
            ]}
          />
          {groups.length === 0 && <Empty>{L({ hi: "यहाँ कोई मैसेज नहीं।", en: "No messages here." })}</Empty>}
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-1.5 mt-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">{g.title}</h2>
              <ul className="-mx-4 border-y border-ink-100 bg-white pl-4">
                {g.items.map((m) => {
                  const done = isDone(m);
                  const pct = m.total ? Math.round((m.sent / m.total) * 100) : 0;
                  return (
                    <li key={m.id}>
                      <Link href={`/erp/messages/detail/?id=${encodeURIComponent(m.id)}`} className="flex flex-col gap-1 border-b border-ink-100 py-3 pr-4 last:border-b-0 active:bg-ink-50">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">{m.title}</span>
                          {m.show_on_website && <Globe className="h-3.5 w-3.5 shrink-0 self-center text-ink-400" aria-label={L({ hi: "वेबसाइट पर", en: "On the website" })} />}
                          <span className="shrink-0 text-[12px] text-ink-500">{shortDay(m.created_at)}</span>
                        </span>
                        <span lang={m.lang} className="truncate text-[14px] text-ink-700">
                          {m.body.replace(/\s+/g, " ")}
                        </span>
                        <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink-600">
                          <i className={done ? "h-[7px] w-[7px] shrink-0 rounded-full bg-jade-500" : "h-[7px] w-[7px] shrink-0 rounded-full bg-[#3099a4]"} aria-hidden />
                          {done
                            ? L({ hi: `${fmt(m.total)} माता-पिता को गया · ${m.audience_label}`, en: `Sent to ${fmt(m.total)} parents · ${m.audience_label}` })
                            : L({ hi: `जा रहा · ${fmt(m.total)} में से ${fmt(m.sent)}`, en: `Sending · ${fmt(m.sent)} of ${fmt(m.total)} parents` })}
                        </span>
                        {!done && (
                          <span className="block h-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                            <span className="block h-full rounded-full bg-[#3099a4]" style={{ width: `${pct}%` }} />
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
