"use client";
/* Copied from the ERP (components/staff/attendance/StaffRegisterGrid.tsx + MARK_STYLE/MARK_NAME from shared.tsx). Keep in step. */

import React from "react";
import type { Mark, RegisterDay, StaffRegister } from "@/lib/erpStaff";
export const MARK_STYLE: Record<Mark, string> = {
  P: "text-emerald-600 font-medium",
  A: "rounded bg-rose-50 text-rose-700 font-bold",
  L: "text-marigold-700 font-semibold",
  H: "text-sky-700 font-semibold",
};
export const MARK_NAME: Record<Mark, string> = { P: "Present", A: "Absent", L: "On leave", H: "Half day" };

export const isOff = (d: RegisterDay) => d.sunday || !!d.holiday;

/**
 * Staff × days for one month. Code + name stay put while the days scroll sideways;
 * totals (P, A, L, H, days marked) on the right.
 */
export function StaffRegisterGrid({ data, today }: { data: StaffRegister; today: string }) {
  const { days, staff } = data;
  const sum = (k: "present" | "absent" | "leave" | "half" | "days") => staff.reduce((t, s) => t + s[k], 0);
  const head = "border-b border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-500";
  const cell = "border-b border-slate-100";
  const total = "whitespace-nowrap px-2 text-right tabular-nums";

  return (
    <div className="register-scroll overflow-x-auto">
      <table className="register-table w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={`${head} sticky left-0 z-20 min-w-[200px] whitespace-nowrap border-r pl-4 pr-3 text-left`}>
              <span className="register-code inline-block w-[66px] text-slate-400">Code</span>
              Name
            </th>
            {days.map((d) => {
              const off = isOff(d);
              return (
                <th key={d.date} title={d.holiday || (d.sunday ? "Sunday" : `${d.weekday} ${Number(d.date.slice(8))}`)} className={`${head} min-w-[26px] whitespace-nowrap px-0 text-center ${off ? "bg-slate-100 text-slate-400" : ""}`}>
                  <span className="block tabular-nums leading-4">{Number(d.date.slice(8))}</span>
                  <span className="block text-[10px] font-medium leading-3 text-slate-400">{d.holiday ? "Hol" : d.sunday ? "S" : d.weekday.slice(0, 2)}</span>
                </th>
              );
            })}
            <th className={`${head} ${total} border-l pl-3`} title="Present">P</th>
            <th className={`${head} ${total}`} title="Absent">A</th>
            <th className={`${head} ${total}`} title="On leave">L</th>
            <th className={`${head} ${total}`} title="Half day">H</th>
            <th className={`${head} ${total} pr-4`} title="Days marked (working days)">Days</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="group">
              <td className={`${cell} sticky left-0 z-10 whitespace-nowrap border-r border-r-slate-200 bg-white py-1.5 pl-4 pr-3 group-hover:bg-slate-50`} title={`${s.name} · ${s.designation}`}>
                <span className="register-code inline-block w-[66px] truncate align-bottom text-xs tabular-nums text-slate-400">{s.empCode}</span>
                <span className="register-name inline-block max-w-[150px] truncate align-bottom font-medium text-slate-900">{s.name}</span>
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
              <td className={`${cell} ${total} border-l border-l-slate-200 pl-3 text-slate-700`}>{s.present}</td>
              <td className={`${cell} ${total} ${s.absent ? "font-semibold text-rose-700" : "text-slate-400"}`}>{s.absent}</td>
              <td className={`${cell} ${total} ${s.leave ? "text-marigold-700" : "text-slate-400"}`}>{s.leave}</td>
              <td className={`${cell} ${total} ${s.half ? "text-sky-700" : "text-slate-400"}`}>{s.half}</td>
              <td className={`${cell} ${total} pr-4 text-slate-900`}>{s.days}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs font-semibold text-slate-600">
            <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-slate-50 py-2 pl-4 pr-3">
              <span className="register-code inline-block w-[66px]" />
              Present each day
            </td>
            {days.map((d) => (
              <td key={d.date} className={`whitespace-nowrap bg-slate-50 px-0 py-2 text-center tabular-nums ${isOff(d) ? "text-slate-300" : ""}`} title={d.marked ? `${d.present} present, ${d.absent} absent, ${d.leave} on leave, ${d.half} half day` : undefined}>
                {d.marked ? d.present + d.half : ""}
              </td>
            ))}
            <td className={`${total} border-l border-slate-200 bg-slate-50 pl-3`}>{sum("present")}</td>
            <td className={`${total} bg-slate-50 text-rose-700`}>{sum("absent")}</td>
            <td className={`${total} bg-slate-50 text-marigold-700`}>{sum("leave")}</td>
            <td className={`${total} bg-slate-50 text-sky-700`}>{sum("half")}</td>
            <td className={`${total} bg-slate-50 pr-4 text-slate-900`}>{sum("days")}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      {(["P", "A", "L", "H"] as Mark[]).map((m) => (
        <span key={m} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={`inline-block min-w-[16px] text-center ${MARK_STYLE[m]}`}>{m}</span>
          {MARK_NAME[m]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="inline-block h-3.5 w-4 rounded-sm border border-slate-200 bg-slate-100" />
        Sunday (S) or holiday (Hol)
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-slate-300">·</span>
        Not marked
      </span>
      <span className="whitespace-nowrap">Present each day counts half days</span>
    </div>
  );
}
