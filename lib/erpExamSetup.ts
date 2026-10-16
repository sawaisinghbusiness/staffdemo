/* Copied from the ERP (lib/services/classService.ts shapes, app/exams/setup helpers, components/settings/classes/shared COMMON_SUBJECTS). Keep in step. */
import type { Exam } from "./erpExams";

export interface SectionItem {
  id: string;
  name: string;
  subjects: string[];
  stream?: string | null;
}

export interface ClassItem {
  id: string;
  name: string;
  orderSeq?: number;
  wing?: string | null;
  sections: SectionItem[];
}

/** GET /api/classes, cleaned the way the ERP's classService does. */
export const cleanClasses = (list: ClassItem[] | undefined): ClassItem[] =>
  (list || []).map((c) => ({ ...c, sections: (c.sections || []).map((s) => ({ id: s.id, name: s.name, subjects: Array.isArray(s.subjects) ? s.subjects : [] })) }));

export const EXAM_NAMES = ["Periodic Test 1", "Half Yearly", "Periodic Test 2", "Annual", "Pre-Board"];

export const COMMON_SUBJECTS = [
  "Hindi",
  "English",
  "Mathematics",
  "Environmental Studies",
  "Science",
  "Social Science",
  "Sanskrit",
  "Computer",
  "General Knowledge",
  "Drawing",
  "Physical Education",
  "Physics",
  "Chemistry",
  "Biology",
  "Accountancy",
  "Business Studies",
  "Economics",
  "History",
  "Geography",
  "Political Science",
  "Hindi Literature",
  "Agriculture",
];

export const cleanSubject = (s: string) => s.trim().replace(/\s+/g, " ");

const day = (iso: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
/** "1 Oct – 4 Oct", or "" when no dates are set. */
export const examDates = (e: Exam) => (!e.start_date ? "" : e.end_date && e.end_date !== e.start_date ? `${day(e.start_date)} – ${day(e.end_date)}` : day(e.start_date));
/** "Out of 100" or "80 theory + 20 internal". */
export const examPattern = (e: Exam) => (e.components.length === 1 ? `${e.max}` : e.components.map((p) => `${p.max} ${p.name.toLowerCase()}`).join(" + "));

/** "Nursery to 12th" when the classes are a run of the class list, else a short list ("" = all classes). */
export function classRange(picked: string[], all: string[]) {
  if (!picked.length) return "—";
  if (picked.length === all.length) return "";
  const idx = picked.map((c) => all.indexOf(c)).sort((a, b) => a - b);
  const run = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (run && picked.length > 2) return `${all[idx[0]]} – ${all[idx[idx.length - 1]]}`;
  return picked.join(", ");
}

/** "12th: Sec A, C Physics, Chemistry" for classes that sit only part of the exam. */
export function scopeNote(e: Exam): string {
  return Object.entries(e.scope || {})
    .filter(([cls, v]) => e.classes.includes(cls) && (v.sections?.length || v.subjects?.length))
    .map(([cls, v]) => [cls + ":", v.sections?.length ? "Sec " + v.sections.join(", ") : "", v.subjects?.length ? v.subjects.join(", ") : ""].filter(Boolean).join(" "))
    .join(" · ");
}
