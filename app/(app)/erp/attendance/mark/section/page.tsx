"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, MessageCircle, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { absenceWhatsApp, type AttendanceDay, type AttStatus, type RosterStudent, type SectionRoster } from "@/lib/erpAttendance";
import { Empty, ErrorCard, ListSkeleton, StickyBar } from "@/components/ui";

/*
 * ERP login → one section's roll call: the ERP's MarkDrawer in the staff app's roll-call look. Everyone starts
 * Present; P / A / L / H set a mark, tapping the name flips present ↔ absent, or type the absent roll numbers.
 * POST /api/attendance/section saves (and, when the school's WhatsApp is linked, the backend tells absent
 * children's parents). Then the absent list with WhatsApp buttons, and "Next section".
 */

type Q = { date: string; cls: string; sec: string };
const shortDate = (date: string) => new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const clock = (at: string) => new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

export default function ErpRollCallPage() {
  const [q, setQ] = useState<Q | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ date: p.get("date") || "", cls: p.get("class") || "", sec: p.get("section") || "" });
  }, []);
  if (!q) return <ListSkeleton rows={6} />;
  return <Roll key={`${q.date}|${q.cls}|${q.sec}`} {...q} />;
}

function Roll({ date, cls, sec }: Q) {
  const L = useL();
  const qs = new URLSearchParams({ date, class: cls, section: sec }).toString();
  const { data: roster, error, reload } = useApi<SectionRoster>(`/erp/attendance/section?${qs}`);
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [rolls, setRolls] = useState("");
  const [busy, setBusy] = useState(false);
  // auto: null when the school sends absent alerts by hand, else how many were just queued
  const [done, setDone] = useState<{ absent: RosterStudent[]; auto: number | null } | null>(null);
  const [nextLink, setNextLink] = useState<string | null | undefined>(undefined);
  const classSec = `${cls} - ${sec}`;

  useEffect(() => {
    if (!roster) return;
    setMarks(Object.fromEntries(roster.students.map((s) => [s.id, s.status || "Present"])));
    setRemarks(Object.fromEntries(roster.students.map((s) => [s.id, s.remark || ""])));
  }, [roster]);

  const counts = useMemo(() => {
    const c: Record<AttStatus, number> = { Present: 0, Absent: 0, Leave: 0, HalfDay: 0 };
    Object.values(marks).forEach((m) => (c[m] += 1));
    return c;
  }, [marks]);

  if (!roster) return error && error.status !== 401 ? (error.status === 404 ? <Empty>{L({ hi: "यह सेक्शन नहीं मिला।", en: "This section was not found." })}</Empty> : <ErrorCard offline={error.status === 0} onRetry={reload} />) : <ListSkeleton rows={8} />;

  const set = (id: string, v: AttStatus) => setMarks((m) => ({ ...m, [id]: v }));
  const flip = (id: string) => setMarks((m) => ({ ...m, [id]: m[id] === "Present" ? "Absent" : "Present" }));

  /** "3, 7, 12" → those roll numbers absent (ERP applyRolls). */
  function applyRolls() {
    const wanted = new Set(
      rolls
        .split(/[\s,]+/)
        .map((x) => x.trim().replace(/^0+/, ""))
        .filter(Boolean)
    );
    const hit = roster!.students.filter((s) => wanted.has(String(s.rollNo).replace(/^0+/, "")));
    if (!hit.length) return toast(false, L({ hi: "इन रोल नंबर का कोई बच्चा नहीं।", en: "No student has those roll numbers." }));
    setMarks((m) => ({ ...m, ...Object.fromEntries(hit.map((s) => [s.id, "Absent" as AttStatus])) }));
    const missing = Array.from(wanted).filter((r) => !roster!.students.some((s) => String(s.rollNo).replace(/^0+/, "") === r));
    toast(!missing.length, L({ hi: `${hit.length} अनुपस्थित${missing.length ? `; रोल नं. ${missing.join(", ")} नहीं मिले` : ""}।`, en: `${hit.length} marked absent${missing.length ? `; no roll no. ${missing.join(", ")}` : ""}.` }));
    setRolls("");
  }

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ success: boolean; data: { present: number; absent: number; leave: number; half: number; whatsappQueued?: number | null } }>("/erp/attendance/section", {
        body: { date, class: roster!.class, section: roster!.section, marks: roster!.students.map((s) => ({ studentId: s.id, status: marks[s.id] || "Present", remark: marks[s.id] === "Leave" || marks[s.id] === "Absent" ? remarks[s.id] : "" })) },
      });
      setDone({ absent: roster!.students.filter((s) => marks[s.id] === "Absent"), auto: r.data.whatsappQueued ?? null });
      toast(true, L({ hi: `${classSec}: ${r.data.present + r.data.half} उपस्थित, ${r.data.absent} अनुपस्थित।`, en: `${classSec}: ${r.data.present + r.data.half} present, ${r.data.absent} absent.` }));
      window.scrollTo(0, 0);
      // The next section of this day still to be marked (ERP nextUnmarked).
      api<AttendanceDay>(`/erp/attendance/day?date=${date}`)
        .then((d) => {
          const list = d.sections;
          const i = list.findIndex((s) => s.class === cls && s.section === sec);
          const n = list.slice(i + 1).concat(list.slice(0, i)).find((s) => s.marked === 0);
          setNextLink(n ? `/erp/attendance/mark/section/?date=${date}&class=${encodeURIComponent(n.class)}&section=${encodeURIComponent(n.section)}` : null);
        })
        .catch(() => setNextLink(null));
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "हाज़िरी सेव नहीं हुई।", en: "Could not save attendance." }));
    } finally {
      setBusy(false);
    }
  }

  const school = `${p?.school_name || "School"}, ${p?.city || "Barmer"}`;
  const head = (
    <div>
      <p className="text-[18px] font-bold">
        {classSec} · {shortDate(date)}
      </p>
      <p className="text-[12.5px] text-ink-500">
        {roster.saved ? `${L({ hi: "सेव", en: "Saved" })} ${roster.markedAt ? clock(roster.markedAt) : ""}${roster.markedBy ? ` · ${roster.markedBy.split(" (")[0]}` : ""} · ${L({ hi: "बदल सकते हैं", en: "you can change it" })}` : `${roster.students.length} ${L({ hi: "बच्चे · अभी हाज़िरी नहीं लगी", en: "students · not marked yet" })}`}
      </p>
    </div>
  );

  if (done)
    return (
      <div className="animate-rise space-y-4">
        {head}
        <div className="rounded-2xl bg-jade-50 p-4 text-center">
          <Check className="mx-auto h-8 w-8 text-jade-600" strokeWidth={3} aria-hidden />
          <p className="mt-1 text-[16px] font-semibold">{L({ hi: `${classSec} की हाज़िरी सेव हुई`, en: `Attendance saved for ${classSec}` })}</p>
          <p className="text-[13.5px] text-ink-600">
            {counts.Present + counts.HalfDay} {L({ hi: "उपस्थित", en: "present" })} · {counts.Absent} {L({ hi: "अनुपस्थित", en: "absent" })} · {counts.Leave} {L({ hi: "छुट्टी", en: "on leave" })}
          </p>
        </div>
        {done.absent.length > 0 && (
          <section className="space-y-1">
            <h2 className="text-[15px] font-bold text-brand-800">{done.auto === null ? L({ hi: "अनुपस्थित बच्चों के माता-पिता को बताएँ", en: "Tell parents of absent students" }) : L({ hi: "माता-पिता को WhatsApp पर बताया जा रहा है", en: "Parents are being told on WhatsApp" })}</h2>
            <p className="text-[12.5px] text-ink-500">
              {done.auto === null ? L({ hi: "हिंदी मैसेज के साथ WhatsApp खुलेगा; वहाँ भेजें दबाएँ।", en: "Opens WhatsApp with a Hindi message; press send there." }) : done.auto > 0 ? L({ hi: `स्कूल के नंबर से ${done.auto} नए मैसेज लगे।`, en: `${done.auto} new message(s) queued from the school's number.` }) : L({ hi: "पहले ही लग चुके।", en: "Already queued earlier." })}
            </p>
            <ul>
              {done.absent.map((s) => {
                const link = absenceWhatsApp(s.mobile, s.name, classSec, shortDate(date), school);
                return (
                  <li key={s.id} className="flex items-center gap-3 border-b border-ink-100 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-500">
                        {L({ hi: "रोल", en: "Roll" })} {s.rollNo} · {s.fatherName} · {s.mobile}
                      </span>
                    </span>
                    {done.auto !== null ? null : link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-jade-600 px-3 text-[13px] font-semibold text-white">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
                      </a>
                    ) : (
                      <span className="shrink-0 text-[12px] text-rose-600">{L({ hi: "मोबाइल सही नहीं", en: "No valid mobile" })}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Link href={`/erp/attendance/mark/?date=${date}`} className="btn-line">
            {L({ hi: "सारे सेक्शन", en: "All sections" })}
          </Link>
          {nextLink ? (
            <a href={nextLink} className="btn-primary">
              {L({ hi: "अगला सेक्शन", en: "Next section" })} <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          ) : (
            <span className="self-center text-center text-[13px] text-ink-500">{nextLink === null ? L({ hi: "इस दिन सबकी लग गई", en: "Every section is marked" }) : "…"}</span>
          )}
        </div>
      </div>
    );

  const saveText = busy ? "…" : `${roster.saved ? L({ hi: "बदलाव सेव करें", en: "Save changes" }) : L({ hi: "हाज़िरी सेव करें", en: "Save attendance" })} · ${counts.Present + counts.HalfDay} P, ${counts.Absent} A${counts.Leave ? `, ${counts.Leave} L` : ""}`;
  const circle = (s: RosterStudent, v: AttStatus, label: string) => {
    const on = (marks[s.id] || "Present") === v;
    return (
      <button type="button" onClick={() => set(s.id, v)} aria-pressed={on} aria-label={`${s.name}: ${label}`} className="grid h-11 place-items-center">
        {on ? <Dot v={v} /> : <span className="h-5 w-5 rounded-full border-[1.6px] border-ink-300" />}
      </button>
    );
  };

  return (
    <div className="animate-rise space-y-2.5 pb-20">
      {head}
      <div className="flex gap-2">
        <label className="field-box min-h-[46px] flex-1">
          <small>{L({ hi: "अनुपस्थित रोल नं.", en: "Absent roll nos." })}</small>
          <input id="att-rolls" value={rolls} onChange={(e) => setRolls(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyRolls())} placeholder="3, 7, 12" inputMode="numeric" />
        </label>
        <button type="button" onClick={applyRolls} disabled={!rolls.trim()} className="btn-line shrink-0 px-3 text-[13.5px]">
          {L({ hi: "अनुपस्थित करें", en: "Mark absent" })}
        </button>
      </div>
      <button type="button" onClick={() => setMarks(Object.fromEntries(roster.students.map((s) => [s.id, "Present" as AttStatus])))} className="flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-brand-600">
        <Check className="h-4 w-4" aria-hidden /> {L({ hi: "सब उपस्थित", en: "All present" })}
      </button>

      <div className="grid grid-cols-[28px_1fr_36px_36px_36px_36px] items-center px-1 pb-0.5 text-[12px] font-semibold text-ink-400">
        <span>{L({ hi: "रोल", en: "No." })}</span>
        <span>{L({ hi: "नाम", en: "Name" })}</span>
        <span className="text-center">P</span>
        <span className="text-center">A</span>
        <span className="text-center">L</span>
        <span className="text-center">H</span>
      </div>
      <ul>
        {roster.students.map((s) => {
          const m = marks[s.id] || "Present";
          const note = m === "Leave" || m === "Absent";
          return (
            <li key={s.id} className={clsx("roll-row px-1", m !== "Present" && "roll-row-on")}>
              <div className="grid min-h-[52px] grid-cols-[28px_1fr_36px_36px_36px_36px] items-center text-[15px]">
                <span className="tnum text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                <button type="button" onClick={() => flip(s.id)} className="min-h-[44px] min-w-0 text-left">
                  <span className="block truncate">{s.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-400">{s.fatherName}</span>
                </button>
                {circle(s, "Present", L({ hi: "उपस्थित", en: "Present" }))}
                {circle(s, "Absent", L({ hi: "अनुपस्थित", en: "Absent" }))}
                {circle(s, "Leave", L({ hi: "छुट्टी", en: "Leave" }))}
                {circle(s, "HalfDay", L({ hi: "आधा दिन", en: "Half day" }))}
              </div>
              <div className={clsx("expand", note && "expand-open")} aria-hidden={!note}>
                <div className="overflow-hidden">
                  <input
                    value={remarks[s.id] || ""}
                    onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: e.target.value }))}
                    disabled={!note}
                    tabIndex={note ? 0 : -1}
                    maxLength={200}
                    placeholder={m === "Leave" ? L({ hi: "छुट्टी का कारण (अगर हो)", en: "Reason for leave (optional)" }) : L({ hi: "नोट (अगर हो), जैसे बुखार", en: "Note (optional), e.g. fever" })}
                    aria-label={`${s.name}: ${L({ hi: "नोट", en: "note" })}`}
                    className="mb-2.5 h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[15px] placeholder:text-ink-400 focus:border-ink-900 focus:outline-none disabled:bg-ink-50"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-500">{L({ hi: "P उपस्थित · A अनुपस्थित · L छुट्टी · H आधा दिन (आधा उपस्थित गिना जाता है)", en: "P present · A absent · L leave · H half day (counts as half present)" })}</p>

      <StickyBar>
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {saveText}
        </button>
      </StickyBar>
    </div>
  );
}

function Dot({ v }: { v: AttStatus }) {
  return (
    <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-white", v === "Present" ? "bg-jade-600" : v === "Absent" ? "bg-rose-600" : v === "Leave" ? "bg-marigold-500" : "bg-sky-600")}>
      {v === "Present" ? <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : v === "Absent" ? <X className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : <span className="text-[10px] font-bold leading-none">{v === "Leave" ? "L" : "H"}</span>}
    </span>
  );
}
