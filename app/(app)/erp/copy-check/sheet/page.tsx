"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, Minus, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { normClasses } from "@/lib/erpStaff";
import { Empty, ErrorCard, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";
import { SetupNeeded } from "@/components/erp/SetupNeeded";

/*
 * ERP login → Copy check → one check: section, subject, date and topic, then every child's notebook as
 * Complete (C), Incomplete (I) or Not submitted (N), in the roll-call look. Not complete opens ready remarks.
 * Everyone starts Complete. POST /api/copy-checks saves (and replaces when editing); DELETE removes it.
 */

type CStatus = "Complete" | "Incomplete" | "NotSubmitted";
type Kid = { id: string; name: string; rollNo: string; photoUrl: string; status: CStatus | null; remark: string };
type One = { id: string; classSec: string; subject: string; date: string; topic: string; checkedBy: string; students: Kid[] };
type Blank = { subjects: string[]; students: Kid[] };

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const REMARKS: Record<Exclude<CStatus, "Complete">, { hi: string; en: string }[]> = {
  Incomplete: [
    { hi: "काम अधूरा", en: "Work incomplete" },
    { hi: "लिखावट सुधारें", en: "Improve handwriting" },
    { hi: "सुधार नहीं किए", en: "Corrections not done" },
    { hi: "कॉपी साफ़ रखें", en: "Keep the notebook neat" },
  ],
  NotSubmitted: [
    { hi: "कॉपी घर पर भूले", en: "Left notebook at home" },
    { hi: "अनुपस्थित था", en: "Was absent" },
    { hi: "कॉपी नहीं है", en: "Has no notebook" },
  ],
};

export default function ErpCopyCheckSheetPage() {
  const [q, setQ] = useState<{ id: string; section: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ id: p.get("id") || "", section: p.get("section") || "" });
  }, []);
  if (!q) return <ListSkeleton rows={6} />;
  return q.id ? <Existing id={q.id} /> : <NewCheck section={q.section} />;
}

