"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronRight } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { weekdayDate } from "@/lib/format";
import { ErrorCard, Skeleton } from "@/components/ui";

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

const OPTS: { key: Mark; text: { hi: string; en: string }; on: string }[] = [
  { key: "P", text: { hi: "उप.", en: "P" }, on: "bg-jade-600 text-white" },
  { key: "A", text: { hi: "अनु.", en: "A" }, on: "bg-rose-500 text-white" },
  { key: "L", text: { hi: "छुट्टी", en: "L" }, on: "bg-marigold-400 text-ink-900" },
  { key: "H", text: { hi: "आधा", en: "H" }, on: "bg-marigold-400 text-ink-900" },
];

export default function AttendancePage() {
  const { me } = useStaff();
  const L = useL();
  const { lang } = useLang();
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useApi<Sections>(me ? "/attendance/sections" : null);

  if (open && data) return <MarkSheet id={open} date={data.date} onBack={() => setOpen(null)} onSaved={() => { setOpen(null); reload(); }} />;

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return (
      <div className="card space-y-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-3">
      <p className="px-1 pt-1 text-sm font-medium text-ink-500">{weekdayDate(data.date, lang)}</p>
      <section className="card p-4">
        <p className="card-title">{L({ hi: "आपकी कक्षाएँ", en: "Your classes" })}</p>
        <ul className="mt-1 divide-y divide-ink-100">
          {data.sections.map((s) => (
            <li key={s.id}>
              <button onClick={() => setOpen(s.id)} className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">{s.classSec}</span>
                  <span className="block text-sm text-ink-500">
                    {s.students} {L({ hi: "बच्चे", en: "students" })}
                    {s.mine ? "" : ` · ${L({ hi: "सिर्फ़ देखें", en: "view only" })}`}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
                  <span className={clsx("dot", s.marked ? "bg-jade-600" : "bg-rose-500")} aria-hidden />
                  {s.marked ? L({ hi: "लग गई", en: "Marked" }) : L({ hi: "बाकी", en: "Not marked" })}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MarkSheet({ id, date, onBack, onSaved }: { id: string; date: string; onBack: () => void; onSaved: () => void }) {
  const L = useL();
  const { me } = useStaff();
  const { data, error, reload } = useApi<Sheet>(`/attendance/section?id=${id}&date=${date}`);
  const [marks, setMarks] = useState<Record<string, Mark | null>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const editable = !!me?.sections.find((s) => s.id === id)?.classTeacher;

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.students.map((s) => [s.id, s.status])));
  }, [data]);

  const count = useMemo(() => {
    const c = { P: 0, A: 0, L: 0, H: 0, none: 0 };
    for (const v of Object.values(marks)) c[v || "none"]++;
    return c;
  }, [marks]);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <Skeleton className="h-64 w-full" />;

  const setAll = (m: Mark) => setMarks(Object.fromEntries(data.students.map((s) => [s.id, m])));

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await api("/attendance/section", { body: { id, date, marks } });
      onSaved();
    } catch (e) {
      setMsg(e instanceof ApiError && e.message ? e.message : L({ hi: "सेव नहीं हुआ। दोबारा कोशिश करें।", en: "Could not save. Please try again." }));
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-3 pb-24">
      <button onClick={onBack} className="link -ml-1 text-sm">
        ‹ {L({ hi: "कक्षाएँ", en: "Classes" })}
      </button>
      <h1 className="text-xl font-bold">{data.classSec}</h1>

      {editable && (
        <button onClick={() => setAll("P")} className="btn-quiet w-full">
          <Check className="h-5 w-5 text-jade-600" aria-hidden /> {L({ hi: "सबको उपस्थित करें", en: "Mark everyone present" })}
        </button>
      )}

      <ul className="card divide-y divide-ink-100 overflow-hidden">
        {data.students.map((s) => (
          <li key={s.id} className="px-3 py-2.5">
            <p className="flex items-baseline gap-2">
              <span className="tnum w-6 shrink-0 text-sm text-ink-500">{s.rollNo}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">{s.name}</span>
            </p>
            <span className="mt-1.5 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={s.name}>
              {OPTS.map((o) => (
                <button
                  key={o.key}
                  role="radio"
                  aria-checked={marks[s.id] === o.key}
                  disabled={!editable}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: o.key }))}
                  className={clsx("h-11 rounded-lg px-1.5 text-[14px] font-semibold transition", marks[s.id] === o.key ? o.on : "bg-ink-100 text-ink-600")}
                >
                  {L(o.text)}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>

      {editable ? (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-10 mx-auto max-w-[560px] border-t border-ink-200 bg-white px-3 py-3 shadow-bar">
          {msg && (
            <p className="mb-2 font-medium text-rose-700" role="alert">
              {msg}
            </p>
          )}
          <div className="flex items-center gap-3">
            <p className="tnum min-w-0 flex-1 text-sm text-ink-600">
              {L({ hi: "उप.", en: "P" })} {count.P} · {L({ hi: "अनु.", en: "A" })} {count.A} · {L({ hi: "छुट्टी", en: "L" })} {count.L + count.H}
              {count.none > 0 && <span className="block text-rose-700">{count.none} {L({ hi: "बाकी", en: "left" })}</span>}
            </p>
            <button onClick={save} disabled={busy || count.none > 0} className="btn-primary px-6">
              {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
            </button>
          </div>
        </div>
      ) : (
        <p className="px-2 text-sm text-ink-500">{L({ hi: "सिर्फ़ क्लास टीचर हाज़िरी लगा सकते हैं।", en: "Only the class teacher can mark attendance." })}</p>
      )}
    </div>
  );
}
