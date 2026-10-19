import {
  Briefcase,
  Bus,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Home,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  NotebookPen,
  Settings2,
  Table2,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Bi } from "./i18n";

/**
 * ERP login's side menu: every screen of the ERP website (its navConfig plus the pages outside it),
 * same groups and sub-pages. `soon` until that screen is built in this app, one module at a time.
 */
export interface ErpSub {
  text: Bi;
  href: string;
  soon?: boolean;
}
export interface ErpItem {
  text: Bi;
  icon: LucideIcon;
  href?: string;
  soon?: boolean;
  children?: ErpSub[];
}
export interface ErpGroup {
  title: Bi | null;
  items: ErpItem[];
}

const s = (hi: string, en: string, href: string): ErpSub => ({ text: { hi, en }, href, soon: true });
/** A sub-page that is built here. */
const a = (hi: string, en: string, href: string): ErpSub => ({ text: { hi, en }, href });

export const ERP_MENU: ErpGroup[] = [
  {
    title: null,
    items: [
      { text: { hi: "होम", en: "Home" }, icon: Home, href: "/" },
      { text: { hi: "रिपोर्ट", en: "Report" }, icon: LayoutDashboard, children: [{ text: { hi: "आज का सार", en: "Overview" }, href: "/erp/report/" }, s("सारी रिपोर्ट", "All reports", "/erp/reports/")] },
    ],
  },
  {
    title: { hi: "रोज़ का काम", en: "Daily work" },
    items: [
      {
        text: { hi: "बच्चे", en: "Students" },
        icon: Users,
        children: [
          { text: { hi: "सभी बच्चे", en: "All students" }, href: "/erp/students/" },
          { text: { hi: "प्रवेश पूछताछ", en: "Admission enquiries" }, href: "/erp/students/enquiries/" },
          { text: { hi: "प्रमोट और ट्रांसफ़र", en: "Promote & transfer" }, href: "/erp/students/promote/" },
          { text: { hi: "सर्टिफ़िकेट", en: "Certificates" }, href: "/erp/students/certificates/" },
          { text: { hi: "फ़ोटो", en: "Photos" }, href: "/erp/students/photos/" },
          { text: { hi: "आईडी कार्ड", en: "ID cards" }, href: "/erp/students/id-cards/" },
        ],
      },
      {
        text: { hi: "फ़ीस", en: "Fees" },
        icon: IndianRupee,
        children: [
          { text: { hi: "फ़ीस जमा करें", en: "Collect fee" }, href: "/erp/fees/collect/" },
          { text: { hi: "बाकी फ़ीस और याद", en: "Dues & reminders" }, href: "/erp/fees/dues/" },
          { text: { hi: "ऑनलाइन पेमेंट", en: "Online payments" }, href: "/erp/fees/online/" },
          { text: { hi: "रसीदें", en: "Receipts" }, href: "/erp/fees/receipts/" },
          { text: { hi: "फ़ीस रिपोर्ट", en: "Reports" }, href: "/erp/fees/reports/" },
          { text: { hi: "फ़ीस सेटअप", en: "Fee setup" }, href: "/erp/fees/setup/" },
        ],
      },
      {
        text: { hi: "हाज़िरी", en: "Attendance" },
        icon: CalendarCheck,
        children: [
          a("आज की हाज़िरी", "Today", "/erp/attendance/today/"),
          { text: { hi: "हाज़िरी लगाएँ", en: "Mark attendance" }, href: "/erp/attendance/mark/" },
          { text: { hi: "रजिस्टर और रिपोर्ट", en: "Register & reports" }, href: "/erp/attendance/register/" },
          { text: { hi: "छुट्टी की अर्ज़ियाँ", en: "Leave requests" }, href: "/erp/attendance/leave/" },
        ],
      },
      { text: { hi: "मैसेज", en: "Messages" }, icon: MessageSquareText, children: [{ text: { hi: "सारे मैसेज", en: "All messages" }, href: "/erp/messages/" }, { text: { hi: "नया मैसेज", en: "New message" }, href: "/erp/messages/new/" }] },
      { text: { hi: "मीटिंग और PTM", en: "Meetings & PTM" }, icon: CalendarClock, href: "/erp/meetings/" },
      { text: { hi: "अभिभावक-टीचर चैट", en: "Parent–teacher chats" }, icon: MessagesSquare, href: "/erp/parent-chats/" },
      { text: { hi: "कैलेंडर", en: "Calendar" }, icon: CalendarDays, href: "/erp/calendar/" },
      { text: { hi: "जन्मदिन", en: "Birthdays" }, icon: Cake, href: "/erp/birthdays/" },
    ],
  },
  {
    title: { hi: "पढ़ाई", en: "Academics" },
    items: [
      { text: { hi: "परीक्षा", en: "Exams" }, icon: Trophy, children: [{ text: { hi: "अंक भरें", en: "Marks entry" }, href: "/erp/exams/marks/" }, { text: { hi: "रिपोर्ट कार्ड", en: "Report cards" }, href: "/erp/exams/report-cards/" }, { text: { hi: "परीक्षा सेटअप", en: "Exam setup" }, href: "/erp/exams/setup/" }] },
      { text: { hi: "टाइम टेबल", en: "Time Table" }, icon: Table2, href: "/erp/timetable/" },
      { text: { hi: "होमवर्क", en: "Homework" }, icon: NotebookPen, href: "/erp/homework/" },
      { text: { hi: "सिलेबस", en: "Syllabus" }, icon: ListChecks, href: "/erp/syllabus/" },
      { text: { hi: "कॉपी जाँच", en: "Copy check" }, icon: ClipboardCheck, href: "/erp/copy-check/" },
    ],
  },
  {
    title: { hi: "स्कूल", en: "School" },
    items: [
      {
        text: { hi: "स्टाफ़", en: "Staff" },
        icon: Briefcase,
        children: [
          a("स्टाफ़ लिस्ट", "Directory", "/erp/staff/"),
          a("नया स्टाफ़", "Add staff", "/erp/staff/new/"),
          a("विषय बँटवारा", "Allocation", "/erp/staff/allocation/"),
          a("स्टाफ़ हाज़िरी", "Staff attendance", "/erp/staff/attendance/"),
          a("स्टाफ़ छुट्टी", "Staff leave", "/erp/staff/attendance/?tab=leave"),
          a("सैलरी", "Payroll", "/erp/staff/payroll/"),
        ],
      },
      { text: { hi: "ट्रांसपोर्ट", en: "Transport" }, icon: Bus, children: [a("रूट और बस", "Routes & buses", "/erp/transport/"), a("बस के बच्चे", "Bus students", "/erp/transport/students/")] },
    ],
  },
];

/** At the very foot of the menu (user, 2026-10-16). */
export const ERP_SETTINGS: ErpItem = {
  text: { hi: "सेटिंग", en: "Settings" },
  icon: Settings2,
  children: [
    a("स्कूल और सत्र", "School & sessions", "/erp/settings/"),
    a("कक्षा और विषय", "Classes & subjects", "/erp/settings/classes/"),
    a("यूज़र और रोल", "Users & roles", "/erp/settings/users/"),
    a("WhatsApp", "WhatsApp", "/erp/settings/whatsapp/"),
    a("मैसेज टेम्पलेट", "Message templates", "/erp/settings/templates/"),
    s("डेटा", "Data", "/erp/settings/data/"),
  ],
};
