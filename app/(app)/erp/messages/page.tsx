"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import type { Message } from "@/lib/erpMessages";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Messages: the ERP's register of notices and reminders to parents on WhatsApp (GET /api/messages)
 * and how many parents have each one. Tap a message to keep sending it; + writes a new one (admin, accountant).
 */

export default function ErpMessagesPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: Message[]; setupNeeded: boolean }>("/erp/messages");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const canWrite = ["admin", "accountant"].includes(who.data?.user.role || "");
  const list = data?.data;

  if (data?.setupNeeded) return <Empty>{L({ hi: "मैसेज के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261001_messages.sql)।", en: "Messages need a one-time database setup (20261001_messages.sql)." })}</Empty>;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "माता-पिता को WhatsApp पर सूचनाएँ और याद, और किस-किस तक पहुँचीं।", en: "Notices and reminders to parents on WhatsApp, and who has received them." })}</p>
      {who.data && !canWrite && <p className="text-[13px] text-ink-500">{L({ hi: "नया मैसेज सिर्फ़ एडमिन और अकाउंटेंट लिख सकते हैं।", en: "Only the admin and the accountant can write a new message." })}</p>}
      {!list ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <Empty>{L({ hi: "अभी कोई मैसेज नहीं भेजा। छुट्टी, मीटिंग, परीक्षा या फ़ीस की याद: एक बार लिखें, हर माता-पिता को बच्चे के नाम के साथ जाएगा।", en: "No message sent yet. Holiday notices, meeting dates, exam and fee reminders: written once, sent to every parent with their child's name." })}</Empty>
      ) : (
        <ul>
          {list.map((m) => {
            const done = m.total > 0 && m.sent >= m.total;
            const pct = m.total ? Math.round((m.sent / m.total) * 100) : 0;
            return (
              <li key={m.id}>
                <Link href={`/erp/messages/detail/?id=${encodeURIComponent(m.id)}`} className="flex min-h-[68px] items-center gap-3 border-b border-ink-100 py-2 active:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium">
                      <span className="truncate">{m.title}</span>
                      {m.show_on_website && <Globe className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-label={L({ hi: "वेबसाइट पर", en: "On the website" })} />}
                    </span>
                    <span lang={m.lang} className="block truncate text-[12.5px] text-ink-400">
                      {m.body.replace(/\s+/g, " ")}
                    </span>
                    <span className="block truncate text-[12px] text-ink-400">
                      {m.audience_label} · {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      {m.created_by_name ? ` · ${m.created_by_name.split(" (")[0]}` : ""}
                    </span>
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    <span className={done ? "tnum block text-[14px] font-semibold text-jade-700" : "tnum block text-[14px] font-semibold"}>
                      {m.sent.toLocaleString("en-IN")}/{m.total.toLocaleString("en-IN")}
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ink-100">
                      <span className={done ? "block h-full rounded-full bg-jade-500" : "block h-full rounded-full bg-brand-500"} style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
