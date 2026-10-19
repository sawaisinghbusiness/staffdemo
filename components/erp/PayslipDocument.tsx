import React from "react";
import { inr, monthLabel, type Payslip } from "@/lib/erpPayroll";

/** A4 salary slip, plain black on white. Copied from ERP components/payroll/PayslipDocument.tsx — keep in step with the ERP. */
export function PayslipDocument({ slip, school, place, account }: { slip: Payslip; school: string; place: string; account?: { bank: string; no: string; ifsc: string; pan: string } }) {
  const earn: [string, number][] = [
    ["Basic", slip.earnings.basic],
    ["HRA", slip.earnings.hra],
    ["DA", slip.earnings.da],
    ["Other allowance", slip.earnings.other],
    ["Bonus", slip.earnings.bonus],
  ].filter(([, v]) => (v as number) > 0) as [string, number][];
  const ded: [string, number][] = [
    ["Provident fund", slip.deductions.pf],
    ["ESI", slip.deductions.esi],
    ["TDS", slip.deductions.tds],
    ["Other deduction", slip.deductions.other],
    ["Advance", slip.deductions.advance],
  ].filter(([, v]) => (v as number) > 0) as [string, number][];
  const rows = Math.max(earn.length, ded.length, 1);
  const cell = "border border-black px-3 py-1.5";

  return (
    <div className="cert-sheet mx-auto h-[1123px] w-[794px] bg-white px-14 py-12 text-[13px] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="border-b-2 border-black pb-3 text-center">
        <div className="text-[20px] font-bold uppercase tracking-wide">{school}</div>
        <div className="text-[12px]">{place}</div>
        <div className="mt-2 text-[15px] font-bold">Salary slip for {monthLabel(slip.month)}</div>
      </div>

      <table className="mt-5 w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} w-1/4 font-semibold`}>Name</td>
            <td className={`${cell} w-1/4`}>{slip.staff_name}</td>
            <td className={`${cell} w-1/4 font-semibold`}>Employee code</td>
            <td className={`${cell} w-1/4`}>{slip.emp_code || "—"}</td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Designation</td>
            <td className={cell}>{slip.designation || "—"}</td>
            <td className={`${cell} font-semibold`}>Days paid</td>
            <td className={cell}>
              {slip.paid_days} of {slip.days_in_month}
              {slip.lop_days > 0 ? ` (LOP ${slip.lop_days})` : ""}
            </td>
          </tr>
          <tr>
            <td className={`${cell} font-semibold`}>Bank account</td>
            <td className={cell}>{account?.no ? `${account.no}${account.ifsc ? ` · ${account.ifsc}` : ""}` : "—"}</td>
            <td className={`${cell} font-semibold`}>PAN</td>
            <td className={cell}>{account?.pan || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            <th className={`${cell} text-left`}>Earnings</th>
            <th className={`${cell} text-right`}>Amount</th>
            <th className={`${cell} text-left`}>Deductions</th>
            <th className={`${cell} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className={cell}>{earn[i]?.[0] || ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{earn[i] ? inr(earn[i][1]) : ""}</td>
              <td className={cell}>{ded[i]?.[0] || (i === 0 ? "None" : "")}</td>
              <td className={`${cell} text-right tabular-nums`}>{ded[i] ? inr(ded[i][1]) : ""}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={cell}>Gross earnings</td>
            <td className={`${cell} text-right tabular-nums`}>{inr(slip.gross)}</td>
            <td className={cell}>Total deductions</td>
            <td className={`${cell} text-right tabular-nums`}>{inr(slip.total_deductions)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-5 flex items-center justify-between border-2 border-black px-4 py-3">
        <span className="text-[15px] font-bold">Net pay</span>
        <span className="text-[18px] font-bold tabular-nums">{inr(slip.net)}</span>
      </div>
      {slip.status === "paid" && (
        <p className="mt-3 text-[12px]">
          Paid on {new Date(slip.paid_on + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} by {slip.pay_mode}
          {slip.pay_ref ? ` (ref. ${slip.pay_ref})` : ""}.
        </p>
      )}

      <div className="mt-24 flex justify-between text-[12px]">
        <span className="w-48 border-t border-black pt-1 text-center">Employee</span>
        <span className="w-48 border-t border-black pt-1 text-center">Principal</span>
      </div>
    </div>
  );
}
