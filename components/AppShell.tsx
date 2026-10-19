"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarCheck, ChevronLeft, History, Home, LayoutDashboard, Menu as MenuIcon, Plus, UserRound, Users, type LucideIcon } from "lucide-react";
import { useStaff } from "@/lib/staff";
import { useL, type Bi } from "@/lib/i18n";
import { MenuContext } from "@/lib/menu";
import { isErpMode } from "@/lib/erpMode";
import { ErrorCard, OfflineNote } from "./ui";
import { SideMenu } from "./SideMenu";

const TEACHER_TABS: { href: string; text: Bi; icon: LucideIcon }[] = [
  { href: "/", text: { hi: "होम", en: "Home" }, icon: Home },
  { href: "/students/", text: { hi: "बच्चे", en: "Students" }, icon: Users },
  { href: "/attendance/", text: { hi: "हाज़िरी", en: "Attendance" }, icon: CalendarCheck },
  { href: "/profile/", text: { hi: "प्रोफ़ाइल", en: "Profile" }, icon: UserRound },
];
const OTHER_TABS = [TEACHER_TABS[0], TEACHER_TABS[3]];

interface PageInfo {
  title: Bi;
  back?: string;
  tab?: string;
  action?: { href: string; text: Bi };
  /** Only teachers have this screen; anyone else who opens it by link goes back to Home. */
  teacher?: boolean;
  /** The screen draws its own header (a chat). */
  own?: boolean;
  /** No tab bar (a chat, whose reply box sits at the bottom). */
  bare?: boolean;
}

