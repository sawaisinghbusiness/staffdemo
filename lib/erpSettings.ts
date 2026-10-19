/**
 * Copied from ERP lib/services/schoolProfileService.ts, lib/services/userService.ts, lib/services/whatsappService.ts,
 * components/settings/classes/shared.tsx and app/settings/* helpers — keep in step with the ERP.
 * Settings in ERP login: GET/PUT /api/school, /api/school/session, /api/school/holidays, /api/classes…,
 * /api/users…, /api/auth/password, /api/whatsapp/…  (writes are admin-only on the backend).
 */
import type { Bi } from "./i18n";
import type { Tone } from "@/components/ui";

/* ───────────── School & session ───────────── */

export interface SchoolProfile {
  school_name: string;
  short_name: string;
  board: string;
  affiliation_no: string;
  school_code: string;
  udise_code: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  contact1: string;
  contact2: string;
  email: string;
  website: string;
  logo_url: string;
  principal_name: string;
  updated_at?: string | null;
}

export const DEFAULT_SCHOOL_PROFILE: SchoolProfile = {
  school_name: "St. Paul School",
  short_name: "SPS",
  board: "CBSE",
  affiliation_no: "1730512",
  school_code: "10492",
  udise_code: "",
  address: "",
  city: "Barmer",
  district: "Barmer",
  state: "Rajasthan",
  pincode: "344001",
  contact1: "",
  contact2: "",
  email: "",
  website: "",
  logo_url: "",
  principal_name: "",
};

/** Only the profile's own fields (GET /api/school also sends saved / setupNeeded). */
export const pickProfile = (p: Partial<SchoolProfile> | undefined): SchoolProfile => {
  const out = { ...DEFAULT_SCHOOL_PROFILE };
  for (const k of Object.keys(DEFAULT_SCHOOL_PROFILE) as (keyof SchoolProfile)[]) {
    const v = p?.[k];
    if (typeof v === "string") (out as any)[k] = v;
  }
  if (p?.updated_at !== undefined) out.updated_at = p.updated_at;
  return out;
};

export interface Holiday {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  description?: string | null;
}
export interface SessionInfo {
  session: { code: string; label: string; start: string; end: string };
  holidays: Holiday[];
  error?: string;
}
export const FALLBACK_SESSION: SessionInfo["session"] = { code: "2026-2027", label: "2026-27", start: "2026-04-01", end: "2027-03-31" };

export const dayLong = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const dayShort = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
export const todayIso = () => new Date().toLocaleDateString("en-CA");

/** Fixed-date national holidays only (festival dates change every year, so those are typed in). */
export const SUGGESTED_HOLIDAYS = [
  { title: "Gandhi Jayanti", date: "2026-10-02" },
  { title: "Christmas", date: "2026-12-25" },
  { title: "Republic Day", date: "2027-01-26" },
];

export const BOARDS = ["CBSE", "RBSE", "ICSE", "Other"];
export const boardLine = (board: string) => (board === "RBSE" ? "Board of Secondary Education, Rajasthan" : board === "ICSE" ? "CISCE, New Delhi" : "C.B.S.E., New Delhi");

/**
 * The school logo, shrunk in the browser to at most 320px (PNG keeps a clear background) so it stays
 * small and prints sharp enough. Throws a ready-to-show message.
 */
