import type { Bi } from "./i18n";
import type { Tone } from "@/components/ui";

/**
 * Copied from ERP lib/services/staffService.ts, lib/services/staffAttendanceService.ts and
 * lib/services/userService.ts (ROLE_INFO, suggestPassword, passwordProblem) — keep in step with the ERP.
 * Staff records come from /api/staff, staff attendance and leave from /api/staff-attendance.
 */

export type StaffType = "teaching" | "non_teaching";

export interface Assignment {
  classSec: string;
  subject: string;
}

export interface StaffMember {
  id: string;
  empCode: string;
  name: string;
  staffType: StaffType;
  department: string;
  designation: string;
  mobile: string;
  altMobile: string;
  email: string;
  qualification: string;
  joiningDate: string;
  gender: string;
  dob: string;
  address: string;
  experienceYears: number | null;
  status: "Active" | "On Leave" | "Relieved";
  relievedOn: string;
  notes: string;
  photoUrl?: string | null;
  login: { userId: string; role: string; active: boolean } | null;
  classTeacherOf: string | null;
  subjects: Assignment[];
}

export type StaffList = { data: StaffMember[]; setupNeeded: boolean };

export type StaffInput = Partial<Omit<StaffMember, "id" | "status" | "relievedOn" | "login" | "classTeacherOf" | "subjects" | "photoUrl">>;

export const DESIGNATIONS: Record<StaffType, string[]> = {
  teaching: ["Principal", "Vice Principal", "PGT", "TGT", "PRT", "NTT", "Teacher", "Sports Teacher", "Music Teacher", "Librarian", "Counsellor"],
  non_teaching: ["Office Clerk", "Accountant", "Receptionist", "Lab Assistant", "Computer Operator", "Driver", "Conductor", "Peon", "Ayah", "Guard", "Sweeper"],
};

/** /api/classes, as the ERP's classService.fetchClasses reads it. */
export interface ClassItem {
  id: string;
  name: string;
  sections: { id: string; name: string; subjects: string[] }[];
}
export const normClasses = (r: { data?: any[] } | undefined): ClassItem[] =>
  (Array.isArray(r?.data) ? r!.data : []).map((c: any) => ({
    id: c.id,
    name: c.name,
    sections: (c.sections || []).map((s: any) => ({ id: s.id, name: s.name, subjects: Array.isArray(s.subjects) ? s.subjects : [] })),
  }));

/** ERP userService ROLE_INFO (the roles a staff login can get). */
export const ROLE_INFO: Record<string, { label: string; hi: string; can: Bi }> = {
  admin: { label: "Admin", hi: "एडमिन", can: { hi: "सब कुछ: बच्चे, फ़ीस, फ़ीस सेटअप, सेटिंग और यूज़र खाते।", en: "Everything: students, fees, fee setup, settings and these user accounts." } },
  accountant: { label: "Accounts", hi: "अकाउंट्स", can: { hi: "फ़ीस लेते हैं और रसीद छापते हैं, पूछताछ देखते हैं। बच्चे और रिपोर्ट देखते हैं।", en: "Collects fees and prints receipts, handles enquiries. Sees students and reports." } },
  teacher: { label: "Teacher", hi: "टीचर", can: { hi: "हाज़िरी लगाते हैं और गेट पास देते हैं। बच्चे और रिपोर्ट देखते हैं।", en: "Marks attendance and issues gate passes. Sees students and reports." } },
  exam_cell: { label: "Exam cell", hi: "परीक्षा सेल", can: { hi: "बच्चे और रिपोर्ट देखते हैं। अंक भरना परीक्षा के साथ खुलेगा।", en: "Sees students and reports. Marks entry will open for them with Exams." } },
};
export const LOGIN_ROLES = ["teacher", "exam_cell", "accountant", "admin"] as const;
export const roleLabel = (r: string, lang: "hi" | "en") => (ROLE_INFO[r] ? (lang === "hi" ? ROLE_INFO[r].hi : ROLE_INFO[r].label) : r);

