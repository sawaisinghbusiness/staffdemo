"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { MessageCircle } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Birthdays (the ERP roadmap's "Birthdays" page): students' and staff birthdays from their real dates
 * of birth (GET /api/birthdays?days=30). Today, this week and this month, with a WhatsApp wish for each.
 */

type Birthday = { kind: "student" | "staff"; id: string; name: string; sub: string; dob: string; mobile: string; photoUrl: string; on: string; inDays: number; turns: number };
type Range = "today" | "week" | "month";
type Who = "all" | "student" | "staff";

const LIMIT: Record<Range, number> = { today: 0, week: 6, month: 30 };
const dayHead = (on: string) => new Date(on + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

function wish(b: Birthday, school: string) {
  const d = (b.mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(d) || /^(\d)\1{9}$/.test(d)) return null;
  const text =
    b.kind === "student"
      ? `प्रिय ${b.name}, जन्मदिन की ढेर सारी शुभकामनाएँ! आपका आने वाला साल खुशियों और सफलता से भरा हो। – ${school}`
      : `आदरणीय ${b.name} जी, जन्मदिन की हार्दिक शुभकामनाएँ! – ${school} परिवार`;
  return `https://wa.me/91${d}?text=${encodeURIComponent(text)}`;
}

export default function ErpBirthdaysPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ today: string; data: Birthday[] }>("/erp/birthdays?days=30");
  const { data: school } = useApi<Record<string, string>>("/erp/school");
  const [range, setRange] = useState<Range>("today");
  const [who, setWho] = useState<Who>("all");

  const all = data?.data || [];
  const count = (r: Range) => all.filter((b) => b.inDays <= LIMIT[r] && (who === "all" || b.kind === who)).length;
  const groups = useMemo(() => {
    const m = new Map<string, Birthday[]>();
    for (const b of all) if (b.inDays <= LIMIT[range] && (who === "all" || b.kind === who)) m.set(b.on, [...(m.get(b.on) || []), b]);
    return Array.from(m.entries());
  }, [all, range, who]);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={6} />;
  const schoolName = school?.school_name || "School";

  return (
    <div className="animate-rise space-y-3 pb-4">
      <LineTabs
        label={L({ hi: "कब", en: "When" })}
        value={range}
        onChange={setRange}
        options={[
          { key: "today", text: `${L({ hi: "आज", en: "Today" })} ${count("today")}` },
          { key: "week", text: `${L({ hi: "7 दिन", en: "7 days" })} ${count("week")}` },
          { key: "month", text: `${L({ hi: "30 दिन", en: "30 days" })} ${count("month")}` },
        ]}
      />
      <div className="flex gap-2" role="group" aria-label={L({ hi: "किसके", en: "Whose" })}>
        {(
          [
            ["all", { hi: "सभी", en: "All" }],
            ["student", { hi: "बच्चे", en: "Students" }],
            ["staff", { hi: "स्टाफ़", en: "Staff" }],
          ] as const
        ).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setWho(k)} aria-pressed={who === k} className={clsx("h-9 rounded-full border px-3.5 text-[13px] font-semibold", who === k ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700")}>
            {L(t)}
          </button>
        ))}
      </div>

      {!groups.length ? (
        <Empty>{range === "today" ? L({ hi: "आज किसी का जन्मदिन नहीं है।", en: "No birthdays today." }) : L({ hi: "इन दिनों में किसी का जन्मदिन नहीं है।", en: "No birthdays in these days." })}</Empty>
      ) : (
        groups.map(([on, list]) => (
          <section key={on}>
            <h2 className="mlabel pt-1">
              {list[0].inDays === 0 ? L({ hi: "आज", en: "Today" }) : list[0].inDays === 1 ? L({ hi: "कल", en: "Tomorrow" }) : dayHead(on)} · {list.length}
            </h2>
            <ul>
              {list.map((b) => {
                const wa = wish(b, schoolName);
                return (
                  <li key={b.kind + b.id} className="flex items-center gap-3 border-b border-ink-100 py-2.5">
                    <Avatar name={b.name} url={b.photoUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{b.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-500">
                        {b.kind === "staff" ? `${L({ hi: "स्टाफ़", en: "Staff" })} · ${b.sub}` : b.sub} · {L({ hi: `${b.turns} साल`, en: `turns ${b.turns}` })}
                      </span>
                    </span>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-semibold text-jade-700">
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        {L({ hi: "बधाई", en: "Wish" })}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
