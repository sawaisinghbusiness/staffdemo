"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useToastMsg } from "@/lib/toast";
import { useStaff } from "@/lib/staff";
import { useL } from "@/lib/i18n";
import { ErrorCard, LineTabs, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";
import { MyMonth } from "@/components/MyMonth";

type Mark = "P" | "A" | "L" | "H";
interface Sections {
  date: string;
  sections: { id: string; classSec: string; students: number; marked: boolean; mine: boolean }[];
}
interface Sheet {
  id: string;
  classSec: string;
  date: string;
  sunday: boolean;
  holiday: string | null;
  marked: boolean;
  students: { id: string; name: string; rollNo: string; status: Mark | null; remark?: string }[];
}

type Tab = "students" | "teacher";

/** Attendance tab: mark a class (Students), or see your own month (Teacher). */
export default function AttendancePage() {
  const L = useL();
  const [tab, setTab] = useState<Tab>("students");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "teacher") setTab("teacher");
  }, []);

  return (
    <div className="animate-rise space-y-4">
      <LineTabs
        label={L({ hi: "हाज़िरी", en: "Attendance" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "students", text: L({ hi: "बच्चे", en: "Students" }) },
          { key: "teacher", text: L({ hi: "मेरी", en: "Teacher" }) },
        ]}
      />
      {/* The new tab's content fades and rises in. */}
      <div key={tab} className="animate-rise">
        {tab === "students" ? <Students /> : <MyMonth counts={false} />}
      </div>
    </div>
  );
}

function Students() {
  const L = useL();
  const { me } = useStaff();
  const { data, error, reload } = useApi<Sections>(me ? "/attendance/sections" : null);
  const [id, setId] = useState("");
  const [date, setDate] = useState("");

  // Start on the class from the link (Home's "Mark now"), else the teacher's own class.
  useEffect(() => {
    if (!data || id) return;
    const want = new URLSearchParams(window.location.search).get("id");
    setId(data.sections.find((s) => s.id === want)?.id || data.sections.find((s) => s.mine)?.id || data.sections[0]?.id || "");
    setDate(data.date);
  }, [data, id]);

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={id} onChange={setId}>
          {data.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.classSec}
            </option>
          ))}
        </SelectBox>
        <label className="field-box">
          <small>{L({ hi: "तारीख", en: "Date" })}</small>
          <input type="date" value={date} max={data.date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
      </div>
      {id && date && <Roll key={id + date} id={id} date={date} onSaved={reload} />}
    </div>
  );
}

