"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Plus } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { normClasses } from "@/lib/erpStaff";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox } from "@/components/ui";
import { SetupNeeded } from "@/components/erp/SetupNeeded";

/*
 * ERP login → Copy check (the ERP roadmap's "Notebook checking with ready remarks"): recent checks with how many
 * notebooks were complete, incomplete or not handed in, and reports by teacher and by student.
 * GET /api/copy-checks, /api/copy-checks/report. A check is taken on /erp/copy-check/sheet/.
 */

type Check = { id: string; classSec: string; subject: string; date: string; topic: string; checkedBy: string; complete: number; incomplete: number; notSubmitted: number };
type Report = { setupNeeded: boolean; teachers: { name: string; checks: number; sections: string[]; last: string }[]; students: { id: string; name: string; rollNo: string; complete: number; incomplete: number; notSubmitted: number }[] };

const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function ErpCopyCheckPage() {
  const L = useL();
  const [tab, setTab] = useState<"checks" | "report">("checks");
  const [sec, setSec] = useState("");
  const cls = useApi<{ data: unknown[] }>("/erp/classes");
  const sections = useMemo(() => normClasses(cls.data as { data?: any[] } | undefined).flatMap((c) => c.sections.map((s) => `${c.name} - ${s.name}`)), [cls.data]);
  const list = useApi<{ setupNeeded: boolean; data: Check[] }>(tab === "checks" ? `/erp/copy-checks${sec ? `?section=${encodeURIComponent(sec)}` : ""}` : null);
  const rep = useApi<Report>(tab === "report" ? `/erp/copy-checks/report${sec ? `?section=${encodeURIComponent(sec)}` : ""}` : null);

  if (list.data?.setupNeeded || rep.data?.setupNeeded) return <SetupNeeded file="20261019_syllabus_copycheck.sql" what={{ hi: "कॉपी जाँच", en: "Copy check" }} />;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <LineTabs
        label={L({ hi: "दिखाएँ", en: "Show" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "checks", text: L({ hi: "जाँचें", en: "Checks" }) },
          { key: "report", text: L({ hi: "रिपोर्ट", en: "Report" }) },
        ]}
      />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sec} onChange={setSec}>
            <option value="">{tab === "report" ? L({ hi: "सिर्फ़ टीचर-वार", en: "Teachers only" }) : L({ hi: "सारे सेक्शन", en: "All sections" })}</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectBox>
        </div>
        {tab === "checks" && (
          <Link href={`/erp/copy-check/sheet/${sec ? `?section=${encodeURIComponent(sec)}` : ""}`} className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-xl border-[1.5px] border-ink-900 bg-white px-3.5 text-[13.5px] font-semibold text-ink-900 active:bg-ink-100">
            <Plus className="h-4 w-4" aria-hidden />
            {L({ hi: "नई जाँच", en: "New check" })}
          </Link>
        )}
      </div>

      {tab === "checks" &&
        (!list.data ? (
          list.error && list.error.status !== 401 ? <ErrorCard offline={list.error.status === 0} onRetry={list.reload} /> : <ListSkeleton rows={5} />
        ) : !list.data.data.length ? (
          <Empty>{L({ hi: "अभी कोई कॉपी जाँच नहीं हुई। 'नई जाँच' से शुरू करें।", en: "No copy checks yet. Start with 'New check'." })}</Empty>
        ) : (
          <ul className="space-y-2.5">
            {list.data.data.map((c) => {
              const total = c.complete + c.incomplete + c.notSubmitted;
              return (
                <li key={c.id}>
                  <Link href={`/erp/copy-check/sheet/?id=${c.id}`} className="glass-line card-in flex items-center gap-3 !rounded-2xl px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold text-ink-900">
                        {c.classSec} · {c.subject}
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-500">
                        {short(c.date)}
                        {c.topic ? ` · ${c.topic}` : ""}
                        {c.checkedBy ? ` · ${c.checkedBy.split(" (")[0]}` : ""}
                      </span>
                      <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-ink-100" aria-hidden>
                        <i className="bg-jade-500" style={{ width: `${(c.complete / (total || 1)) * 100}%` }} />
                        <i className="bg-marigold-400" style={{ width: `${(c.incomplete / (total || 1)) * 100}%` }} />
                        <i className="bg-rose-500" style={{ width: `${(c.notSubmitted / (total || 1)) * 100}%` }} />
                      </span>
                      <span className="tnum mt-1 flex gap-3 text-[12px] text-ink-600">
                        <Count dot="bg-jade-500" n={c.complete} label={L({ hi: "पूरी", en: "complete" })} />
                        <Count dot="bg-marigold-400" n={c.incomplete} label={L({ hi: "अधूरी", en: "incomplete" })} />
                        <Count dot="bg-rose-500" n={c.notSubmitted} label={L({ hi: "नहीं दी", en: "not given" })} />
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "report" &&
        (!rep.data ? (
          rep.error && rep.error.status !== 401 ? <ErrorCard offline={rep.error.status === 0} onRetry={rep.reload} /> : <ListSkeleton rows={5} />
        ) : (
          <>
            {sec && (
              <section>
                <h2 className="mlabel mb-1">{L({ hi: `${sec} के बच्चे`, en: `Students of ${sec}` })}</h2>
                {!rep.data.students.some((s) => s.complete + s.incomplete + s.notSubmitted) ? (
                  <Empty>{L({ hi: "इस सेक्शन की अभी कोई जाँच नहीं हुई।", en: "This section has no checks yet." })}</Empty>
                ) : (
                  <ul>
                    {rep.data.students
                      .slice()
                      .sort((a, b) => b.notSubmitted + b.incomplete - (a.notSubmitted + a.incomplete))
                      .map((s) => (
                        <li key={s.id} className="flex items-center gap-3 border-b border-ink-100 py-2.5">
                          <span className="tnum w-7 shrink-0 text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{s.name}</span>
                          <span className="tnum flex shrink-0 gap-2.5 text-[12.5px] text-ink-600">
                            <Count dot="bg-jade-500" n={s.complete} />
                            <Count dot="bg-marigold-400" n={s.incomplete} />
                            <Count dot="bg-rose-500" n={s.notSubmitted} />
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )}
            <section>
              <h2 className="mlabel mb-1 pt-1">{L({ hi: "टीचर-वार", en: "By teacher" })}</h2>
              {!rep.data.teachers.length ? (
                <Empty>{L({ hi: "अभी कोई जाँच नहीं हुई।", en: "No checks yet." })}</Empty>
              ) : (
                <ul>
                  {rep.data.teachers.map((t) => (
                    <li key={t.name} className="flex items-center gap-3 border-b border-ink-100 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold">{t.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-500">
                          {t.sections.join(", ")} · {L({ hi: "आख़िरी", en: "last" })} {short(t.last)}
                        </span>
                      </span>
                      <span className={clsx("tnum shrink-0 text-[15px] font-bold")}>{t.checks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="flex flex-wrap gap-3 text-[12px] text-ink-500">
              <Count dot="bg-jade-500" label={L({ hi: "पूरी", en: "complete" })} />
              <Count dot="bg-marigold-400" label={L({ hi: "अधूरी", en: "incomplete" })} />
              <Count dot="bg-rose-500" label={L({ hi: "नहीं दी", en: "not given" })} />
            </p>
          </>
        ))}
    </div>
  );
}

function Count({ dot, n, label }: { dot: string; n?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <i className={clsx("h-2 w-2 rounded-full", dot)} />
      {n !== undefined && <b className="font-semibold text-ink-900">{n}</b>}
      {label}
    </span>
  );
}
