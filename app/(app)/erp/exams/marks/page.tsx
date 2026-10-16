"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Lock, Search } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import type { Exam, SectionProgress } from "@/lib/erpExams";
import { Empty, ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

/*
 * ERP login → Exams → Marks entry: the ERP's page (GET /api/exams, /api/exams/:id/progress). Pick an exam, then a
 * section's subject to type its marks; each subject shows how many of the class are entered.
 */

export default function ErpMarksEntryPage() {
  const L = useL();
  const exams = useApi<{ data: Exam[]; setupNeeded: boolean }>("/erp/exams");
  const [examId, setExamId] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const list = exams.data?.data;
    if (!list || examId) return;
    const wanted = new URLSearchParams(window.location.search).get("exam") || "";
    const pick = list.find((e) => e.id === wanted) || list.find((e) => !e.locked) || list[0];
    if (pick) setExamId(pick.id);
  }, [exams.data, examId]);
  const prog = useApi<{ exam: Exam; sections: SectionProgress[] }>(examId ? `/erp/exams/${examId}/progress` : null);
  const sections = prog.data && prog.data.exam.id === examId ? prog.data.sections : undefined;
  const exam = exams.data?.data.find((e) => e.id === examId);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (sections || []).filter((s) => !t || s.classSec.toLowerCase().includes(t) || s.subjects.some((x) => x.name.toLowerCase().includes(t)));
  }, [sections, q]);
  const totals = useMemo(() => {
    let need = 0;
    let done = 0;
    for (const s of sections || [])
      for (const sub of s.subjects) {
        need += s.students;
        done += Math.min(sub.entered, s.students);
      }
    return { need, done, pct: need ? Math.round((done / need) * 100) : 0 };
  }, [sections]);
  const noSubjects = (sections || []).filter((s) => !s.subjects.length).length;

  if (exams.data?.setupNeeded) return <Empty>{L({ hi: "परीक्षा के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261001_exams.sql)।", en: "Exams need a one-time database setup (20261001_exams.sql)." })}</Empty>;
  if (exams.data && exams.data.data.length === 0) return <Empty>{L({ hi: "अभी कोई परीक्षा नहीं बनी। पहले परीक्षा सेटअप में इस सत्र की परीक्षाएँ जोड़ें।", en: "No exam has been set up yet. Add this session's exams in Exam setup first." })}</Empty>;
  if (!exams.data) return exams.error && exams.error.status !== 401 ? <ErrorCard offline={exams.error.status === 0} onRetry={exams.reload} /> : <ListSkeleton rows={5} />;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <SelectBox label={L({ hi: "परीक्षा", en: "Exam" })} value={examId} onChange={setExamId}>
        {exams.data.data.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
            {e.locked ? ` (${L({ hi: "बंद", en: "locked" })})` : ""} · {L({ hi: "पूर्णांक", en: "out of" })} {e.max}
          </option>
        ))}
      </SelectBox>
      {exam?.locked && (
        <p className="flex items-center gap-2 rounded-xl bg-ink-100 px-3 py-2 text-[13.5px] text-ink-700">
          <Lock className="h-4 w-4 shrink-0" aria-hidden /> {L({ hi: "बंद है: अंक देख सकते हैं, बदल नहीं सकते", en: "Locked: marks can be viewed, not changed" })}
        </p>
      )}
      <div className="rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink-500">{L({ hi: "अंक भरे गए", en: "Marks entered" })}</span>
          <span className="tnum text-[20px] font-extrabold">{sections ? `${totals.pct}%` : "…"}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-jade-500" style={{ width: `${totals.pct}%` }} />
        </div>
        <p className="tnum mt-1 text-[12px] text-ink-500">
          {totals.done.toLocaleString("en-IN")} / {totals.need.toLocaleString("en-IN")} {L({ hi: "अंक", en: "marks" })}
        </p>
      </div>
      {noSubjects > 0 && <p className="rounded-xl bg-marigold-50 px-3 py-2 text-[13px] text-ink-800">{L({ hi: `${noSubjects} सेक्शन में विषय नहीं डले; परीक्षा सेटअप में डालें।`, en: `${noSubjects} section(s) have no subjects; set them in Exam setup.` })}</p>}
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="mk-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "कक्षा या विषय", en: "Class or subject" })} autoComplete="off" />
      </label>

      {!sections ? (
        prog.error && prog.error.status !== 401 ? <ErrorCard offline={prog.error.status === 0} onRetry={prog.reload} /> : <ListSkeleton rows={6} />
      ) : shown.length === 0 ? (
        <Empty>{q ? L({ hi: "कुछ नहीं मिला।", en: "Nothing matches." }) : L({ hi: "इस परीक्षा में कोई सेक्शन नहीं।", en: "No sections sit this exam." })}</Empty>
      ) : (
        <ul>
          {shown.map((s) => (
            <li key={s.classSec} className="border-b border-ink-100 py-2.5">
              <p className="text-[15px] font-semibold">
                {s.classSec} <span className="tnum text-[12.5px] font-normal text-ink-400">· {s.students} {L({ hi: "बच्चे", en: "students" })}</span>
              </p>
              {s.subjects.length === 0 ? (
                <p className="text-[13px] text-marigold-700">{L({ hi: "विषय नहीं डले", en: "No subjects set" })}</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.subjects.map((sub) => {
                    const full = s.students > 0 && sub.entered >= s.students;
                    const some = sub.entered > 0 && !full;
                    return (
                      <Link
                        key={sub.name}
                        href={`/erp/exams/marks/sheet/?${new URLSearchParams({ exam: examId, section: s.classSec, subject: sub.name })}`}
                        className={clsx("flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold", full ? "bg-jade-50 text-jade-800 ring-1 ring-jade-200" : some ? "bg-marigold-50 text-ink-900 ring-1 ring-marigold-300" : "bg-white text-ink-700 ring-1 ring-ink-200")}
                      >
                        {sub.name}
                        <span className={clsx("tnum text-[12px] font-medium", full ? "text-jade-600" : some ? "text-marigold-700" : "text-ink-400")}>
                          {sub.entered}/{s.students}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