function Existing({ id }: { id: string }) {
  const L = useL();
  const { data, error, reload } = useApi<One>(`/erp/copy-checks/${id}`);
  const blank = useApi<Blank>(data ? `/erp/copy-checks/blank?section=${encodeURIComponent(data.classSec)}` : null);
  if (error && /not set up/i.test(error.message)) return <SetupNeeded file="20261019_syllabus_copycheck.sql" what={{ hi: "कॉपी जाँच", en: "Copy check" }} />;
  if (!data || !blank.data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={8} />;
  return <Form id={data.id} section={data.classSec} subjects={blank.data.subjects} students={data.students} init={{ subject: data.subject, date: data.date, topic: data.topic }} by={data.checkedBy} L={L} />;
}

function NewCheck({ section }: { section: string }) {
  const L = useL();
  const cls = useApi<{ data: unknown[] }>("/erp/classes");
  const sections = useMemo(() => normClasses(cls.data as { data?: any[] } | undefined).flatMap((c) => c.sections.map((s) => `${c.name} - ${s.name}`)), [cls.data]);
  const [sec, setSec] = useState(section);
  useEffect(() => {
    if (!sec && sections.length) setSec(sections[0]);
  }, [sections, sec]);
  const blank = useApi<Blank>(sec ? `/erp/copy-checks/blank?section=${encodeURIComponent(sec)}` : null);

  return (
    <div className="animate-rise space-y-3">
      <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sec} onChange={setSec}>
        {sections.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectBox>
      {!blank.data || !sec ? (
        blank.error && blank.error.status !== 401 ? <ErrorCard offline={blank.error.status === 0} onRetry={blank.reload} /> : <ListSkeleton rows={8} />
      ) : !blank.data.subjects.length ? (
        <Empty>{L({ hi: "इस सेक्शन के विषय नहीं डाले गए। सेटिंग → कक्षा और विषय में डालें।", en: "This section has no subjects. Add them in Settings → Classes & subjects." })}</Empty>
      ) : (
        <Form key={sec} id="" section={sec} subjects={blank.data.subjects} students={blank.data.students} init={{ subject: blank.data.subjects[0], date: todayIST(), topic: "" }} by="" L={L} />
      )}
    </div>
  );
}

function Form({ id, section, subjects, students, init, by, L }: { id: string; section: string; subjects: string[]; students: Kid[]; init: { subject: string; date: string; topic: string }; by: string; L: ReturnType<typeof useL> }) {
  const [f, setF] = useState(init);
  const [marks, setMarks] = useState<Record<string, CStatus>>(() => Object.fromEntries(students.map((s) => [s.id, s.status || "Complete"])));
  const [remarks, setRemarks] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, s.remark || ""])));
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const counts = useMemo(() => {
    const c = { Complete: 0, Incomplete: 0, NotSubmitted: 0 };
    Object.values(marks).forEach((m) => (c[m] += 1));
    return c;
  }, [marks]);

  async function save() {
    if (!students.length) return;
    setBusy(true);
    try {
      await api("/erp/copy-checks", { body: { id: id || undefined, classSec: section, subject: f.subject, date: f.date, topic: f.topic, marks: students.map((s) => ({ studentId: s.id, status: marks[s.id], remark: marks[s.id] === "Complete" ? "" : remarks[s.id] || "" })) } });
      toast(true, L({ hi: `${section} ${f.subject}: ${counts.Complete} पूरी, ${counts.Incomplete} अधूरी, ${counts.NotSubmitted} नहीं दी।`, en: `${section} ${f.subject}: ${counts.Complete} complete, ${counts.Incomplete} incomplete, ${counts.NotSubmitted} not given.` }));
      window.location.assign(`/erp/copy-check/`);
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  async function remove() {
    if (!sure) return setSure(true);
    setBusy(true);
    try {
      await api(`/erp/copy-checks/${id}`, { method: "DELETE" });
      toast(true, L({ hi: "जाँच हटा दी।", en: "Check deleted." }));
      window.location.assign(`/erp/copy-check/`);
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "हटाया नहीं गया।", en: "Could not delete." }));
      setBusy(false);
    }
  }

  const circle = (s: Kid, v: CStatus, label: string) => {
    const on = marks[s.id] === v;
    return (
      <button type="button" onClick={() => setMarks((m) => ({ ...m, [s.id]: v }))} aria-pressed={on} aria-label={`${s.name}: ${label}`} className="grid h-11 place-items-center">
        {on ? <Dot v={v} /> : <span className="h-5 w-5 rounded-full border-[1.6px] border-ink-300" />}
      </button>
    );
  };

  return (
    <div className="animate-rise space-y-2.5 pb-20">
      {id && (
        <p className="text-[18px] font-bold">
          {section}
          {by && <span className="block text-[12.5px] font-normal text-ink-500">{L({ hi: "जाँच", en: "Checked by" })}: {by.split(" (")[0]} · {L({ hi: "बदल सकते हैं", en: "you can change it" })}</span>}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "विषय", en: "Subject" })} value={f.subject} onChange={(v) => setF((p) => ({ ...p, subject: v }))}>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectBox>
        <label className="field-box">
          <small>{L({ hi: "तारीख", en: "Date" })}</small>
          <input id="cc-date" type="date" max={todayIST()} value={f.date} onChange={(e) => e.target.value && setF((p) => ({ ...p, date: e.target.value }))} />
          <CalendarDays aria-hidden />
        </label>
      </div>
      <label className="field-box">
        <small>{L({ hi: "कौन-सा काम (अगर लिखना हो)", en: "Topic (optional)" })}</small>
        <input id="cc-topic" value={f.topic} maxLength={120} onChange={(e) => setF((p) => ({ ...p, topic: e.target.value }))} placeholder={L({ hi: "जैसे अध्याय 3 के प्रश्न", en: "e.g. Chapter 3 questions" })} />
      </label>
      <button type="button" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "Complete" as CStatus])))} className="flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-brand-600">
        <Check className="h-4 w-4" aria-hidden /> {L({ hi: "सब पूरी", en: "All complete" })}
      </button>

      <div className="grid grid-cols-[28px_1fr_40px_40px_40px] items-center px-1 pb-0.5 text-[12px] font-semibold text-ink-400">
        <span>{L({ hi: "रोल", en: "No." })}</span>
        <span>{L({ hi: "नाम", en: "Name" })}</span>
        <span className="text-center">{L({ hi: "पूरी", en: "C" })}</span>
        <span className="text-center">{L({ hi: "अधूरी", en: "I" })}</span>
        <span className="text-center">{L({ hi: "नहीं", en: "N" })}</span>
      </div>
      {!students.length ? (
        <Empty>{L({ hi: "इस सेक्शन में कोई बच्चा नहीं।", en: "No students in this section." })}</Empty>
      ) : (
        <ul>
          {students.map((s) => {
            const m = marks[s.id];
            const note = m !== "Complete";
            return (
              <li key={s.id} className={clsx("roll-row px-1", note && "roll-row-on")}>
                <div className="grid min-h-[52px] grid-cols-[28px_1fr_40px_40px_40px] items-center text-[15px]">
                  <span className="tnum text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                  <span className="block min-w-0 truncate">{s.name}</span>
                  {circle(s, "Complete", L({ hi: "पूरी", en: "Complete" }))}
                  {circle(s, "Incomplete", L({ hi: "अधूरी", en: "Incomplete" }))}
                  {circle(s, "NotSubmitted", L({ hi: "नहीं दी", en: "Not submitted" }))}
                </div>
                <div className={clsx("expand", note && "expand-open")} aria-hidden={!note}>
                  <div className="overflow-hidden">
                    <div className="flex flex-wrap gap-1.5 pb-2">
                      {note &&
                        REMARKS[m as Exclude<CStatus, "Complete">].map((r) => {
                          const t = L(r);
                          const on = remarks[s.id] === t;
                          return (
                            <button key={r.en} type="button" onClick={() => setRemarks((x) => ({ ...x, [s.id]: on ? "" : t }))} aria-pressed={on} className={clsx("min-h-[34px] rounded-full border px-3 text-[12.5px] font-medium", on ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700")}>
                              {t}
                            </button>
                          );
                        })}
                    </div>
                    <input
                      value={remarks[s.id] || ""}
                      onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: e.target.value }))}
                      disabled={!note}
                      tabIndex={note ? 0 : -1}
                      maxLength={120}
                      placeholder={L({ hi: "या अपनी बात लिखें", en: "Or write your own" })}
                      aria-label={`${s.name}: ${L({ hi: "टिप्पणी", en: "remark" })}`}
                      className="mb-2.5 h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[15px] placeholder:text-ink-400 focus:border-ink-900 focus:outline-none disabled:bg-ink-50"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {id && (
        <button type="button" onClick={remove} disabled={busy} className={clsx("btn-line w-full", sure && "!border-rose-500 !text-rose-600")}>
          {sure ? L({ hi: "पक्का हटाएँ?", en: "Really delete?" }) : L({ hi: "यह जाँच हटाएँ", en: "Delete this check" })}
        </button>
      )}
      <StickyBar>
        <button type="button" onClick={save} disabled={busy || !students.length} className="btn-primary w-full">
          {busy ? "…" : `${L({ hi: "सेव करें", en: "Save" })} · ${counts.Complete} ${L({ hi: "पूरी", en: "C" })}, ${counts.Incomplete} ${L({ hi: "अधूरी", en: "I" })}, ${counts.NotSubmitted} ${L({ hi: "नहीं", en: "N" })}`}
        </button>
      </StickyBar>
    </div>
  );
}

function Dot({ v }: { v: CStatus }) {
  return (
    <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-white", v === "Complete" ? "bg-jade-600" : v === "Incomplete" ? "bg-marigold-500" : "bg-rose-600")}>
      {v === "Complete" ? <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : v === "Incomplete" ? <Minus className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : <X className="h-3 w-3" strokeWidth={3.5} aria-hidden />}
    </span>
  );
}
