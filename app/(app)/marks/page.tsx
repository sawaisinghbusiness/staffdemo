"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, Lock } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL } from "@/lib/i18n";
import { Avatar, ErrorCard, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";

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

/** Pick exam, class and subject (only the teacher's own), then type marks for each child. */
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

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={3} />;
  if (open) return <Entry exam={exam} section={sectionId} subject={subject} onBack={() => setOpen(false)} />;

  const sec = data.sections.find((s) => s.id === sectionId);
  const ex = data.exams.find((e) => e.id === exam);

  return (
    <div className="animate-rise space-y-3">
      <SelectBox label={L({ hi: "परीक्षा", en: "Exam" })} value={exam} onChange={setExam}>
        {data.exams.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
            {e.locked ? ` (${L({ hi: "बंद", en: "locked" })})` : ""}
          </option>
        ))}
      </SelectBox>
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox
          label={L({ hi: "कक्षा", en: "Class" })}
          value={sectionId}
          onChange={(v) => {
            setSectionId(v);
            setSubject(data.sections.find((s) => s.id === v)?.subjects[0] || "");
          }}
        >
          {data.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.classSec}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "विषय", en: "Subject" })} value={subject} onChange={setSubject}>
          {(sec?.subjects || []).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectBox>
      </div>
      {ex && (
        <p className="row-card flex items-center gap-2 text-[14px] text-ink-600">
          {ex.locked && <Lock className="h-4 w-4 shrink-0" aria-hidden />}
          {ex.locked ? L({ hi: "यह परीक्षा बंद है, सिर्फ़ देख सकते हैं।", en: "This exam is locked: view only." }) : `${L({ hi: "हिस्से", en: "Parts" })}: ${ex.parts.map((p) => `${p.name} ${p.max}`).join(" + ")}`}
        </p>
      )}
      <button onClick={() => setOpen(true)} className="btn-primary w-full">
        {ex?.locked ? L({ hi: "अंक देखें", en: "View marks" }) : L({ hi: "अंक भरें", en: "Enter marks" })}
      </button>
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

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />;

  const locked = data.exam.locked;
  const multi = data.exam.parts.length > 1;
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
    <div className={clsx("animate-rise space-y-3", !locked && "pb-20")}>
      <button onClick={onBack} className="-ml-1 flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-brand-600">
        <ChevronLeft className="h-4 w-4" aria-hidden /> {L({ hi: "बदलें", en: "Change" })}
      </button>
      <div className="row-card">
        <p className="text-[16px] font-bold">
          {data.subject} · {data.classSec}
        </p>
        <p className="text-[13px] text-ink-500">
          {data.exam.title} · {L({ hi: "पूर्णांक", en: "out of" })} {max}
          {multi ? ` (${data.exam.parts.map((p) => `${p.name} ${p.max}`).join(" + ")})` : ""}
        </p>
      </div>

      <ul>
        {data.students.map((s) => (
          <li key={s.id} className="flex min-h-[62px] items-center gap-2.5 border-b border-ink-100">
            <Avatar name={s.name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{s.name}</span>
              <span className="block text-[12px] text-ink-400">
                {L({ hi: "रोल", en: "Roll" })} {s.rollNo}
                {multi && ` · ${L({ hi: "कुल", en: "total" })} ${total(s.id)}`}
              </span>
            </span>
            {data.exam.parts.map((p) => {
              const bad = Number(vals[s.id]?.[p.key]) > p.max;
              return (
                <label key={p.key} className="flex shrink-0 flex-col items-center">
                  {multi && <span className="text-[10.5px] leading-none text-ink-400">{p.name.slice(0, 3)}</span>}
                  <input
                    value={vals[s.id]?.[p.key] ?? ""}
                    onChange={(e) => setVals((v) => ({ ...v, [s.id]: { ...v[s.id], [p.key]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) } }))}
                    inputMode="decimal"
                    disabled={locked}
                    aria-label={`${s.name} ${p.name}`}
                    aria-invalid={bad}
                    className={clsx("tnum mt-0.5 h-11 w-[54px] rounded-xl border bg-white text-center font-semibold outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50", bad ? "border-rose-500 text-rose-600" : "border-ink-200")}
                  />
                </label>
              );
            })}
          </li>
        ))}
      </ul>

      {!locked && (
        <StickyBar>
          {msg && (
            <p className={clsx("mb-1.5 text-[14px] font-medium", msg.ok ? "text-jade-700" : "text-rose-700")} role="alert">
              {msg.text}
            </p>
          )}
          <button onClick={save} disabled={busy} className="btn-primary w-full">
            {busy ? "…" : `${L({ hi: "सेव करें", en: "Save" })} · ${filled} / ${data.students.length} ${L({ hi: "भरे", en: "filled" })}`}
          </button>
        </StickyBar>
      )}
    </div>
  );
}
