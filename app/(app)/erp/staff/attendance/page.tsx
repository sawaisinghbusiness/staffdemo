"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Download, Lock, Plus, Printer, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import {
  clockAt,
  firstName,
  LEAVE_TEXT,
  LEAVE_TONE,
  LEAVE_TYPES,
  leaveDays,
  leaveRange,
  longDate,
  monthLabel,
  shiftDate,
  shiftMonth,
  shortDate,
  todayIST,
  type LeaveList,
  type LeaveStatus,
  type Mark,
  type MaybeSetup,
  type RegisterStaff,
  type StaffAttStatus,
  type StaffDay,
  type StaffLeave,
  type StaffRegister,
} from "@/lib/erpStaff";
import { isOff } from "@/components/erp/staffRegister/StaffRegisterGrid";
import { PrintStaffRegister } from "@/components/erp/staffRegister/PrintStaffRegister";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet, Status, StickyBar } from "@/components/ui";

/*
 * ERP login → Staff → Staff attendance & leave: the ERP's /staff/attendance page with its three tabs
 * (Today, Register, Leave; ?tab=leave opens Leave). Same endpoints (/api/staff-attendance/*) and rules: the admin
 * and the accountant see it, only the admin marks attendance and records or decides leave.
 */

type Tab = "today" | "register" | "leave";
const isTab = (v: string | null): v is Tab => v === "today" || v === "register" || v === "leave";
const SETUP: Bi = { hi: "स्टाफ़ हाज़िरी के लिए डेटाबेस में एक बार का बदलाव चाहिए: Supabase SQL editor में sms backend/supabase/migrations/20261002_staff.sql चलाएँ।", en: "Staff attendance needs a one-time database setup: run sms backend/supabase/migrations/20261002_staff.sql in the Supabase SQL editor." };

export default function ErpStaffAttendancePage() {
  const L = useL();
  const [tab, setTab] = useState<Tab>("today");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const role = who.data?.user.role;
  const canView = role === "admin" || role === "accountant";
  const canWrite = role === "admin";
  const leaves = useApi<MaybeSetup<LeaveList>>(canView ? "/erp/staff-attendance/leaves" : null);
  const pending = leaves.data?.data ? leaves.data.data.filter((l) => l.status === "Pending").length : 0;

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (isTab(t)) setTab(t);
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    const u = new URL(window.location.href);
    if (t === "today") u.searchParams.delete("tab");
    else u.searchParams.set("tab", t);
    window.history.replaceState(null, "", u.pathname + u.search);
  };

  if (!who.data) return who.error && who.error.status !== 401 ? <ErrorCard offline={who.error.status === 0} onRetry={who.reload} /> : <ListSkeleton rows={5} />;
  if (!canView)
    return (
      <p className="animate-rise flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 text-[14px] text-ink-700">
        <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
        {L({ hi: "स्टाफ़ हाज़िरी सिर्फ़ एडमिन और अकाउंटेंट देख सकते हैं।", en: "Only the admin and the accountant can see staff attendance." })}
      </p>
    );

  return (
    <div className="animate-rise space-y-3">
      <LineTabs
        label={L({ hi: "स्टाफ़ हाज़िरी", en: "Staff attendance" })}
        value={tab}
        onChange={choose}
        options={[
          { key: "today", text: L({ hi: "आज", en: "Today" }) },
          { key: "register", text: L({ hi: "रजिस्टर", en: "Register" }) },
          { key: "leave", text: `${L({ hi: "छुट्टी", en: "Leave" })}${pending ? ` ${pending}` : ""}` },
        ]}
      />
      {!canWrite && <p className="text-[13px] text-ink-500">{L({ hi: "सिर्फ़ देख सकते हैं · स्टाफ़ हाज़िरी ऑफ़िस (एडमिन) लगाता है", en: "View only · the office marks staff attendance" })}</p>}
      {tab === "today" && <DayTab canWrite={canWrite} />}
      {tab === "register" && <RegisterTab />}
      {tab === "leave" && <LeaveTab canWrite={canWrite} res={leaves} />}
    </div>
  );
}

/* ── Today: mark the whole staff for a day (ERP DayTab) ── */

interface Entry {
  status: StaffAttStatus;
  inTime: string;
  outTime: string;
  remark: string;
}
const TIMES_KEY = "staff.att.times";
const works = (s: StaffAttStatus) => s === "Present" || s === "Half Day";
const STATUS: { key: StaffAttStatus; short: Mark; text: Bi; on: string }[] = [
  { key: "Present", short: "P", text: { hi: "उपस्थित", en: "Present" }, on: "bg-jade-600" },
  { key: "Absent", short: "A", text: { hi: "अनुपस्थित", en: "Absent" }, on: "bg-rose-600" },
  { key: "On Leave", short: "L", text: { hi: "छुट्टी", en: "On leave" }, on: "bg-marigold-500" },
  { key: "Half Day", short: "H", text: { hi: "आधा दिन", en: "Half day" }, on: "bg-sky-600" },
];

