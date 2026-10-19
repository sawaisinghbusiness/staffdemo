"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { Empty, ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";
import { SetupNeeded } from "@/components/erp/SetupNeeded";

/*
 * ERP login → Syllabus (the ERP roadmap's "Chapters planned vs taught, class by class"): pick a class, see every
 * subject's coverage per section (chapters done of the plan) and how many were due by this month. Tap a subject
 * for its chapter plan. GET /api/syllabus/summary.
 */

type Row = { className: string; subject: string; chapters: number; dueByNow: number; sections: { classSec: string; done: number }[] };
type Summary = { setupNeeded: boolean; month?: string; data: Row[] };

const LAST = "sa:syl-class";

export default function ErpSyllabusPage() {
  const L = useL();
  const { data, error, reload } = useApi<Summary>("/erp/syllabus/summary");
  const classes = useMemo(() => Array.from(new Set((data?.data || []).map((r) => r.className))), [data]);
  const [cls, setCls] = useState("");
  useEffect(() => {
    if (cls || !classes.length) return;
    let last = "";
    try {
      last = localStorage.getItem(LAST) || "";
    } catch {}
    setCls(classes.includes(last) ? last : classes[0]);
  }, [classes, cls]);
  const pick = (c: string) => {
    setCls(c);
    try {
      localStorage.setItem(LAST, c);
    } catch {}
  };

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={6} />;
  if (data.setupNeeded) return <SetupNeeded file="20261019_syllabus_copycheck.sql" what={{ hi: "सिलेबस", en: "Syllabus" }} />;
  if (!classes.length) return <Empty>{L({ hi: "अभी किसी कक्षा के विषय नहीं हैं। पहले सेटिंग → कक्षा और विषय में विषय डालें।", en: "No class has subjects yet. Add them in Settings → Classes & subjects first." })}</Empty>;

  const rows = data.data.filter((r) => r.className === cls);
  const planned = rows.filter((r) => r.chapters).length;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={cls} onChange={pick}>
        {classes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </SelectBox>
      <p className="mlabel tnum">{L({ hi: `${rows.length} में से ${planned} विषयों का प्लान बना है`, en: `${planned} of ${rows.length} subjects have a plan` })}</p>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const late = r.sections.filter((s) => s.done < r.dueByNow).length;
          return (
            <li key={r.subject}>
              <Link href={`/erp/syllabus/plan/?class=${encodeURIComponent(r.className)}&subject=${encodeURIComponent(r.subject)}`} className="glass-line card-in block !rounded-2xl px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink-900">{r.subject}</span>
                  <span className="text-[12.5px] text-ink-500">{r.chapters ? `${r.chapters} ${L({ hi: "अध्याय", en: "chapters" })}` : L({ hi: "प्लान नहीं", en: "No plan" })}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                </span>
                {r.chapters > 0 && (
                  <>
                    <span className="mt-2 block space-y-1.5">
                      {r.sections.map((s) => {
                        const pct = Math.round((s.done / r.chapters) * 100);
                        const behind = s.done < r.dueByNow;
                        return (
                          <span key={s.classSec} className="flex items-center gap-2 text-[12.5px]">
                            <span className="w-10 shrink-0 font-semibold text-ink-700">{s.classSec.split(" - ")[1]}</span>
                            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                              <i className={clsx("absolute inset-y-0 left-0", behind ? "bg-rose-500" : "bg-jade-500")} style={{ width: `${pct}%` }} />
                              {r.dueByNow > 0 && <i className="absolute inset-y-0 w-0.5 bg-ink-900" style={{ left: `${Math.min(100, (r.dueByNow / r.chapters) * 100)}%` }} />}
                            </span>
                            <span className="tnum w-12 shrink-0 text-right text-ink-600">
                              {s.done}/{r.chapters}
                            </span>
                          </span>
                        );
                      })}
                    </span>
                    {late > 0 && (
                      <span className="mt-1.5 block text-[12px] text-rose-600">
                        {L({ hi: `${late} सेक्शन प्लान से पीछे (अब तक ${r.dueByNow} होने थे)`, en: `${late} section${late > 1 ? "s" : ""} behind plan (${r.dueByNow} due by now)` })}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
        <i className="h-3 w-0.5 bg-ink-900" aria-hidden />
        {L({ hi: "काली लकीर = इस महीने तक जितने अध्याय होने थे", en: "Black line = chapters due by this month" })}
      </p>
    </div>
  );
}
