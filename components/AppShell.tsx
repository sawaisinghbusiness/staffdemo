"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarCheck, ChevronLeft, History, Home, Menu as MenuIcon, Plus, UserRound, Users, type LucideIcon } from "lucide-react";
import { useStaff } from "@/lib/staff";
import { useL, type Bi } from "@/lib/i18n";
import { MenuContext } from "@/lib/menu";
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
};

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
  const tabs = teacher ? TEACHER_TABS : OTHER_TABS;
  const blocked = !!me && me.role !== "teacher" && !!page?.teacher;
  const lit = isHome ? "/" : page?.tab || (page && !page.back ? path : "/");
  const litIndex = tabs.findIndex((t) => t.href === lit);
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
    <div className={clsx("mx-auto flex min-h-[100dvh] max-w-[560px] flex-col", driver ? "bg-white" : "bg-ink-50", driver && "drv")}>
      {!isHome && !own && (
        <header className="pt-safe sticky top-0 z-20 bg-white/95 backdrop-blur-sm">
          <div className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-1.5">
            {page?.back ? (
              <Link href={page.back} className="grid h-11 w-11 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={L({ hi: "वापस", en: "Back" })}>
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </Link>
            ) : driver ? (
              <span />
            ) : (
              <button type="button" onClick={() => setMenu(true)} aria-label={L({ hi: "मेन्यू", en: "Menu" })} aria-haspopup="dialog" className="grid h-11 w-11 place-items-center rounded-full text-ink-900 active:bg-ink-100">
                <MenuIcon className="h-6 w-6" strokeWidth={2} aria-hidden />
              </button>
            )}
            <h1 className={clsx("truncate text-center", driver ? "text-[16px] font-semibold" : "text-[18px] font-bold")}>{page ? L(page.title) : ""}</h1>
            <span className="flex justify-end">
              {page?.action && (
                <Link href={page.action.href} className="grid h-11 w-11 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={L(page.action.text)}>
                  <Plus className="h-6 w-6" aria-hidden />
                </Link>
              )}
            </span>
          </div>
        </header>
      )}

      <main className={clsx("flex-1", !page?.bare && "pb-28", !isHome && !own && "space-y-3.5 px-4 pt-1")}>
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
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] border-t border-ink-100 bg-white" aria-label="Main">
        <ul className={clsx("relative grid", tabs.length === 2 ? "grid-cols-2" : "grid-cols-4")}>
          {/* One blue pill that slides to the lit tab, as in the parent app. */}
          <span
            aria-hidden
            className="slide-pill pointer-events-none absolute left-0 top-[9px] flex justify-center"
            style={{ width: `${100 / tabs.length}%`, transform: `translateX(${Math.max(0, litIndex) * 100}%)`, opacity: litIndex < 0 ? 0 : 1 }}
          >
            <span className="h-8 w-[52px] rounded-[10px] bg-brand-600" />
          </span>
          {tabs.map(({ href, text, icon: Icon }) => {
            const on = lit === href;
            return (
              <li key={href} className="relative">
                <Link href={href} aria-current={on ? "page" : undefined} className={clsx("flex h-[66px] flex-col items-center justify-center gap-0.5 text-[12px] transition-colors duration-300", on ? "font-semibold text-brand-600" : "font-medium text-ink-400")}>
                  <span className={clsx("grid h-8 w-[52px] place-items-center rounded-[10px] transition-colors duration-300", on && "text-white")}>
                    <Icon key={on ? "on" : "off"} className={clsx("h-[22px] w-[22px]", on && "tab-icon-on")} strokeWidth={on ? 2.1 : 1.7} aria-hidden />
                  </span>
                  {L(text)}
                </Link>
              </li>
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
