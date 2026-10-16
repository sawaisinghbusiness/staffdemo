/* Copied from the ERP (lib/services/attendanceService.ts: shapes + absenceWhatsApp). Keep in step. */

export type AttStatus = "Present" | "Absent" | "Leave" | "HalfDay";

export interface SectionDay {
  class: string;
  section: string;
  classSec: string;
  students: number;
  marked: number;
  present: number;
  absent: number;
  leave: number;
  half: number;
  markedBy: string | null;
  markedAt: string | null;
}

export interface AttendanceDay {
  date: string;
  sunday: boolean;
  holiday: string | null;
  sections: SectionDay[];
  totals: { students: number; marked: number; present: number; absent: number; leave: number; half: number; sectionsMarked: number; sections: number };
}

export interface RosterStudent {
  id: string;
  name: string;
  rollNo: string;
  srNo: string;
  fatherName: string;
  mobile: string;
  gender: string;
  photoUrl: string;
  status: AttStatus | null;
  remark: string;
}

export interface SectionRoster {
  date: string;
  class: string;
  section: string;
  sunday: boolean;
  holiday: string | null;
  saved: boolean;
  markedAt: string | null;
  markedBy: string | null;
  students: RosterStudent[];
}

/** wa.me link with the absence note typed in (sent from the office phone). */
export function absenceWhatsApp(mobile: string, name: string, classSec: string, dateLabel: string, school: string): string | null {
  const d = (mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(d) || /^(\d)\1{9}$/.test(d)) return null; // 9999999999 etc. are placeholders, not parents
  const text = `प्रिय अभिभावक, आज (${dateLabel}) ${name} (कक्षा ${classSec.replace(/\s*-\s*/, "-")}) स्कूल में अनुपस्थित है। कृपया कारण बताएं। – ${school}`;
  return `https://wa.me/91${d}?text=${encodeURIComponent(text)}`;
}
