import React from "react";
import type { TTEntry as Entry, TTPeriod as Period } from "@/lib/erpTimetable";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A4 class timetable, plain black on white. */
export function TimetableDocument({ school, classSec, periods, entries, teacherName, sessionLabel }: { school: string; classSec: string; periods: Period[]; entries: Entry[]; teacherName: (id: string | null) => string; sessionLabel?: string }) {
  const cell = "border border-black px-2 py-2 align-top";
  const at = (day: number, p: Period) => entries.find((e) => e.day === day && e.periodId === p.id);
  return (
    <div className="cert-sheet mx-auto h-[1123px] w-[794px] overflow-hidden bg-white px-10 py-12 text-[12px] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="border-b-2 border-black pb-3 text-center">
        <div className="text-[20px] font-bold uppercase tracking-wide">{school}</div>
        <div className="mt-1 text-[15px] font-bold">
          Timetable · Class {classSec}{sessionLabel ? ` · Session ${sessionLabel}` : ""}
        </div>
      </div>
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            <th className={`${cell} w-24 text-left`}>Period</th>
            {DAYS.map((d) => (
              <th key={d} className={`${cell} text-center`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) =>
            p.isBreak ? (
              <tr key={p.id} className="bg-neutral-50">
                <td className={`${cell} font-semibold`}>
                  {p.label}
                  {p.start && <span className="block text-[10px] font-normal">{p.start}–{p.end}</span>}
                </td>
                <td colSpan={6} className={`${cell} text-center text-[11px] uppercase tracking-widest text-neutral-600`}>
                  {p.label}
                </td>
              </tr>
            ) : (
              <tr key={p.id} style={{ height: 62 }}>
                <td className={`${cell} font-semibold`}>
                  {p.label}
                  {p.start && <span className="block text-[10px] font-normal">{p.start}–{p.end}</span>}
                </td>
                {DAYS.map((_, i) => {
                  const e = at(i + 1, p);
                  return (
                    <td key={i} className={`${cell} text-center`}>
                      {e && (
                        <>
                          <span className="block font-semibold">{e.subject}</span>
                          {e.staffId && <span className="block text-[10px]">{teacherName(e.staffId)}</span>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
