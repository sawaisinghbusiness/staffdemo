"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Eye, EyeOff } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
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
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    setBusy(true);
    setMsg(null);
    try {
      await api("/notes", { body: { student, text: text.trim(), parentCanSee: visible } });
      setText("");
      setMsg({ ok: true, text: visible ? L({ hi: "नोट सेव हो गया। माता-पिता देख सकेंगे।", en: "Note saved. The parent can see it." }) : L({ hi: "नोट सेव हो गया। सिर्फ़ स्टाफ़ देखेगा।", en: "Note saved. Only staff can see it." }) });
      notes.reload();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.message ? err.message : L({ hi: "सेव नहीं हुआ।", en: "Could not save." }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-5">
      <form onSubmit={save} className="space-y-3" noValidate>
        <div className="grid grid-cols-[2fr_3fr] gap-2.5">
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
                {s.rollNo}. {s.name}
              </option>
            ))}
          </SelectBox>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={500} className="textarea-box" placeholder={L({ hi: "जैसे: भिन्न में कमज़ोर है, घर पर रोज़ 15 मिनट अभ्यास करवाएँ।", en: "e.g. Falling behind in fractions; needs 15 minutes of practice at home daily." })} />
        <div className="flex flex-wrap gap-x-6" role="radiogroup" aria-label={L({ hi: "कौन देख सकता है", en: "Who can see it" })}>
          <label className="radio">
            <input type="radio" name="vis" checked={visible} onChange={() => setVisible(true)} />
            {L({ hi: "माता-पिता देख सकते हैं", en: "Parent can see" })}
          </label>
          <label className="radio">
            <input type="radio" name="vis" checked={!visible} onChange={() => setVisible(false)} />
            {L({ hi: "सिर्फ़ स्टाफ़", en: "Only staff" })}
          </label>
        </div>
        {msg && (
          <p className={clsx("text-[14px] font-medium", msg.ok ? "text-jade-700" : "text-rose-700")} role="alert">
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={busy || !student} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "नोट सेव करें", en: "Save note" })}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="mlabel">{L({ hi: "पहले के नोट", en: "Earlier notes" })}</h2>
        {!notes.data ? (
          notes.error && notes.error.status !== 401 ? <ErrorCard offline={notes.error.status === 0} onRetry={notes.reload} /> : <ListSkeleton rows={2} />
        ) : notes.data.notes.length === 0 ? (
          <Empty>{L({ hi: "अभी कोई नोट नहीं।", en: "No notes yet." })}</Empty>
        ) : (
          <ul className="space-y-2">
            {notes.data.notes.map((n) => (
              <li key={n.id} className="row-card">
                <p className="meta">
                  <span>
                    <CalendarDays aria-hidden />
                    {dayMonth(n.date, lang)} · {n.student} · {n.classSec}
                  </span>
                </p>
                <p className="mt-1 text-[14.5px] leading-relaxed">{n.text}</p>
                <p className="meta mt-1">
                  <span>
                    {n.parentCanSee ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                    {n.parentCanSee ? L({ hi: "माता-पिता देख सकते हैं", en: "Parent can see" }) : L({ hi: "सिर्फ़ स्टाफ़", en: "Only staff" })}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
