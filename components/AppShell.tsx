"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarCheck, ChevronLeft, Home, Plus, UserRound, Users, type LucideIcon } from "lucide-react";
import { useStaff } from "@/lib/staff";
import { useL, type Bi } from "@/lib/i18n";
import { ErrorCard, OfflineNote } from "./ui";

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
}

const PAGES: Record<string, PageInfo> = {
  "/students/": { title: { hi: "बच्चे", en: "Students" }, teacher: true },
  "/students/detail/": { title: { hi: "बच्चा", en: "Student" }, back: "/students/", tab: "/students/", teacher: true },
  "/attendance/": { title: { hi: "हाज़िरी", en: "Attendance" }, teacher: true },
  "/profile/": { title: { hi: "प्रोफ़ाइल", en: "Profile" } },
  "/my-attendance/": { title: { hi: "मेरी हाज़िरी", en: "My Attendance" }, back: "/profile/", tab: "/profile/" },
  "/salary/": { title: { hi: "सैलरी स्लिप", en: "Salary Slips" }, back: "/profile/", tab: "/profile/" },
  "/homework/": { title: { hi: "होमवर्क", en: "Homework" }, back: "/", teacher: true },
  "/marks/": { title: { hi: "अंक", en: "Marks" }, back: "/", teacher: true },
  "/timetable/": { title: { hi: "टाइम टेबल", en: "Time Table" }, back: "/", teacher: true },
  "/lectures/": { title: { hi: "आज की कक्षाएँ", en: "Today's Lectures" }, back: "/", teacher: true },
  "/notes/": { title: { hi: "टीचर का नोट", en: "Teacher's Note" }, back: "/", teacher: true },
  "/leave/": { title: { hi: "छुट्टी", en: "Leave" }, back: "/", action: { href: "/leave/apply/", text: { hi: "छुट्टी की अर्ज़ी", en: "Apply leave" } } },
  "/leave/apply/": { title: { hi: "छुट्टी की अर्ज़ी", en: "Apply Leave" }, back: "/leave/" },
  "/notice/": { title: { hi: "सूचनाएँ", en: "Notice" }, back: "/" },
};

const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

/**
 * Home draws its own header. Every other screen gets the kit's bar: Back, the name in the
 * middle, and the screen's + action on the right. Drivers and attendants get only Home and Profile.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = norm(usePathname() || "/");
  const { me, stale, error, reload } = useStaff();
  const L = useL();
  const page = PAGES[path];
  const isHome = path === "/";
  const teacher = !me || me.role === "teacher";
  const tabs = teacher ? TEACHER_TABS : OTHER_TABS;
  const blocked = !!me && me.role !== "teacher" && !!page?.teacher;
  const lit = isHome ? "/" : page?.tab || (page && !page.back ? path : "/");
  useEffect(() => {
    if (blocked) window.location.replace("/");
  }, [blocked]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[560px] flex-col bg-white">
      {!isHome && (
        <header className="pt-safe sticky top-0 z-20 bg-white/95 backdrop-blur-sm">
          <div className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-1.5">
            {page?.back ? (
              <Link href={page.back} className="grid h-11 w-11 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={L({ hi: "वापस", en: "Back" })}>
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
            <h1 className="truncate text-center text-[18px] font-bold">{page ? L(page.title) : ""}</h1>
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

      <main className={clsx("flex-1 pb-28", !isHome && "space-y-3.5 px-4 pt-1")}>
        {!isHome && <OfflineNote show={stale && !!me} />}
        {blocked ? null : error && error.status !== 401 ? (
          <div className={clsx(isHome && "px-4 pt-6")}>
            <ErrorCard offline={error.status === 0} onRetry={reload} />
          </div>
        ) : (
          children
        )}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] border-t border-ink-100 bg-white" aria-label="Main">
        <ul className={clsx("grid", tabs.length === 2 ? "grid-cols-2" : "grid-cols-4")}>
          {tabs.map(({ href, text, icon: Icon }) => {
            const on = lit === href;
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={clsx("flex h-[62px] flex-col items-center justify-center gap-1 text-[12px]", on ? "font-semibold text-brand-600" : "font-medium text-ink-400")}>
                  <Icon className="h-[23px] w-[23px]" strokeWidth={on ? 2 : 1.7} fill={on ? "#E7E1FD" : "none"} aria-hidden />
                  {L(text)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
