"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Banknote, Bell, BookOpen, CalendarCheck, CalendarX2, Clock3, Megaphone, NotebookPen, Search, Table2, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, type Bi } from "@/lib/i18n";
import { clock } from "@/lib/format";
import { Art, type ArtName } from "@/components/art";
import { Avatar, ErrorCard, OfflineNote, Skeleton, TINTS } from "@/components/ui";

interface Lesson {
  id: string;
  label: string;
  start: string;
  end: string;
  classSec: string;
  subject: string;
}
interface Home {
  date: string;
  myMark: "P" | "A" | "L" | "H" | null;
  lessons: Lesson[];
  attendanceToMark: { id: string; classSec: string }[];
  pendingLeaves: number;
}

type Tile = { href: string; text: Bi; icon: LucideIcon };
const TEACHER_GRID: Tile[] = [
  { href: "/attendance/", text: { hi: "हाज़िरी", en: "Attendance" }, icon: CalendarCheck },
  { href: "/homework/", text: { hi: "होमवर्क", en: "Homework" }, icon: BookOpen },
  { href: "/students/", text: { hi: "बच्चे", en: "Students" }, icon: Users },
  { href: "/marks/", text: { hi: "अंक", en: "Marks" }, icon: TrendingUp },
  { href: "/timetable/", text: { hi: "टाइम टेबल", en: "Time Table" }, icon: Table2 },
  { href: "/leave/", text: { hi: "छुट्टी", en: "Leave" }, icon: CalendarX2 },
  { href: "/notes/", text: { hi: "टीचर नोट", en: "Teacher's Note" }, icon: NotebookPen },
  { href: "/notice/", text: { hi: "सूचना", en: "Notice" }, icon: Megaphone },
];
const OTHER_GRID: Tile[] = [
  { href: "/my-attendance/", text: { hi: "मेरी हाज़िरी", en: "Attendance" }, icon: CalendarCheck },
  { href: "/leave/", text: { hi: "छुट्टी", en: "Leave" }, icon: CalendarX2 },
  { href: "/salary/", text: { hi: "सैलरी", en: "Salary" }, icon: Banknote },
  { href: "/notice/", text: { hi: "सूचना", en: "Notice" }, icon: Megaphone },
];

const MARK: Record<"P" | "A" | "L" | "H", Bi> = {
  P: { hi: "आज आपकी हाज़िरी लग गई", en: "You are marked present today" },
  A: { hi: "आज आप अनुपस्थित दर्ज हैं", en: "You are marked absent today" },
  L: { hi: "आज आप छुट्टी पर हैं", en: "You are on leave today" },
  H: { hi: "आज आधा दिन दर्ज है", en: "Half day marked for today" },
};

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Home as the kit lays it out: ID and greeting, a search, one banner with what is still left
 * today, the shortcuts, then today's lectures (the one going on now outlined).
 */
