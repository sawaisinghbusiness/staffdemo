import type { Lang } from "./i18n";

/** Parent messages: the teacher's side of Ask Teacher. */
export interface InboxRow {
  id: string;
  student: string;
  classSec: string;
  last: { from: "parent" | "teacher"; text: string; at: string } | null;
  unread: number;
  /** The family's first unanswered message, or null when the teacher wrote last. */
  waitingSince: string | null;
}
export interface Inbox {
  classes: string[];
  waiting: InboxRow[];
  replied: InboxRow[];
}

export interface ChatMessage {
  id: string;
  from: "parent" | "teacher";
  text: string;
  at: string;
  meeting: { date: string; time: string; minutes: number; place: "school" | "call" | "online"; placeText: string; status: "waiting" | "yes" | "other"; meetingId: string | null } | null;
}
export interface Thread {
  id: string;
  student: { name: string; classSec: string; rollNo: string; photoUrl: string | null; attendance: number | null };
  today: string;
  messages: ChatMessage[];
}
export interface SchoolDay {
  date: string;
  sunday: boolean;
  periods: { label: string; start: string; end: string; state: "free" | "class" | "break" }[];
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Earthy avatar colours from the Ajrakh palette, picked by name so a child keeps theirs. */
const SHADES = ["#6E1E2B", "#A0522D", "#2B1A12", "#B8860B", "#7A3B12"];
export const shade = (name: string) => SHADES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % SHADES.length];

const loc = (lang: Lang) => (lang === "hi" ? "hi-IN" : "en-IN");

/** "9:12 AM" today, "Mon" this week, else "12 Oct". */
export function when(iso: string, lang: Lang) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(loc(lang), { hour: "numeric", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString(loc(lang), { weekday: "short" });
  return d.toLocaleDateString(loc(lang), { day: "numeric", month: "short" });
}

/** How long the family has waited: "25 min ago", "14 hours ago", "3 days ago". */
export function waited(iso: string, lang: Lang) {
  const min = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return lang === "hi" ? `${min} मिनट पहले` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return lang === "hi" ? `${h} घंटे पहले` : `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return lang === "hi" ? `${d} दिन पहले` : `${d} days ago`;
}

export const clockOf = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(loc(lang), { hour: "numeric", minute: "2-digit" });

export function dayLine(iso: string, lang: Lang) {
  const d = new Date(iso);
  const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === new Date().toDateString()) return lang === "hi" ? "आज" : "Today";
  if (d.toDateString() === y.toDateString()) return lang === "hi" ? "कल" : "Yesterday";
  return d.toLocaleDateString(loc(lang), { weekday: "short", day: "numeric", month: "short" });
}

/** "13:30" -> "1:30 PM" */
export function ampm(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
