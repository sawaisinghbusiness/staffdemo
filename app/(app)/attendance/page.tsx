"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
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
  students: { id: string; name: string; rollNo: string; status: Mark | null }[];
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
      {tab === "students" ? <Students /> : <MyMonth />}
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const editable = !!me?.sections.find((s) => s.id === id)?.classTeacher;

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.students.map((s) => [s.id, s.status || "P"])));
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

  // Present ↔ absent; leave or half day (from an approved application) goes back to present.
  const toggle = (sid: string) => editable && setMarks((m) => ({ ...m, [sid]: m[sid] === "P" ? "A" : "P" }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/attendance/section", { body: { id, date, marks } });
      setMsg({ ok: true, text: L({ hi: "हाज़िरी सेव हो गई।", en: "Attendance saved." }) });
      onSaved();
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError && e.message ? e.message : L({ hi: "सेव नहीं हुआ। दोबारा कोशिश करें।", en: "Could not save. Please try again." }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clsx("space-y-2", editable && "pb-20")}>
      <p className="text-[13px] text-ink-500">
        {data.students.length} {L({ hi: "बच्चे", en: "students" })} ·{" "}
        {!editable
          ? L({ hi: "सिर्फ़ क्लास टीचर हाज़िरी लगा सकते हैं", en: "only the class teacher can mark" })
          : data.marked
            ? L({ hi: "लग चुकी है, बदल सकते हैं", en: "already marked, you can change it" })
            : L({ hi: "जो नहीं आया उसके नाम पर टैप करें", en: "tap a name to mark absent" })}
      </p>

      <div className="grid grid-cols-[28px_1fr_40px_40px] items-center px-1 pb-0.5 text-[12px] font-semibold text-ink-400">
        <span>{L({ hi: "रोल", en: "No." })}</span>
        <span>{L({ hi: "नाम", en: "Name" })}</span>
        <span className="text-center">P</span>
        <span className="text-center">A</span>
      </div>
      <ul>
        {data.students.map((s) => {
          const m = marks[s.id] || "P";
          return (
            <li key={s.id}>
              <button
                onClick={() => toggle(s.id)}
                disabled={!editable}
                aria-pressed={m === "A"}
                className={clsx("grid min-h-[52px] w-full grid-cols-[28px_1fr_40px_40px] items-center px-1 text-left text-[15px]", m === "A" ? "rounded-xl bg-rose-50" : "border-b border-ink-100")}
              >
                <span className="tnum text-[13px] text-ink-400">{s.rollNo}</span>
                <span className="min-w-0 truncate">
                  {s.name}
                  {(m === "L" || m === "H") && <span className="ml-1.5 text-[12px] font-semibold text-marigold-600">{m === "L" ? L({ hi: "छुट्टी", en: "Leave" }) : L({ hi: "आधा दिन", en: "Half day" })}</span>}
                </span>
                <span className="grid place-items-center">
                  {m === "P" ? <Dot tone="ok" /> : <span className="h-5 w-5 rounded-full border-[1.6px] border-ink-300" />}
                </span>
                <span className="grid place-items-center">
                  {m === "A" ? <Dot tone="bad" /> : <span className="h-5 w-5 rounded-full border-[1.6px] border-ink-300" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {editable && (
        <StickyBar>
          {msg && (
            <p className={clsx("mb-1.5 text-[14px] font-medium", msg.ok ? "text-jade-700" : "text-rose-700")} role="alert">
              {msg.text}
            </p>
          )}
          <button onClick={save} disabled={busy} className="btn-primary w-full">
            {busy ? "…" : `${L({ hi: "सेव करें", en: "Save" })} · ${count.P} ${L({ hi: "उपस्थित", en: "present" })}, ${count.A} ${L({ hi: "अनुपस्थित", en: "absent" })}${count.L + count.H ? `, ${count.L + count.H} ${L({ hi: "छुट्टी", en: "leave" })}` : ""}`}
          </button>
        </StickyBar>
      )}
    </div>
  );
}

function Dot({ tone }: { tone: "ok" | "bad" }) {
  return (
    <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-white", tone === "ok" ? "bg-jade-600" : "bg-rose-600")}>
      {tone === "ok" ? <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : <X className="h-3 w-3" strokeWidth={3.5} aria-hidden />}
    </span>
  );
}
