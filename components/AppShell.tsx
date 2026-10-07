"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BookOpen, CalendarCheck, ClipboardList, Home, UserRound } from "lucide-react";
import { useStaff } from "@/lib/staff";
import { useL, type Bi } from "@/lib/i18n";
import { Avatar, ErrorCard, OfflineNote, Skeleton } from "./ui";

const TEACHER_TABS: { href: string; text: Bi; icon: typeof Home }[] = [
  { href: "/", text: { hi: "होम", en: "Home" }, icon: Home },
  { href: "/attendance/", text: { hi: "हाज़िरी", en: "Attendance" }, icon: CalendarCheck },
  { href: "/homework/", text: { hi: "होमवर्क", en: "Homework" }, icon: BookOpen },
  { href: "/marks/", text: { hi: "अंक", en: "Marks" }, icon: ClipboardList },
  { href: "/me/", text: { hi: "मेरा", en: "Me" }, icon: UserRound },
];
const OTHER_TABS = [TEACHER_TABS[0], TEACHER_TABS[4]];

const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

/** Screens only teachers have; anyone else who opens one by link goes back to Home. */
const TEACHER_ONLY = ["/attendance/", "/homework/", "/marks/", "/me/timetable/", "/me/requests/"];

/** Dark top bar with the school and the person, the screen, then the tab bar (fewer tabs for non-teachers). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = norm(usePathname() || "/");
  const { me, stale, error, reload } = useStaff();
  const L = useL();
  const tabs = !me || me.role === "teacher" ? TEACHER_TABS : OTHER_TABS;
  const blocked = !!me && me.role !== "teacher" && TEACHER_ONLY.some((p) => path.startsWith(p));
  useEffect(() => {
    if (blocked) window.location.replace("/");
  }, [blocked]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[560px] flex-col">
      <header className="pt-safe sticky top-0 z-20 bg-night-900 text-white">
        <div className="flex h-14 items-center gap-3 px-4">
          {me?.school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.school.logoUrl} alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
          ) : null}
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white/90">{me?.school.name || " "}</p>
        </div>
        <div className="px-4 pb-4">
          {!me ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full !bg-night-700" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36 !bg-night-700" />
                <Skeleton className="h-3 w-24 !bg-night-700" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar name={me.name} size={48} />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold leading-tight">{me.name}</p>
                <p className="text-sm text-white/65">
                  {L(me.roleLabel)} · {me.empCode}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 space-y-3 px-3 pb-28 pt-3">
        <OfflineNote show={stale && !!me} />
        {blocked ? null : error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : children}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] border-t border-ink-200 bg-white shadow-bar" aria-label="Main">
        <ul className={clsx("grid", tabs.length === 2 ? "grid-cols-2" : "grid-cols-5")}>
          {tabs.map(({ href, text, icon: Icon }) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={clsx("relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", on ? "text-brand-700" : "text-ink-500")}>
                  {on && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-600" aria-hidden />}
                  <Icon className="h-6 w-6" strokeWidth={on ? 2.3 : 1.9} aria-hidden />
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
