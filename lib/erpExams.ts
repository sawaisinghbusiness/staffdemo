/* Copied from the ERP (lib/services/examService.ts: shapes). Keep in step. */
import type { ExamPart } from "./erpGrading";

export type ExamScope = Record<string, { sections?: string[]; subjects?: string[]; units?: Record<string, string> }>;

export interface Exam {
  id: string;
  title: string;
  classes: string[];
  start_date: string | null;
  end_date: string | null;
  components: ExamPart[];
  max: number;
  order_seq: number;
  locked: boolean;
  session: string;
  scope: ExamScope;
}

export interface ExamInput {
  title: string;
  classes: string[];
  start_date: string | null;
  end_date: string | null;
  components: ExamPart[];
  order_seq: number;
  scope: ExamScope;
}

export interface SectionProgress {
  cls: string;
  section: string;
  sectionId: string;
  classSec: string;
  students: number;
  subjects: { name: string; entered: number }[];
}

export interface SheetRow {
  studentId: string;
  rollNo: string;
  name: string;
  srNo: string;
  marks: Record<string, number>;
  absent: boolean;
  saved: boolean;
}

export interface Sheet {
  exam: Exam;
  classSec: string;
  subject: string;
  lastSaved: { at: string; by: string | null } | null;
  rows: SheetRow[];
}

export interface ReportSubject {
  subject: string;
  marks: Record<string, number>;
  absent: boolean;
  total: number | null;
  grade: string | null;
  passed: boolean;
  entered: boolean;
}

export interface ReportCard {
  studentId: string;
  name: string;
  rollNo: string;
  srNo: string;
  fatherName: string;
  motherName: string;
  dob: string;
  subjects: ReportSubject[];
  grand: number;
  outOf: number;
  percent: number;
  grade: string | null;
  result: string;
  complete: boolean;
  attendance: { present: number; days: number } | null;
  rank: number | null;
}

export interface Report {
  exam: Exam;
  classSec: string;
  subjects: string[];
  cards: ReportCard[];
}

const enc = encodeURIComponent;

