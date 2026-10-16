"use client";
/* Copied from the ERP (components/attendance/register/RegisterGrid.tsx). Keep in step. */

import React from "react";
import type { Mark, MonthRegister, RegisterDay } from "@/lib/erpRegister";

const MARK_STYLE: Record<Mark, string> = {
  P: "text-emerald-600 font-medium",
  A: "rounded bg-rose-50 text-rose-700 font-bold",
  L: "text-marigold-700 font-semibold",
  H: "text-sky-700 font-semibold",
};
export const MARK_NAME: Record<Mark, string> = { P: "Present", A: "Absent", L: "Leave", H: "Half day" };

export const isOff = (d: RegisterDay) => d.sunday || !!d.holiday;
const pctText = (p: number | null) => (p === null ? "—" : `${Number.isInteger(p) ? p : p.toFixed(1)}%`);

/**
 * The month grid: one row per student (roll + name stay put while the days scroll),
 * one column per day, then Present / Absent / Leave / % on the right.
 */
export function RegisterGrid({ data, today }: { data: MonthRegister; today: string }) {
  const { days, students } = data;
  const sum = (k: "present" | "absent" | "leave" | "half") => students.reduce((t, s) => t + s[k], 0);
  const head = "border-b border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-500";
  const cell = "border-b border-slate-100";

  return (
    <div className="register-scroll overflow-x-auto">
      <table className="register-table w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={`${head} sticky left-0 z-20 min-w-[184px] whitespace-nowrap border-r pl-4 pr-3 text-left`}>
              <span className="inline-block w-7 text-slate-400">Roll</span>
              Student
            </th>
            {days.map((d) => {
              const off = isOff(d);
              return (
                <th key={d.date} title={d.holiday || (d.sunday ? "Sunday" : `${d.weekday} ${Number(d.date.slice(8))}`)} className={`${head} min-w-[28px] whitespace-nowrap px-0 text-center ${off ? "bg-slate-100 text-slate-400" : ""}`}>
                  <span className="block tabular-nums leading-4">{Number(d.date.slice(8))}</span>
                  <span className={`block text-[10px] font-medium leading-3 ${off ? "text-slate-400" : "text-slate-400/80"}`}>{d.holiday ? "H" : d.sunday ? "S" : d.weekday.slice(0, 2)}</span>
                </th>
              );
            })}
            <th className={`${head} whitespace-nowrap border-l pl-3 pr-2 text-right`} title="Present">
              P
            </th>
            <th className={`${head} whitespace-nowrap px-2 text-right`} title="Absent">
              A
            </th>
            <th className={`${head} whitespace-nowrap px-2 text-right`} title="Leave">
              L
            </th>
            <th className={`${head} whitespace-nowrap pl-2 pr-4 text-right`}>Attendance</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="group">
              <td className={`${cell} sticky left-0 z-10 whitespace-nowrap border-r border-r-slate-200 bg-white py-1.5 pl-4 pr-3 group-hover:bg-slate-50`}>
                <span className="inline-block w-7 tabular-nums text-slate-400">{s.rollNo || "–"}</span>
                <span className="register-name inline-block max-w-[150px] truncate align-bottom font-medium text-slate-900" title={s.name}>
                  {s.name}
                </span>
              </td>
              {days.map((d) => {
                const m = s.marks[d.date];
                const off = isOff(d);
                return (
                  <td key={d.date} className={`${cell} px-0 py-1.5 text-center leading-5 ${off ? "bg-slate-50" : ""}`} title={m ? `${MARK_NAME[m]} · ${Number(d.date.slice(8))} ${d.weekday}` : undefined}>
                    {m ? <span className={`inline-block min-w-[18px] ${MARK_STYLE[m]}`}>{m}</span> : off || d.date > today ? null : <span className="text-slate-300">·</span>}
                  </td>
                );
              })}
              <td className={`${cell} whitespace-nowrap border-l border-l-slate-200 pl-3 pr-2 text-right tabular-nums text-slate-700`}>{s.present}</td>
              <td className={`${cell} whitespace-nowrap px-2 text-right tabular-nums ${s.absent ? "font-semibold text-rose-700" : "text-slate-400"}`}>{s.absent}</td>
              <td className={`${cell} whitespace-nowrap px-2 text-right tabular-nums ${s.leave ? "text-marigold-700" : "text-slate-400"}`}>{s.leave}</td>
              <td className={`${cell} whitespace-nowrap pl-2 pr-4`}>
                <Meter percent={s.percent} half={s.half} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs font-semibold text-slate-600">
            <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-slate-50 py-2 pl-4 pr-3">
              <span className="inline-block w-7" />
              Present each day
            </td>
            {days.map((d) => (
              <td key={d.date} className={`whitespace-nowrap bg-slate-50 px-0 py-2 text-center tabular-nums ${isOff(d) ? "text-slate-300" : ""}`} title={d.marked ? `${d.present} present, ${d.absent} absent, ${d.leave} leave, ${d.half} half day` : undefined}>
                {d.marked ? d.present : ""}
              </td>
            ))}
            <td className="whitespace-nowrap border-l border-slate-200 bg-slate-50 pl-3 pr-2 text-right tabular-nums">{sum("present")}</td>
            <td className="whitespace-nowrap bg-slate-50 px-2 text-right tabular-nums text-rose-700">{sum("absent")}</td>
            <td className="whitespace-nowrap bg-slate-50 px-2 text-right tabular-nums text-marigold-700">{sum("leave")}</td>
            <td className="whitespace-nowrap bg-slate-50 pl-2 pr-4 text-right tabular-nums text-slate-900">{pctText(data.totals.averagePercent)} avg</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function Meter({ percent, half = 0, below = 75 }: { percent: number | null; half?: number; below?: number }) {
  if (percent === null) return <span className="block text-right text-slate-400">—</span>;
  const low = percent < below;
  return (
    <span className="flex items-center justify-end gap-2" title={half ? `${half} half day${half === 1 ? "" : "s"} counted as ½` : undefined}>
      <span className="register-meter h-1.5 w-10 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${low ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </span>
      <span className={`w-12 text-right tabular-nums ${low ? "font-semibold text-rose-700" : "text-slate-900"}`}>{pctText(percent)}</span>
    </span>
  );
}

/** Small key under the grid. */
export function Legend() {
  const item = (m: Mark) => (
    <span key={m} className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-block min-w-[16px] text-center ${MARK_STYLE[m]}`}>{m}</span>
      {MARK_NAME[m]}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      {(["P", "A", "L", "H"] as Mark[]).map(item)}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="inline-block h-3.5 w-4 rounded-sm border border-slate-200 bg-slate-100" />
        Sunday (S) or holiday (H in the date row)
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-slate-300">·</span>
        Not marked
      </span>
      <span className="whitespace-nowrap">Half day counts as ½ present</span>
    </div>
  );
}
