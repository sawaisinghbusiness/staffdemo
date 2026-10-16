"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Clock, Plus, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { clock } from "@/lib/format";
import { addDays, DAYS, DAYS_FULL, nowHHMM, todayIso } from "@/lib/timetable";
import type { TTBusy, TTEntry, TTOverview, TTPeriod, TTTeacher, TTTeacherEntry } from "@/lib/erpTimetable";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Time Table: the ERP's page (GET /api/timetable, /section/:id, /teacher/:id). Class view or one
 * teacher's week, one day at a time. Same rule as the ERP: everyone sees, only admin changes a lesson
 * (PUT/DELETE /api/timetable/cell — the backend refuses a teacher already busy then) and the periods.
 */

type Tab = "class" | "teacher";

export default function ErpTimetablePage() {
  const L = useL();
  const { lang } = useLang();
  const ov = useApi<TTOverview>("/erp/timetable");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";

  const [tab, setTab] = useState<Tab>("class");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const [now, setNow] = useState(nowHHMM);
  const [cell, setCell] = useState<TTPeriod | null>(null);
  const [periodsOpen, setPeriodsOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);

  // First load: the first class, and a teacher opens on their own week (as in the ERP).
  useEffect(() => {
    const d = ov.data;
    if (!d || d.setupNeeded || classId) return;
    setClassId(d.classes[0]?.id || "");
    setSectionId(d.classes[0]?.sections[0]?.id || "");
    if (d.me && d.teachers.some((t) => t.id === d.me)) {
      setTab("teacher");
      setTeacherId(d.me);
    } else setTeacherId(d.teachers.find((t) => t.teaching)?.id || "");
  }, [ov.data, classId]);

  const sec = useApi<{ entries: TTEntry[]; busy: TTBusy[] }>(tab === "class" && sectionId ? `/erp/timetable/section/${encodeURIComponent(sectionId)}` : null);
  const tch = useApi<{ entries: TTTeacherEntry[] }>(tab === "teacher" && teacherId ? `/erp/timetable/teacher/${encodeURIComponent(teacherId)}` : null);

  const d = ov.data;
  const cls = d?.classes.find((c) => c.id === classId);
  const section = cls?.sections.find((s) => s.id === sectionId);
  const classSec = cls && section ? `${cls.name} - ${section.name}` : "";
  const teachers = useMemo(() => (d?.teachers || []).filter((t) => t.teaching), [d]);
  const teacherName = (id: string | null) => d?.teachers.find((t) => t.id === id)?.name || "";

  if (d?.setupNeeded) return <Empty>{L({ hi: "टाइम टेबल के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261003_timetable.sql)।", en: "Timetable needs a one-time database setup (20261003_timetable.sql)." })}</Empty>;
  if (!d) return ov.error && ov.error.status !== 401 ? <ErrorCard offline={ov.error.status === 0} onRetry={ov.reload} /> : <ListSkeleton rows={6} />;

  const todayN = new Date().getDay(); // 0 = Sunday
  const shown = day ?? (todayN >= 1 && todayN <= 6 ? todayN : 1);
  const t = todayIso();
  const monday = todayN === 0 ? addDays(t, 1) : addDays(t, -(todayN - 1));
  const loaded = tab === "class" ? sec.data : tch.data;
  const loadError = tab === "class" ? sec.error : tch.error;
  const lessonsAWeek = tch.data?.entries.length ?? 0;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <LineTabs
        label={L({ hi: "टाइम टेबल", en: "Time Table" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "class", text: L({ hi: "कक्षा", en: "Class" }) },
          { key: "teacher", text: L({ hi: "टीचर", en: "Teacher" }) },
        ]}
      />

      {tab === "class" ? (
        <div className="grid grid-cols-2 gap-2.5">
          <SelectBox
            label={L({ hi: "कक्षा", en: "Class" })}
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setSectionId(d.classes.find((c) => c.id === v)?.sections[0]?.id || "");
            }}
          >
            {d.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectBox>
          <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sectionId} onChange={setSectionId}>
            {(cls?.sections || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectBox>
        </div>
      ) : teachers.length === 0 ? null : (
        <div>
          <SelectBox label={L({ hi: "टीचर", en: "Teacher" })} value={teacherId} onChange={setTeacherId}>
            {teachers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </SelectBox>
          {tch.data && <p className="tnum mt-1.5 text-[13px] text-ink-500">{L({ hi: `हफ़्ते में ${lessonsAWeek} पीरियड`, en: `${lessonsAWeek} lessons a week` })}</p>}
        </div>
      )}

      {tab === "teacher" && teachers.length === 0 ? (
        <Empty>{L({ hi: "स्टाफ़ लिस्ट में अभी कोई टीचर नहीं।", en: "No teachers on the staff list yet." })}</Empty>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-1.5" role="tablist" aria-label={L({ hi: "दिन", en: "Day" })}>
            {DAYS[lang].map((name, i) => {
              const n = i + 1;
              const on = n === shown;
              return (
                <button key={n} role="tab" aria-selected={on} aria-label={DAYS_FULL[lang][i]} onClick={() => setDay(n)} className={clsx("flex min-h-[54px] flex-col items-center justify-center rounded-xl text-[11.5px] leading-tight", on ? "bg-[#3099a4] text-white/80" : "border border-ink-200 bg-white text-ink-500")}>
                  {name}
                  <b className={clsx("tnum text-[16px]", on ? "text-white" : n === todayN ? "text-[#3099a4]" : "text-ink-900")}>{+addDays(monday, i).slice(8)}</b>
                </button>
              );
            })}
          </div>

          {!loaded ? (
            loadError && loadError.status !== 401 ? <ErrorCard offline={loadError.status === 0} onRetry={tab === "class" ? sec.reload : tch.reload} /> : <ListSkeleton rows={6} />
          ) : d.periods.length === 0 ? (
            <Empty>{isAdmin ? L({ hi: "अभी कोई पीरियड नहीं बना। नीचे \"पीरियड\" से समय डालें।", en: "No periods yet. Set the times with \"Periods\" below." }) : L({ hi: "अभी कोई पीरियड नहीं बना।", en: "No periods set yet." })}</Empty>
          ) : (
            <ol aria-label={`${DAYS_FULL[lang][shown - 1]}${tab === "class" ? ` · ${classSec}` : ""}`}>
              {d.periods.map((p) => {
                const e = tab === "class" ? sec.data?.entries.find((x) => x.day === shown && x.periodId === p.id) : null;
                const te = tab === "teacher" ? tch.data?.entries.find((x) => x.day === shown && x.periodId === p.id) : null;
                const filled = !!(e || te);
                const live = shown === todayN && !!p.start && p.start <= now && now < p.end;
                const editable = tab === "class" && isAdmin && !p.isBreak;
                const body = p.isBreak ? (
                  p.label
                ) : (
                  <>
                    <span className="flex items-baseline gap-1.5">
                      <span className="min-w-0 truncate">{e ? e.subject : te ? te.classSec : editable ? L({ hi: "+ पीरियड डालें", en: "+ Add lesson" }) : L({ hi: "खाली", en: "Free" })}</span>
                      {live && <span className="text-[11px] font-bold uppercase text-brand-600">{L({ hi: "अभी", en: "Now" })}</span>}
                      <span className="ml-auto shrink-0 text-[12px] font-normal text-ink-400">{p.label}</span>
                    </span>
                    {e && <span className="block truncate text-[13px] font-normal text-ink-500">{teacherName(e.staffId) || L({ hi: "टीचर नहीं चुना", en: "No teacher chosen" })}</span>}
                    {te && <span className="block truncate text-[13px] font-normal text-ink-500">{te.subject}</span>}
                  </>
                );
                const box = clsx(
                  "my-1 block w-full rounded-xl px-3 py-2.5 text-left text-[15px]",
                  p.isBreak ? "border border-dashed border-ink-300 font-medium text-ink-400" : live && filled ? "glass-line !rounded-xl !border-[#3099a4] !bg-[#3099a4]/10 font-semibold" : filled ? "glass-line !rounded-xl font-semibold" : editable ? "glass-line !rounded-xl font-semibold text-brand-600" : "glass-line !rounded-xl font-medium text-ink-400",
                );
                return (
                  <li key={p.id} className="grid grid-cols-[46px_14px_1fr] gap-x-1.5">
                    <span className="tnum pt-3.5 text-[13px] text-ink-500">{p.start ? clock(p.start) : ""}</span>
                    <span className="relative" aria-hidden>
                      <span className="absolute inset-y-0 left-[6px] w-0.5 bg-brand-100" />
                      <span className={clsx("absolute left-[2px] top-[18px] h-2.5 w-2.5 rounded-full ring-2 ring-white", p.isBreak || !filled ? "bg-ink-300" : "bg-brand-600")} />
                    </span>
                    {editable ? (
                      <button type="button" onClick={() => setCell(p)} className={box}>
                        {body}
                      </button>
                    ) : (
                      <div className={box}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {isAdmin && (
        <button type="button" onClick={() => setPeriodsOpen(true)} className="btn-line w-full">
          <Clock className="h-4 w-4" aria-hidden /> {L({ hi: "पीरियड और समय", en: "Periods & times" })}
        </button>
      )}
      {tab === "class" && !isAdmin && who.data && <p className="text-center text-[13px] text-ink-500">{L({ hi: "टाइम टेबल सिर्फ़ एडमिन बदल सकते हैं।", en: "Only admin can change the timetable." })}</p>}

      {cell && section && (
        <CellSheet
          sectionId={section.id}
          classSec={classSec}
          subjects={section.subjects}
          day={shown}
          period={cell}
          entry={sec.data?.entries.find((x) => x.day === shown && x.periodId === cell.id) || null}
          teachers={d.teachers}
          busy={sec.data?.busy || []}
          onClose={() => setCell(null)}
          onChanged={() => {
            setCell(null);
            sec.reload();
          }}
        />
      )}
      {periodsOpen && (
        <PeriodsSheet
          periods={d.periods}
          onClose={() => setPeriodsOpen(false)}
          onSaved={() => {
            setPeriodsOpen(false);
            toast(true, L({ hi: "पीरियड सेव हो गए।", en: "Periods saved." }));
            ov.reload();
            sec.reload();
          }}
        />
      )}
    </div>
  );
}

const OTHER = "__other__";

/** One lesson (ERP CellModal): subject, then the teacher. Teachers busy elsewhere then can't be picked. */
function CellSheet({ sectionId, classSec, subjects, day, period, entry, teachers, busy, onClose, onChanged }: {
  sectionId: string;
  classSec: string;
  subjects: string[];
  day: number;
  period: TTPeriod;
  entry: TTEntry | null;
  teachers: TTTeacher[];
  busy: TTBusy[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const L = useL();
  const { lang } = useLang();
  const known = !!entry && subjects.includes(entry.subject);
  const [subject, setSubject] = useState(entry ? (known ? entry.subject : OTHER) : subjects[0] || OTHER);
  const [other, setOther] = useState(entry && !known ? entry.subject : "");
  const [staffId, setStaffId] = useState(entry?.staffId || "");
  const [saving, setSaving] = useState(false);

  const name = subject === OTHER ? other.trim() : subject;
  const taken = useMemo(() => new Map(busy.filter((b) => b.day === day && b.periodId === period.id).map((b) => [b.staffId, b.classSec])), [busy, day, period]);
  const { suggested, rest } = useMemo(() => {
    const mine = (t: TTTeacher) => t.assigned.some((a) => a.classSec === classSec && a.subject === name);
    const list = teachers.filter((t) => t.teaching);
    return { suggested: list.filter(mine), rest: list.filter((t) => !mine(t)) };
  }, [teachers, classSec, name]);

  // A subject with exactly one free teacher of this class fills the teacher in (as in the ERP).
  const pickSubject = (v: string) => {
    setSubject(v);
    if (v === OTHER) return setStaffId("");
    const free = teachers.filter((t) => t.assigned.some((a) => a.classSec === classSec && a.subject === v) && !taken.has(t.id));
    setStaffId(free.length === 1 ? free[0].id : "");
  };

  const run = async (job: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    try {
      await job();
      toast(true, ok);
      onChanged();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setSaving(false);
    }
  };
  const save = () => run(() => api("/erp/timetable/cell", { method: "PUT", body: { sectionId, day, periodId: period.id, subject: name, staffId: staffId || null } }), L({ hi: "पीरियड सेव हो गया।", en: "Lesson saved." }));
  const clear = () => run(() => api("/erp/timetable/cell", { method: "DELETE", body: { sectionId, day, periodId: period.id } }), L({ hi: "पीरियड खाली कर दिया।", en: "Lesson cleared." }));

  const teacherRow = (t: TTTeacher) => {
    const busyIn = taken.get(t.id);
    const blocked = !!busyIn && t.id !== entry?.staffId;
    const on = staffId === t.id;
    return (
      <li key={t.id}>
        <button type="button" disabled={blocked} onClick={() => setStaffId(on ? "" : t.id)} aria-pressed={on} className={clsx("flex min-h-[48px] w-full items-center gap-3 border-b border-ink-100 py-2 text-left", blocked && "opacity-45")}>
          <span className={clsx("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "border-[#3099a4]" : "border-ink-300")} aria-hidden>
            {on && <span className="h-2.5 w-2.5 rounded-full bg-[#3099a4]" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold">{t.name}</span>
            {busyIn ? <span className="block text-[12.5px] text-ink-500">{L({ hi: `इस समय ${busyIn} में`, en: `Busy in ${busyIn}` })}</span> : t.designation && <span className="block truncate text-[12.5px] text-ink-500">{t.designation}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <Sheet title={`${DAYS_FULL[lang][day - 1]} · ${period.label}`} onClose={() => !saving && onClose()}>
      <p className="-mt-1 mb-3 text-[13px] text-ink-500">{classSec}</p>
      <h3 className="mb-2 text-[13px] font-bold text-ink-700">{L({ hi: "विषय", en: "Subject" })}</h3>
      <div className="flex flex-wrap gap-1.5">
        {[...subjects, OTHER].map((s) => (
          <button key={s} type="button" onClick={() => pickSubject(s)} aria-pressed={subject === s} className={clsx("min-h-[40px] rounded-lg px-3 text-[13.5px] font-semibold", subject === s ? "bg-[#3099a4] text-white" : "bg-white text-ink-700 ring-1 ring-ink-200")}>
            {s === OTHER ? L({ hi: "दूसरा…", en: "Other…" }) : s}
          </button>
        ))}
      </div>
      {subject === OTHER && (
        <label className="field-box mt-2 min-h-[48px]">
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder={L({ hi: "जैसे Games", en: "e.g. Games" })} maxLength={40} aria-label={L({ hi: "विषय का नाम", en: "Subject name" })} autoFocus />
        </label>
      )}

      <h3 className="mb-1 mt-4 text-[13px] font-bold text-ink-700">{L({ hi: "टीचर", en: "Teacher" })}</h3>
      {suggested.length > 0 && <p className="text-[12px] font-semibold uppercase text-ink-400">{L({ hi: `यहाँ ${name} पढ़ाते हैं`, en: `Teaches ${name} here` })}</p>}
      <ul>{suggested.map(teacherRow)}</ul>
      {rest.length > 0 && <p className="mt-2 text-[12px] font-semibold uppercase text-ink-400">{suggested.length ? L({ hi: "बाकी टीचर", en: "Other teachers" }) : L({ hi: "टीचर", en: "Teachers" })}</p>}
      <ul className="max-h-[38vh] overflow-y-auto">{rest.map(teacherRow)}</ul>

      <div className={clsx("mt-4 grid gap-2.5", entry ? "grid-cols-2" : "grid-cols-1")}>
        {entry && (
          <button type="button" onClick={clear} disabled={saving} className="btn-line">
            {L({ hi: "खाली करें", en: "Clear" })}
          </button>
        )}
        <button type="button" onClick={save} disabled={saving || name.length < 2} className="btn-primary">
          {saving ? "…" : L({ hi: "सेव करें", en: "Save" })}
        </button>
      </div>
    </Sheet>
  );
}

type Row = { id?: string; label: string; start: string; end: string; isBreak: boolean };

/** The school's periods and breaks, the same for every class (ERP PeriodsDrawer). */
function PeriodsSheet({ periods, onClose, onSaved }: { periods: TTPeriod[]; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [rows, setRows] = useState<Row[]>(() => periods.map((p) => ({ id: p.id, label: p.label, start: p.start, end: p.end, isBreak: p.isBreak })));
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) =>
    setRows((r) => {
      const j = i + by;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const lessons = rows.filter((r) => !r.isBreak).length;

  const save = async () => {
    setBusy(true);
    try {
      await api("/erp/timetable/periods", { method: "PUT", body: { periods: rows } });
      onSaved();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  };

  return (
    <Sheet title={L({ hi: "पीरियड और समय", en: "Periods & times" })} onClose={() => !busy && onClose()}>
      <p className="-mt-1 mb-3 text-[13px] text-ink-500">{L({ hi: `हर कक्षा के लिए एक जैसे · दिन में ${lessons} पीरियड`, en: `Same for every class · ${lessons} lessons a day` })}</p>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id || `new-${i}`} className="glass-line !rounded-xl p-2.5">
            <div className="flex items-center gap-1">
              <label className="field-box min-h-[44px] flex-1">
                <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={24} aria-label={L({ hi: `पंक्ति ${i + 1} का नाम`, en: `Name of row ${i + 1}` })} />
              </label>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-11 w-9 place-items-center text-ink-400 disabled:opacity-30" aria-label={L({ hi: "ऊपर", en: "Move up" })}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="grid h-11 w-9 place-items-center text-ink-400 disabled:opacity-30" aria-label={L({ hi: "नीचे", en: "Move down" })}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="grid h-11 w-9 place-items-center text-ink-400" aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${r.label}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="field-box min-h-[44px] flex-1">
                <input type="time" value={r.start} onChange={(e) => set(i, { start: e.target.value })} className="tnum" aria-label={L({ hi: `${r.label} शुरू`, en: `${r.label} starts` })} />
              </label>
              <span className="text-[12px] text-ink-400">{L({ hi: "से", en: "to" })}</span>
              <label className="field-box min-h-[44px] flex-1">
                <input type="time" value={r.end} onChange={(e) => set(i, { end: e.target.value })} className="tnum" aria-label={L({ hi: `${r.label} ख़त्म`, en: `${r.label} ends` })} />
              </label>
              <label className="flex min-h-[44px] items-center gap-1.5 text-[13px] text-ink-700">
                <input type="checkbox" checked={r.isBreak} onChange={(e) => set(i, { isBreak: e.target.checked })} className="h-5 w-5 accent-brand-600" />
                {L({ hi: "ब्रेक", en: "Break" })}
              </label>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setRows((x) => [...x, { label: `Period ${x.filter((y) => !y.isBreak).length + 1}`, start: "", end: "", isBreak: false }])} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[13.5px] font-semibold text-brand-600">
        <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "पीरियड जोड़ें", en: "Add a period" })}
      </button>
      <button type="button" onClick={save} disabled={busy} className="btn-primary mt-3 w-full">
        {busy ? "…" : L({ hi: "पीरियड सेव करें", en: "Save periods" })}
      </button>
    </Sheet>
  );
}
