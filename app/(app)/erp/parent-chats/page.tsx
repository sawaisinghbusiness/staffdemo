"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Parent–teacher chats: the ERP's page (GET /api/teacher-chats), drawn like a WhatsApp chat list
 * (user, 2026-10-26). The office can read every chat; only the teacher (staff app) and the family (parent app) write.
 */

interface Row {
  id: string;
  student: string;
  classSec: string;
  teacher: string;
  last: { from: "parent" | "teacher"; text: string; at: string } | null;
}
/** WhatsApp-style time: "10:42 am" today, "Yesterday", else "20 Oct". */
function when(iso: string, yesterday: string) {
  const d = new Date(iso);
  const day = (x: Date) => x.toDateString();
  const now = new Date();
  if (day(d) === day(now)) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (day(d) === day(new Date(now.getTime() - 864e5))) return yesterday;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function ErpParentChatsPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ setupNeeded: boolean; data: Row[] }>("/erp/teacher-chats");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "waiting">("all");
  const rows = data?.data;
  // Waiting: the parent wrote last, the teacher hasn't answered yet.
  const waiting = useMemo(() => (rows || []).filter((r) => r.last?.from === "parent").length, [rows]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((r) => (tab === "all" || r.last?.from === "parent") && (!s || `${r.student} ${r.classSec} ${r.teacher}`.toLowerCase().includes(s)));
  }, [rows, q, tab]);

  if (data?.setupNeeded) return <Empty>{L({ hi: "चैट के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261013_teacher_chat.sql)।", en: "Parent–teacher chats need a one-time database setup (20261013_teacher_chat.sql)." })}</Empty>;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="pc-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "बच्चा, कक्षा या टीचर", en: "Student, class or teacher" })} autoComplete="off" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>
      <LineTabs
        label={L({ hi: "चैट", en: "Chats" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "all", text: `${L({ hi: "सभी", en: "All" })}${rows ? ` ${rows.length}` : ""}` },
          { key: "waiting", text: `${L({ hi: "जवाब बाकी", en: "Reply pending" })}${rows ? ` ${waiting}` : ""}` },
        ]}
      />
      {!rows ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} slow={error.message === "timeout"} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : shown.length === 0 ? (
        <Empty>{rows.length ? L({ hi: "इस खोज से कोई चैट नहीं मिली।", en: "No chat matches this search." }) : L({ hi: "अभी किसी माता-पिता ने टीचर को नहीं लिखा।", en: "No parent has written to a teacher yet." })}</Empty>
      ) : (
        <ul className="-mx-4 bg-white pl-4">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/erp/parent-chats/chat/?id=${encodeURIComponent(r.id)}`} className="flex items-center gap-3 border-b border-ink-100 py-3 pr-4 active:bg-ink-50">
                <Avatar name={r.student} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">{r.student}</span>
                    {r.last && <span className={r.last.from === "parent" ? "shrink-0 text-[12px] font-semibold text-[#0D2A5E]" : "shrink-0 text-[12px] text-ink-500"}>{when(r.last.at, L({ hi: "कल", en: "Yesterday" }))}</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-500">
                    {r.classSec} · {r.teacher}
                  </span>
                  {r.last && (
                    <span className="flex items-center gap-1.5">
                      {r.last.from === "parent" && <i className="h-2 w-2 shrink-0 rounded-full bg-[#0D2A5E]" aria-label={L({ hi: "जवाब बाकी", en: "Reply pending" })} />}
                      <span className={r.last.from === "parent" ? "truncate text-[14px] text-ink-900" : "truncate text-[14px] text-ink-600"}>
                        {r.last.from === "teacher" ? L({ hi: "टीचर: ", en: "Teacher: " }) : ""}
                        {r.last.text}
                      </span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
