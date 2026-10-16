"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Parent–teacher chats: the ERP's page (GET /api/teacher-chats). What parents ask teachers in the
 * parent app. The office can read every chat; only the teacher (staff app) and the family (parent app) write.
 */

interface Row {
  id: string;
  student: string;
  classSec: string;
  teacher: string;
  last: { from: "parent" | "teacher"; text: string; at: string } | null;
}
const stamp = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function ErpParentChatsPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ setupNeeded: boolean; data: Row[] }>("/erp/teacher-chats");
  const [q, setQ] = useState("");
  const rows = data?.data;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((r) => !s || `${r.student} ${r.classSec} ${r.teacher}`.toLowerCase().includes(s));
  }, [rows, q]);

  if (data?.setupNeeded) return <Empty>{L({ hi: "चैट के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261013_teacher_chat.sql)।", en: "Parent–teacher chats need a one-time database setup (20261013_teacher_chat.sql)." })}</Empty>;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "माता-पिता ऐप में टीचर से क्या पूछते हैं। आप हर चैट पढ़ सकते हैं; लिखते सिर्फ़ टीचर और परिवार हैं।", en: "What parents ask teachers in the app. You can read every chat; only the teacher and the family can write." })}</p>
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="pc-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "बच्चा, कक्षा या टीचर", en: "Student, class or teacher" })} autoComplete="off" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>
      {!rows ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : shown.length === 0 ? (
        <Empty>{rows.length ? L({ hi: "इस खोज से कोई चैट नहीं मिली।", en: "No chat matches this search." }) : L({ hi: "अभी किसी माता-पिता ने टीचर को नहीं लिखा।", en: "No parent has written to a teacher yet." })}</Empty>
      ) : (
        <ul>
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/erp/parent-chats/chat/?id=${encodeURIComponent(r.id)}`} className="block border-b border-ink-100 py-2.5 active:bg-ink-50">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-medium">
                    {r.student} <span className="font-normal text-ink-500">· {r.classSec}</span>
                  </span>
                  {r.last && <span className="shrink-0 text-[12px] text-ink-400">{stamp(r.last.at)}</span>}
                </span>
                <span className="block text-[12.5px] text-ink-500">
                  {L({ hi: "टीचर:", en: "with" })} {r.teacher}
                </span>
                {r.last && (
                  <span className="mt-0.5 block truncate text-[13px] text-ink-600">
                    {r.last.from === "teacher" ? L({ hi: "टीचर: ", en: "Teacher: " }) : L({ hi: "माता-पिता: ", en: "Parent: " })}
                    {r.last.text}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