const PAGES: Record<string, PageInfo> = {
  "/students/": { title: { hi: "बच्चे", en: "Students" }, teacher: true },
  "/students/detail/": { title: { hi: "बच्चा", en: "Student" }, back: "/students/", tab: "/students/", teacher: true },
  "/attendance/": { title: { hi: "हाज़िरी", en: "Attendance" }, teacher: true },
  "/profile/": { title: { hi: "प्रोफ़ाइल", en: "Profile" } },
  "/my-attendance/": { title: { hi: "मेरी हाज़िरी", en: "My Attendance" }, back: "/profile/", tab: "/profile/" },
  "/salary/": { title: { hi: "सैलरी स्लिप", en: "Salary Slips" }, back: "/profile/", tab: "/profile/" },
  // Screens opened from Home or the side menu show the menu button, not Back (as Parent Enquiries does).
  "/homework/": { title: { hi: "होमवर्क", en: "Homework" }, tab: "/", teacher: true },
  "/marks/": { title: { hi: "अंक", en: "Marks" }, tab: "/", teacher: true },
  "/timetable/": { title: { hi: "टाइम टेबल", en: "Time Table" }, tab: "/", teacher: true },
  "/lectures/": { title: { hi: "आज की कक्षाएँ", en: "Today's Lectures" }, tab: "/", teacher: true },
  "/notes/": { title: { hi: "टीचर का नोट", en: "Teacher's Note" }, tab: "/", teacher: true },
  "/leave/": { title: { hi: "छुट्टी", en: "Leave" }, tab: "/", action: { href: "/leave/apply/", text: { hi: "छुट्टी की अर्ज़ी", en: "Apply leave" } } },
  "/leave/apply/": { title: { hi: "छुट्टी की अर्ज़ी", en: "Apply Leave" }, back: "/leave/" },
  "/notice/": { title: { hi: "सूचनाएँ", en: "Notice" }, tab: "/" },
  "/trip/": { title: { hi: "ट्रिप", en: "Trip" }, back: "/" },
  "/trip/history/": { title: { hi: "ट्रिप रिकॉर्ड", en: "Trip record" }, back: "/" },
  "/messages/": { title: { hi: "अभिभावकों की पूछताछ", en: "Parent Enquiries" }, tab: "/", teacher: true },
  "/messages/chat/": { title: { hi: "संदेश", en: "Message" }, back: "/messages/", teacher: true, own: true, bare: true },
  // ERP login's own screens (the ERP website's modules, one by one).
  "/erp/students/": { title: { hi: "सभी बच्चे", en: "All Students" }, tab: "/erp/students/", action: { href: "/erp/students/admission/", text: { hi: "नया प्रवेश", en: "New admission" } } },
  "/erp/students/enquiries/": { title: { hi: "प्रवेश पूछताछ", en: "Admission Enquiries" }, tab: "/erp/students/", action: { href: "/erp/students/enquiries/new/", text: { hi: "नई पूछताछ", en: "New enquiry" } } },
  "/erp/students/enquiries/detail/": { title: { hi: "पूछताछ", en: "Enquiry" }, back: "/erp/students/enquiries/", tab: "/erp/students/" },
  "/erp/students/enquiries/new/": { title: { hi: "नई पूछताछ", en: "New Enquiry" }, back: "/erp/students/enquiries/", tab: "/erp/students/" },
  "/erp/students/promote/": { title: { hi: "प्रमोट और ट्रांसफ़र", en: "Promote & Transfer" }, tab: "/erp/students/" },
  "/erp/students/certificates/": { title: { hi: "सर्टिफ़िकेट", en: "Certificates" }, tab: "/erp/students/", action: { href: "/erp/students/certificates/issue/", text: { hi: "सर्टिफ़िकेट दें", en: "Issue certificate" } } },
  "/erp/students/certificates/issue/": { title: { hi: "सर्टिफ़िकेट दें", en: "Issue Certificate" }, back: "/erp/students/certificates/", tab: "/erp/students/" },
  "/erp/students/photos/": { title: { hi: "बच्चों की फ़ोटो", en: "Photos" }, tab: "/erp/students/" },
  "/erp/students/id-cards/": { title: { hi: "आईडी कार्ड", en: "ID Cards" }, tab: "/erp/students/" },
  "/erp/fees/dues/": { title: { hi: "बाकी फ़ीस और याद", en: "Dues & Reminders" }, tab: "/" },
  "/erp/fees/receipts/": { title: { hi: "रसीदें", en: "Receipts" }, tab: "/" },
  "/erp/fees/reports/": { title: { hi: "फ़ीस रिपोर्ट", en: "Fee Reports" }, tab: "/" },
  "/erp/fees/online/": { title: { hi: "ऑनलाइन पेमेंट", en: "Online Payments" }, tab: "/" },
  "/erp/attendance/mark/": { title: { hi: "हाज़िरी लगाएँ", en: "Mark Attendance" }, tab: "/erp/attendance/mark/" },
  "/erp/attendance/mark/section/": { title: { hi: "हाज़िरी", en: "Roll Call" }, back: "/erp/attendance/mark/", tab: "/erp/attendance/mark/" },
  "/erp/exams/marks/": { title: { hi: "अंक भरें", en: "Marks Entry" }, tab: "/" },
  "/erp/exams/marks/sheet/": { title: { hi: "अंक", en: "Marks" }, back: "/erp/exams/marks/", tab: "/" },
  "/erp/exams/report-cards/": { title: { hi: "रिपोर्ट कार्ड", en: "Report Cards" }, tab: "/" },
  "/erp/exams/setup/": { title: { hi: "परीक्षा सेटअप", en: "Exam Setup" }, tab: "/" },
  "/erp/exams/setup/edit/": { title: { hi: "परीक्षा", en: "Exam" }, back: "/erp/exams/setup/", tab: "/" },
  "/erp/timetable/": { title: { hi: "टाइम टेबल", en: "Time Table" }, tab: "/" },
  "/erp/homework/": { title: { hi: "होमवर्क", en: "Homework" }, tab: "/" },
  "/erp/parent-chats/": { title: { hi: "अभिभावक-टीचर चैट", en: "Parent–Teacher Chats" }, tab: "/" },
  "/erp/parent-chats/chat/": { title: { hi: "चैट", en: "Chat" }, back: "/erp/parent-chats/", tab: "/" },
  "/erp/meetings/": { title: { hi: "मीटिंग और PTM", en: "Meetings & PTM" }, tab: "/", action: { href: "/erp/meetings/new/", text: { hi: "नई मीटिंग", en: "New meeting" } } },
  "/erp/meetings/new/": { title: { hi: "नई मीटिंग", en: "New Meeting" }, back: "/erp/meetings/", tab: "/" },
  "/erp/messages/": { title: { hi: "मैसेज", en: "Messages" }, tab: "/", action: { href: "/erp/messages/new/", text: { hi: "नया मैसेज", en: "New message" } } },
  "/erp/messages/new/": { title: { hi: "नया मैसेज", en: "New Message" }, back: "/erp/messages/", tab: "/" },
  "/erp/messages/detail/": { title: { hi: "मैसेज भेजें", en: "Send Message" }, back: "/erp/messages/", tab: "/" },
  "/erp/settings/templates/": { title: { hi: "मैसेज टेम्पलेट", en: "Message Templates" }, tab: "/" },
  "/erp/copy-check/": { title: { hi: "कॉपी जाँच", en: "Copy Check" }, tab: "/" },
  "/erp/copy-check/sheet/": { title: { hi: "कॉपी जाँच", en: "Copy Check" }, back: "/erp/copy-check/", tab: "/" },
  "/erp/syllabus/": { title: { hi: "सिलेबस", en: "Syllabus" }, tab: "/" },
  "/erp/syllabus/plan/": { title: { hi: "अध्याय प्लान", en: "Chapter Plan" }, back: "/erp/syllabus/", tab: "/" },
  "/erp/staff/allocation/": { title: { hi: "विषय बँटवारा", en: "Subject Allocation" }, tab: "/" },
  "/erp/calendar/": { title: { hi: "कैलेंडर", en: "Calendar" }, tab: "/" },
  "/erp/birthdays/": { title: { hi: "जन्मदिन", en: "Birthdays" }, tab: "/" },
  "/erp/attendance/today/": { title: { hi: "आज की हाज़िरी", en: "Today's Attendance" }, tab: "/erp/attendance/mark/" },
  "/erp/attendance/leave/": { title: { hi: "छुट्टी की अर्ज़ियाँ", en: "Leave Requests" }, tab: "/erp/attendance/mark/" },
  "/erp/attendance/register/": { title: { hi: "हाज़िरी रजिस्टर", en: "Attendance Register" }, tab: "/erp/attendance/mark/" },
  "/erp/fees/setup/": { title: { hi: "फ़ीस सेटअप", en: "Fee Setup" }, tab: "/" },
  "/erp/fees/collect/": { title: { hi: "फ़ीस जमा करें", en: "Collect Fee" }, tab: "/" },
  "/erp/students/admission/": { title: { hi: "प्रवेश फ़ॉर्म", en: "Admission form" }, back: "/erp/students/", tab: "/erp/students/" },
  "/erp/staff/": { title: { hi: "स्टाफ़ लिस्ट", en: "Staff Directory" }, tab: "/" },
  "/erp/staff/detail/": { title: { hi: "स्टाफ़", en: "Staff" }, back: "/erp/staff/", tab: "/" },
  "/erp/staff/new/": { title: { hi: "नया स्टाफ़", en: "Add Staff" }, back: "/erp/staff/", tab: "/" },
  "/erp/staff/class-teachers/": { title: { hi: "क्लास टीचर", en: "Class Teachers" }, back: "/erp/staff/", tab: "/" },
  "/erp/staff/attendance/": { title: { hi: "स्टाफ़ हाज़िरी और छुट्टी", en: "Staff Attendance & Leave" }, tab: "/" },
  "/erp/transport/": { title: { hi: "रूट और बस", en: "Routes & Buses" }, tab: "/" },
  "/erp/transport/route/": { title: { hi: "बस रूट", en: "Bus Route" }, back: "/erp/transport/", tab: "/" },
  "/erp/transport/students/": { title: { hi: "बस के बच्चे", en: "Bus Students" }, tab: "/" },
  "/erp/settings/": { title: { hi: "स्कूल और सत्र", en: "School & Session" }, tab: "/" },
  "/erp/settings/classes/": { title: { hi: "कक्षा और विषय", en: "Classes & Subjects" }, tab: "/" },
  "/erp/settings/users/": { title: { hi: "यूज़र और रोल", en: "Users & Roles" }, tab: "/" },
  "/erp/settings/whatsapp/": { title: { hi: "WhatsApp", en: "WhatsApp" }, tab: "/" },
  "/erp/report/": { title: { hi: "आज का सार", en: "Overview" }, tab: "/" },
  "/erp/staff/payroll/": { title: { hi: "सैलरी", en: "Payroll" }, tab: "/" },
  "/erp/students/detail/": { title: { hi: "बच्चा", en: "Student" }, back: "/erp/students/", tab: "/erp/students/" },
};