export default function HomePage() {
  const { me, stale } = useStaff();
  const { data, error, reload } = useApi<Home>(me ? "/home" : null);
  const L = useL();
  const [now, setNow] = useState(nowHHMM);
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);

  const teacher = me?.role === "teacher";
  const first = me?.name.split(" ")[0] || "";
  const hour = +now.slice(0, 2);
  const greet = hour < 12 ? L({ hi: "सुप्रभात", en: "Good morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good afternoon" }) : L({ hi: "नमस्ते", en: "Good evening" });

  let banner: { title: string; text: string; href: string; button: string; art: ArtName } | null = null;
  if (data && me) {
    const open = data.attendanceToMark[0];
    if (teacher && open)
      banner = {
        title: L({ hi: `${open.classSec} की हाज़िरी बाकी है`, en: `${open.classSec} attendance is not marked` }),
        text: L({ hi: "सुबह 9 बजे से पहले लगा दें", en: "Mark it before 9:00" }),
        href: `/attendance/?id=${open.id}`,
        button: L({ hi: "अभी लगाएँ", en: "Mark now" }),
        art: "teacher",
      };
    else if (teacher && data.pendingLeaves > 0)
      banner = {
        title: L({ hi: `${data.pendingLeaves} छुट्टी की अर्ज़ियाँ`, en: `${data.pendingLeaves} leave requests waiting` }),
        text: L({ hi: "बच्चों के माता-पिता जवाब का इंतज़ार कर रहे हैं", en: "Parents are waiting for your answer" }),
        href: "/leave/?tab=requests",
        button: L({ hi: "देखें", en: "Review" }),
        art: "calflag",
      };
    else if (teacher)
      banner = {
        title: L({ hi: "आज का सब काम हो गया", en: "All done for today" }),
        text: data.lessons.length ? L({ hi: `आज ${data.lessons.length} कक्षाएँ हैं`, en: `${data.lessons.length} classes today` }) : L({ hi: "आज कोई कक्षा नहीं", en: "No classes today" }),
        href: "/homework/",
        button: L({ hi: "होमवर्क दें", en: "Give homework" }),
        art: "notebook",
      };
    else
      banner = {
        title: data.myMark ? L(MARK[data.myMark]) : L({ hi: "आज की हाज़िरी अभी नहीं लगी", en: "Today's attendance not marked yet" }),
        text: L({ hi: "ऑफ़िस हाज़िरी लगाता है", en: "The office marks staff attendance" }),
        href: "/my-attendance/",
        button: L({ hi: "पूरा महीना", en: "Whole month" }),
        art: "calflag",
      };
  }

  // Lectures: the one going on now, and those still to come.
  const lessons = data?.lessons || [];
  const nowIdx = lessons.findIndex((l) => l.start <= now && now < l.end);
  const nextIdx = lessons.findIndex((l) => l.start > now);
  const shown = lessons.filter((l) => l.end > now);

  return (
    <div className="animate-fadeIn">
      <header className="pt-safe">
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <div className="min-w-0 flex-1">
            {me ? (
              <>
                <p className="truncate text-[12px] font-semibold uppercase tracking-[0.03em] text-ink-400">
                  ID {me.empCode} · {L(me.roleLabel)}
                </p>
                <h1 className="text-[21px] font-bold leading-tight">
                  {greet}, {first}
                </h1>
              </>
            ) : (
              <div className="space-y-1.5 py-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-48" />
              </div>
            )}
          </div>
          <Link href="/notice/" className="grid h-11 w-11 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={L({ hi: "सूचनाएँ", en: "Notices" })}>
            <Bell className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden />
          </Link>
          {me && (
            <Link href="/profile/" className="rounded-full" aria-label={L({ hi: "प्रोफ़ाइल", en: "Profile" })}>
              <Avatar name={me.name} size={42} tint={5} />
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-4 px-4 pt-2">
        <OfflineNote show={stale && !!me} />

        {teacher && (
          <Link href="/students/?search=1" className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-ink-200 px-3.5 text-[15px] text-ink-400 active:bg-ink-50">
            <Search className="h-[18px] w-[18px]" aria-hidden />
            {L({ hi: "बच्चे खोजें", en: "Search students" })}
          </Link>
        )}

        {error && error.status !== 401 && !data && <ErrorCard offline={error.status === 0} onRetry={reload} />}

        {!banner ? (
          <div className="banner space-y-2.5">
            <Skeleton className="h-5 w-40 bg-brand-100" />
            <Skeleton className="h-3.5 w-32 bg-brand-100" />
            <Skeleton className="h-10 w-24 bg-brand-100" />
          </div>
        ) : (
          <section className="banner">
            <p className="text-[17px] font-bold leading-snug">{banner.title}</p>
            <p className="mb-3 mt-1 text-[13px] leading-snug text-ink-500">{banner.text}</p>
            <Link href={banner.href} className="btn-dark">
              {banner.button}
            </Link>
            <Art name={banner.art} />
          </section>
        )}

        <nav className="grid grid-cols-4 gap-x-1.5 gap-y-3 pt-1" aria-label={L({ hi: "सब कुछ", en: "Everything" })}>
          {(teacher ? TEACHER_GRID : OTHER_GRID).map(({ href, text, icon: Icon }, k) => (
            <Link key={href} href={href} className="icon-tile">
              <span style={{ background: TINTS[k][0], color: TINTS[k][1] }}>
                <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
              </span>
              {L(text)}
            </Link>
          ))}
        </nav>

        {teacher && data && (
          <section className="space-y-2.5 pt-1">
            <div className="sec-head">
              <h2>{L({ hi: "आज की कक्षाएँ", en: "Today's lectures" })}</h2>
              <Link href="/lectures/">{L({ hi: "सब देखें ›", en: "View all ›" })}</Link>
            </div>
            {shown.length === 0 ? (
              <p className="row-card text-[15px] text-ink-500">{lessons.length ? L({ hi: "आज की सारी कक्षाएँ हो गईं।", en: "All of today's classes are done." }) : L({ hi: "आज आपकी कोई कक्षा नहीं है।", en: "You have no classes today." })}</p>
            ) : (
              <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
                {shown.map((l) => {
                  const i = lessons.indexOf(l);
                  const live = i === nowIdx;
                  return (
                    <li key={l.id} className={clsx("w-[172px] shrink-0 rounded-2xl px-3.5 py-3", live ? "bg-brand-50 ring-[1.5px] ring-inset ring-brand-600" : "bg-ink-50")}>
                      {(live || i === nextIdx) && <span className={clsx("block text-[11px] font-bold uppercase", live ? "text-brand-600" : "text-ink-400")}>{live ? L({ hi: "अभी", en: "Now" }) : L({ hi: "अगली", en: "Next" })}</span>}
                      <span className="block text-[15px] font-bold">
                        {l.subject} · {l.classSec}
                      </span>
                      <span className="meta mt-1.5">
                        <span>
                          <Clock3 aria-hidden />
                          {clock(l.start)} – {clock(l.end)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
