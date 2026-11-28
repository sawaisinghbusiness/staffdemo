/**
 * Who may open which ERP screen inside the staff app's ERP login (2026-11-28).
 * KEEP IN STEP with the ERP website (components/layout/navConfig.ts ROUTE_ROLES / ROUTE_PERMS)
 * and the backend (src/lib/permissions.ts). The backend enforces fees, reports and salary;
 * this only keeps the menu to what the person may use.
 */

const ROUTE_ROLES: [string, string[]][] = [
  ["/fees", ["admin", "accountant"]],
  ["/staff/payroll", ["admin", "accountant"]],
  ["/staff/new", ["admin"]],
  ["/staff/excel", ["admin"]],
  ["/staff/allocation", ["admin"]],
  ["/staff/class-teachers", ["admin"]],
  ["/students/photos", ["admin", "accountant"]],
  ["/students/enquiries", ["admin", "accountant"]],
  ["/students/promote", ["admin"]],
  ["/students/certificates", ["admin"]],
  ["/students/excel", ["admin"]],
  ["/parent-chats", ["admin"]],
  ["/settings", ["admin"]],
];

const ROUTE_PERMS: [string, string[]][] = [
  ["/report", ["fees.dashboard"]],
  ["/fees", ["fees.view", "fees.collect"]],
  ["/fees/collect", ["fees.collect"]],
  ["/fees/reports", ["reports.fees"]],
  ["/reports", ["reports.fees", "reports.attendance"]],
  ["/staff", ["staff.view"]],
  ["/staff/payroll", ["salary"]],
  ["/students", ["students.view"]],
  ["/students/photos", ["students.docs"]],
  ["/attendance/mark", ["att.mark"]],
  ["/attendance/today", ["att.mark", "att.view"]],
  ["/attendance/register", ["att.mark", "att.view"]],
  ["/attendance/leave", ["att.mark", "att.view"]],
  ["/homework", ["hw"]],
  ["/copy-check", ["hw"]],
  ["/syllabus", ["hw", "exams"]],
  ["/exams/marks", ["marks"]],
  ["/exams/setup", ["exams"]],
  ["/exams/report-cards", ["exams"]],
  ["/messages", ["messages"]],
  ["/parent-chats", ["messages"]],
  ["/transport", ["transport"]],
];

const pathOf = (href: string) => href.split("?")[0].replace(/^\/erp(?=\/|$)/, "").replace(/\/+$/, "") || "/";
const longest = <T,>(rules: [string, T][], path: string) => rules.filter(([p]) => path === p || path.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];

/** True when this ERP login may open `href`. Unknown role (still loading) or an older backend without permissions: allowed. */
export function canOpenErp(href: string, role?: string, perms?: string[]): boolean {
  if (!role || !href.startsWith("/erp")) return true;
  const path = pathOf(href);
  const r = longest(ROUTE_ROLES, path);
  if (r && !r[1].includes(role)) return false;
  if (role === "admin" || !perms) return true;
  const need = longest(ROUTE_PERMS, path);
  return !need || need[1].some((p) => perms.includes(p));
}
