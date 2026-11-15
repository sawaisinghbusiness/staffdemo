"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, BellRing, Check, MessageCircle, Phone } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useL } from "@/lib/i18n";
import { absenceWhatsApp, type AttendanceDay, type AttStatus } from "@/lib/erpAttendance";
import { phone, type StaffList } from "@/lib/erpStaff";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Attendance → Today (the ERP roadmap's "Today" page): every section at a glance. Pending sections
 * with their class teacher and a WhatsApp reminder, marked sections with % present, and today's absent list with
 * the parents' numbers. Reads GET /api/attendance/day, /api/attendance/absent and /api/staff (class teachers).
 */

type Absentee = { id: string; name: string; classSec: string; rollNo: string; fatherName: string; mobile: string; photoUrl: string; status: AttStatus; remark: string };
type Tab = "pending" | "marked" | "absent";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const STATUS_TEXT: Record<AttStatus, { hi: string; en: string; dot: string }> = {
  Present: { hi: "उपस्थित", en: "Present", dot: "bg-jade-500" },
  Absent: { hi: "अनुपस्थित", en: "Absent", dot: "bg-rose-500" },
  Leave: { hi: "छुट्टी", en: "Leave", dot: "bg-marigold-400" },
  HalfDay: { hi: "आधा दिन", en: "Half day", dot: "bg-sky-500" },
};

export default function ErpAttendanceTodayPage() {
  const L = useL();
  const date = todayIso();
  const { data: day, error, reload } = useApi<AttendanceDay>(`/erp/attendance/day?date=${date}`);
  const abs = useApi<{ date: string; data: Absentee[] }>(`/erp/attendance/absent?date=${date}`);
  const staff = useApi<StaffList>("/erp/staff");
  const { data: school } = useApi<Record<string, string>>("/erp/school");
  const [tab, setTab] = useState<Tab>("pending");
  const reminded = useApi<{ data: Record<string, string> }>(`/erp/attendance/reminders?date=${date}`);
  const [sending, setSending] = useState<string | null>(null);

  /** Sends the reminder to each section's class teacher; quiet about ones with no class teacher when sending to all. */
  async function remind(list: { class: string; section: string; classSec: string }[]) {
    setSending(list.length === 1 ? list[0].classSec : "all");
    let sent = 0;
    let fail = "";
    for (const s of list) {
      try {
        await api("/erp/attendance/remind", { body: { date, class: s.class, section: s.section } });
        sent++;
      } catch (e) {
        fail = (e instanceof ApiError && e.message) || L({ hi: "याद नहीं भेजी जा सकी।", en: "Could not send the reminder." });
        if (list.length === 1 || (e instanceof ApiError && e.status === 503)) break;
      }
    }
    setSending(null);
    reminded.reload();
    if (sent) toast(true, list.length === 1 ? L({ hi: `${list[0].classSec} के क्लास टीचर को ऐप में याद दिलाया।`, en: `Reminded ${list[0].classSec}'s class teacher in the app.` }) : L({ hi: `${sent} क्लास टीचर को याद दिलाया।`, en: `Reminded ${sent} class teachers.` }));
    else if (fail) toast(false, fail);
  }
  const clock = (at: string) => new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  const ctOf = useMemo(() => {
    const m = new Map<string, { name: string; mobile: string }>();
    for (const s of staff.data?.data || []) if (s.classTeacherOf && s.status !== "Relieved") m.set(s.classTeacherOf, { name: s.name, mobile: s.mobile });
    return m;
  }, [staff.data]);

  const sections = day?.sections || [];
  const pending = sections.filter((s) => s.marked === 0);
  const marked = sections.filter((s) => s.marked > 0);
  const absent = abs.data?.data || [];
  const t = day?.totals;
  const schoolName = school?.school_name || "School";
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  if (!day) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={6} />;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">
        {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        {t ? ` · ${t.sectionsMarked} / ${t.sections} ${L({ hi: "सेक्शन की हाज़िरी लगी", en: "sections marked" })}` : ""}
      </p>
      {(day.sunday || day.holiday) && (
        <p className="flex gap-2 rounded-xl bg-marigold-50 p-3 text-[13.5px] text-ink-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          {day.holiday ? L({ hi: `आज छुट्टी है (${day.holiday})।`, en: `Today is a holiday (${day.holiday}).` }) : L({ hi: "आज रविवार है।", en: "Today is a Sunday." })}
        </p>
      )}

      {t && (
        <div className="rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-500">{L({ hi: "दर्ज बच्चों में उपस्थित", en: "Present among marked" })}</span>
            <span className="tnum text-[12px] text-ink-400">
              {t.marked.toLocaleString("en-IN")} / {t.students.toLocaleString("en-IN")} {L({ hi: "बच्चों की लगी", en: "students marked" })}
            </span>
          </div>
          <span className="tnum mt-0.5 block text-[26px] font-extrabold">{t.marked ? `${pct(t.present + t.half * 0.5, t.marked)}%` : "—"}</span>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden>
            <i className="bg-jade-500" style={{ width: `${pct(t.present, t.students)}%` }} />
            <i className="bg-sky-500" style={{ width: `${pct(t.half, t.students)}%` }} />
            <i className="bg-marigold-400" style={{ width: `${pct(t.leave, t.students)}%` }} />
            <i className="bg-rose-500" style={{ width: `${pct(t.absent, t.students)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-600">
            <Key dot="bg-jade-500" label={L({ hi: "उपस्थित", en: "Present" })} n={t.present} />
            <Key dot="bg-rose-500" label={L({ hi: "अनुपस्थित", en: "Absent" })} n={t.absent} />
            <Key dot="bg-marigold-400" label={L({ hi: "छुट्टी", en: "Leave" })} n={t.leave} />
            {t.half > 0 && <Key dot="bg-sky-500" label={L({ hi: "आधा दिन", en: "Half day" })} n={t.half} />}
            <Key dot="bg-ink-300" label={L({ hi: "बाकी", en: "Not marked" })} n={t.students - t.marked} />
          </div>
        </div>
      )}

      <LineTabs
        label={L({ hi: "दिखाएँ", en: "Show" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "pending", text: `${L({ hi: "बाकी", en: "Pending" })} ${pending.length}` },
          { key: "marked", text: `${L({ hi: "लगी", en: "Marked" })} ${marked.length}` },
          { key: "absent", text: `${L({ hi: "अनुपस्थित", en: "Absent" })} ${absent.length}` },
        ]}
      />

      {tab === "pending" &&
        (!pending.length ? (
          <Empty>{L({ hi: "सारे सेक्शन की हाज़िरी लग चुकी है।", en: "Every section is marked." })}</Empty>
        ) : (
          <>
          <button type="button" onClick={() => remind(pending.filter((p) => ctOf.has(p.classSec)))} disabled={!!sending || !pending.some((p) => ctOf.has(p.classSec))} className="btn-line w-full disabled:opacity-50">
            <BellRing className="h-4 w-4" aria-hidden />
            {sending === "all" ? "…" : L({ hi: `सबको याद दिलाएँ (${pending.filter((p) => ctOf.has(p.classSec)).length})`, en: `Remind all (${pending.filter((p) => ctOf.has(p.classSec)).length})` })}
          </button>
          <ul>
            {pending.map((s) => {
              const ct = ctOf.get(s.classSec);
              const at = reminded.data?.data?.[s.classSec];
              const busy = sending === s.classSec || sending === "all";
              return (
                <li key={s.classSec} className="flex items-center gap-3 border-b border-ink-100 py-2.5">
                  <Link href={`/erp/attendance/mark/?date=${date}&class=${encodeURIComponent(s.class)}&section=${encodeURIComponent(s.section)}`} className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{s.classSec}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {s.students} {L({ hi: "बच्चे", en: "students" })} · {ct ? ct.name : <span className="text-rose-600">{L({ hi: "क्लास टीचर नहीं", en: "No class teacher" })}</span>}
                    </span>
                    {at && (
                      <span className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-jade-700">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                        {L({ hi: `याद दिलाया ${clock(at)}`, en: `Reminded ${clock(at)}` })}
                      </span>
                    )}
                  </Link>
                  {ct && (
                    <button type="button" onClick={() => remind([s])} disabled={busy} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-semibold text-ink-900 disabled:opacity-50">
                      <BellRing className="h-4 w-4" aria-hidden />
                      {busy ? "…" : at ? L({ hi: "फिर से", en: "Again" }) : L({ hi: "याद दिलाएँ", en: "Remind" })}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          </>
        ))}

      {tab === "marked" &&
        (!marked.length ? (
          <Empty>{L({ hi: "आज अभी किसी सेक्शन की हाज़िरी नहीं लगी।", en: "No section is marked yet today." })}</Empty>
        ) : (
          <ul>
            {marked.map((s) => {
              const p = pct(s.present + s.half * 0.5, s.marked);
              return (
                <li key={s.classSec}>
                  <Link href={`/erp/attendance/mark/?date=${date}&class=${encodeURIComponent(s.class)}&section=${encodeURIComponent(s.section)}`} className="flex items-center gap-3 border-b border-ink-100 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold">{s.classSec}</span>
                      <span className="block truncate text-[12.5px] text-ink-500">
                        {s.present + s.half}/{s.students}
                        {s.absent ? <span className="font-semibold text-rose-600"> · {s.absent} {L({ hi: "अनुपस्थित", en: "absent" })}</span> : null}
                        {s.markedBy ? ` · ${s.markedBy.split(" (")[0]}` : ""}
                      </span>
                    </span>
                    <span className={clsx("tnum text-[15px] font-bold", p < 75 ? "text-rose-600" : "text-ink-900")}>{p}%</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "absent" &&
        (!abs.data ? (
          abs.error ? <ErrorCard offline={abs.error.status === 0} onRetry={abs.reload} /> : <ListSkeleton rows={5} />
        ) : !absent.length ? (
          <Empty>{L({ hi: "आज कोई अनुपस्थित नहीं है।", en: "Nobody is absent today." })}</Empty>
        ) : (
          <ul>
            {absent.map((s) => {
              const st = STATUS_TEXT[s.status];
              const wa = s.status === "Absent" ? absenceWhatsApp(s.mobile, s.name, s.classSec, dateLabel, schoolName) : null;
              const tel = /^\d{10}$/.test(s.mobile.replace(/\D/g, "").slice(-10)) ? s.mobile.replace(/\D/g, "").slice(-10) : "";
              return (
                <li key={s.id} className="flex items-center gap-3 border-b border-ink-100 py-2.5">
                  <Avatar name={s.name} url={s.photoUrl} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{s.name}</span>
                    <span className="flex items-center gap-1.5 truncate text-[12.5px] text-ink-500">
                      <i className={clsx("h-2 w-2 shrink-0 rounded-full", st.dot)} />
                      {L(st)} · {s.classSec}
                      {s.rollNo ? ` · ${L({ hi: "रोल", en: "Roll" })} ${s.rollNo}` : ""}
                    </span>
                    {(s.fatherName || tel) && (
                      <span className="block truncate text-[12px] text-ink-400">
                        {s.fatherName}
                        {s.fatherName && tel ? " · " : ""}
                        {tel ? phone(tel) : ""}
                      </span>
                    )}
                  </span>
                  {tel && (
                    <a href={`tel:${tel}`} aria-label={L({ hi: "कॉल करें", en: "Call" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700">
                      <Phone className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white text-jade-700">
                      <MessageCircle className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

function Key({ dot, label, n }: { dot: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={clsx("h-2 w-2 rounded-full", dot)} />
      {label} <b className="tnum font-semibold text-ink-900">{n}</b>
    </span>
  );
}
