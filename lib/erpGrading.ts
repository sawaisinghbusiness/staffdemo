/* Copied from the ERP (lib/grading.ts) so grades and mark checks match. Keep in step. */
/**
 * Exam parts, totals and CBSE grades.
 *
 * KEEP IN SYNC with `sms backend/src/lib/grading.ts` (same file, copied).
 */

export interface ExamPart {
  key: string;
  name: string;
  max: number;
}

export const PASS_PERCENT = 33;

/** CBSE 8-point scale: lower bound of each grade, in percent. */
export const GRADES: { grade: string; min: number }[] = [
  { grade: "A1", min: 91 },
  { grade: "A2", min: 81 },
  { grade: "B1", min: 71 },
  { grade: "B2", min: 61 },
  { grade: "C1", min: 51 },
  { grade: "C2", min: 41 },
  { grade: "D", min: 33 },
  { grade: "E", min: 0 },
];

export const PART_PRESETS: { key: string; label: string; parts: ExamPart[] }[] = [
  { key: "100", label: "One paper of 100", parts: [{ key: "marks", name: "Marks", max: 100 }] },
  { key: "80+20", label: "80 theory + 20 internal", parts: [{ key: "theory", name: "Theory", max: 80 }, { key: "internal", name: "Internal", max: 20 }] },
  { key: "50", label: "One paper of 50", parts: [{ key: "marks", name: "Marks", max: 50 }] },
  { key: "20", label: "Periodic test of 20", parts: [{ key: "marks", name: "Marks", max: 20 }] },
];

export const maxOf = (parts: ExamPart[]) => parts.reduce((s, p) => s + (p.max || 0), 0);

export function gradeFor(percent: number): string {
  return (GRADES.find((g) => percent >= g.min) || GRADES[GRADES.length - 1]).grade;
}

/** Total of the entered parts; null until every part has a number. */
export function totalOf(parts: ExamPart[], marks: Record<string, number | null | undefined>): number | null {
  let t = 0;
  for (const p of parts) {
    const v = marks[p.key];
    if (typeof v !== "number" || Number.isNaN(v)) return null;
    t += v;
  }
  return Math.round(t * 100) / 100;
}

/** Checks one part's mark: whole or half numbers from 0 to the part's maximum. */
export function markProblem(part: ExamPart, v: number): string | null {
  if (Number.isNaN(v)) return "Enter a number";
  if (v < 0) return "Cannot be below 0";
  if (v > part.max) return `Out of ${part.max}`;
  if (Math.round(v * 2) !== v * 2) return "Use whole or half marks";
  return null;
}

/** Cleans parts typed in setup: 1-4 parts, unique keys, each max 1-200. */
export function partsProblem(parts: ExamPart[]): string | null {
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 4) return "Use one to four parts.";
  const keys = new Set<string>();
  for (const p of parts) {
    if (!p || typeof p.name !== "string" || !p.name.trim()) return "Every part needs a name.";
    if (!/^[a-z0-9_]{1,20}$/.test(p.key || "")) return "Part keys must be short lowercase words.";
    if (keys.has(p.key)) return "Two parts have the same name.";
    keys.add(p.key);
    if (!Number.isInteger(p.max) || p.max < 1 || p.max > 200) return `${p.name}: maximum marks must be 1 to 200.`;
  }
  return null;
}
