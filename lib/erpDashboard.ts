/** Copied from ERP lib/services/dashboardService.ts and app/dashboard/page.tsx — keep in step with the ERP. */

/** GET /api/dashboard answers `{ data: Dashboard }` (backend services/dashboardService.ts, cached 60s). */
export interface Dashboard {
  generatedAt: string;
  students: { total: number; boys: number; girls: number; bus: number };
  fees: {
    sessionTotal: number;
    sessionPaid: number;
    sessionDue: number;
    dueStudents: number;
    thisMonth: number;
    lastMonth: number;
    byMonth: { month: string; amount: number }[];
    byMode: { Cash: number; UPI: number; Cheque: number; Other: number };
    topDueClasses: { class: string; due: number }[];
  };
  today: { receipts: number; amount: number };
  attention: {
    chequesThisWeek: { count: number; amount: number };
    birthdaysToday: { name: string; classSec: string }[];
    sectionsTotal: number;
    sectionsMarkedToday: number;
  };
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ₹ in Indian units: ₹76.2 L, ₹3.65 Cr, ₹54,000 */
export function money(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export const fmt = (n: number) => n.toLocaleString("en-IN");