/** ERP login: the Students tab opens the ERP's all-students list. */
const ERP_TABS = TEACHER_TABS.map((t) => (t.href === "/students/" ? { ...t, href: "/erp/students/" } : t.href === "/attendance/" ? { ...t, href: "/erp/attendance/mark/" } : t));

/** The middle button: the ERP's Report overview; teachers get Marks. */
const ERP_REPORT = { href: "/erp/report/", text: { hi: "रिपोर्ट", en: "Report" } as Bi };
const TEACHER_REPORT = { href: "/marks/", text: { hi: "रिपोर्ट", en: "Report" } as Bi };

/** Drivers get their own bar: a black pill with Record, Home (raised, yellow) and Profile. */
function DriverNav({ path }: { path: string }) {
  const L = useL();
  const item = (href: string, text: Bi, Icon: LucideIcon, mid?: boolean) => {
    const on = path === href || (href !== "/" && path.startsWith(href));
    return (
      <Link
        href={href}
        aria-label={L(text)}
        aria-current={on ? "page" : undefined}
        className={clsx(
          "grid place-items-center rounded-full",
          mid ? "-mt-[22px] h-[52px] w-[52px] bg-drv-yellow text-black shadow-[0_0_0_5px_#0A0A0A]" : clsx("h-11 w-11", on ? "text-drv-yellow" : "text-[#9A9A9A]")
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={on || mid ? 2.2 : 1.9} aria-hidden />
      </Link>
    );
  };
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[560px] justify-center" aria-label="Main">
      <div className="mb-5 flex h-[52px] w-[184px] items-center justify-between rounded-full bg-drv-black px-4 shadow-[0_8px_20px_rgba(0,0,0,.18)]">
        {item("/trip/history/", { hi: "ट्रिप रिकॉर्ड", en: "Trip record" }, History)}
        {item("/", { hi: "होम", en: "Home" }, Home, true)}
        {item("/profile/", { hi: "प्रोफ़ाइल", en: "Profile" }, UserRound)}
      </div>
    </nav>
  );
}

const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

/**
 * Laid out like the parent app. Home draws its own header. Every other screen gets the kit's bar:
 * Back (or the menu on a tab screen), the name in the middle, and the screen's + action on the right.
 * Drivers and attendants get only Home and Profile; drivers keep their own look and no side menu.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = norm(usePathname() || "/");
  const { me, stale, error, reload } = useStaff();
  const L = useL();
  const [menu, setMenu] = useState(false);
  const page = PAGES[path];
  const isHome = path === "/";
  const own = !!page?.own;
  const teacher = !me || me.role === "teacher";
  const driver = me?.role === "driver";
  const [erp] = useState(isErpMode);
  const tabs = erp ? ERP_TABS : teacher ? TEACHER_TABS : OTHER_TABS;
  // Home sits on the teal band (the user's pick, 2026-10-14), so its header buttons are white.
  const band = !driver && isHome;
  const onBand = band ? "text-white active:bg-white/15" : "text-ink-900 active:bg-ink-100";
  const blocked = !!me && me.role !== "teacher" && !!page?.teacher;
  const lit = isHome ? "/" : page?.tab || (page && !page.back ? path : "/");
  const litIndex = tabs.findIndex((t) => t.href === lit);
  // Four-tab bars get the raised Report button in the middle (Dhan's centre button, 2026-10-17).
  const mid = tabs.length === 4 ? (erp ? ERP_REPORT : TEACHER_REPORT) : null;
  const midOn = !!mid && (path === mid.href || lit === mid.href);
  const cols = mid ? 5 : tabs.length;
  const litCol = midOn ? -1 : mid && litIndex >= 2 ? litIndex + 1 : litIndex;
  useEffect(() => {
    if (blocked) window.location.replace("/");
  }, [blocked]);

  // Swipe right anywhere on the screen to open the side menu (not on a chat, whose screen is all typing,
  // not for drivers, and not when the swipe starts on something that scrolls sideways, like the lectures strip).
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    if (page?.bare || driver) return;
    const sideways = (el: Element | null) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if ((o === "auto" || o === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
      }
      return false;
    };
    const start = (e: TouchEvent) => {
      const p = e.touches[0];
      touch.current = e.touches.length === 1 && !sideways(e.target as Element) ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
    };
    const end = (e: TouchEvent) => {
      const s0 = touch.current;
      touch.current = null;
      if (!s0) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - s0.x;
      const dy = Math.abs(p.clientY - s0.y);
      if (dx > 70 && dy < dx * 0.5 && Date.now() - s0.t < 700) setMenu(true);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
  }, [page?.bare, driver]);

  return (
    <MenuContext.Provider value={{ openMenu: () => setMenu(true) }}>
    <div className={clsx("relative mx-auto flex min-h-[100dvh] max-w-[560px] flex-col", driver ? "drv bg-white" : band ? "teal-page" : "app-page")}>
      {/* The teal band, on Home only for now: under the header, down to the middle of the banner. */}
      {band && <div aria-hidden className="teal-band" style={{ height: "calc(env(safe-area-inset-top, 0px) + 220px)", transform: "translate3d(0,var(--band-y,0px),0)", willChange: "transform" }} />}
      {!isHome && !own && (
        <header className="pt-safe sticky top-0 z-20 bg-[#f7f7f7]/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm">
          <div className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-1.5">
            {page?.back ? (
              <Link href={page.back} className={clsx("grid h-11 w-11 place-items-center rounded-full", onBand)} aria-label={L({ hi: "वापस", en: "Back" })}>
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </Link>
            ) : driver ? (
              <span />
            ) : (
              <button type="button" onClick={() => setMenu(true)} aria-label={L({ hi: "मेन्यू", en: "Menu" })} aria-haspopup="dialog" className={clsx("grid h-11 w-11 place-items-center rounded-full", onBand)}>
                <MenuIcon className="h-6 w-6" strokeWidth={2} aria-hidden />
              </button>
            )}
            <h1 className={clsx("truncate text-center", driver ? "text-[16px] font-semibold" : "text-[18px] font-bold", band && "text-white")}>{page ? L(page.title) : ""}</h1>
            <span className="flex justify-end">
              {page?.action && (
                <Link href={page.action.href} className={clsx("grid h-11 w-11 place-items-center rounded-full", onBand)} aria-label={L(page.action.text)}>
                  <Plus className="h-6 w-6" aria-hidden />
                </Link>
              )}
            </span>
          </div>
        </header>
      )}

      <main className={clsx("relative z-10 flex-1",!page?.bare && "pb-28", !isHome && !own && "space-y-3.5 px-4 pt-1")}>
        {!isHome && !own && <OfflineNote show={stale && !!me} />}
        {blocked ? null : error && error.status !== 401 ? (
          <div className={clsx(isHome && "px-4 pt-6")}>
            <ErrorCard offline={error.status === 0} onRetry={reload} />
          </div>
        ) : isHome || own ? (
          children
        ) : (
          <div key={path} className="page-in space-y-3.5">
            {children}
          </div>
        )}
      </main>

      {page?.bare ? null : driver ? (
        <DriverNav path={path} />
      ) : (
      // Design C (user's pick, 2026-10-19): a floating 50% glass capsule; Report rises above it as a teal disc.
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] px-2.5 pb-[calc(12px+env(safe-area-inset-bottom,0px))]" aria-label="Main">
        <ul className={clsx("nav-capsule pointer-events-auto relative grid h-16 rounded-3xl", tabs.length === 2 ? "grid-cols-2" : mid ? "grid-cols-5" : "grid-cols-4")}>
          {/* No pill behind the lit tab (user, 2026-10-19): its icon is coloured and filled inside instead. */}
          {tabs.map(({ href, text, icon: Icon }, i) => {
            const on = lit === href;
            return (
              <Fragment key={href}>
                {mid && i === 2 && (
                  <li className="relative">
                    <Link href={mid.href} aria-current={midOn ? "page" : undefined} className={clsx("flex h-16 flex-col items-center justify-end pb-[9px] text-[11px] text-[#3099a4]", midOn ? "font-semibold" : "font-medium")}>
                      <span className={clsx("absolute -top-[22px] left-1/2 grid h-[54px] w-[54px] -translate-x-1/2 place-items-center rounded-full border-4 bg-[#3099a4] text-white shadow-[0_6px_16px_rgba(48,153,164,0.35)] transition-transform duration-200 active:scale-95", band ? "border-[#eef6f6]" : "border-[#ececec]")}>
                        <LayoutDashboard className="h-[25px] w-[25px]" strokeWidth={2} aria-hidden />
                      </span>
                      {L(mid.text)}
                    </Link>
                  </li>
                )}
                <li className="relative">
                  <Link href={href} aria-current={on ? "page" : undefined} className={clsx("flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors duration-300", on ? "font-semibold text-brand-600" : "font-medium text-ink-400")}>
                    <span className="grid h-7 w-[52px] place-items-center">
                      <Icon key={on ? "on" : "off"} className={clsx("h-[27px] w-[27px]", on && "tab-icon-on")} strokeWidth={on ? 2 : 1.7} fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.22 : undefined} aria-hidden />
                    </span>
                    {L(text)}
                  </Link>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>
      )}

      {menu && <SideMenu onClose={() => setMenu(false)} />}
    </div>
    </MenuContext.Provider>
  );
}
