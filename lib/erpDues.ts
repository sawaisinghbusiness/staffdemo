/* Copied from the ERP (lib/services/duesService.ts: types, reminder templates, fillTemplate, whatsappLink). Keep in step. */

export interface OverdueInstalment {
  name: string;
  due: string;
  outstanding: number;
  daysLate: number;
  fine: number;
}

export interface StudentDues {
  studentId: string;
  name: string;
  srNo: string;
  class: string;
  section: string;
  classSec: string;
  fatherName: string;
  mobile: string;
  bus: boolean;
  total: number;
  paid: number;
  balance: number;
  dueNow: number;
  fine: number;
  overdue: OverdueInstalment[];
  upcoming: { name: string; due: string; outstanding: number } | null;
  lastPaid: string | null;
  adjusted: boolean;
}

export interface DuesReport {
  asOf: string;
  instalments: { name: string; due: string }[];
  students: StudentDues[];
  summary: {
    active: number;
    withDues: number;
    dueNow: number;
    fine: number;
    upToDate: number;
    next: { name: string; due: string; students: number; amount: number } | null;
  };
}

/* ── Reminder messages ── */

export type ReminderLang = "hi" | "en";

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const shortQ = (name: string) => name.replace(/^Quarter\s*/i, "Q");

export const DEFAULT_TEMPLATES: Record<ReminderLang, string> = {
  hi: "प्रिय अभिभावक, {name} (कक्षा {class}) की फीस {due} बकाया है ({quarters})। {fine_line}कृपया जल्द से जल्द स्कूल कार्यालय में जमा करें। – {school}",
  en: "Dear Parent, fee of {due} for {name} (Class {class}) is overdue ({quarters}). {fine_line}Please pay at the school office at the earliest. – {school}",
};

/** Fills a reminder template for one student. */
export function fillTemplate(tpl: string, s: StudentDues, school: string, lang: ReminderLang): string {
  const fineLine = s.fine > 0 ? (lang === "hi" ? `विलंब शुल्क अब तक ${inr(s.fine)}। ` : `Late fine so far ${inr(s.fine)}. `) : "";
  return tpl
    .replace(/\{name\}/g, s.name)
    .replace(/\{class\}/g, s.classSec.replace(/\s*-\s*/, "-"))
    .replace(/\{due\}/g, inr(s.dueNow))
    .replace(/\{fine\}/g, inr(s.fine))
    .replace(/\{total\}/g, inr(s.dueNow + s.fine))
    .replace(/\{quarters\}/g, s.overdue.map((o) => shortQ(o.name)).join(", "))
    .replace(/\{fine_line\}/g, fineLine)
    .replace(/\{school\}/g, school);
}

/** wa.me link that opens WhatsApp with the message typed in, for the office phone to send. */
export function whatsappLink(mobile: string, text: string): string | null {
  const digits = (mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits) || /^(\d)\1{9}$/.test(digits)) return null; // 9999999999 etc. are placeholders, not parents
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}
