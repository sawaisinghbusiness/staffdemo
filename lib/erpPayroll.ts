/**
 * Payroll shapes and helpers. Copied from ERP lib/services/payrollService.ts, components/payroll/* —
 * keep in step with the ERP. The backend (/api/payroll*) works out every slip; the app only shows it.
 */

export interface SalaryStructure {
  basic: number;
  hra: number;
  da: number;
  other_allowance: number;
  pf: boolean;
  esi: boolean;
  tds: number;
  other_deduction: number;
  bank_name: string;
  account_no: string;
  ifsc: string;
  pan: string;
}

export interface Payslip {
  id: string;
  month: string;
  staff_id: string;
  staff_name: string;
  emp_code: string | null;
  designation: string | null;
  days_in_month: number;
  lop_days: number;
  lop_manual: boolean;
  paid_days: number;
  earnings: { basic: number; hra: number; da: number; other: number; bonus: number };
  deductions: { pf: number; esi: number; tds: number; other: number; advance: number };
  bonus: number;
  advance: number;
  gross: number;
  total_deductions: number;
  net: number;
  status: "draft" | "paid";
  paid_on: string | null;
  pay_mode: string | null;
  pay_ref: string | null;
}

export interface PayrollRow {
  staffId: string;
  empCode: string;
  name: string;
  designation: string;
  department: string;
  status: string;
  structure: SalaryStructure | null;
  slip: Payslip | null;
}

export const PAY_MODES = ["Bank transfer", "Cash", "Cheque", "UPI"];
export const EMPTY_STRUCTURE: SalaryStructure = { basic: 0, hra: 0, da: 0, other_allowance: 0, pf: false, esi: false, tds: 0, other_deduction: 0, bank_name: "", account_no: "", ifsc: "", pan: "" };

export const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
export const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
export const nowMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Whole rupees, never below 0 (the ERP SalaryDrawer's num()). */
export const rupees = (v: string | boolean) => Math.max(0, Math.round(Number(v) || 0));

/**
 * The salary form's "net a month" preview, exactly as the ERP SalaryDrawer shows it.
 * Only a preview: the backend's payroll run is what makes the real slip.
 */
export function previewNet(f: { basic: string; hra: string; da: string; other_allowance: string; pf: boolean; esi: boolean; tds: string; other_deduction: string }) {
  const gross = rupees(f.basic) + rupees(f.hra) + rupees(f.da) + rupees(f.other_allowance);
  const pf = f.pf ? Math.round(0.12 * Math.min(rupees(f.basic) + rupees(f.da), 15000)) : 0;
  const esi = f.esi && gross <= 21000 ? Math.ceil(0.0075 * gross) : 0;
  return { gross, pf, esi, net: gross - pf - esi - rupees(f.tds) - rupees(f.other_deduction) };
}
