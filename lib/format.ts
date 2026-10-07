import type { Lang } from "./i18n";

export const rupees = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

const locale = (lang: Lang) => (lang === "hi" ? "hi-IN" : "en-IN");

/** "6 अक्टूबर" / "6 Oct". Dates are plain YYYY-MM-DD in India time. */
export function dayMonth(iso: string, lang: Lang) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(locale(lang), { day: "numeric", month: lang === "hi" ? "long" : "short" });
}

/** "मंगलवार, 6 अक्टूबर" / "Tue, 6 Oct" */
export function weekdayDate(iso: string, lang: Lang) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(locale(lang), { weekday: lang === "hi" ? "long" : "short", day: "numeric", month: lang === "hi" ? "long" : "short" });
}

/** 9588894289 -> "95888 94289" */
export const phoneText = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** "October 2026" / "अक्टूबर 2026" */
export function monthYear(iso: string, lang: Lang) {
  return new Date(iso.slice(0, 7) + "-01T00:00:00").toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
}

/** "6 Oct 2026" / "6 अक्टूबर 2026" */
export function fullDate(iso: string, lang: Lang) {
  return new Date(iso + "T00:00:00").toLocaleDateString(locale(lang), { day: "numeric", month: lang === "hi" ? "long" : "short", year: "numeric" });
}

/** "07:15" -> "7:15" (school times are all daytime, so no AM/PM). "13:05" -> "1:05". */
export function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;
}

/** 82.2 -> "82.2", 80 -> "80" */
export const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