export async function shrinkLogo(file: File, L: (b: Bi) => string): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error(L({ hi: "PNG या JPG फ़ोटो चुनें।", en: "Choose a PNG or JPG image." }));
  if (file.size > 8 * 1024 * 1024) throw new Error(L({ hi: "फ़ोटो बहुत बड़ी है (8 MB से ज़्यादा)।", en: "That picture is too big (over 8 MB)." }));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = url;
    });
    const scale = Math.min(1, 320 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL("image/png");
    if (data.length > 450_000) data = canvas.toDataURL("image/jpeg", 0.85); // photos: JPEG is far smaller
    if (data.length > 490_000) throw new Error(L({ hi: "यह फ़ोटो बहुत भारी है। सादा लोगो इस्तेमाल करें।", en: "That picture is too detailed. Use a simpler logo image." }));
    return data;
  } catch (e) {
    if (e instanceof Error && e.message) throw e;
    throw new Error(L({ hi: "यह फ़ोटो नहीं पढ़ी जा सकी। दूसरी फ़ाइल चुनें।", en: "Could not read that picture. Try another file." }));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ───────────── Classes & subjects ───────────── */

export interface SectionItem {
  id: string;
  name: string;
  subjects: string[];
  /** 11th–12th: Science, Commerce, Arts… */
  stream?: string | null;
}
export interface ClassItem {
  id: string;
  name: string;
  orderSeq?: number;
  wing?: string | null;
  sections: SectionItem[];
}

/** GET /api/classes, cleaned the way the ERP's classService does (stream kept: the backend sends it). */
export const cleanClassList = (list: ClassItem[] | undefined): ClassItem[] =>
  (Array.isArray(list) ? list : []).map((c) => ({
    id: c.id,
    name: c.name,
    orderSeq: c.orderSeq,
    wing: c.wing ?? null,
    sections: (c.sections || []).map((s) => ({ id: s.id, name: s.name, subjects: Array.isArray(s.subjects) ? s.subjects : [], stream: s.stream || null })),
  }));

export const SUBJECTS_SETUP_MESSAGE = "Subjects cannot be saved yet: the database needs a one-time update (sections.subjects column). Classes and sections still work.";
export const isSetupMessage = (msg?: string) => !!msg && /one-time database update|sections\.subjects/i.test(msg);

export const WINGS = ["Pre-primary", "Primary", "Middle", "Secondary", "Senior Secondary"];
export const WING_HI: Record<string, string> = { "Pre-primary": "प्री-प्राइमरी", Primary: "प्राइमरी", Middle: "मिडिल", Secondary: "सेकेंडरी", "Senior Secondary": "सीनियर सेकेंडरी", Other: "अन्य" };
export const STANDARD_CLASSES = ["Pre Nursery", "Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

/** Best guess of the wing from the class name ("7th" -> Middle). */
export function guessWing(name: string): string {
  const n = name.trim().toLowerCase();
  if (/(pre|nursery|lkg|ukg|kg)/.test(n)) return "Pre-primary";
  const num = parseInt(n, 10);
  if (num >= 1 && num <= 5) return "Primary";
  if (num >= 6 && num <= 8) return "Middle";
  if (num >= 9 && num <= 10) return "Secondary";
  if (num >= 11 && num <= 12) return "Senior Secondary";
  return "";
}

/** "a" -> "A"; longer names like "Science-Maths" keep their case (students store them that way). */
export const cleanSection = (s: string) => (s.trim().length <= 2 ? s.trim().toUpperCase() : s.trim().replace(/\s+/g, " "));

export const DEFAULT_STREAMS = ["Science", "Commerce", "Arts"];
export const streamsOf = (classes: { sections: { stream?: string | null }[] }[]) =>
  Array.from(new Set([...DEFAULT_STREAMS, ...classes.flatMap((c) => c.sections.map((s) => s.stream || "").filter(Boolean))]));
/** 11th and 12th take a stream. */
export const takesStream = (cls: { name: string; sections: { stream?: string | null }[] }) => /^1[12]/.test(cls.name.trim()) || cls.sections.some((s) => !!s.stream);

/** Chips helper: adds "A, B, C" to a list (no duplicates, up to max). */
export function addChips(values: string[], raw: string, clean: (s: string) => string, max = 50, maxLength = 60): string[] {
  const next = values.slice();
  for (const part of raw.split(",")) {
    const v = clean(part).slice(0, maxLength);
    if (v && next.length < max && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
  }
  return next;
}

/* ───────────── Users & roles ───────────── */

export type UserRole = "admin" | "accountant" | "teacher" | "exam_cell" | "parent" | "student";

export interface AppUser {
  id: string;
  full_name: string;
  role: UserRole;
  phone_number: string | null;
  employee_code: string | null;
  admission_no: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
}

/** What each role can open — matches the checks in the backend routes. `dot` is the role's colour dot. */
export const ROLE_INFO: Record<UserRole, { label: Bi; can: Bi; staff: boolean; dot: string }> = {
  admin: { label: { hi: "एडमिन", en: "Admin" }, dot: "bg-brand-600", staff: true, can: { hi: "सब कुछ: बच्चे, फ़ीस, फ़ीस सेटअप, सेटिंग और ये यूज़र अकाउंट।", en: "Everything: students, fees, fee setup, settings and these user accounts." } },
  accountant: { label: { hi: "अकाउंट्स", en: "Accounts" }, dot: "bg-emerald-600", staff: true, can: { hi: "फ़ीस जमा करता है और रसीद छापता है, पूछताछ देखता है। बच्चे और रिपोर्ट देखता है।", en: "Collects fees and prints receipts, handles enquiries. Sees students and reports." } },
  teacher: { label: { hi: "टीचर", en: "Teacher" }, dot: "bg-sky-600", staff: true, can: { hi: "हाज़िरी लगाता है और गेट पास देता है। बच्चे और रिपोर्ट देखता है।", en: "Marks attendance and issues gate passes. Sees students and reports." } },
  exam_cell: { label: { hi: "एग्ज़ाम सेल", en: "Exam cell" }, dot: "bg-violet-600", staff: true, can: { hi: "बच्चे और रिपोर्ट देखता है। परीक्षा के साथ अंक भरना खुलेगा।", en: "Sees students and reports. Marks entry will open for them with Exams." } },
  parent: { label: { hi: "अभिभावक", en: "Parent" }, dot: "bg-amber-500", staff: false, can: { hi: "पेरेंट ऐप के लिए। ऑफ़िस की कोई स्क्रीन नहीं खुलती।", en: "For the parent app (coming). Cannot open any office screen." } },
  student: { label: { hi: "विद्यार्थी", en: "Student" }, dot: "bg-ink-400", staff: false, can: { hi: "स्टूडेंट ऐप के लिए। ऑफ़िस की कोई स्क्रीन नहीं खुलती।", en: "For the student app (coming). Cannot open any office screen." } },
};
export const ROLE_ORDER: UserRole[] = ["admin", "accountant", "teacher", "exam_cell", "parent", "student"];
export const STAFF_ROLES: UserRole[] = ["admin", "accountant", "teacher", "exam_cell"];

export const plainName = (n: string) => n.replace(/\s*\(.*?\)\s*$/, "");
export const designation = (n: string) => n.match(/\((.*?)\)\s*$/)?.[1] || "";

export function lastSeen(iso: string | null, L: (b: Bi) => string): string {
  if (!iso) return L({ hi: "कभी नहीं", en: "Never" });
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return `${L({ hi: "आज", en: "Today" })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return L({ hi: "कल", en: "Yesterday" });
  if (days < 30) return L({ hi: `${days} दिन पहले`, en: `${days} days ago` });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** A password that is easy to read out over the phone: Word + 4 digits + word. */
export function suggestPassword(): string {
  const words = ["Thar", "Barmer", "Desert", "Camel", "Marigold", "Sunrise", "Peacock", "Mango", "River", "Lotus", "Banyan", "Kesar"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}${Math.floor(1000 + Math.random() * 9000)}${pick().toLowerCase()}`;
}

/** Same rules as the backend; returns a message when too weak. */
export function passwordProblem(pw: string, L: (b: Bi) => string): string | null {
  if (pw.length < 8) return L({ hi: "कम से कम 8 अक्षर रखें।", en: "Use at least 8 characters." });
  if (pw.length > 72) return L({ hi: "72 से ज़्यादा अक्षर नहीं।", en: "Use at most 72 characters." });
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return L({ hi: "अक्षर और अंक दोनों रखें।", en: "Use both letters and numbers." });
  if (/^(admin|teacher|accounts|student|password)@?123$/i.test(pw)) return L({ hi: "यह पासवर्ड बहुत आसान है।", en: "That password is too easy to guess." });
  return null;
}

export interface IssuedLogin {
  name: string;
  loginId: string;
  password: string;
  isNew: boolean;
}

/* ───────────── WhatsApp ───────────── */

export type WaState = "off" | "connecting" | "qr" | "open";
export interface WaSettings {
  auto_absent: boolean;
  auto_receipt: boolean;
  updated_by_name?: string | null;
  updated_at?: string | null;
}
export interface WaStatus {
  state: WaState;
  qr: string | null;
  me: { number: string; name: string } | null;
  lastError: string | null;
  quietHours: boolean;
  setupNeeded: boolean;
  settings: WaSettings | null;
  counts: { pending: number; sentToday: number; failed: number };
}
export type OutboxStatus = "pending" | "sent" | "failed" | "skipped";
export interface OutboxRow {
  id: string;
  kind: "absent" | "receipt" | "dues" | "notice" | "test";
  student_name: string | null;
  class_sec: string | null;
  phone: string;
  body: string;
  status: OutboxStatus;
  error: string | null;
  attempts: number;
  created_by_name: string | null;
  created_at: string;
  sent_at: string | null;
}

export const KIND_LABEL: Record<OutboxRow["kind"], Bi> = {
  absent: { hi: "गैरहाज़िर", en: "Absent" },
  receipt: { hi: "फ़ीस रसीद", en: "Fee receipt" },
  dues: { hi: "फ़ीस याद", en: "Fee reminder" },
  notice: { hi: "सूचना", en: "Notice" },
  test: { hi: "टेस्ट", en: "Test" },
};
export const OUT_STATUS: Record<OutboxStatus, { tone: Tone; label: Bi }> = {
  pending: { tone: "wait", label: { hi: "इंतज़ार में", en: "Waiting" } },
  sent: { tone: "ok", label: { hi: "भेजा", en: "Sent" } },
  failed: { tone: "bad", label: { hi: "नहीं गया", en: "Failed" } },
  skipped: { tone: "mute", label: { hi: "WhatsApp पर नहीं", en: "Not on WhatsApp" } },
};
export const WA_STATE: Record<WaState, { tone: Tone; label: Bi }> = {
  open: { tone: "ok", label: { hi: "जुड़ा है", en: "Connected" } },
  qr: { tone: "wait", label: { hi: "स्कैन का इंतज़ार", en: "Waiting for scan" } },
  connecting: { tone: "wait", label: { hi: "जुड़ रहा है", en: "Connecting" } },
  off: { tone: "mute", label: { hi: "नहीं जुड़ा", en: "Not connected" } },
};

export const outboxWhen = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return today ? t : `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${t}`;
};
