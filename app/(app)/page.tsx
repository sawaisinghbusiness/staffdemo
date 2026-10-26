"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bell, ChevronRight, Clock3, Menu as MenuIcon, Search } from "lucide-react";
import { isErpMode } from "@/lib/erpMode";
import { toast } from "@/lib/toast";
import { useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang, type Bi } from "@/lib/i18n";
import { QuickIcon, type QuickIconName } from "@/components/QuickIcons";
import { useMenu } from "@/lib/menu";
import { ripple } from "@/lib/motion";
import { clock } from "@/lib/format";
import { useUnseenNotices } from "@/lib/counts";
import { Avatar, CountBadge, ErrorCard, OfflineNote, Skeleton } from "@/components/ui";
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
  attendanceToMark: { id: string; classSec: string; remindedAt?: string }[];
  pendingLeaves: number;
  noticeCount?: number;
}

// Each tile's icon is one of the orange family (components/QuickIcons), as on the parent app (user, 2026-10-24).
type Tile = { href: string; text: Bi; icon: QuickIconName; soon?: boolean };
const TEACHER_GRID: Tile[] = [
  { href: "/attendance/", text: { hi: "हाज़िरी", en: "Attendance" }, icon: "attendance" },
  { href: "/homework/", text: { hi: "होमवर्क", en: "Homework" }, icon: "homework" },
  { href: "/students/", text: { hi: "बच्चे", en: "Students" }, icon: "students" },
  { href: "/messages/", text: { hi: "पूछताछ", en: "Enquiries" }, icon: "askTeacher" },
  { href: "/marks/", text: { hi: "अंक", en: "Marks" }, icon: "marks" },
  { href: "/timetable/", text: { hi: "टाइम टेबल", en: "Time Table" }, icon: "timetable" },
  { href: "/leave/", text: { hi: "छुट्टी", en: "Leave" }, icon: "leave" },
  { href: "/notes/", text: { hi: "टीचर नोट", en: "Teacher's Note" }, icon: "notes" },
  { href: "/notice/", text: { hi: "सूचना", en: "Notice" }, icon: "notice" },
];
const OTHER_GRID: Tile[] = [
  { href: "/my-attendance/", text: { hi: "मेरी हाज़िरी", en: "Attendance" }, icon: "myAttendance" },
  { href: "/leave/", text: { hi: "छुट्टी", en: "Leave" }, icon: "leave" },
  { href: "/salary/", text: { hi: "सैलरी", en: "Salary" }, icon: "salary" },
  { href: "/notice/", text: { hi: "सूचना", en: "Notice" }, icon: "notice" },
];
/** ERP login: every module of the ERP website's menu. `soon` until that module is built here, one by one. */
const ERP_GRID: Tile[] = [
  { href: "/erp/report/", text: { hi: "रिपोर्ट", en: "Report" }, icon: "report" },
  { href: "/erp/students/", text: { hi: "बच्चे", en: "Students" }, icon: "students" },
  { href: "/erp/fees/collect/", text: { hi: "फ़ीस", en: "Fees" }, icon: "fees" },
  { href: "/erp/attendance/mark/", text: { hi: "हाज़िरी", en: "Attendance" }, icon: "attendance" },
  { href: "/erp/students/enquiries/", text: { hi: "प्रवेश पूछताछ", en: "Admission Enquiries" }, icon: "admission" },
  { href: "/erp/messages/", text: { hi: "मैसेज", en: "Messages" }, icon: "messages" },
  { href: "/erp/meetings/", text: { hi: "मीटिंग", en: "Meetings" }, icon: "meetings" },
  { href: "/erp/parent-chats/", text: { hi: "अभिभावक चैट", en: "Parent Chats" }, icon: "parentChats" },
  { href: "/erp/exams/marks/", text: { hi: "परीक्षा", en: "Exams" }, icon: "exam" },
  { href: "/erp/timetable/", text: { hi: "टाइम टेबल", en: "Time Table" }, icon: "timetable" },
  { href: "/erp/homework/", text: { hi: "होमवर्क", en: "Homework" }, icon: "homework" },
  { href: "/erp/syllabus/", text: { hi: "सिलेबस", en: "Syllabus" }, icon: "syllabus" },
  { href: "/erp/copy-check/", text: { hi: "कॉपी जाँच", en: "Copy Check" }, icon: "copyCheck" },
  { href: "/erp/staff/", text: { hi: "स्टाफ़", en: "Staff" }, icon: "staff" },
  { href: "/erp/staff/payroll/", text: { hi: "सैलरी", en: "Payroll" }, icon: "salary" },
  { href: "/erp/transport/", text: { hi: "ट्रांसपोर्ट", en: "Transport" }, icon: "bus" },
  { href: "/erp/students/certificates/", text: { hi: "सर्टिफ़िकेट", en: "Certificates" }, icon: "certificate" },
  { href: "/erp/students/id-cards/", text: { hi: "आईडी कार्ड", en: "ID Cards" }, icon: "idCard" },
  { href: "/erp/calendar/", text: { hi: "कैलेंडर", en: "Calendar" }, icon: "calendar" },
  { href: "/erp/birthdays/", text: { hi: "जन्मदिन", en: "Birthdays" }, icon: "birthday" },
];
// Settings is not a tile: it sits at the foot of the side menu (user, 2026-10-16).

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
  // Unread parent messages, unseen notices and unanswered leave requests each put a red count on their tile.
  const { data: chats } = useApi<{ unread: number }>(me?.role === "teacher" ? "/chats/unread" : null);
  const unreadChats = chats?.unread || 0;
  const unread = useUnseenNotices();
  const L = useL();
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

  // The top row stays put on a white strip, as on the parent app (user, 2026-10-24); a soft edge shows under
  // it once something has gone under it.
  const headRef = useRef<HTMLDivElement>(null);
  const ready = !!me && me.role !== "driver";
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (headRef.current) headRef.current.style.boxShadow = window.scrollY > 4 ? "0 4px 12px rgba(15,47,60,0.12)" : "none";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready]);

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

  const grid = isErpMode() ? ERP_GRID : teacher ? TEACHER_GRID : OTHER_GRID;
  const tileCount: Record<string, { n: number; label: Bi }> = {
    "/messages/": { n: unreadChats, label: { hi: "नए संदेश", en: "new messages" } },
    "/notice/": { n: unread, label: { hi: "नई सूचनाएँ", en: "new notices" } },
    "/leave/": { n: teacher ? data?.pendingLeaves || 0 : 0, label: { hi: "अर्ज़ियाँ बाकी", en: "requests waiting" } },
  };

  // Lectures: the one going on now, and those still to come.
  const lessons = data?.lessons || [];
  const nowIdx = lessons.findIndex((l) => l.start <= now && now < l.end);
  const nextIdx = lessons.findIndex((l) => l.start > now);
  const shown = lessons.filter((l) => l.end > now);

  return (
    <div className={clsx("animate-fadeIn", calm && "calm")}>
      {/* The top row on a white strip, as on the parent app: menu, the greeting, then notices and the staff
          member. Language is in the side menu and Profile. */}
      <div ref={headRef} className="pt-safe sticky top-0 z-20 bg-white px-4 pb-2 transition-shadow duration-300">
        <div className="enter flex items-center gap-1.5 pt-3" style={v(0)}>
          <button type="button" onClick={openMenu} aria-label={L({ hi: "मेन्यू", en: "Menu" })} aria-haspopup="dialog" className="-ml-2 grid h-11 w-10 shrink-0 place-items-center rounded-full text-ink-900 active:bg-ink-100">
            <MenuIcon className="h-6 w-6" strokeWidth={2} aria-hidden />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[19px] font-bold leading-tight text-ink-900">
            <span className="reveal">
              <span style={v(0)}>{greet},</span>
            </span>{" "}
            <span className="reveal">
              <span style={v(1)}>{first}</span>
            </span>
          </h1>
          <Link href="/notice/" className="relative grid h-10 w-9 shrink-0 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={unread ? `${unread} ${L({ hi: "नई सूचनाएँ", en: "new notices" })}` : L({ hi: "सूचनाएँ", en: "Notices" })}>
            <Bell className={clsx("h-[21px] w-[21px]", unread > 0 && "bell-ring")} strokeWidth={2} aria-hidden />
            {unread > 0 && <CountBadge n={unread} className="absolute -right-1.5 -top-0.5" />}
          </Link>
          <Link href="/profile/" className="shrink-0 rounded-full ring-2 ring-white shadow-sm transition-transform duration-300 active:scale-90" aria-label={L({ hi: "प्रोफ़ाइल", en: "Profile" })}>
            <Avatar name={me.name} url={me.photoUrl} size={38} tint={0} />
          </Link>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* The school's banner, then search under it (as on the parent app). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isErpMode() ? "/home-top-erp.jpg" : "/home-top.jpeg"}
          alt={isErpMode() ? L({ hi: "एडमिन पोर्टल – आपका स्कूल, आपके हाथ में", en: "Admin portal – your school, in your control" }) : L({ hi: "स्टाफ पोर्टल – सेंट पॉल स्कूल", en: "Staff portal – St. Paul School" })}
          className="enter aspect-[1366/768] w-full rounded-2xl border border-ink-100 bg-ink-100 object-cover" style={v(3)} />
        {teacher && (
          <Link href={isErpMode() ? "/erp/students/?search=1" : "/students/?search=1"} className="enter mt-3.5 flex h-12 items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-4 text-ink-500 shadow-sm" style={v(3)} aria-label={L({ hi: "बच्चे खोजें", en: "Search students" })}>
            <Search className="h-[18px] w-[18px] shrink-0 text-ink-700" strokeWidth={2.2} aria-hidden />
            <span className="truncate text-[14.5px]">{L({ hi: "बच्चे का नाम या SR नंबर खोजें", en: "Search a student by name or SR no." })}</span>
          </Link>
        )}
      </div>

      <div className="space-y-6 px-4 pt-4">
        <OfflineNote show={stale && !!me} />
        {error && error.status !== 401 && !data && <ErrorCard offline={error.status === 0} onRetry={reload} />}

        <div>
          <Today data={data} teacher={teacher} />
        </div>

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
          <div className="grid grid-cols-4 gap-x-1 gap-y-3">
            {(more ? grid : grid.slice(0, 4)).map(({ href, text, icon, soon }, k) =>
              soon ? (
                // Not built yet in the app: drawn muted, a tap says so.
                <button key={href} type="button" onPointerDown={ripple} onClick={() => toast(false, `${L(text)}: ${L({ hi: "जल्द आ रहा है", en: "coming soon" })}`)} className="quick-tile pop-in !text-ink-400" style={v(k)}>
                  <span className="relative opacity-40 grayscale">
                    <QuickIcon name={icon} size={48} />
                  </span>
                  {L(text)}
                </button>
              ) : (
              <Link key={href} href={href} onPointerDown={ripple} className="quick-tile pop-in" style={v(k)}>
                <span className="relative">
                  <QuickIcon name={icon} size={48} />
                  {tileCount[href]?.n > 0 && <CountBadge n={tileCount[href].n} label={`${tileCount[href].n} ${L(tileCount[href].label)}`} className="absolute -right-2 -top-2" />}
                </span>
                {L(text)}
              </Link>
              )
            )}
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

  // Their own attendance, marked by the office. The icon stays the same every day (as on the parent app);
  // the state is told in the words.
  const m = data.myMark;
  const myNote =
    m === "P"
      ? L({ hi: "आज उपस्थित", en: "Present today" })
      : m === "A"
        ? L({ hi: "आज अनुपस्थित", en: "Absent today" })
        : m === "L"
          ? L({ hi: "आज छुट्टी पर", en: "On leave today" })
          : m === "H"
            ? L({ hi: "आज आधा दिन", en: "Half day today" })
            : L({ hi: "अभी हाज़िरी नहीं लगी", en: "Not marked yet" });
  const blue = (name: QuickIconName) => <QuickIcon name={name} tone="blue" size={48} />;
  const myRow = (i: number) => <TodayRow i={i} href="/my-attendance/" icon={blue("myAttendance")} title={L({ hi: "मेरी हाज़िरी", en: "My attendance" })} note={myNote} />;

  const open = data.attendanceToMark[0];
  const rows = teacher ? (
    <>
      <TodayRow
        i={4}
        href={open ? `/attendance/?id=${open.id}` : "/attendance/"}
        icon={blue("attendance")}
        title={L({ hi: "हाज़िरी", en: "Attendance" })}
        note={
          open
            ? open.remindedAt
              ? L({ hi: `ऑफ़िस ने याद दिलाया · ${open.classSec} की बाकी`, en: `Office reminder · ${open.classSec} not marked` })
              : L({ hi: `${open.classSec} की बाकी है`, en: `${open.classSec} not marked` })
            : L({ hi: "सब लग गई", en: "All marked" })
        }
        end={open ? <span className="pay-pulse rounded-full bg-[#b01003] px-3.5 py-2 text-[13.5px] font-semibold text-white">{L({ hi: "अभी लगाएँ", en: "Mark now" })}</span> : null}
      />
      <TodayRow
        i={5}
        href="/leave/?tab=requests"
        icon={blue("leave")}
        title={L({ hi: "छुट्टी की अर्ज़ियाँ", en: "Leave requests" })}
        note={data.pendingLeaves ? L({ hi: `${data.pendingLeaves} जवाब बाकी`, en: `${data.pendingLeaves} waiting` }) : L({ hi: "कोई अर्ज़ी नहीं", en: "None waiting" })}
        end={data.pendingLeaves ? <CountBadge n={data.pendingLeaves} label={L({ hi: `${data.pendingLeaves} अर्ज़ियाँ बाकी`, en: `${data.pendingLeaves} waiting` })} /> : null}
      />
      {myRow(6)}
    </>
  ) : (
    <>
      {myRow(4)}
      <TodayRow
        i={5}
        href="/leave/"
        icon={blue("leave")}
        title={L({ hi: "छुट्टी", en: "Leave" })}
        note={L({ hi: "अर्ज़ी दें या देखें", en: "Apply or check" })}
        end={<span className="text-[14.5px] font-semibold text-brand-600">{L({ hi: "देखें", en: "View" })}</span>}
      />
      <TodayRow
        i={6}
        href="/salary/"
        icon={blue("salary")}
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

function TodayRow({ i, href, icon, title, note, end }: { i: number; href: string; icon: React.ReactNode; title: string; note: string; end?: React.ReactNode }) {
  return (
    <li className="enter border-b border-ink-100 last:border-0" style={v(i)}>
      <Link href={href} onPointerDown={ripple} className="relative -mx-4 flex min-h-[72px] items-center gap-3.5 overflow-hidden px-4 py-3">
        <span className="h-12 w-12 shrink-0">{icon}</span>
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