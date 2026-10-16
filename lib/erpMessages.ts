/* Copied from the ERP (lib/services/messageService.ts: shapes, TEMPLATES, unfilled, whatsappUrl). Keep in step. */

export type Lang = "hi" | "en";
export type AudienceKind = "school" | "classes" | "sections" | "dues";

export interface Audience {
  kind: AudienceKind;
  classes?: string[];
  sections?: string[];
}

export interface Message {
  id: string;
  title: string;
  body: string;
  lang: Lang;
  audience: Audience;
  audience_label: string;
  channel: "whatsapp" | "sms";
  total: number;
  sent: number;
  show_on_website: boolean;
  website_until: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface Recipient {
  id: string;
  student_name: string;
  class_sec: string;
  parent_name: string;
  phone: string;
  text: string;
  status: "pending" | "sent" | "skipped";
  sent_at: string | null;
  sent_by_name: string | null;
}

export interface Preview {
  label: string;
  students: number;
  families: number;
  noPhone: number;
  sample: { phone: string; text: string } | null;
}

/** Ready-made messages. {name} {class} {father} {school} {due} are filled in for each parent. */
export const TEMPLATES: { key: string; label: string; title: Record<Lang, string>; body: Record<Lang, string>; dues?: boolean }[] = [
  {
    key: "holiday",
    label: "Holiday",
    title: { hi: "अवकाश की सूचना", en: "Holiday notice" },
    body: {
      hi: "प्रिय अभिभावक, {date} को {reason} के कारण विद्यालय बंद रहेगा। {name} {next} को सामान्य समय पर विद्यालय आएँ। – {school}",
      en: "Dear Parent, the school will remain closed on {date} for {reason}. {name} should come to school as usual on {next}. – {school}",
    },
  },
  {
    key: "ptm",
    label: "Parent-teacher meeting",
    title: { hi: "अभिभावक-शिक्षक बैठक", en: "Parent-teacher meeting" },
    body: {
      hi: "प्रिय अभिभावक, {name} (कक्षा {class}) की अभिभावक-शिक्षक बैठक {date} को सुबह 10 से 12 बजे तक होगी। कृपया अवश्य पधारें। – {school}",
      en: "Dear Parent, the parent-teacher meeting for {name} (Class {class}) is on {date}, 10 am to 12 noon. Please do come. – {school}",
    },
  },
  {
    key: "exam",
    label: "Exam",
    title: { hi: "परीक्षा की सूचना", en: "Exam notice" },
    body: {
      hi: "प्रिय अभिभावक, {name} (कक्षा {class}) की परीक्षाएँ {date} से शुरू होंगी। समय-सारणी विद्यालय से प्राप्त करें। – {school}",
      en: "Dear Parent, exams for {name} (Class {class}) begin on {date}. Please collect the date sheet from the school. – {school}",
    },
  },
  {
    key: "fees",
    label: "Fee reminder",
    dues: true,
    title: { hi: "फीस बकाया", en: "Fee reminder" },
    body: {
      hi: "प्रिय अभिभावक, {name} (कक्षा {class}) की फीस {due} बकाया है। कृपया जल्द से जल्द विद्यालय कार्यालय में जमा करें। – {school}",
      en: "Dear Parent, fee of {due} for {name} (Class {class}) is due. Please pay at the school office at the earliest. – {school}",
    },
  },
  {
    key: "general",
    label: "Blank",
    title: { hi: "सूचना", en: "Notice" },
    body: { hi: "प्रिय अभिभावक, \n\n– {school}", en: "Dear Parent, \n\n– {school}" },
  },
];

/** Fields the server fills for each parent. Anything else in {braces} must be typed in before sending. */
export const AUTO_FIELDS = ["name", "class", "father", "school", "due"];
export const unfilled = (body: string) => Array.from(new Set((body.match(/\{(\w+)\}/g) || []).map((m) => m.slice(1, -1)).filter((k) => !AUTO_FIELDS.includes(k))));

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
}

