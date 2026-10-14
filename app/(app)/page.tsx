"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Banknote, Bell, BookOpen, CalendarCheck, CalendarX2, Check, ChevronRight, Clock3, Megaphone, Menu as MenuIcon, MessageCircle, NotebookPen, Search, Table2, TrendingUp, Users, X, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang, type Bi } from "@/lib/i18n";
import { useMenu } from "@/lib/menu";
import { ripple } from "@/lib/motion";
import { clock } from "@/lib/format";
import { Avatar, ErrorCard, OfflineNote, SchoolMark, Skeleton } from "@/components/ui";
import { DriverHome } from "@/components/driver/DriverHome";

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
  noticeCount?: number;
}

type Tile = { href: string; text: Bi; icon: LucideIcon };
const TEACHER_GRID: Tile[] = [
  { href: "/attendance/", text: { hi: "हाज़िरी", en: "Attendance" }, icon: CalendarCheck },
  { href: "/homework/", text: { hi: "होमवर्क", en: "Homework" }, icon: BookOpen },
  { href: "/students/", text: { hi: "बच्चे", en: "Students" }, icon: Users },
  { href: "/messages/", text: { hi: "पूछताछ", en: "Enquiries" }, icon: MessageCircle },
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

let arrived = false;

/** Place in the arrival order (see .enter / .reveal in globals.css). */
const v = (i: number) => ({ "--i": i }) as React.CSSProperties;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * Home laid out like the parent app: the school row, the greeting, the school's photo, a Today card
 * (what is still left today), Quick Actions, then parent messages and today's lectures.
 */
export default function HomePage() {
  const { me, stale } = useStaff();
  const { data, error, reload } = useApi<Home>(me ? "/home" : null);
  // Unread parent messages put a red dot on the Messages tile.
  const { data: chats } = useApi<{ unread: number }>(me?.role === "teacher" ? "/chats/unread" : null);
  const unreadChats = chats?.unread || 0;
  const L = useL();
  const { lang, setLang } = useLang();
  const { openMenu } = useMenu();
  const [now, setNow] = useState(nowHHMM);
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);
  // The arrival plays once per visit to the app; coming back to Home later, it is simply there.
  const [calm] = useState(arrived);
  useEffect(() => {
    arrived = true;
  }, []);
  // Every action shows from the start; "Show less" folds it to the first row.
  const [more, setMore] = useState(true);

  const teacher = me?.role === "teacher";
  const first = me?.name.split(" ")[0] || "";
  const hour = +now.slice(0, 2);
  const greet = hour < 12 ? L({ hi: "सुप्रभात", en: "Good morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good afternoon" }) : L({ hi: "नमस्ते", en: "Good evening" });

  // Drivers have their own Home: today's route and the trip. Until we know who it is, only a
  // plain loading screen, so a driver never sees the teachers' Home flash first.
  if (me?.role === "driver") return <DriverHome />;
  if (!me)
    return (
      <div className="space-y-4 px-4 pt-6" aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );

  const grid = teacher ? TEACHER_GRID : OTHER_GRID;
  const school = me.school;
  const unread = data?.noticeCount || 0;

  // Lectures: the one going on now, and those still to come.
  const lessons = data?.lessons || [];
  const nowIdx = lessons.findIndex((l) => l.start <= now && now < l.end);
  const nextIdx = lessons.findIndex((l) => l.start > now);
  const shown = lessons.filter((l) => l.end > now);

  return (
    <div className={clsx("animate-fadeIn", calm && "calm")}>
      <header className="pt-safe px-4">
        {/* One row like the parent app: menu, school, then language, search, notices and the staff member. */}
        <div className="enter flex items-center gap-1.5 pt-4" style={v(0)}>
          <button type="button" onClick={openMenu} aria-label={L({ hi: "मेन्यू", en: "Menu" })} aria-haspopup="dialog" className="-ml-2 mr-0.5 grid h-11 w-10 shrink-0 place-items-center rounded-full text-white active:bg-white/15">
            <MenuIcon className="h-6 w-6" strokeWidth={2} aria-hidden />
          </button>
          <SchoolMark name={school.name} url={school.logoUrl} size={44} />
          {/* Search fills the room between the logo and the language switch. */}
          {teacher ? (
            <Link href="/students/?search=1" className="glass-search ml-1 mr-0.5 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-ink-500" aria-label={L({ hi: "बच्चे खोजें", en: "Search students" })}>
              <Search className="h-[18px] w-[18px] shrink-0 text-brand-800" strokeWidth={2.2} aria-hidden />
              <span className="truncate text-[14px]">{L({ hi: "खोजें", en: "Search" })}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          <div className="relative flex shrink-0 rounded-full border border-ink-200 bg-white p-0.5" role="group" aria-label={L({ hi: "भाषा", en: "Language" })}>
            <span aria-hidden className="slide-pill absolute left-0.5 top-0.5 h-7 w-[30px] rounded-full bg-brand-600" style={{ transform: lang === "hi" ? "translateX(30px)" : "none" }} />
            {(["en", "hi"] as const).map((k) => (
              <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k} className={clsx("relative h-7 w-[30px] rounded-full text-[12px] font-semibold transition-colors duration-300", lang === k ? "text-white" : "text-ink-500")}>
                {k === "en" ? "EN" : "हि"}
              </button>
            ))}
          </div>
          <Link href="/notice/" className="relative grid h-10 w-9 shrink-0 place-items-center rounded-full text-white active:bg-white/15" aria-label={unread ? `${unread} ${L({ hi: "नई सूचनाएँ", en: "new notices" })}` : L({ hi: "सूचनाएँ", en: "Notices" })}>
            <Bell className={clsx("h-[21px] w-[21px]", unread > 0 && "bell-ring")} strokeWidth={2} aria-hidden />
            {unread > 0 && (
              <span className="badge-pop absolute right-0 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white bg-rose-600 px-0.5 text-[10px] font-bold leading-none text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link href="/profile/" className="shrink-0 rounded-full ring-2 ring-white transition-transform duration-300 active:scale-90" aria-label={L({ hi: "प्रोफ़ाइल", en: "Profile" })}>
            <Avatar name={me.name} url={me.photoUrl} size={38} tint={0} />
          </Link>
        </div>

        <div className="mt-5">
          <h1 className="truncate text-[clamp(21px,6.4vw,26px)] font-bold leading-tight text-white">
            <span className="reveal">
              <span style={v(0)}>{greet},</span>
            </span>{" "}
            <span className="reveal">
              <span style={v(1)}>{first}</span>
            </span>
          </h1>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-4">
        <OfflineNote show={stale && !!me} />
        {error && error.status !== 401 && !data && <ErrorCard offline={error.status === 0} onRetry={reload} />}

        {/* The school's banner, right under the greeting. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/home-top.jpeg" alt={L({ hi: "स्टाफ पोर्टल – सेंट पॉल स्कूल", en: "Staff portal – St. Paul School" })} className="enter aspect-[1366/768] w-full rounded-2xl border border-ink-100 bg-ink-100 object-cover" style={v(3)} />

        <Today data={data} teacher={teacher} />

        <section className="enter" style={v(4)}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[19px] font-bold text-brand-800">{L({ hi: "जल्दी पहुँचें", en: "Quick Actions" })}</h2>
            {grid.length > 4 && (
              <button onClick={() => setMore((m) => !m)} className="flex min-h-[44px] items-center gap-0.5 text-[14px] font-medium text-brand-600" aria-expanded={more}>
                {more ? L({ hi: "कम दिखाएँ", en: "Show less" }) : L({ hi: "सब देखें", en: "View all" })}
                <ChevronRight className={clsx("h-4 w-4 transition-transform", more && "rotate-90")} aria-hidden />
              </button>
            )}
          </div>
          {/* Four to a row; folded, only the first row shows. */}
          <div className="grid grid-cols-4 gap-2">
            {(more ? grid : grid.slice(0, 4)).map(({ href, text, icon: Icon }, k) => (
              <Link key={href} href={href} onPointerDown={ripple} className="quick-tile pop-in" style={v(k)}>
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                  {href === "/messages/" && unreadChats > 0 && (
                    <span className="badge-pop absolute -right-3 -top-2 grid h-[20px] min-w-[20px] place-items-center rounded-full border-2 border-white bg-[#ff3040] px-1 text-[11px] font-bold leading-none text-white" aria-label={`${unreadChats} ${L({ hi: "नए संदेश", en: "new messages" })}`}>
                      {unreadChats > 10 ? "10+" : unreadChats}
                    </span>
                  )}
                </span>
                {L(text)}
              </Link>
            ))}
          </div>
        </section>

        {teacher && data && (
          <section className="enter" style={v(5)}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[19px] font-bold text-brand-800">{L({ hi: "आज की कक्षाएँ", en: "Today's lectures" })}</h2>
              <Link href="/lectures/" className="flex min-h-[44px] items-center gap-0.5 text-[14px] font-medium text-brand-600">
                {L({ hi: "सब देखें", en: "View all" })}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-2xl border border-ink-100 bg-white px-4 py-3.5 text-[15px] text-ink-500">{lessons.length ? L({ hi: "आज की सारी कक्षाएँ हो गईं।", en: "All of today's classes are done." }) : L({ hi: "आज आपकी कोई कक्षा नहीं है।", en: "You have no classes today." })}</p>
            ) : (
              <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
                {shown.map((l) => {
                  const i = lessons.indexOf(l);
                  const live = i === nowIdx;
                  return (
                    <li key={l.id} className={clsx("w-[172px] shrink-0 rounded-2xl px-3.5 py-3", live ? "bg-brand-50 ring-[1.5px] ring-inset ring-brand-600" : "border border-ink-100 bg-white")}>
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

/** "Thu, 09 Oct 2026" / "गुरुवार, 9 अक्टूबर" */
const todayText = (iso: string, lang: "hi" | "en") =>
  new Date(iso + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-GB", lang === "hi" ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

const plainIcon = (Icon: LucideIcon) => <Icon className="h-6 w-6 text-ink-900" strokeWidth={1.8} aria-hidden />;

/** What the staff member checks every morning, each a row that opens its screen (the parent app's Today card). */
function Today({ data, teacher }: { data: Home | undefined; teacher: boolean }) {
  const L = useL();
  const { lang } = useLang();

  if (!data)
    return (
      <section className="today-card space-y-3 pb-4">
        <Skeleton className="h-6 w-24" />
        {[0, 1, 2].map((k) => (
          <div key={k} className="flex items-center gap-3.5">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </section>
    );

  // Their own attendance, marked by the office.
  const m = data.myMark;
  const mine =
    m === "P"
      ? { icon: <Mark className="bg-jade-600" icon={Check} draw />, note: L({ hi: "आज उपस्थित", en: "Present today" }) }
      : m === "A"
        ? { icon: <Mark className="bg-rose-600" icon={X} />, note: L({ hi: "आज अनुपस्थित", en: "Absent today" }) }
        : m === "L" || m === "H"
          ? { icon: <Mark className="bg-marigold-500" icon={Check} />, note: m === "L" ? L({ hi: "आज छुट्टी पर", en: "On leave today" }) : L({ hi: "आज आधा दिन", en: "Half day today" }) }
          : { icon: plainIcon(Clock3), note: L({ hi: "अभी हाज़िरी नहीं लगी", en: "Not marked yet" }) };
  const myRow = (i: number) => <TodayRow i={i} href="/my-attendance/" icon={mine.icon} title={L({ hi: "मेरी हाज़िरी", en: "My attendance" })} note={mine.note} />;

  const open = data.attendanceToMark[0];
  const rows = teacher ? (
    <>
      <TodayRow
        i={4}
        href={open ? `/attendance/?id=${open.id}` : "/attendance/"}
        icon={open ? plainIcon(CalendarCheck) : <Mark className="bg-jade-600" icon={Check} draw />}
        title={L({ hi: "हाज़िरी", en: "Attendance" })}
        note={open ? L({ hi: `${open.classSec} की बाकी है`, en: `${open.classSec} not marked` }) : L({ hi: "सब लग गई", en: "All marked" })}
        end={open ? <span className="pay-pulse rounded-full bg-[#b01003] px-3.5 py-2 text-[13.5px] font-semibold text-white">{L({ hi: "अभी लगाएँ", en: "Mark now" })}</span> : null}
      />
      <TodayRow
        i={5}
        href="/leave/?tab=requests"
        icon={plainIcon(CalendarX2)}
        title={L({ hi: "छुट्टी की अर्ज़ियाँ", en: "Leave requests" })}
        note={data.pendingLeaves ? L({ hi: `${data.pendingLeaves} जवाब बाकी`, en: `${data.pendingLeaves} waiting` }) : L({ hi: "कोई अर्ज़ी नहीं", en: "None waiting" })}
        end={data.pendingLeaves ? <span className="text-[14.5px] font-semibold text-brand-600">{L({ hi: "देखें", en: "Review" })}</span> : null}
      />
      {myRow(6)}
    </>
  ) : (
    <>
      {myRow(4)}
      <TodayRow
        i={5}
        href="/leave/"
        icon={plainIcon(CalendarX2)}
        title={L({ hi: "छुट्टी", en: "Leave" })}
        note={L({ hi: "अर्ज़ी दें या देखें", en: "Apply or check" })}
        end={<span className="text-[14.5px] font-semibold text-brand-600">{L({ hi: "देखें", en: "View" })}</span>}
      />
      <TodayRow
        i={6}
        href="/salary/"
        icon={plainIcon(Banknote)}
        title={L({ hi: "सैलरी", en: "Salary" })}
        note={L({ hi: "सैलरी स्लिप", en: "Salary slips" })}
        end={<span className="text-[14.5px] font-semibold text-brand-600">{L({ hi: "देखें", en: "View" })}</span>}
      />
    </>
  );

  return (
    <section className="today-card enter" style={v(3)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-bold text-brand-800">{L({ hi: "आज", en: "Today" })}</h2>
        <span className="truncate text-[13.5px] text-ink-500">{todayText(data.date, lang)}</span>
      </div>
      <ul>{rows}</ul>
    </section>
  );
}

/** A round status mark that pops in; with `draw` its tick draws itself. */
function Mark({ className, icon: Icon, draw }: { className: string; icon: LucideIcon; draw?: boolean }) {
  return (
    <span className={clsx("tick-pop grid h-7 w-7 place-items-center rounded-full text-white", className)}>
      <Icon className={clsx("h-4 w-4", draw && "tick-draw")} strokeWidth={3} aria-hidden />
    </span>
  );
}

function TodayRow({ i, href, icon, title, note, end }: { i: number; href: string; icon: React.ReactNode; title: string; note: string; end?: React.ReactNode }) {
  return (
    <li className="enter border-b border-ink-100 last:border-0" style={v(i)}>
      <Link href={href} onPointerDown={ripple} className="relative -mx-4 flex min-h-[72px] items-center gap-3.5 overflow-hidden px-4 py-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-ink-900">{title}</span>
          <span className="block truncate text-[13px] text-ink-500">{note}</span>
        </span>
        {end}
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-400" aria-hidden />
      </Link>
    </li>
  );
}