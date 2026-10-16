"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Printer, Search } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { useSchoolInfo } from "@/lib/erpCerts";
import type { Exam, Report, ReportCard, SectionProgress } from "@/lib/erpExams";
import { ReportCardBack, ReportCardDocument, type ReportSchool } from "@/components/erp/report/ReportCardDocument";
import { SheetPreview } from "@/components/erp/certs/SheetPreview";
import { PrintReportCards } from "@/components/erp/PrintReportCards";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";

/*
 * ERP login → Exams → Report cards: the ERP's page (GET /api/exams, /progress, /report?section=). Pick an exam and a
 * section; each student shows % · grade or "incomplete". A tap opens the A4 card (front/back, the ERP's own
 * ReportCardDocument); print one card or the whole section.
 */

/** The latest exam that has already started, else the first one (as the ERP picks). */
function defaultExam(list: Exam[]) {
  const today = new Date().toISOString().slice(0, 10);
  const started = list.filter((e) => e.start_date && e.start_date <= today).sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  return (started[0] || list[0])?.id || "";
}

export default function ErpReportCardsPage() {
  const L = useL();
  const exams = useApi<{ data: Exam[]; setupNeeded: boolean }>("/erp/exams");
  const [examId, setExamId] = useState("");
  const [section, setSection] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState("");
  const [printing, setPrinting] = useState<ReportCard[] | null>(null);

  useEffect(() => {
    const list = exams.data?.data;
    if (!list || examId) return;
    const p = new URLSearchParams(window.location.search);
    const wanted = p.get("exam") || "";
    const id = list.some((e) => e.id === wanted) ? wanted : defaultExam(list);
    setExamId(id);
    if (id === wanted) setSection(p.get("section") || "");
  }, [exams.data, examId]);

  const prog = useApi<{ exam: Exam; sections: SectionProgress[] }>(examId ? `/erp/exams/${examId}/progress` : null);
  const sections = prog.data && prog.data.exam.id === examId ? prog.data.sections : undefined;
  useEffect(() => {
    if (!sections) return;
    setSection((cur) => (sections.some((s) => s.classSec === cur) ? cur : sections.length === 1 ? sections[0].classSec : ""));
  }, [sections]);

  const ready = !!section && !!sections?.some((s) => s.classSec === section);
  useEffect(() => {
    if (!examId) return;
    const u = new URL(window.location.href);
    u.searchParams.set("exam", examId);
    if (section) u.searchParams.set("section", section);
    else u.searchParams.delete("section");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [examId, section]);

  const rep = useApi<Report>(ready ? `/erp/exams/${examId}/report?section=${encodeURIComponent(section)}` : null);
  const report = rep.data && rep.data.exam.id === examId && rep.data.classSec === section ? rep.data : undefined;
  const cards = report?.cards;
  const incomplete = useMemo(() => (cards || []).filter((c) => !c.complete).length, [cards]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (cards || []).filter((c) => !t || c.name.toLowerCase().includes(t) || c.rollNo === t || c.srNo.toLowerCase() === t);
  }, [cards, q]);
  const open = cards?.find((c) => c.studentId === openId) || null;

  const info = useSchoolInfo();
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const school: ReportSchool = { ...info, city: p?.city || "Barmer", principal: p?.principal_name || undefined };

  const pickExam = (id: string) => {
    setExamId(id);
    setSection("");
    setQ("");
  };

  if (exams.data?.setupNeeded) return <Empty>{L({ hi: "परीक्षा के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261001_exams.sql)।", en: "Exams need a one-time database setup (20261001_exams.sql)." })}</Empty>;
  if (exams.data && exams.data.data.length === 0) return <Empty>{L({ hi: "अभी कोई परीक्षा नहीं बनी। रिपोर्ट कार्ड परीक्षा के भरे अंकों से बनते हैं; पहले परीक्षा सेटअप करें।", en: "No exam set up yet. Report cards come from the marks entered for an exam; set one up first." })}</Empty>;
  if (!exams.data) return exams.error && exams.error.status !== 401 ? <ErrorCard offline={exams.error.status === 0} onRetry={exams.reload} /> : <ListSkeleton rows={5} />;

  return (
    <div className={clsx("animate-rise space-y-3", cards?.length ? "pb-20" : "pb-4")}>
      <SelectBox label={L({ hi: "परीक्षा", en: "Exam" })} value={examId} onChange={pickExam}>
        {exams.data.data.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
            {e.locked ? ` (${L({ hi: "बंद", en: "locked" })})` : ""}
          </option>
        ))}
      </SelectBox>
      <SelectBox label={L({ hi: "कक्षा", en: "Section" })} value={section} onChange={setSection}>
        <option value="">{sections ? (sections.length ? L({ hi: "कक्षा चुनें", en: "Pick a section" }) : L({ hi: "कोई कक्षा नहीं", en: "No sections" })) : L({ hi: "लोड हो रहा है…", en: "Loading…" })}</option>
        {(sections || []).map((s) => (
          <option key={s.classSec} value={s.classSec}>
            {s.classSec} ({s.students})
          </option>
        ))}
      </SelectBox>

      {!sections ? (
        prog.error && prog.error.status !== 401 ? <ErrorCard offline={prog.error.status === 0} onRetry={prog.reload} /> : <ListSkeleton rows={6} />
      ) : sections.length === 0 ? (
        <Empty>{L({ hi: "इस परीक्षा में कोई कक्षा नहीं। परीक्षा सेटअप में कक्षाएँ जोड़ें।", en: "No section sits this exam. Add classes in Exam setup." })}</Empty>
      ) : !section ? (
        <ul>
          {sections.map((s) => (
            <li key={s.classSec}>
              <button type="button" onClick={() => setSection(s.classSec)} className="flex min-h-[52px] w-full items-center justify-between border-b border-ink-100 text-left">
                <span className="text-[15px] font-semibold">{s.classSec}</span>
                <span className="tnum text-[13px] text-ink-400">
                  {s.students} {L({ hi: "बच्चे", en: "students" })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : !cards ? (
        rep.error && rep.error.status !== 401 ? <ErrorCard offline={rep.error.status === 0} onRetry={rep.reload} /> : <ListSkeleton rows={8} />
      ) : cards.length === 0 ? (
        <Empty>{L({ hi: `${section} में कोई बच्चा नहीं।`, en: `No students in ${section}.` })}</Empty>
      ) : (
        <>
          {incomplete > 0 && (
            <p className="rounded-xl bg-marigold-50 px-3 py-2 text-[13px] text-ink-800">
              {L({ hi: `${incomplete} कार्ड अधूरे हैं: कुछ विषयों के अंक नहीं भरे, वहाँ “—” छपेगा और ग्रेड/रैंक नहीं।`, en: `${incomplete} card(s) incomplete: some subjects have no marks, so they print “—” with no grade or rank.` })}{" "}
              <Link href={`/erp/exams/marks/?exam=${examId}`} className="font-semibold underline underline-offset-2">
                {L({ hi: "अंक भरें", en: "Enter marks" })}
              </Link>
            </p>
          )}
          <label className="field-box min-h-[48px]">
            <Search aria-hidden />
            <input id="rc-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, रोल या SR नं.", en: "Name, roll or SR no." })} autoComplete="off" />
          </label>
          <p className="tnum text-[12.5px] text-ink-500">
            {section} · {cards.length} {L({ hi: "बच्चे", en: "students" })}
            {incomplete ? ` · ${incomplete} ${L({ hi: "अधूरे", en: "incomplete" })}` : ""}
          </p>
          <ul>
            {shown.map((c) => (
              <li key={c.studentId}>
                <button type="button" onClick={() => setOpenId(c.studentId)} className="flex min-h-[58px] w-full items-center gap-3 border-b border-ink-100 py-2 text-left">
                  <span className="tnum w-7 shrink-0 text-right text-[13px] text-ink-400">{c.rollNo || "–"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                    <span className={clsx("mt-0.5 flex items-center gap-1.5 text-[12.5px]", !c.complete ? "text-ink-500" : c.result === "Passed" ? "text-jade-700" : "text-marigold-700")}>
                      <span className={clsx("h-1.5 w-1.5 rounded-full", !c.complete ? "bg-ink-300" : c.result === "Passed" ? "bg-jade-500" : "bg-marigold-500")} aria-hidden />
                      {!c.complete ? L({ hi: "अधूरा", en: "Incomplete" }) : c.result === "Passed" ? L({ hi: "पास", en: "Passed" }) : L({ hi: "सुधार चाहिए", en: "Needs improvement" })}
                    </span>
                  </span>
                  {c.complete && (
                    <span className="shrink-0 text-right">
                      <span className="tnum block text-[15px] font-bold">{c.percent.toFixed(1)}%</span>
                      <span className="tnum block text-[12px] text-ink-500">
                        {c.grade}
                        {c.rank ? ` · ${L({ hi: "रैंक", en: "Rank" })} ${c.rank}` : ""}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            ))}
            {!shown.length && <li className="py-8 text-center text-[14px] text-ink-500">{L({ hi: `“${q}” से कोई नहीं मिला।`, en: `Nobody matches “${q}”.` })}</li>}
          </ul>
          <StickyBar>
            <button type="button" onClick={() => setPrinting(cards)} disabled={!!printing} className="btn-primary w-full">
              <Printer className="h-4 w-4" aria-hidden /> {L({ hi: `पूरी कक्षा छापें (${cards.length})`, en: `Print whole class (${cards.length})` })}
            </button>
          </StickyBar>
        </>
      )}

      {open && report && <CardSheet card={open} report={report} school={school} onClose={() => setOpenId("")} onPrint={() => setPrinting([open])} />}

      {printing && report && (
        <PrintReportCards onDone={() => setPrinting(null)}>
          {printing.map((c) => (
            <React.Fragment key={c.studentId}>
              <ReportCardDocument exam={report.exam} classSec={report.classSec} card={c} school={school} />
              <ReportCardBack card={c} school={school} />
            </React.Fragment>
          ))}
        </PrintReportCards>
      )}
    </div>
  );
}

/** One student's card as it prints: front and back sheets, scaled to the phone. */
function CardSheet({ card, report, school, onClose, onPrint }: { card: ReportCard; report: Report; school: ReportSchool; onClose: () => void; onPrint: () => void }) {
  const L = useL();
  const [side, setSide] = useState<"front" | "back">("front");
  return (
    <Sheet title={card.name} onClose={onClose}>
      <p className="-mt-1 mb-2 text-[13px] text-ink-500">
        {report.classSec} · {L({ hi: "रोल", en: "Roll" })} {card.rollNo || "–"} · {card.result}
      </p>
      <LineTabs
        label={L({ hi: "कार्ड का हिस्सा", en: "Card side" })}
        value={side}
        onChange={setSide}
        options={[
          { key: "front", text: L({ hi: "आगे", en: "Front" }) },
          { key: "back", text: L({ hi: "पीछे", en: "Back" }) },
        ]}
      />
      <div className="mt-3 overflow-hidden rounded-lg ring-1 ring-ink-200">
        <SheetPreview>{side === "front" ? <ReportCardDocument exam={report.exam} classSec={report.classSec} card={card} school={school} /> : <ReportCardBack card={card} school={school} />}</SheetPreview>
      </div>
      <button type="button" onClick={onPrint} className="btn-primary mt-4 w-full">
        <Printer className="h-4 w-4" aria-hidden /> {L({ hi: "यह कार्ड छापें", en: "Print this card" })}
      </button>
    </Sheet>
  );
}
