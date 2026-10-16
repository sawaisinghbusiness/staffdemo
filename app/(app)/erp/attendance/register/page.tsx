"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, MessageCircle, Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { lowAttendanceMessage, whatsappLink, type LowReport, type Mark, type MonthRegister, type RegisterSection, type RegisterStudent } from "@/lib/erpRegister";
import { PrintRegister } from "@/components/erp/register/PrintRegister";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Attendance → Register & reports: the ERP's register (GET /api/attendance-register/*). A section's
 * month, each child's days and %, and the whole school's children below 75% with a WhatsApp nudge. On a phone the
 * wide grid becomes a list; tap a child for their month as a calendar. "Print" gives the ERP's A4 register.
 * Excel export stays on the ERP website.
 */

type Tab = "register" | "low";
const BELOW = 75;
const SESSION_START_MONTH = "2026-04";
const SEC_KEY = "att.register.sec";
const SCHOOL = "St. Paul School, Barmer";
const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
};
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const secKey = (s: { class: string; section: string }) => `${s.class}|${s.section}`;
const num = (n: number) => n.toLocaleString("en-IN");
const isOff = (d: { sunday: boolean; holiday: string | null }) => d.sunday || !!d.holiday;
const MARK_TONE: Record<Mark, string> = { P: "bg-jade-600 text-white", A: "bg-rose-600 text-white", L: "bg-marigold-500 text-white", H: "bg-sky-600 text-white" };