/** A password that is easy to read out over the phone: Word + 4 digits + word. */
export function suggestPassword(): string {
  const words = ["Thar", "Barmer", "Desert", "Camel", "Marigold", "Sunrise", "Peacock", "Mango", "River", "Lotus", "Banyan", "Kesar"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}${Math.floor(1000 + Math.random() * 9000)}${pick().toLowerCase()}`;
}

/** Same rules as the backend; returns a message when too weak. */
export function passwordProblem(pw: string): Bi | null {
  if (pw.length < 8) return { hi: "कम से कम 8 अक्षर रखें।", en: "Use at least 8 characters." };
  if (pw.length > 72) return { hi: "ज़्यादा से ज़्यादा 72 अक्षर रखें।", en: "Use at most 72 characters." };
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return { hi: "अक्षर और अंक दोनों रखें।", en: "Use both letters and numbers." };
  if (/^(admin|teacher|accounts|student|password)@?123$/i.test(pw)) return { hi: "यह पासवर्ड बहुत आसान है।", en: "That password is too easy to guess." };
  return null;
}

/** 9000000201 → "90000 00201" */
export const phone = (m: string) => (/^\d{10}$/.test(m) ? `${m.slice(0, 5)} ${m.slice(5)}` : m);
export const day = (iso: string) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const todayLocal = () => new Date().toISOString().slice(0, 10);
export function yearsSince(iso: string, lang: "hi" | "en") {
  if (!iso) return "";
  const y = (Date.now() - new Date(iso + "T00:00:00").getTime()) / (365.25 * 86400000);
  if (y < 1) return lang === "hi" ? "एक साल से कम" : "less than a year";
  const n = Math.floor(y);
  return lang === "hi" ? `${n} साल` : `${n} year${n === 1 ? "" : "s"}`;
}

/* ── Staff attendance and leave (ERP staffAttendanceService) ── */

export type StaffAttStatus = "Present" | "Absent" | "On Leave" | "Half Day";
export type Mark = "P" | "A" | "L" | "H";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Other"];

export interface DayStaff {
  id: string;
  empCode: string;
  name: string;
  designation: string;
  staffType: "teaching" | "non_teaching";
  status: StaffAttStatus | null;
  inTime: string;
  outTime: string;
  remark: string;
  leave: { id: string; type: string; from: string; to: string; status: LeaveStatus } | null;
}
export interface StaffDay {
  date: string;
  today: string;
  sunday: boolean;
  holiday: string | null;
  marked: number;
  markedAt: string | null;
  markedBy: string | null;
  staff: DayStaff[];
}
export interface RegisterDay {
  date: string;
  weekday: string;
  sunday: boolean;
  holiday: string | null;
  marked: boolean;
  present: number;
  absent: number;
  leave: number;
  half: number;
}
export interface RegisterStaff {
  id: string;
  empCode: string;
  name: string;
  designation: string;
  marks: Record<string, Mark>;
  present: number;
  absent: number;
  leave: number;
  half: number;
  days: number;
}
export interface StaffRegister {
  month: string;
  days: RegisterDay[];
  staff: RegisterStaff[];
  totals: { workingDays: number; schoolDays: number };
}
export interface StaffLeave {
  id: string;
  staffId: string;
  name: string;
  empCode: string;
  designation: string;
  leaveType: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  processedBy: string;
  processedAt: string | null;
  remarks: string;
  createdAt: string;
}
export interface LeaveList {
  today: string;
  data: StaffLeave[];
  staff: { id: string; empCode: string; name: string; designation: string }[];
}
/** Each GET may instead say the SQL has not been run. */
export type MaybeSetup<T> = T & { setupNeeded?: boolean };

export const LEAVE_TEXT: Record<LeaveStatus, Bi> = { Pending: { hi: "बाकी", en: "Pending" }, Approved: { hi: "मंज़ूर", en: "Approved" }, Rejected: { hi: "नामंज़ूर", en: "Rejected" } };
export const LEAVE_TONE: Record<LeaveStatus, Tone> = { Pending: "wait", Approved: "ok", Rejected: "bad" };

export const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const at = (d: string) => new Date(d + "T00:00:00");
export const shortDate = (d: string) => at(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const longDate = (d: string) => at(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const monthLabel = (m: string) => at(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
export const clockAt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
export function shiftDate(d: string, n: number) {
  const x = at(d);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
}
/** Leave days: calendar days from–to, not counting Sundays (same rule as the backend). */
export function leaveDays(from: string, to: string) {
  if (!from || !to || to < from) return 0;
  let n = 0;
  for (let d = from, i = 0; d <= to && i < 400; d = shiftDate(d, 1), i++) if (at(d).getDay() !== 0) n++;
  return n;
}
export const firstName = (by: string | null) => (by || "").split(" (")[0];
export const leaveRange = (from: string, to: string) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);
