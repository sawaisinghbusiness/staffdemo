"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL } from "@/lib/i18n";
import { ErrorCard, Skeleton } from "@/components/ui";

interface Part {
  key: string;
  name: string;
  max: number;
}
interface Exams {
  exams: { id: string; title: string; locked: boolean; parts: Part[] }[];
  sections: { id: string; classSec: string; subjects: string[] }[];
}
interface Sheet {
  exam: { id: string; title: string; locked: boolean; parts: Part[] };
  classSec: string;
  subject: string;
  students: { id: string; name: string; rollNo: string; marks: Record<string, number | null> }[];
}

export default function MarksPage() {
  const { me } = useStaff();
  const L = useL();
  const { data, error, reload } = useApi<Exams>(me ? "/marks/exams" : null);
  const [exam, setExam] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subject, setSubject] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data && !exam) {
      setExam(data.exams[0].id);
      setSectionId(data.sections[0].id);
      setSubject(data.sections[0].subjects[0]);
    }
  }, [data, exam]);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-48 w-full" />;

  if (open) return <Entry exam={exam} section={sectionId} subject={subject} onBack={() => setOpen(false)} />;

  const sec = data.sections.find((s) => s.id === sectionId);
  const ex = data.exams.find((e) => e.id === exam);

  return (
    <div className="animate-rise space-y-3">
      <section className="card space-y-3 p-4">
        <p className="card-title">{L({ hi: "अंक भरने के लिए चुनें", en: "Choose what to enter marks for" })}</p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "परीक्षा", en: "Exam" })}</span>
          <select value={exam} onChange={(e) => setExam(e.target.value)} className="field">
            {data.exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
                {e.locked ? " 🔒" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "कक्षा", en: "Class" })}</span>
            <select
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setSubject(data.sections.find((s) => s.id === e.target.value)?.subjects[0] || "");
              }}
              className="field"
            >
              {data.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.classSec}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "विषय", en: "Subject" })}</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="field">
              {(sec?.subjects || []).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {ex?.locked && (
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <Lock className="h-4 w-4 shrink-0" aria-hidden /> {L({ hi: "यह परीक्षा बंद है, सिर्फ़ देख सकते हैं।", en: "This exam is locked: view only." })}
          </p>
        )}
        <button onClick={() => setOpen(true)} className="btn-primary w-full">
          {ex?.locked ? L({ hi: "अंक देखें", en: "View marks" }) : L({ hi: "अंक भरें", en: "Enter marks" })}
        </button>
      </section>
    </div>
  );
}

function Entry({ exam, section, subject, onBack }: { exam: string; section: string; subject: string; onBack: () => void }) {
  const L = useL();
  const { data, error, reload } = useApi<Sheet>(`/marks/sheet?exam=${exam}&section=${section}&subject=${encodeURIComponent(subject)}`);
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data) setVals(Object.fromEntries(data.students.map((s) => [s.id, Object.fromEntries(data.exam.parts.map((p) => [p.key, s.marks[p.key] == null ? "" : String(s.marks[p.key])]))])));
  }, [data]);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-64 w-full" />;

  const locked = data.exam.locked;
  const total = (id: string) => data.exam.parts.reduce((a, p) => a + (Number(vals[id]?.[p.key]) || 0), 0);
  const max = data.exam.parts.reduce((a, p) => a + p.max, 0);
  const filled = data.students.filter((s) => data.exam.parts.every((p) => vals[s.id]?.[p.key] !== "" && vals[s.id]?.[p.key] !== undefined)).length;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/marks/sheet", { body: { exam, section, subject, marks: vals } });
      setMsg({ ok: true, text: L({ hi: "अंक सेव हो गए।", en: "Marks saved." }) });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError && e.message ? e.message : L({ hi: "सेव नहीं हुआ।", en: "Could not save." }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-3 pb-24">
      <button onClick={onBack} className="link -ml-1 text-sm">
        ‹ {L({ hi: "वापस", en: "Back" })}
      </button>
      <div>
        <h1 className="text-xl font-bold">
          {data.classSec} · {data.subject}
        </h1>
        <p className="text-sm text-ink-500">
          {data.exam.title} · {L({ hi: "कुल", en: "Total" })} {max}
        </p>
      </div>

      <ul className="card divide-y divide-ink-100 overflow-hidden">
        {data.students.map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
            <span className="tnum w-7 shrink-0 text-sm text-ink-500">{s.rollNo}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{s.name}</span>
            {data.exam.parts.map((p) => (
              <label key={p.key} className="flex shrink-0 flex-col items-center">
                {data.exam.parts.length > 1 && <span className="text-[11px] leading-none text-ink-500">{p.name}/{p.max}</span>}
                <input
                  value={vals[s.id]?.[p.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [s.id]: { ...v[s.id], [p.key]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) } }))}
                  inputMode="decimal"
                  disabled={locked}
                  aria-label={`${s.name} ${p.name}`}
                  className={clsx("tnum mt-0.5 h-11 w-[58px] rounded-lg border bg-white text-center text-base font-semibold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50", Number(vals[s.id]?.[p.key]) > p.max ? "border-rose-500" : "border-ink-300")}
                />
              </label>
            ))}
            {data.exam.parts.length > 1 && <span className="tnum w-9 shrink-0 text-right text-sm font-bold text-ink-900">{total(s.id)}</span>}
          </li>
        ))}
      </ul>

      {!locked && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-10 mx-auto max-w-[560px] border-t border-ink-200 bg-white px-3 py-3 shadow-bar">
          {msg && (
            <p className={clsx("mb-2 font-medium", msg.ok ? "text-jade-700" : "text-rose-700")} role="alert">
              {msg.text}
            </p>
          )}
          <div className="flex items-center gap-3">
            <p className="tnum min-w-0 flex-1 text-sm text-ink-600">
              {filled}/{data.students.length} {L({ hi: "भरे गए", en: "filled" })}
            </p>
            <button onClick={save} disabled={busy} className="btn-primary px-6">
              {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