export default function ErpRegisterPage() {
  const L = useL();
  const today = todayIST();
  const thisMonth = today.slice(0, 7);
  const sections = useApi<RegisterSection[]>("/erp/attendance-register/sections");
  const [sec, setSec] = useState("");
  const [month, setMonth] = useState(thisMonth);
  const [tab, setTab] = useState<Tab>("register");
  const [student, setStudent] = useState<RegisterStudent | null>(null);
  const [printing, setPrinting] = useState(false);

  // Remember the last section on this phone (ERP SEC_KEY).
  useEffect(() => {
    const list = sections.data;
    if (!list || (sec && list.some((s) => secKey(s) === sec))) return;
    let saved = "";
    try {
      saved = localStorage.getItem(SEC_KEY) || "";
    } catch {
      /* private window */
    }
    setSec(list.some((s) => secKey(s) === saved) ? saved : list[0] ? secKey(list[0]) : "");
  }, [sections.data, sec]);
  useEffect(() => {
    if (!sec) return;
    try {
      localStorage.setItem(SEC_KEY, sec);
    } catch {
      /* ignore */
    }
  }, [sec]);

  const [cls, section] = sec ? sec.split("|") : ["", ""];
  const regApi = useApi<MonthRegister>(sec ? `/erp/attendance-register/month?${new URLSearchParams({ class: cls, section, month })}` : null);
  const lowApi = useApi<LowReport>(`/erp/attendance-register/low?month=${month}&below=${BELOW}`);
  // Never show another section's or month's figures under this title.
  const reg = regApi.data && regApi.data.class === cls && regApi.data.section === section && regApi.data.month === month ? regApi.data : undefined;
  const low = lowApi.data && lowApi.data.month === month ? lowApi.data : undefined;

  const wd = reg?.totals.workingDays || 0;
  const schoolDaysSoFar = reg ? reg.days.filter((d) => !isOff(d) && d.date <= today).length : 0;
  const marked = reg ? reg.students.filter((s) => s.workingDays > 0) : [];
  const absentDays = marked.reduce((t, s) => t + s.absent, 0);
  const leaveDays = marked.reduce((t, s) => t + s.leave, 0);
  const halfDays = marked.reduce((t, s) => t + s.half, 0);
  const belowHere = marked.filter((s) => s.percent !== null && s.percent < BELOW).length;
  const avg = reg?.totals.averagePercent ?? null;
  const classSec = reg?.classSec || sections.data?.find((s) => secKey(s) === sec)?.classSec || "";

  return (
    <div className="animate-rise space-y-3 pb-4">
      <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={sec} onChange={setSec}>
        {(sections.data || []).map((s) => (
          <option key={secKey(s)} value={secKey(s)}>
            {s.classSec} ({s.students})
          </option>
        ))}
      </SelectBox>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= SESSION_START_MONTH} aria-label={L({ hi: "पिछला महीना", en: "Previous month" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white disabled:opacity-40">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="tnum flex-1 text-center text-[15px] font-semibold" aria-live="polite">
          {monthLabel(month)}
        </span>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label={L({ hi: "अगला महीना", en: "Next month" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white disabled:opacity-40">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {sections.error && !sections.data && sections.error.status !== 401 && <ErrorCard offline={sections.error.status === 0} onRetry={sections.reload} />}

      <div className="grid grid-cols-2 gap-2">
        <Figure label={L({ hi: "हाज़िरी के दिन", en: "Days marked" })} value={reg ? num(wd) : "…"} note={reg ? `${L({ hi: "कुल", en: "of" })} ${schoolDaysSoFar} ${L({ hi: "स्कूल के दिन", en: "school days" })}` : ""} dot="bg-brand-500" />
        <Figure label={L({ hi: "हाज़िरी", en: "Attendance" })} value={reg ? (avg === null ? "—" : `${avg}%`) : "…"} note={reg ? (wd ? `${num(marked.length)} ${L({ hi: "बच्चों का औसत", en: "students' average" })}` : L({ hi: "अभी कुछ नहीं लगी", en: "Nothing marked yet" })) : ""} dot="bg-jade-500" />
        <Figure label={L({ hi: "अनुपस्थित दिन", en: "Absent days" })} value={reg ? num(absentDays) : "…"} note={reg ? `${num(leaveDays)} ${L({ hi: "छुट्टी", en: "leave" })} · ${num(halfDays)} ${L({ hi: "आधा", en: "half" })}` : ""} dot="bg-rose-500" />
        <Figure label={`${L({ hi: "से कम", en: "Below" })} ${BELOW}%`} value={reg ? num(belowHere) : "…"} note={low ? `${num(low.students.length)} ${L({ hi: "पूरे स्कूल में", en: "across the school" })}` : ""} dot="bg-marigold-400" />
      </div>

      <LineTabs
        label={L({ hi: "रजिस्टर", en: "Register" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "register", text: L({ hi: "रजिस्टर", en: "Register" }) },
          { key: "low", text: `${L({ hi: `${BELOW}% से कम`, en: `Below ${BELOW}%` })}${low && low.students.length ? ` ${num(low.students.length)}` : ""}` },
        ]}
      />

      {tab === "register" ? (
        !reg ? (
          regApi.error && regApi.error.status !== 401 ? <ErrorCard offline={regApi.error.status === 0} onRetry={regApi.reload} /> : <ListSkeleton rows={6} />
        ) : wd === 0 ? (
          <Empty>
            {L({ hi: `${monthLabel(month)} में ${reg.classSec} की हाज़िरी अभी नहीं लगी।`, en: `No attendance marked for ${reg.classSec} in ${monthLabel(month)} yet.` })}{" "}
            <Link href="/erp/attendance/mark/" className="font-semibold text-brand-600">
              {L({ hi: "हाज़िरी लगाएँ", en: "Mark attendance" })}
            </Link>
          </Empty>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] text-ink-500">
                {wd} {L({ hi: "दिन · % = उपस्थित ÷ लगे दिन", en: "working days · % = present ÷ days marked" })}
              </p>
              <button type="button" onClick={() => setPrinting(true)} className="flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-brand-600">
                <Printer className="h-4 w-4" aria-hidden /> {L({ hi: "प्रिंट", en: "Print" })}
              </button>
            </div>
            <ul>
              {reg.students.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setStudent(s)} className="flex min-h-[60px] w-full items-center gap-3 border-b border-ink-100 py-2 text-left active:bg-ink-50">
                    <span className="tnum w-6 shrink-0 text-right text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      <span className="tnum block text-[12px] text-ink-500">
                        P {s.present} · A <span className={s.absent ? "font-semibold text-rose-600" : ""}>{s.absent}</span> · L {s.leave}
                        {s.half ? ` · H ${s.half}` : ""}
                      </span>
                    </span>
                    <Meter percent={s.percent} />
                  </button>
                </li>
              ))}
            </ul>
            <DailyRow reg={reg} />
          </>
        )
      ) : !low ? (
        lowApi.error && lowApi.error.status !== 401 ? <ErrorCard offline={lowApi.error.status === 0} onRetry={lowApi.reload} /> : <ListSkeleton rows={5} />
      ) : low.students.length === 0 ? (
        <Empty>{L({ hi: `${monthLabel(month)} में कोई भी ${BELOW}% से कम नहीं।`, en: `Nobody marked in ${monthLabel(month)} is below ${BELOW}%.` })}</Empty>
      ) : (
        <>
          <p className="text-[12.5px] text-ink-500">{L({ hi: `पूरा स्कूल · ${monthLabel(month)} · सबसे कम पहले · WhatsApp बटन से माता-पिता को हिंदी मैसेज`, en: `Whole school · ${monthLabel(month)} · lowest first · the WhatsApp button opens a Hindi message to the parent` })}</p>
          <ul>
            {low.students.map((s) => {
              const wa = whatsappLink(s.mobile, lowAttendanceMessage(s));
              return (
                <li key={s.id} className={clsx("flex items-center gap-3 border-b border-ink-100 py-2", classSec === s.classSec && "bg-brand-50/60")}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{s.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {s.classSec}
                      {s.rollNo ? ` · ${L({ hi: "रोल", en: "Roll" })} ${s.rollNo}` : ""} · {s.fatherName}
                    </span>
                    <span className="tnum block text-[12px] text-ink-500">
                      {s.workingDays} {L({ hi: "दिन", en: "days" })} · <span className="font-semibold text-rose-600">A {s.absent}</span> · L {s.leave}
                    </span>
                  </span>
                  <Meter percent={s.percent} />
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp · ${s.name}`} className="grid h-11 w-11 shrink-0 place-items-center text-jade-600">
                      <MessageCircle className="h-5 w-5" aria-hidden />
                    </a>
                  ) : (
                    <span className="w-11 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {student && reg && <StudentMonth s={student} reg={reg} today={today} onClose={() => setStudent(null)} />}
      {printing && reg && <PrintRegister data={reg} today={today} title={`${SCHOOL} · Attendance register · ${reg.classSec} · ${monthLabel(month)}`} onDone={() => setPrinting(false)} />}
    </div>
  );
}

function Figure({ label, value, note, dot }: { label: string; value: string; note: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500">
        <i className={clsx("h-2 w-2 shrink-0 rounded-full", dot)} />
        <span className="truncate">{label}</span>
      </span>
      <span className="tnum mt-0.5 block text-[22px] font-extrabold">{value}</span>
      <span className="block truncate text-[12px] text-ink-400">{note}</span>
    </div>
  );
}

function Meter({ percent }: { percent: number | null }) {
  return (
    <span className="w-14 shrink-0 text-right">
      <span className={clsx("tnum block text-[15px] font-bold", percent === null ? "text-ink-400" : percent < BELOW ? "text-rose-600" : "text-ink-900")}>{percent === null ? "—" : `${percent}%`}</span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink-100">
        <span className={clsx("block h-full rounded-full", percent !== null && percent < BELOW ? "bg-rose-500" : percent !== null && percent < 90 ? "bg-marigold-400" : "bg-jade-500")} style={{ width: `${percent ?? 0}%` }} />
      </span>
    </span>
  );
}

/** How many were present on each marked day, as a small strip (the ERP grid's "Present each day" row). */
function DailyRow({ reg }: { reg: MonthRegister }) {
  const L = useL();
  const days = reg.days.filter((d) => d.marked);
  if (!days.length) return null;
  return (
    <section className="space-y-1.5 pt-2">
      <h2 className="text-[14px] font-semibold">{L({ hi: "हर दिन उपस्थित", en: "Present each day" })}</h2>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <span key={d.date} className="min-w-[46px] shrink-0 rounded-lg border border-ink-100 bg-white px-1.5 py-1 text-center">
            <span className="block text-[11px] text-ink-400">
              {d.weekday.slice(0, 2)} {Number(d.date.slice(8))}
            </span>
            <span className="tnum block text-[14px] font-semibold">{d.present + d.half}</span>
            {d.absent ? <span className="tnum block text-[11px] font-semibold text-rose-600">−{d.absent}</span> : <span className="block text-[11px] text-transparent">0</span>}
          </span>
        ))}
      </div>
    </section>
  );
}

/** One child's month as a calendar: a coloured circle per marked day, Sundays and holidays greyed. */
function StudentMonth({ s, reg, today, onClose }: { s: RegisterStudent; reg: MonthRegister; today: string; onClose: () => void }) {
  const L = useL();
  const first = new Date(reg.month + "-01T00:00:00").getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // weeks start on Monday
  return (
    <Sheet title={s.name} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">
          {reg.classSec} · {L({ hi: "रोल", en: "Roll" })} {s.rollNo || "—"} · {s.srNo} · {monthLabel(reg.month)}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11.5px] font-semibold text-ink-400">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`x${i}`} />
          ))}
          {reg.days.map((d) => {
            const m = s.marks[d.date];
            const off = isOff(d);
            return (
              <span key={d.date} title={d.holiday || undefined} className="grid h-10 place-items-center">
                <span className={clsx("tnum grid h-8 w-8 place-items-center rounded-full text-[13px]", m ? clsx("font-semibold", MARK_TONE[m]) : off ? "text-ink-300" : d.date === today ? "ring-2 ring-ink-900" : "text-ink-700")}>{Number(d.date.slice(8))}</span>
              </span>
            );
          })}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-600">
          {(["P", "A", "L", "H"] as Mark[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <i className={clsx("h-2.5 w-2.5 rounded-full", MARK_TONE[k].split(" ")[0])} />
              {k === "P" ? L({ hi: "उपस्थित", en: "Present" }) : k === "A" ? L({ hi: "अनुपस्थित", en: "Absent" }) : k === "L" ? L({ hi: "छुट्टी", en: "Leave" }) : L({ hi: "आधा दिन", en: "Half day" })}
            </span>
          ))}
        </p>
        <dl className="kv tnum">
          <div>
            <dt>{L({ hi: "लगे दिन", en: "Days marked" })}</dt>
            <dd>{s.workingDays}</dd>
          </div>
          <div>
            <dt>{L({ hi: "उपस्थित / आधा", en: "Present / half" })}</dt>
            <dd>
              {s.present} / {s.half}
            </dd>
          </div>
          <div>
            <dt>{L({ hi: "अनुपस्थित / छुट्टी", en: "Absent / leave" })}</dt>
            <dd>
              {s.absent} / {s.leave}
            </dd>
          </div>
          <div>
            <dt>{L({ hi: "हाज़िरी", en: "Attendance" })}</dt>
            <dd className={s.percent !== null && s.percent < BELOW ? "text-rose-600" : ""}>{s.percent === null ? "—" : `${s.percent}%`}</dd>
          </div>
        </dl>
      </div>
    </Sheet>
  );
}