/** What each row starts as: the saved mark, else "On Leave" for approved leave, else Present. */
function startingEntries(day: StaffDay): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const s of day.staff) {
    const onLeave = !s.status && s.leave?.status === "Approved";
    out[s.id] = { status: s.status || (onLeave ? "On Leave" : "Present"), inTime: s.inTime, outTime: s.outTime, remark: s.remark || (onLeave ? `${s.leave!.type} leave` : "") };
  }
  return out;
}

function DayTab({ canWrite }: { canWrite: boolean }) {
  const L = useL();
  const today = todayIST();
  const [date, setDate] = useState(today);
  const res = useApi<MaybeSetup<StaffDay>>(`/erp/staff-attendance/day?date=${date}`);
  const day = res.data && !res.data.setupNeeded && res.data.date === date ? res.data : undefined;
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [initial, setInitial] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTimes, setShowTimes] = useState(false);

  useEffect(() => {
    try {
      setShowTimes(localStorage.getItem(TIMES_KEY) === "1");
    } catch {
      /* private window */
    }
  }, []);
  const toggleTimes = (on: boolean) => {
    setShowTimes(on);
    try {
      localStorage.setItem(TIMES_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!day) return;
    const e = startingEntries(day);
    setEntries(e);
    setInitial(JSON.stringify(e));
  }, [day]);

  const dirty = !!day && JSON.stringify(entries) !== initial;
  const counts = useMemo(() => {
    const c: Record<StaffAttStatus, number> = { Present: 0, Absent: 0, "On Leave": 0, "Half Day": 0 };
    Object.keys(entries).forEach((id) => (c[entries[id].status] += 1));
    return c;
  }, [entries]);

  if (res.data?.setupNeeded) return <Empty>{L(SETUP)}</Empty>;

  const set = (id: string, patch: Partial<Entry>) => setEntries((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
  const allPresent = () => {
    if (!day) return;
    setEntries((cur) => {
      const next: Record<string, Entry> = {};
      // Approved leave stays as leave; everybody else becomes Present.
      for (const s of day.staff) next[s.id] = s.leave?.status === "Approved" && cur[s.id].status === "On Leave" ? cur[s.id] : { ...cur[s.id], status: "Present" };
      return next;
    });
  };
  const changeDate = (d: string) => {
    if (!d || d > today) return;
    if (dirty && !window.confirm(L({ hi: "बदलाव सेव नहीं हुए। छोड़ दें?", en: "You have changes that are not saved. Leave them?" }))) return;
    setDate(d);
  };

  async function save() {
    if (!day) return;
    setSaving(true);
    const marks = day.staff.map((s) => {
      const e = entries[s.id];
      return { staffId: s.id, status: e.status, inTime: works(e.status) ? e.inTime : "", outTime: works(e.status) ? e.outTime : "", remark: e.remark };
    });
    try {
      const r = await api<{ success: boolean; data: { saved: number; present: number; absent: number; leave: number; half: number } }>("/erp/staff-attendance/day", { method: "POST", body: { date, marks } });
      const d = r.data;
      toast(true, L({ hi: `${shortDate(date)} की स्टाफ़ हाज़िरी सेव हुई: ${d.present + d.half} उपस्थित, ${d.absent} अनुपस्थित, ${d.leave} छुट्टी पर।`, en: `Staff attendance saved for ${shortDate(date)}: ${d.present + d.half} present, ${d.absent} absent, ${d.leave} on leave.` }));
      res.reload();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    } finally {
      setSaving(false);
    }
  }

  const total = day?.staff.length || 0;
  const status = !day
    ? ""
    : day.marked === 0
    ? L({ hi: "अभी नहीं लगी", en: "Not marked yet" })
    : day.marked < total
    ? `${day.marked} ${L({ hi: "में से", en: "of" })} ${total} ${L({ hi: "लगी", en: "marked" })}${day.markedAt ? ` · ${clockAt(day.markedAt)}${day.markedBy ? ` · ${firstName(day.markedBy)}` : ""}` : ""}`
    : `${L({ hi: "सेव", en: "Saved" })} ${day.markedAt ? clockAt(day.markedAt) : ""}${day.markedBy ? ` · ${firstName(day.markedBy)}` : ""}`;

  return (
    <div className={clsx("space-y-2.5", canWrite && day && total > 0 && "pb-20")}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => changeDate(shiftDate(date, -1))} aria-label={L({ hi: "पिछला दिन", en: "Previous day" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <label className="field-box min-h-[44px] flex-1">
          <input id="sa-date" type="date" value={date} max={today} onChange={(e) => changeDate(e.target.value)} aria-label={L({ hi: "तारीख", en: "Date" })} />
          <CalendarDays aria-hidden />
        </label>
        <button type="button" onClick={() => changeDate(shiftDate(date, 1))} disabled={date >= today} aria-label={L({ hi: "अगला दिन", en: "Next day" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white disabled:opacity-40">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[12.5px] text-ink-500" title={day ? longDate(date) : undefined}>
          {status}
        </p>
        {date !== today && (
          <button type="button" onClick={() => changeDate(today)} className="min-h-[36px] shrink-0 px-1 text-[13.5px] font-semibold text-brand-600">
            {L({ hi: "आज", en: "Today" })}
          </button>
        )}
      </div>

      {day && (day.sunday || day.holiday) && (
        <div className="flex items-start gap-2 rounded-xl border border-marigold-300/70 bg-marigold-50 px-3 py-2 text-[13.5px] text-ink-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          <span>
            {day.holiday ? L({ hi: `${shortDate(date)} को छुट्टी है (${day.holiday})।`, en: `${shortDate(date)} is a holiday (${day.holiday}).` }) : L({ hi: `${shortDate(date)} रविवार है।`, en: `${shortDate(date)} is a Sunday.` })}{" "}
            {L({ hi: "हाज़िरी तभी लगाएँ जब स्टाफ़ बुलाया गया हो।", en: "Mark attendance only if staff were called in." })}
          </span>
        </div>
      )}

      {!day ? (
        res.error && res.error.status !== 401 ? <ErrorCard offline={res.error.status === 0} onRetry={res.reload} /> : <ListSkeleton rows={6} />
      ) : total === 0 ? (
        <Empty>
          {L({ hi: `${shortDate(date)} को स्टाफ़ लिस्ट में कोई नहीं।`, en: `Nobody is on the staff rolls for ${shortDate(date)}.` })}{" "}
          <Link href="/erp/staff/" className="font-semibold text-brand-600">
            {L({ hi: "स्टाफ़ जोड़ें", en: "Add staff" })}
          </Link>
        </Empty>
      ) : (
        <>
          {canWrite && (
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={allPresent} className="flex min-h-[40px] items-center gap-1 text-[13.5px] font-semibold text-brand-600">
                <Check className="h-4 w-4" aria-hidden /> {L({ hi: "सब उपस्थित", en: "Mark all present" })}
              </button>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[13.5px] text-ink-600">
                <input type="checkbox" checked={showTimes} onChange={(e) => toggleTimes(e.target.checked)} className="h-[18px] w-[18px] accent-[#3099a4]" />
                {L({ hi: "आने/जाने का समय", en: "In/out time" })}
              </label>
            </div>
          )}
          <div className="grid grid-cols-[1fr_36px_36px_36px_36px] items-center px-1 pb-0.5 text-[12px] font-semibold text-ink-400">
            <span>{L({ hi: "नाम", en: "Name" })}</span>
            {STATUS.map((o) => (
              <span key={o.key} className="text-center">
                {o.short}
              </span>
            ))}
          </div>
          <ul>
            {day.staff.map((s) => {
              const e = entries[s.id];
              if (!e) return null;
              const second = (showTimes && canWrite) || e.status !== "Present" || !!e.remark || !!e.inTime || !!e.outTime;
              const times = ((showTimes && canWrite) || e.inTime || e.outTime) && works(e.status);
              return (
                <li key={s.id} className={clsx("roll-row px-1", e.status !== "Present" && "roll-row-on")}>
                  <div className="grid min-h-[52px] grid-cols-[1fr_36px_36px_36px_36px] items-center text-[15px]">
                    <span className="min-w-0 py-1">
                      <span className="block truncate">{s.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-400">
                        {s.empCode} · {s.designation}
                        {s.leave && (
                          <span className={s.leave.status === "Approved" ? "text-marigold-700" : ""}>
                            {" · "}
                            {s.leave.type} {s.leave.status === "Approved" ? L({ hi: "छुट्टी मंज़ूर", en: "leave approved" }) : L({ hi: "छुट्टी बाकी", en: "leave pending" })}
                            {s.leave.from !== s.leave.to ? ` (${leaveRange(s.leave.from, s.leave.to)})` : ""}
                          </span>
                        )}
                      </span>
                    </span>
                    {STATUS.map((o) => {
                      const on = e.status === o.key;
                      return (
                        <button key={o.key} type="button" disabled={!canWrite} onClick={() => set(s.id, { status: o.key })} aria-pressed={on} aria-label={`${s.name}: ${L(o.text)}`} className="grid h-11 place-items-center disabled:cursor-default">
                          {on ? (
                            <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-white", o.on)}>
                              {o.short === "P" ? <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : o.short === "A" ? <X className="h-3 w-3" strokeWidth={3.5} aria-hidden /> : <span className="text-[10px] font-bold leading-none">{o.short}</span>}
                            </span>
                          ) : (
                            <span className={clsx("h-5 w-5 rounded-full border-[1.6px] border-ink-300", !canWrite && "opacity-40")} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {second && (
                    <div className="space-y-2 pb-2.5">
                      {times && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
                            {L({ hi: "आए", en: "In" })}
                            <input type="time" value={e.inTime} disabled={!canWrite} onChange={(ev) => set(s.id, { inTime: ev.target.value })} aria-label={`${s.name}: in`} className="h-11 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-2 text-[16px] disabled:bg-ink-50" />
                          </label>
                          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
                            {L({ hi: "गए", en: "Out" })}
                            <input type="time" value={e.outTime} disabled={!canWrite} onChange={(ev) => set(s.id, { outTime: ev.target.value })} aria-label={`${s.name}: out`} className="h-11 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-2 text-[16px] disabled:bg-ink-50" />
                          </label>
                        </div>
                      )}
                      <input
                        value={e.remark}
                        disabled={!canWrite}
                        maxLength={200}
                        onChange={(ev) => set(s.id, { remark: ev.target.value })}
                        placeholder={
                          e.status === "Absent"
                            ? L({ hi: "नोट (अगर हो), जैसे बताया नहीं", en: "Note (optional), e.g. not informed" })
                            : e.status === "On Leave"
                            ? L({ hi: "कारण (अगर हो)", en: "Reason (optional)" })
                            : e.status === "Half Day"
                            ? L({ hi: "नोट (अगर हो), जैसे 11 बजे गए", en: "Note (optional), e.g. left at 11" })
                            : L({ hi: "टिप्पणी (अगर हो)", en: "Remark (optional)" })
                        }
                        aria-label={`${s.name}: ${L({ hi: "नोट", en: "remark" })}`}
                        className="h-11 w-full rounded-lg border border-ink-200 bg-white px-3 text-[16px] placeholder:text-ink-400 focus:border-ink-900 focus:outline-none disabled:bg-ink-50"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="tnum text-[12.5px] text-ink-600">
            <b className="text-jade-700">{counts.Present}</b> {L({ hi: "उपस्थित", en: "present" })} · <b className="text-rose-600">{counts.Absent}</b> {L({ hi: "अनुपस्थित", en: "absent" })} · <b className="text-marigold-700">{counts["On Leave"]}</b> {L({ hi: "छुट्टी", en: "on leave" })} · <b className="text-sky-700">{counts["Half Day"]}</b> {L({ hi: "आधा दिन", en: "half day" })}
            <span className="text-ink-400">
              {" "}
              · {total} {L({ hi: "स्टाफ़", en: "staff" })}
            </span>
          </p>
          {canWrite && (
            <StickyBar>
              <button type="button" onClick={save} disabled={saving || res.loading} className="btn-primary w-full">
                {saving ? "…" : `${day.marked >= total ? L({ hi: "बदलाव सेव करें", en: "Save changes" }) : L({ hi: "हाज़िरी सेव करें", en: "Save attendance" })}${dirty ? ` · ${L({ hi: "सेव नहीं", en: "not saved" })}` : ""}`}
              </button>
            </StickyBar>
          )}
        </>
      )}
    </div>
  );
}

/* ── Register: the month, staff × days (ERP RegisterTab) ── */

const SESSION_START_MONTH = "2026-04";
const MARK_TONE: Record<Mark, string> = { P: "bg-jade-600 text-white", A: "bg-rose-600 text-white", L: "bg-marigold-500 text-white", H: "bg-sky-600 text-white" };
const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function RegisterTab() {
  const L = useL();
  const today = todayIST();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const res = useApi<MaybeSetup<StaffRegister>>(`/erp/staff-attendance/month?month=${month}`);
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const [person, setPerson] = useState<RegisterStaff | null>(null);
  const [printing, setPrinting] = useState(false);
  const reg = res.data && !res.data.setupNeeded && res.data.month === month ? res.data : undefined;

  if (res.data?.setupNeeded) return <Empty>{L(SETUP)}</Empty>;

  const school = [p?.school_name, p?.city].filter(Boolean).join(", ") || "School";
  const title = `${school} · Staff attendance register · ${monthLabel(month)}`;
  const wd = reg?.totals.workingDays || 0;

  const downloadCsv = () => {
    if (!reg) return;
    const lines: (string | number)[][] = [
      [title],
      [],
      ["Emp code", "Name", "Designation", ...reg.days.map((d) => Number(d.date.slice(8))), "Present", "Absent", "On leave", "Half day", "Days marked"],
      ["", "", "", ...reg.days.map((d) => (d.holiday ? "Holiday" : d.weekday)), "", "", "", "", ""],
    ];
    for (const s of reg.staff) lines.push([s.empCode, s.name, s.designation, ...reg.days.map((d) => s.marks[d.date] || (isOff(d) ? (d.holiday ? "Hol" : "S") : "")), s.present, s.absent, s.leave, s.half, s.days]);
    lines.push([]);
    lines.push(["P present · A absent · L on leave · H half day · S Sunday · Hol holiday"]);
    const csv = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Staff_attendance_${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-3 pb-4">
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

      {!reg ? (
        res.error && res.error.status !== 401 ? <ErrorCard offline={res.error.status === 0} onRetry={res.reload} /> : <ListSkeleton rows={6} />
      ) : reg.staff.length === 0 ? (
        <Empty>{L({ hi: `${monthLabel(month)} में स्टाफ़ लिस्ट में कोई नहीं था।`, en: `Nobody was on the staff rolls in ${monthLabel(month)}.` })}</Empty>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="tnum min-w-0 text-[12.5px] text-ink-500">
              {L({ hi: `${reg.staff.length} स्टाफ़ · ${reg.totals.schoolDays} स्कूल के दिनों में ${wd} दिन लगी`, en: `${reg.staff.length} staff · ${wd} day${wd === 1 ? "" : "s"} marked of ${reg.totals.schoolDays} school day${reg.totals.schoolDays === 1 ? "" : "s"}` })}
            </p>
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setPrinting(true)} className="flex min-h-[40px] items-center gap-1 px-1 text-[13.5px] font-semibold text-brand-600">
                <Printer className="h-4 w-4" aria-hidden /> {L({ hi: "प्रिंट", en: "Print" })}
              </button>
              <button type="button" onClick={downloadCsv} className="flex min-h-[40px] items-center gap-1 px-1 text-[13.5px] font-semibold text-brand-600">
                <Download className="h-4 w-4" aria-hidden /> CSV
              </button>
            </span>
          </div>
          {wd === 0 && <p className="text-[13px] text-ink-500">{L({ hi: `${monthLabel(month)} में अभी स्टाफ़ हाज़िरी नहीं लगी।`, en: `No staff attendance marked in ${monthLabel(month)} yet.` })}</p>}
          <ul>
            {reg.staff.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setPerson(s)} className="flex min-h-[60px] w-full items-center gap-3 border-b border-ink-100 py-2 text-left active:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{s.name}</span>
                    <span className="tnum block truncate text-[12px] text-ink-500">
                      {s.empCode} · P {s.present} · A <span className={s.absent ? "font-semibold text-rose-600" : ""}>{s.absent}</span> · L {s.leave}
                      {s.half ? ` · H ${s.half}` : ""}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-right">
                    <span className="block text-[15px] font-bold">{s.days}</span>
                    <span className="block text-[11.5px] text-ink-400">{L({ hi: "दिन", en: "days" })}</span>
                  </span>
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <DailyRow reg={reg} />
        </>
      )}

      {person && reg && <PersonMonth s={person} reg={reg} today={today} onClose={() => setPerson(null)} />}
      {printing && reg && <PrintStaffRegister data={reg} today={today} title={title} onDone={() => setPrinting(false)} />}
    </div>
  );
}

/** The ERP grid's "Present each day" row, as a sideways strip. */
function DailyRow({ reg }: { reg: StaffRegister }) {
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
      <p className="text-[12px] text-ink-500">{L({ hi: "आधे दिन भी गिने जाते हैं", en: "Present each day counts half days" })}</p>
    </section>
  );
}

/** One person's month as a calendar (the grid's row on a phone). */
function PersonMonth({ s, reg, today, onClose }: { s: RegisterStaff; reg: StaffRegister; today: string; onClose: () => void }) {
  const L = useL();
  const lead = (new Date(reg.month + "-01T00:00:00").getDay() + 6) % 7; // weeks start on Monday
  return (
    <Sheet title={s.name} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">
          {s.empCode} · {s.designation} · {monthLabel(reg.month)}
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
            return (
              <span key={d.date} title={d.holiday || undefined} className="grid h-10 place-items-center">
                <span className={clsx("tnum grid h-8 w-8 place-items-center rounded-full text-[13px]", m ? clsx("font-semibold", MARK_TONE[m]) : isOff(d) ? "text-ink-300" : d.date === today ? "ring-2 ring-ink-900" : "text-ink-700")}>{Number(d.date.slice(8))}</span>
              </span>
            );
          })}
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-600">
          {STATUS.map((o) => (
            <span key={o.short} className="inline-flex items-center gap-1">
              <i className={clsx("h-2.5 w-2.5 rounded-full", o.on)} />
              {L(o.text)}
            </span>
          ))}
          <span className="text-ink-400">{L({ hi: "हल्के = रविवार या छुट्टी", en: "Faint = Sunday or holiday" })}</span>
        </p>
        <dl className="kv tnum">
          <div>
            <dt>{L({ hi: "लगे दिन", en: "Days marked" })}</dt>
            <dd>{s.days}</dd>
          </div>
          <div>
            <dt>{L({ hi: "उपस्थित / आधा", en: "Present / half" })}</dt>
            <dd>
              {s.present} / {s.half}
            </dd>
          </div>
          <div>
            <dt>{L({ hi: "अनुपस्थित / छुट्टी", en: "Absent / on leave" })}</dt>
            <dd>
              {s.absent} / {s.leave}
            </dd>
          </div>
        </dl>
      </div>
    </Sheet>
  );
}

/* ── Leave: record, approve, reject (ERP LeaveTab + LeaveDrawers) ── */

type Filter = "all" | LeaveStatus;
const year = (d: string) => d.slice(0, 4);

function afterApproval(written: number, kept: number, lang: (b: Bi) => string) {
  const parts: string[] = [];
  if (written) parts.push(lang({ hi: `${written} दिन छुट्टी पर मार्क हुए`, en: `${written} day${written === 1 ? "" : "s"} marked On leave` }));
  if (kept) parts.push(lang({ hi: `पहले से लगे ${kept} दिन वैसे ही रहे`, en: `${kept} already marked day${kept === 1 ? "" : "s"} kept` }));
  return parts.length ? ` ${parts.join(", ")}.` : "";
}

function LeaveTab({ canWrite, res }: { canWrite: boolean; res: ReturnType<typeof useApi<MaybeSetup<LeaveList>>> }) {
  const L = useL();
  const [filter, setFilter] = useState<Filter>("all");
  const [recording, setRecording] = useState(false);
  const [deciding, setDeciding] = useState<{ leave: StaffLeave; mode: "Approved" | "Rejected" } | null>(null);
  const list = res.data && !res.data.setupNeeded ? res.data : undefined;

  if (res.data?.setupNeeded) return <Empty>{L(SETUP)}</Empty>;

  const all = list?.data || [];
  const count = (s: LeaveStatus) => all.filter((l) => l.status === s).length;
  const shown = filter === "all" ? all : all.filter((l) => l.status === filter);
  const thisYear = list ? year(list.today) : "";
  const FILTERS: [Filter, Bi][] = [
    ["all", { hi: "सभी", en: "All" }],
    ["Pending", LEAVE_TEXT.Pending],
    ["Approved", LEAVE_TEXT.Approved],
    ["Rejected", LEAVE_TEXT.Rejected],
  ];

  return (
    <div className="space-y-3 pb-4">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label={L({ hi: "दिखाएँ", en: "Show" })}>
        {FILTERS.map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={clsx("min-h-[40px] shrink-0 rounded-full border bg-white px-3.5 text-[14px]", filter === k ? "border-[#3099a4] font-semibold text-[#3099a4]" : "border-ink-200 text-ink-700")}>
            {L(t)}
            {k !== "all" && list ? <span className="tnum ml-1 text-ink-400">{count(k)}</span> : null}
          </button>
        ))}
      </div>
      {canWrite && (
        <button type="button" onClick={() => setRecording(true)} disabled={!list} className="btn-line w-full">
          <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "छुट्टी लिखें", en: "Record leave" })}
        </button>
      )}

      {!list ? (
        res.error && res.error.status !== 401 ? <ErrorCard offline={res.error.status === 0} onRetry={res.reload} /> : <ListSkeleton rows={4} />
      ) : shown.length === 0 ? (
        <Empty>
          {filter === "all" ? L({ hi: "अभी कोई स्टाफ़ छुट्टी नहीं लिखी।", en: "No staff leave recorded yet." }) : L({ hi: `कोई ${L(LEAVE_TEXT[filter])} छुट्टी नहीं।`, en: `No ${filter.toLowerCase()} leave.` })}
          {filter === "all" && canWrite ? ` ${L({ hi: "कोई छुट्टी माँगे तो “छुट्टी लिखें” दबाएँ।", en: "When someone asks for leave, use Record leave." })}` : ""}
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((l) => (
            <li key={l.id} className="row-card space-y-1.5">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-semibold">{l.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-500">{[l.empCode, l.designation].filter(Boolean).join(" · ")}</span>
                </span>
                <Status tone={LEAVE_TONE[l.status]}>{L(LEAVE_TEXT[l.status])}</Status>
              </div>
              <p className="tnum text-[14px] text-ink-800">
                {l.leaveType} · {leaveRange(l.from, l.to)}
                {year(l.from) !== thisYear ? ` ${year(l.from)}` : ""} · {l.days} {L({ hi: "दिन", en: l.days === 1 ? "day" : "days" })}
              </p>
              <p className="whitespace-pre-line break-words text-[14px] text-ink-600">{l.reason}</p>
              {l.status !== "Pending" && (
                <p className="text-[12.5px] text-ink-400">
                  {L(LEAVE_TEXT[l.status])}
                  {l.processedBy ? ` · ${firstName(l.processedBy)}` : ""}
                  {l.processedAt ? `, ${clockAt(l.processedAt)}` : ""}
                  {l.remarks ? ` · “${l.remarks}”` : ""}
                </p>
              )}
              {l.status === "Pending" && canWrite && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button type="button" onClick={() => setDeciding({ leave: l, mode: "Rejected" })} className="btn-line min-h-[44px]">
                    <X className="h-4 w-4 text-rose-600" aria-hidden /> {L({ hi: "नामंज़ूर", en: "Reject" })}
                  </button>
                  <button type="button" onClick={() => setDeciding({ leave: l, mode: "Approved" })} className="btn-primary min-h-[44px]">
                    <Check className="h-4 w-4" aria-hidden /> {L({ hi: "मंज़ूर", en: "Approve" })}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {recording && list && <RecordLeaveSheet staff={list.staff} today={list.today} onClose={() => setRecording(false)} onSaved={res.reload} />}
      {deciding && <DecideLeaveSheet leave={deciding.leave} mode={deciding.mode} onClose={() => setDeciding(null)} onSaved={res.reload} />}
    </div>
  );
}

/** The office writes down a leave someone asked for (on paper or by phone). POST /api/staff-attendance/leaves. */
function RecordLeaveSheet({ staff, today, onClose, onSaved }: { staff: LeaveList["staff"]; today: string; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState("Casual");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [approve, setApprove] = useState(false);
  const [saving, setSaving] = useState(false);
  const days = leaveDays(from, to);

  async function save() {
    if (!staffId) return toast(false, L({ hi: "स्टाफ़ चुनें।", en: "Choose the staff member." }));
    if (!from || !to || to < from) return toast(false, L({ hi: "तारीख देखें: छुट्टी शुरू होने से पहले खत्म हो रही है।", en: "Check the dates: the leave ends before it starts." }));
    if (!days) return toast(false, L({ hi: "ये सारी तारीखें रविवार हैं।", en: "Those dates are all Sundays." }));
    if (reason.trim().length < 2) return toast(false, L({ hi: "छुट्टी का कारण लिखें।", en: "Write the reason for the leave." }));
    setSaving(true);
    try {
      const r = await api<{ success: boolean; data: { leave: StaffLeave; written: number; kept: number } }>("/erp/staff-attendance/leaves", { method: "POST", body: { staffId, leaveType: type, from, to, reason: reason.trim(), approve } });
      const who = staff.find((s) => s.id === staffId)?.name || "Leave";
      toast(true, approve ? L({ hi: `${who}: छुट्टी लिखी और मंज़ूर हुई।`, en: `${who}: leave recorded and approved.` }) + afterApproval(r.data.written, r.data.kept, L) : L({ hi: `${who}: छुट्टी लिखी गई। लिस्ट से मंज़ूर करें।`, en: `${who}: leave recorded. Approve it from the list.` }));
      onSaved();
      onClose();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setSaving(false);
    }
  }

  return (
    <Sheet title={L({ hi: "छुट्टी लिखें", en: "Record leave" })} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">{L({ hi: "कागज़ या फ़ोन पर माँगी गई छुट्टी के लिए", en: "For leave asked on paper or by phone" })}</p>
        <SelectBox label={L({ hi: "स्टाफ़", en: "Staff member" })} value={staffId} onChange={setStaffId}>
          <option value="">{L({ hi: "चुनें…", en: "Choose…" })}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.designation} ({s.empCode})
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "छुट्टी का प्रकार", en: "Type of leave" })} value={type} onChange={setType}>
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectBox>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field-box">
            <small>{L({ hi: "से", en: "From" })}</small>
            <input
              id="lv-from"
              type="date"
              value={from}
              onChange={(e) => {
                const v = e.target.value;
                setFrom(v);
                if (v && (!to || to < v)) setTo(v);
              }}
            />
            <CalendarDays aria-hidden />
          </label>
          <label className="field-box">
            <small>{L({ hi: "तक", en: "To" })}</small>
            <input id="lv-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            <CalendarDays aria-hidden />
          </label>
        </div>
        <p className="text-[13px] text-ink-500">
          {days ? (
            <>
              <b className="text-ink-800">{L({ hi: `${days} दिन`, en: `${days} day${days === 1 ? "" : "s"}` })}</b> {L({ hi: "(रविवार नहीं गिने)", en: "(Sundays not counted)" })}
            </>
          ) : from && to && to >= from ? (
            L({ hi: "ये सारी तारीखें रविवार हैं।", en: "Those dates are all Sundays." })
          ) : (
            ""
          )}
        </p>
        <textarea id="lv-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={L({ hi: "कारण, जैसे जोधपुर में बहन की शादी", en: "Reason, e.g. Sister's wedding at Jodhpur" })} className="textarea-box" />
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-200 bg-white p-3 text-[14px] text-ink-700">
          <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#3099a4]" />
          <span>
            <b className="font-semibold text-ink-900">{L({ hi: "पहले से मंज़ूर", en: "Already approved" })}</b>
            <span className="block text-[13px] text-ink-500">{L({ hi: "ये दिन स्टाफ़ हाज़िरी में छुट्टी पर लग जाएँगे। जो दिन पहले से लगे हैं, वे नहीं बदलेंगे।", en: "Marks these days On leave in staff attendance. Days already marked are not changed." })}</span>
          </span>
        </label>
        <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? "…" : approve ? L({ hi: "लिखें और मंज़ूर करें", en: "Record & approve" }) : L({ hi: "छुट्टी लिखें", en: "Record leave" })}
        </button>
      </div>
    </Sheet>
  );
}

/** Approve or reject one pending leave, with an optional remark. POST /api/staff-attendance/leaves/:id/decide. */
function DecideLeaveSheet({ leave, mode, onClose, onSaved }: { leave: StaffLeave; mode: "Approved" | "Rejected"; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const approving = mode === "Approved";

  async function go() {
    setSaving(true);
    try {
      const r = await api<{ success: boolean; data: { leave: StaffLeave; written: number; kept: number } }>(`/erp/staff-attendance/leaves/${leave.id}/decide`, { method: "POST", body: { decision: mode, remark: remark.trim() } });
      toast(true, approving ? L({ hi: `${leave.name}: छुट्टी मंज़ूर।`, en: `${leave.name}: leave approved.` }) + afterApproval(r.data.written, r.data.kept, L) : L({ hi: `${leave.name}: छुट्टी नामंज़ूर।`, en: `${leave.name}: leave rejected.` }));
      onSaved();
      onClose();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setSaving(false);
    }
  }

  return (
    <Sheet title={approving ? L({ hi: "छुट्टी मंज़ूर करें", en: "Approve leave" }) : L({ hi: "छुट्टी नामंज़ूर करें", en: "Reject leave" })} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">
          {leave.name} · {leave.designation || leave.empCode}
        </p>
        <dl className="kv">
          <div>
            <dt>{L({ hi: "प्रकार", en: "Type" })}</dt>
            <dd>{leave.leaveType} leave</dd>
          </div>
          <div>
            <dt>{L({ hi: "तारीख", en: "Dates" })}</dt>
            <dd>{leaveRange(leave.from, leave.to)}</dd>
          </div>
          <div>
            <dt>{L({ hi: "दिन", en: "Days" })}</dt>
            <dd>{L({ hi: `${leave.days} (रविवार नहीं गिने)`, en: `${leave.days} (Sundays not counted)` })}</dd>
          </div>
          <div>
            <dt>{L({ hi: "कारण", en: "Reason" })}</dt>
            <dd>{leave.reason}</dd>
          </div>
        </dl>
        {approving && <p className="text-[13px] text-ink-600">{L({ hi: "इस छुट्टी के जिन दिनों की हाज़िरी नहीं लगी, वे छुट्टी पर लग जाएँगे (रविवार और स्कूल की छुट्टियाँ नहीं)। जो दिन उपस्थित या अनुपस्थित लगे हैं, वे वैसे ही रहेंगे।", en: "Days of this leave that have no attendance yet will be marked On leave (not Sundays or school holidays). Days already marked Present or Absent stay as they are." })}</p>}
        <label className="field-box">
          <small>{L({ hi: "टिप्पणी (अगर हो)", en: "Remark (optional)" })}</small>
          <input id="lv-remark" value={remark} maxLength={300} onChange={(e) => setRemark(e.target.value)} placeholder={approving ? L({ hi: "जैसे 7th-A के लिए दूसरा टीचर", en: "e.g. Arrange substitute for 7th-A" }) : L({ hi: "जैसे उस हफ़्ते परीक्षा है", en: "e.g. Exams that week" })} />
        </label>
        <button type="button" onClick={go} disabled={saving} className={approving ? "btn-primary w-full" : "btn w-full bg-rose-600 text-white"}>
          {saving ? "…" : approving ? L({ hi: "मंज़ूर करें", en: "Approve" }) : L({ hi: "नामंज़ूर करें", en: "Reject" })}
        </button>
      </div>
    </Sheet>
  );
}
