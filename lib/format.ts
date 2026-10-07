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
