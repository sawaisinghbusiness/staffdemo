"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, MessageCircle, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { absenceWhatsApp, type AttStatus, type RosterStudent, type SectionRoster } from "@/lib/erpAttendance";
import { Empty, ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → one section's roll call, drawn exactly like the teacher app's (app/(app)/attendance): everyone
 * starts present, P / A / L circles, tapping the name flips present ↔ absent, a leave opens a reason box.
 * One Save at the end of the list (user's ask, 2026-10-26: not floating). POST /api/attendance/section saves;
 * when the school's WhatsApp isn't linked, absent children's parents get a WhatsApp button each.
 */

const shortDate = (date: string) => new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function ErpRollCall({ date, cls, sec, onSaved }: { date: string; cls: string; sec: string; onSaved?: () => void }) {
  const L = useL();
  const qs = new URLSearchParams({ date, class: cls, section: sec }).toString();
  const { data: roster, error, reload } = useApi<SectionRoster>(`/erp/attendance/section?${qs}`);
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // After a save with WhatsApp not linked: the absent children, so the office can tell parents by hand.
  const [absent, setAbsent] = useState<RosterStudent[]>([]);
  const classSec = `${cls} - ${sec}`;

  useEffect(() => {
    if (!roster) return;
    setMarks(Object.fromEntries(roster.students.map((s) => [s.id, s.status || "Present"])));
    setRemarks(Object.fromEntries(roster.students.map((s) => [s.id, s.remark || ""])));
  }, [roster]);

  const count = useMemo(() => {
    const c: Record<AttStatus, number> = { Present: 0, Absent: 0, Leave: 0, HalfDay: 0 };
    Object.values(marks).forEach((m) => (c[m] += 1));
    return c;
  }, [marks]);

  if (!roster) return error && error.status !== 401 ? error.status === 404 ? <Empty>{L({ hi: "यह सेक्शन नहीं मिला।", en: "This section was not found." })}</Empty> : <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={8} />;
  if (!roster.students.length) return <Empty>{L({ hi: "इस सेक्शन में कोई बच्चा नहीं।", en: "No students in this section." })}</Empty>;

  const set = (id: string, v: AttStatus) => setMarks((m) => ({ ...m, [id]: v }));
  const flip = (id: string) => setMarks((m) => ({ ...m, [id]: m[id] === "Present" ? "Absent" : "Present" }));

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ success: boolean; data: { present: number; absent: number; leave: number; half: number; whatsappQueued?: number | null } }>("/erp/attendance/section", {
        body: { date, class: roster!.class, section: roster!.section, marks: roster!.students.map((s) => ({ studentId: s.id, status: marks[s.id] || "Present", remark: marks[s.id] === "Leave" ? remarks[s.id] : "" })) },
      });
      const auto = r.data.whatsappQueued ?? null;
      setAbsent(auto === null ? roster!.students.filter((s) => marks[s.id] === "Absent") : []);
      toast(
        true,
        L({
          hi: `${classSec}: ${r.data.present + r.data.half} उपस्थित, ${r.data.absent} अनुपस्थित।${auto ? ` ${auto} माता-पिता को WhatsApp गया।` : ""}`,
          en: `${classSec}: ${r.data.present + r.data.half} present, ${r.data.absent} absent.${auto ? ` WhatsApp sent to ${auto} parents.` : ""}`,
        })
      );
      onSaved?.();
      reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ। दोबारा कोशिश करें।", en: "Could not save. Please try again." }));
    } finally {
      setBusy(false);
    }
  }

  const saveText = busy
    ? "…"
    : `${L({ hi: "सेव करें", en: "Save" })} · ${count.Present + count.HalfDay} ${L({ hi: "उपस्थित", en: "present" })}, ${count.Absent} ${L({ hi: "अनुपस्थित", en: "absent" })}${count.Leave ? `, ${count.Leave} ${L({ hi: "छुट्टी", en: "leave" })}` : ""}`;
  const school = `${p?.school_name || "School"}, ${p?.city || "Barmer"}`;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[28px_1fr_40px_40px_40px] items-center px-1 pb-0.5 text-[12px] font-semibold text-ink-400">
        <span>{L({ hi: "रोल", en: "No." })}</span>
        <span>{L({ hi: "नाम", en: "Name" })}</span>
        <span className="text-center">P</span>
        <span className="text-center">A</span>
        <span className="text-center">L</span>
      </div>
      <ul>
        {roster.students.map((s) => {
          const m = marks[s.id] || "Present";
          const circle = (v: AttStatus, label: string) => (
            <button type="button" onClick={() => set(s.id, v)} aria-pressed={m === v} aria-label={`${s.name}: ${label}`} className="grid h-11 place-items-center">
              {m === v ? <Dot v={v} /> : <span className="h-5 w-5 rounded-full border-[1.6px] border-ink-300" />}
            </button>
          );
          return (
            <li key={s.id} className={clsx("roll-row px-1", m !== "Present" && "roll-row-on")}>
              <div className="grid min-h-[52px] grid-cols-[28px_1fr_40px_40px_40px] items-center text-[15px]">
                <span className="tnum text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                <button type="button" onClick={() => flip(s.id)} className="min-h-[44px] min-w-0 truncate text-left">
                  {s.name}
                  {m === "HalfDay" && <span className="ml-1.5 text-[12px] font-semibold text-marigold-600">{L({ hi: "आधा दिन", en: "Half day" })}</span>}
                </button>
                {circle("Present", L({ hi: "उपस्थित", en: "Present" }))}
                {circle("Absent", L({ hi: "अनुपस्थित", en: "Absent" }))}
                {circle("Leave", L({ hi: "छुट्टी", en: "Leave" }))}
              </div>
              <div className={clsx("expand", m === "Leave" && "expand-open")} aria-hidden={m !== "Leave"}>
                <div className="overflow-hidden">
                  <input
                    value={remarks[s.id] || ""}
                    onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: e.target.value }))}
                    disabled={m !== "Leave"}
                    tabIndex={m === "Leave" ? 0 : -1}
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

      <button type="button" onClick={save} disabled={busy} className="btn-primary mt-2 w-full">
        {saveText}
      </button>

      {absent.length > 0 && (
        <section className="space-y-1 pt-3">
          <h2 className="text-[15px] font-bold">{L({ hi: "अनुपस्थित बच्चों के माता-पिता को बताएँ", en: "Tell parents of absent students" })}</h2>
          <ul>
            {absent.map((s) => {
              const link = absenceWhatsApp(s.mobile, s.name, classSec, shortDate(date), school);
              return (
                <li key={s.id} className="flex items-center gap-3 border-b border-ink-100 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{s.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {s.fatherName} · {s.mobile}
                    </span>
                  </span>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg bg-jade-600 px-3 text-[13px] font-semibold text-white">
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
    </div>
  );
}

function Dot({ v }: { v: AttStatus }) {
  return (
    <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-white", v === "Present" || v === "HalfDay" ? "bg-jade-600" : v === "Absent" ? "bg-rose-600" : "bg-marigold-500")}>
      {v === "Absent" ? <X className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : v === "Leave" ? <span className="text-[10px] font-bold leading-none">L</span> : <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />}
    </span>
  );
}
