import type { Bi } from "./i18n";
import type { Tone } from "@/components/ui";

/** Admission enquiry as the ERP backend's /api/enquiries returns it (ERP lib/services/enquiryService). */
export type EnquiryStatus = "new" | "visited" | "admitted" | "dropped";
export interface Enquiry {
  id: string;
  enquiry_no: number;
  student_name: string;
  class_wanted: string;
  gender: string | null;
  dob: string | null;
  father_name: string | null;
  mother_name: string | null;
  mobile: string;
  alt_mobile: string | null;
  area: string | null;
  previous_school: string | null;
  source: string | null;
  status: EnquiryStatus;
  next_follow_up: string | null;
  notes: { at: string; by: string; text: string }[];
  admitted_student_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_TEXT: Record<EnquiryStatus, Bi> = {
  new: { hi: "नई", en: "New" },
  visited: { hi: "स्कूल आए", en: "Visited school" },
  admitted: { hi: "प्रवेश हुआ", en: "Admitted" },
  dropped: { hi: "रुचि नहीं", en: "Not interested" },
};
export const STATUS_TONE: Record<EnquiryStatus, Tone> = { new: "wait", visited: "wait", admitted: "ok", dropped: "mute" };

/** The ERP's lists, word for word. */
export const SOURCES = ["Walk-in", "Phone call", "Parent reference", "Staff reference", "Hoarding / banner", "Newspaper", "Facebook / Instagram", "WhatsApp"];
export const ENQUIRY_CLASSES = ["Pre Nursery", "Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const FOLLOW_UP_CHIPS: { text: Bi; days: number }[] = [
  { text: { hi: "कल", en: "Tomorrow" }, days: 1 },
  { text: { hi: "3 दिन बाद", en: "In 3 days" }, days: 3 },
  { text: { hi: "अगले हफ़्ते", en: "Next week" }, days: 7 },
];

export const enquiryNo = (n: number) => `ENQ-${String(n).padStart(4, "0")}`;
export const isOpenEnquiry = (e: Enquiry) => e.status === "new" || e.status === "visited";

/** yyyy-mm-dd for today + n days, in local time. */
export function dayIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today", "Overdue · 3 days", "Tomorrow", "12 Oct", with how loud to say it (ERP enquiries page). */
export function followUp(e: Enquiry, lang: "hi" | "en"): { text: string; tone: "late" | "today" | "plain" | "none" } {
  if (!isOpenEnquiry(e) || !e.next_follow_up) return { text: "", tone: "none" };
  const today = dayIso(0);
  if (e.next_follow_up < today) {
    const days = Math.round((new Date(today).getTime() - new Date(e.next_follow_up).getTime()) / 86400000);
    return { text: lang === "hi" ? `${days} दिन देर` : `Overdue · ${days} day${days === 1 ? "" : "s"}`, tone: "late" };
  }
  if (e.next_follow_up === today) return { text: lang === "hi" ? "आज कॉल करें" : "Call today", tone: "today" };
  if (e.next_follow_up === dayIso(1)) return { text: lang === "hi" ? "कल" : "Tomorrow", tone: "plain" };
  return { text: new Date(e.next_follow_up + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }), tone: "plain" };
}