/** Everyone starts present; tap a name to mark absent. One Save at the bottom. */
function Roll({ id, date, onSaved }: { id: string; date: string; onSaved: () => void }) {
  const L = useL();
  const { me } = useStaff();
  const { data, error, reload } = useApi<Sheet>(`/attendance/section?id=${id}&date=${date}`);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const setMsg = useToastMsg();
  const editable = !!me?.sections.find((s) => s.id === id)?.classTeacher;

  useEffect(() => {
    if (!data) return;
    setMarks(Object.fromEntries(data.students.map((s) => [s.id, s.status || "P"])));
    setNotes(Object.fromEntries(data.students.filter((s) => s.remark).map((s) => [s.id, s.remark!])));
  }, [data]);

  const count = useMemo(() => {
    const c = { P: 0, A: 0, L: 0, H: 0 };
    for (const v of Object.values(marks)) c[v]++;
    return c;
  }, [marks]);

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={5} />;
  }
  if (data.sunday || data.holiday) return <p className="row-card text-[15px] text-ink-500">{data.holiday ? `${L({ hi: "छुट्टी", en: "Holiday" })} · ${data.holiday}` : L({ hi: "रविवार को हाज़िरी नहीं लगती।", en: "No attendance on Sunday." })}</p>;

  // Tapping the name flips present ↔ absent (leave or half day goes back to present);
  // the P / A / L circles set that mark directly.
  const toggle = (sid: string) => editable && setMarks((m) => ({ ...m, [sid]: m[sid] === "P" ? "A" : "P" }));
  const set = (sid: string, v: Mark) => editable && setMarks((m) => ({ ...m, [sid]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      // A reason goes only with a student still on leave.
      const remarks = Object.fromEntries(Object.entries(notes).filter(([sid, why]) => marks[sid] === "L" && why.trim()));
      await api("/attendance/section", { body: { id, date, marks, remarks } });
      setMsg({ ok: true, text: L({ hi: "हाज़िरी सेव हो गई।", en: "Attendance saved." }) });
      onSaved();
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError && e.message ? e.message : L({ hi: "सेव नहीं हुआ। दोबारा कोशिश करें।", en: "Could not save. Please try again." }) });
    } finally {
      setBusy(false);
    }
  }

  const saveText = busy
    ? "…"
    : `${L({ hi: "सेव करें", en: "Save" })} · ${count.P} ${L({ hi: "उपस्थित", en: "present" })}, ${count.A} ${L({ hi: "अनुपस्थित", en: "absent" })}${count.L + count.H ? `, ${count.L + count.H} ${L({ hi: "छुट्टी", en: "leave" })}` : ""}`;

  return (
    <div className={clsx("space-y-2", editable && "pb-20")}>
      {/* Save also right under the class and date, so a short class needs no scrolling. */}
      {editable && (
        <button onClick={save} disabled={busy} className="btn-primary w-full">
          {saveText}
        </button>
      )}
      {/* The "14 students · already marked" line is gone (user's ask); only a teacher who can't mark is told why. */}
      {!editable && <p className="text-[13px] text-ink-500">{L({ hi: "सिर्फ़ क्लास टीचर हाज़िरी लगा सकते हैं।", en: "Only the class teacher can mark this class." })}</p>}

      <div className="grid grid-cols-[28px_1fr_40px_40px_40px] items-center px-1 pb-0.5 text-[12px] font-semibold text-ink-400">
        <span>{L({ hi: "रोल", en: "No." })}</span>
        <span>{L({ hi: "नाम", en: "Name" })}</span>
        <span className="text-center">P</span>
        <span className="text-center">A</span>
        <span className="text-center">L</span>
      </div>
      <ul>
        {data.students.map((s) => {
          const m = marks[s.id] || "P";
          const circle = (v: Mark, tone: "ok" | "bad" | "leave", label: string) => (
            <button type="button" onClick={() => set(s.id, v)} disabled={!editable} aria-pressed={m === v} aria-label={`${s.name}: ${label}`} className="grid h-11 place-items-center">
              {m === v ? <Dot tone={tone} /> : <span className="h-5 w-5 rounded-full border-[1.6px] border-ink-300" />}
            </button>
          );
          return (
            // Absent or leave: no fill, just a black outline round the row (user's ask, 2026-10-14).
            // The outline fades in and the reason box slides open, so nothing jumps.
            <li key={s.id} className={clsx("roll-row px-1", m !== "P" && "roll-row-on")}>
              <div className="grid min-h-[52px] grid-cols-[28px_1fr_40px_40px_40px] items-center text-[15px]">
                <span className="tnum text-[13px] text-ink-400">{s.rollNo}</span>
                <button type="button" onClick={() => toggle(s.id)} disabled={!editable} className="min-h-[44px] min-w-0 truncate text-left">
                  {s.name}
                  {m === "H" && <span className="ml-1.5 text-[12px] font-semibold text-marigold-600">{L({ hi: "आधा दिन", en: "Half day" })}</span>}
                </button>
                {circle("P", "ok", L({ hi: "उपस्थित", en: "Present" }))}
                {circle("A", "bad", L({ hi: "अनुपस्थित", en: "Absent" }))}
                {circle("L", "leave", L({ hi: "छुट्टी", en: "Leave" }))}
              </div>
              {/* On leave: why (optional), saved in the ERP's attendance remarks. */}
              <div className={clsx("expand", m === "L" && "expand-open")} aria-hidden={m !== "L"}>
                <div className="overflow-hidden">
                  <input
                    value={notes[s.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                    disabled={!editable || m !== "L"}
                    tabIndex={m === "L" ? 0 : -1}
                    maxLength={200}
                    placeholder={L({ hi: "छुट्टी का कारण (जैसे बीमार, शादी)", en: "Reason for leave (e.g. sick, wedding)" })}
                    aria-label={`${s.name}: ${L({ hi: "छुट्टी का कारण", en: "reason for leave" })}`}
                    className="mb-2.5 h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[15px] placeholder:text-ink-400 focus:border-ink-900 focus:outline-none disabled:bg-ink-50"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editable && (
        <StickyBar>
          <button onClick={save} disabled={busy} className="btn-primary w-full">
            {saveText}
          </button>
        </StickyBar>
      )}
    </div>
  );
}

function Dot({ tone }: { tone: "ok" | "bad" | "leave" }) {
  return (
    <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-white", tone === "ok" ? "bg-jade-600" : tone === "bad" ? "bg-rose-600" : "bg-marigold-500")}>
      {tone === "ok" ? <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : tone === "bad" ? <X className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : <span className="text-[10px] font-bold leading-none">L</span>}
    </span>
  );
}
