/* Copied from the ERP (lib/services/attendanceRegisterService.ts: shapes, whatsappLink, lowAttendanceMessage). Keep in step. */

export type Mark = "P" | "A" | "L" | "H";

export interface RegisterSection {
  class: string;
  section: string;
  classSec: string;
  students: number;
}

export interface RegisterDay {
  date: string;
  weekday: string;
  holiday: string | null;
  sunday: boolean;
  marked: boolean;
  present: number;
  absent: number;
  leave: number;
  half: number;
}

export interface RegisterStudent {
  id: string;
  name: string;
  srNo: string;
  rollNo: string;
  marks: Record<string, Mark>;
  present: number;
  absent: number;
  leave: number;
  half: number;
  workingDays: number;
  /** null when the student was not marked on any day of the month. */
  percent: number | null;
}

export interface MonthRegister {
  class: string;
  section: string;
  classSec: string;
  month: string;
  days: RegisterDay[];
  students: RegisterStudent[];
  totals: { workingDays: number; averagePercent: number | null };
}

export interface LowStudent {
  id: string;
  name: string;
  srNo: string;
  rollNo: string;
  class: string;
  section: string;
  classSec: string;
  fatherName: string;
  mobile: string;
  present: number;
  absent: number;
  leave: number;
  half: number;
  workingDays: number;
  percent: number;
}

export interface LowReport {
  month: string;
  below: number;
  students: LowStudent[];
}

/** wa.me link for a 10-digit Indian mobile, or null when the number is not valid. */
export function whatsappLink(mobile: string, text: string): string | null {
  const digits = (mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}

export const lowAttendanceMessage = (s: { name: string; classSec: string; percent: number }) =>
  `प्रिय अभिभावक, ${s.name} (कक्षा ${s.classSec}) की इस माह उपस्थिति केवल ${s.percent}% है। कृपया नियमित रूप से स्कूल भेजें। – St. Paul School, Barmer`;
