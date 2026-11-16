"use client";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError, useApi } from "@/lib/api";
import { useToastMsg } from "@/lib/toast";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { dayMonth } from "@/lib/format";
import { Empty, ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

interface Note {
  id: string;
  studentId: string;
  student: string;
  classSec: string;
  text: string;
  parentCanSee: boolean;
  date: string;
}

/** A short remark about one student. The teacher chooses whether the parent sees it. */
export default function NotesPage() {
  const { me } = useStaff();
  const L = useL();
  const { lang } = useLang();
  const sections = me?.sections || [];
  const [sec, setSec] = useState("");
  const [student, setStudent] = useState("");
  const [text, setText] = useState("");
  useUnsavedChanges(!!text.trim());
  const [busy, setBusy] = useState(false);
  const setMsg = useToastMsg();

  useEffect(() => {
    if (!sec && sections.length) setSec(sections.find((s) => s.classTeacher)?.id || sections[0].id);
  }, [sections, sec]);
  const roster = useApi<{ students: { id: string; name: string; rollNo: string }[] }>(sec ? `/students?section=${sec}` : null);
  const notes = useApi<{ notes: Note[] }>(me ? "/notes" : null);
  useEffect(() => {
    const first = roster.data?.students[0]?.id;
    if (first && !roster.data!.students.some((s) => s.id === student)) setStudent(first);
  }, [roster.data, student]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setMsg({ ok: false, text: L({ hi: "पहले नोट लिखें।", en: "Write the note first." }) });
    setBusy(true);
    setMsg(null);
    try {
      await api("/notes", { body: { student, text: text.trim(), parentCanSee: true } });
      setText("");
      setMsg({ ok: true, text: L({ hi: "नोट भेज दिया। माता-पिता देख सकेंगे।", en: "Note sent. The parent can see it." }) });
      notes.reload();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.message ? err.message : L({ hi: "सेव नहीं हुआ।", en: "Could not save." }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-5">
      <form onSubmit={save} className="teacher-form space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={sec} onChange={setSec}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.classSec}
              </option>
            ))}
          </SelectBox>
          <SelectBox label={L({ hi: "बच्चा", en: "Student" })} value={student} onChange={setStudent}>
            {(roster.data?.students || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectBox>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-500">{L({hi:"\u092f\u0939 \u0928\u094b\u091f \u092c\u091a\u094d\u091a\u0947 \u0915\u0947 \u0905\u092d\u093f\u092d\u093e\u0935\u0915 \u0915\u094b \u0926\u093f\u0916\u0947\u0917\u093e\u0964",en:"This note will be visible to the student's parent."})}</p>
        <textarea aria-label={L({hi:"\u0928\u094b\u091f",en:"Note"})} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={500} className="textarea-box" placeholder={L({ hi: "जैसे: भिन्न में कमज़ोर है, घर पर रोज़ 15 मिनट अभ्यास करवाएँ।", en: "e.g. Falling behind in fractions; needs 15 minutes of practice at home daily." })} />
        <button type="submit" disabled={busy || !student} className="btn-go w-full">
          {busy ? "…" : L({ hi: "नोट भेजें", en: "Send note" })}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="teacher-section-heading">{L({ hi: "पहले के नोट", en: "Earlier notes" })}</h2>
        {!notes.data ? (
          notes.error && notes.error.status !== 401 ? <ErrorCard offline={notes.error.status === 0} slow={notes.error.message === "timeout"} onRetry={notes.reload} /> : <ListSkeleton rows={2} />
        ) : notes.data.notes.length === 0 ? (
          <Empty>{L({ hi: "अभी कोई नोट नहीं।", en: "No notes yet." })}</Empty>
        ) : (
          <ul className="space-y-2">
            {notes.data.notes.map((n) => (
              <li key={n.id} className="row-card">
                {/* Top: the child's name. Bottom corner: the date. */}
                <p className="truncate text-[15px] font-semibold leading-snug text-ink-900">
                  {n.student} <span className="text-[13.5px] font-medium text-ink-500">· {n.classSec}</span>
                </p>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <p className="min-w-0 text-[14.5px] leading-relaxed">{n.text}</p>
                  <span className="shrink-0 text-[14px] font-bold text-ink-900">{dayMonth(n.date, lang)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
