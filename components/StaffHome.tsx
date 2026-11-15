"use client";

/**
 * Staff Home (teachers and other staff) in the parent app's design, approved 2026-11-13 after a
 * /home-new preview. The ERP-login Home and the driver's Home are separate (see app/(app)/page.tsx).
 *
 * Same pieces as the parent Home: the school photo header (sinks behind the cards on scroll), the person's
 * card over its edge, four plain tiles, "Today at school" (what still needs doing, in amber when it does),
 * and today's lectures laid out like the parent app's Upcoming Events. The other shortcuts stay in the
 * side menu (user, 2026-11-13).
 */

import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-devanagari";
import "./staff-home.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Banknote, Bell, CalendarCheck, CalendarX2, ChevronRight, Clock, MessageCircle, RotateCw, WifiOff } from "lucide-react";
import { useStaff } from "@/lib/staff";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { clock, initials } from "@/lib/format";
import { useMenu } from "@/lib/menu";
import { useUnseenNotices } from "@/lib/counts";

const INK = "#242628";
const MUTED = "#666A6E";
const LINE = "#DCE4ED";
const TILE = "#F3F4F4";

interface Lesson {
  id: string;
  label: string;
  start: string;
  end: string;
  classSec: string;
  subject: string;
}
interface HomeData {
  date: string;
  myMark: "P" | "A" | "L" | "H" | null;
  lessons: Lesson[];
  attendanceToMark: { id: string; classSec: string; remindedAt?: string }[];
  pendingLeaves: number;
  noticeCount?: number;
}

/** The parent app's scroll effect: the photo moves at half speed and darkens; the greeting fades. */
function useHeroScroll() {
  const img = useRef<HTMLImageElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const y = Math.min(Math.max(window.scrollY, 0), 320);
      if (img.current) img.current.style.transform = `translate3d(0, ${y * 0.5}px, 0) scale(${1 + y / 2400})`;
      if (shade.current) shade.current.style.opacity = String(Math.min(y / 260, 1) * 0.55);
      if (text.current) {
        text.current.style.opacity = String(Math.max(1 - y / 200, 0));
        text.current.style.transform = `translate3d(0, ${y * 0.25}px, 0)`;
      }
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
  }, []);
  return { img, shade, text };
}

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function StaffHome() {
  const fx = useHeroScroll();
  const { me, stale } = useStaff();
  const teacher = me?.role === "teacher";
  const { data, error, stale: homeStale, reload } = useApi<HomeData>(me ? "/home" : null);
  const { data: chats } = useApi<{ unread: number }>(teacher ? "/chats/unread" : null);
  const unread = useUnseenNotices();
  const L = useL();
  const { openMenu } = useMenu();
  const school = me?.school;
  const town = school?.address?.split(",").map((s) => s.trim()).filter(Boolean).pop() || "";
  const [now, setNow] = useState("09:00");
  useEffect(() => {
    setNow(nowHHMM());
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hour = +now.slice(0, 2);
  const first = me?.name.split(" ")[0] || "";
  const greet = hour < 12 ? L({ hi: "सुप्रभात", en: "Good Morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good Afternoon" }) : L({ hi: "शुभ संध्या", en: "Good Evening" });
  const failed = error && error.status !== 401 && !data ? error : null;

  // The class this teacher is class teacher of, for the card ("Class teacher · 5-A").
  const ownClass = me?.sections.find((s) => s.classTeacher)?.classSec;

  // Each tile shows the school's own illustration, arriving in its own way (fx, see staff-home.css), as on the parent app.
  const tiles: { href: string; art: string; fx: "slide" | "rise" | "tilt" | "grow"; t: string; n?: number }[] = teacher
    ? [
        { href: "/attendance/", art: "attendance", fx: "grow", t: L({ hi: "हाज़िरी", en: "Attendance" }) },
        { href: "/homework/", art: "homework", fx: "rise", t: L({ hi: "होमवर्क", en: "Homework" }) },
        { href: "/students/", art: "students", fx: "slide", t: L({ hi: "बच्चे", en: "Students" }) },
        { href: "/marks/", art: "marks", fx: "tilt", t: L({ hi: "अंक", en: "Marks" }) },
      ]
    : [
        { href: "/my-attendance/", art: "my-attendance", fx: "rise", t: L({ hi: "मेरी हाज़िरी", en: "Attendance" }) },
        { href: "/leave/", art: "leave", fx: "grow", t: L({ hi: "छुट्टी", en: "Leave" }) },
        { href: "/salary/", art: "salary", fx: "tilt", t: L({ hi: "सैलरी", en: "Salary" }) },
        { href: "/notice/", art: "notice", fx: "slide", t: L({ hi: "सूचना", en: "Notice" }), n: unread },
      ];

  return (
    <div className="staff-home" style={{ color: INK }}>
      {/* School photograph fades into the cool Home background, as on the parent app. */}
      <header className="relative h-[calc(210px+env(safe-area-inset-top,0px))] overflow-hidden bg-[#25282A]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={fx.img} src={school?.heroUrl || "/img/school-hero-morning.webp"} alt="" className="absolute inset-0 h-full w-full object-cover object-[72%_60%] will-change-transform" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(18,22,24,.52) 0%, rgba(18,22,24,.36) 45%, rgba(18,22,24,.12) 75%, rgba(18,22,24,0) 100%)" }} />
        <div className="absolute inset-x-0 top-0 h-[130px]" style={{ background: "linear-gradient(180deg, rgba(18,22,24,.28) 0%, rgba(18,22,24,0) 100%)" }} />
        <div ref={fx.shade} className="absolute inset-0 bg-[#25282A] opacity-0" aria-hidden />
        <div className="home-photo-fade absolute inset-x-0 bottom-0 h-[60px]" />

        <div ref={fx.text} className="pt-safe relative z-[1] px-4 will-change-[opacity,transform]">
          <div className="flex items-center pt-5">
            {/* The school (logo and name) opens the side menu, where the other shortcuts live. */}
            <button type="button" onClick={openMenu} aria-haspopup="dialog" aria-label={L({ hi: "मेन्यू", en: "Menu" })} className="flex min-w-0 flex-1 items-center text-left active:opacity-80">
              {school?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={school.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full bg-white object-cover ring-1 ring-white/50" />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/50 text-[12px] font-semibold text-white">{school ? initials(school.name) : ""}</span>
              )}
              <span className="mx-2 h-6 w-px shrink-0 bg-white/35" aria-hidden />
              <span className="min-w-0 flex-1 text-white">
                <span className="block truncate text-[14px] font-semibold leading-[1.2]">{school?.name || " "}</span>
                <span className="mt-0.5 block truncate text-[12px] font-medium text-white/85">{town}</span>
              </span>
            </button>
            <Link href="/notice/" className="relative grid h-11 w-11 shrink-0 place-items-center text-white" aria-label={unread ? `${L({ hi: "सूचनाएँ", en: "Notices" })}, ${unread} ${L({ hi: "नई", en: "new" })}` : L({ hi: "सूचनाएँ", en: "Notices" })}>
              <Bell className="h-[26px] w-[26px]" strokeWidth={1.9} aria-hidden />
              {unread > 0 && (
                <span className="absolute right-[3px] top-[4px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#E53935] px-1 text-[10.5px] font-semibold leading-none text-white ring-2 ring-[#25282A]" aria-hidden>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
          <div className="mt-5 max-w-full text-white">
            <div className="truncate text-[19px] font-medium leading-snug">
              {greet}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-[2] -mt-[48px] space-y-6 px-5">
        {/* ── The staff member's card: photo, name, role, today's own attendance ── */}
        <Link href="/profile/" className="-mx-2 flex min-h-[96px] w-[calc(100%+1rem)] items-stretch rounded-[14px] border bg-white py-2" style={{ borderColor: LINE }}>
          <span className="grid w-[76px] shrink-0 place-items-center">{me && <Photo key={me.empCode} name={me.name} url={me.photoUrl || null} />}</span>
          <span className="flex min-w-0 flex-1 flex-col justify-center pr-1 text-left">
            <span className="break-words text-[19px] font-semibold leading-6">{me?.name}</span>
            <span className="mt-1 break-words text-[12px] leading-5" style={{ color: MUTED }}>
              {me ? L(me.roleLabel) : ""}
              {ownClass ? `  •  ${L({ hi: "कक्षा अध्यापक", en: "Class teacher" })} ${ownClass}` : ""}
            </span>
            {data && <MyToday data={data} />}
          </span>
          <span className="grid w-8 shrink-0 place-items-center">
            <ChevronRight className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </span>
        </Link>

        {(stale || homeStale) && me && (
          <p className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px]" style={{ background: TILE, color: MUTED }}>
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            {L({ hi: "इंटरनेट नहीं है, पिछली बार की जानकारी दिख रही है।", en: "You're offline. Showing what was saved last time." })}
          </p>
        )}
        {failed && (
          <div className="flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3.5" style={{ borderColor: LINE }}>
            <p className="min-w-0 flex-1 text-[13.5px]" style={{ color: MUTED }}>
              {failed.status === 0 ? L({ hi: "इंटरनेट नहीं है।", en: "No internet connection." }) : L({ hi: "जानकारी नहीं आ पाई।", en: "Couldn't load your details." })}
            </p>
            <button type="button" onClick={reload} className="flex min-h-[40px] items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold text-white" style={{ background: INK }}>
              <RotateCw className="h-4 w-4" aria-hidden />
              {L({ hi: "फिर से", en: "Retry" })}
            </button>
          </div>
        )}

        {/* ── Four tiles; the rest of the shortcuts are in the side menu ── */}
        <div className="grid grid-cols-4 gap-2 border-b pb-5" style={{ borderColor: LINE }}>
          {tiles.map(({ href, art, fx, t, n }, i) => (
            <Link key={href} href={href} className="home-tile relative flex h-[68px] flex-col items-center justify-between overflow-hidden rounded-[10px] border px-0.5 pt-1.5 active:opacity-80" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="text-[11.5px] font-bold leading-[1.15]">{t}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/img/tiles/${art}.webp`} alt="" className={`home-art-${fx} h-[42px] max-w-full object-contain object-bottom`} style={{ animationDelay: `${i * 80 + 150}ms` }} />
              {!!n && <span className="absolute right-1 top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[#E53935] px-1 text-[10px] font-semibold leading-none text-white">{n > 9 ? "9+" : n}</span>}
            </Link>
          ))}
        </div>

        {data && <TodaySummary data={data} teacher={teacher} unreadChats={chats?.unread || 0} />}

        {teacher && <Lectures data={data} now={now} />}
      </div>
    </div>
  );
}

/** A failed photo falls back to initials; a new URL gets a fresh attempt. */
function Photo({ name, url }: { name: string; url: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && failedUrl !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setFailedUrl(url)} className="h-[56px] w-[56px] rounded-full object-cover object-[50%_22%] ring-2 ring-white" />
  ) : (
    <span className="grid h-[56px] w-[56px] place-items-center rounded-full text-[19px] font-semibold text-white" style={{ background: INK }}>
      {initials(name)}
    </span>
  );
}

/** Never shows an earlier cached day as today. */
function isToday(date: string) {
  return date === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** "Today · Present" under the name: the staff member's own attendance, marked by the office. */
function MyToday({ data }: { data: HomeData }) {
  const L = useL();
  if (!isToday(data.date)) return null;
  const m = data.myMark;
  const word = m === "P" ? L({ hi: "उपस्थित", en: "Present" }) : m === "A" ? L({ hi: "अनुपस्थित", en: "Absent" }) : m === "L" ? L({ hi: "छुट्टी", en: "On leave" }) : m === "H" ? L({ hi: "आधा दिन", en: "Half day" }) : L({ hi: "हाज़िरी अभी नहीं लगी", en: "Attendance not marked" });
  const color = m === "P" ? "#21613F" : m === "A" ? "#A32F35" : MUTED;
  return (
    <span className="mt-2 flex items-baseline gap-1.5 text-[12px] leading-5" style={{ color }}>
      <span>{L({ hi: "आज", en: "Today" })}</span>
      <span aria-hidden>·</span>
      <span className="font-semibold">{word}</span>
    </span>
  );
}

/** What still needs doing today, in the parent app's plain rows. */
function TodaySummary({ data, teacher, unreadChats }: { data: HomeData; teacher: boolean; unreadChats: number }) {
  const L = useL();
  if (!isToday(data.date)) return null;
  const open = data.attendanceToMark;
  const rows = teacher
    ? [
        {
          href: open[0] ? `/attendance/?id=${open[0].id}` : "/attendance/",
          label: L({ hi: "कक्षा की हाज़िरी", en: "Class attendance" }),
          value: open.length ? String(open.length) : "",
          detail: open.length
            ? open[0].remindedAt
              ? L({ hi: `ऑफ़िस ने याद दिलाया · ${open.map((o) => o.classSec).join(", ")} बाकी`, en: `Office reminder · ${open.map((o) => o.classSec).join(", ")} not marked` })
              : L({ hi: `${open.map((o) => o.classSec).join(", ")} की हाज़िरी बाकी`, en: `${open.map((o) => o.classSec).join(", ")} not marked yet` })
            : L({ hi: "सब लग गई", en: "All marked" }),
          icon: CalendarCheck,
        },
        {
          href: "/leave/?tab=requests",
          label: L({ hi: "छुट्टी की अर्ज़ियाँ", en: "Leave requests" }),
          value: data.pendingLeaves ? String(data.pendingLeaves) : "",
          detail: data.pendingLeaves ? L({ hi: "जवाब देना बाकी", en: "Waiting for your answer" }) : L({ hi: "कोई अर्ज़ी बाकी नहीं", en: "None waiting" }),
          icon: CalendarX2,
        },
        {
          href: "/messages/",
          label: L({ hi: "अभिभावकों की पूछताछ", en: "Parent enquiries" }),
          value: unreadChats ? String(unreadChats) : "",
          detail: unreadChats ? L({ hi: "नए संदेश", en: "New messages" }) : L({ hi: "कोई नया संदेश नहीं", en: "No new messages" }),
          icon: MessageCircle,
        },
      ]
    : [
        { href: "/leave/", label: L({ hi: "छुट्टी", en: "Leave" }), value: "", detail: L({ hi: "अर्ज़ी दें या देखें", en: "Apply or check" }), icon: CalendarX2 },
        { href: "/salary/", label: L({ hi: "सैलरी", en: "Salary" }), value: "", detail: L({ hi: "सैलरी स्लिप देखें", en: "View salary slips" }), icon: Banknote },
      ];
  return (
    <section aria-labelledby="today-title">
      <h2 id="today-title" className="mb-3 text-[18px] font-semibold">
        {L({ hi: "आज की जानकारी", en: "Today at school" })}
      </h2>
      <ul className="home-updates">
        {rows.map(({ href, label, value, detail, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="home-update">
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.7} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{label}</span>
                <span className="mt-1 block break-words text-[12px] leading-5" style={{ color: MUTED }}>
                  {detail}
                </span>
              </span>
              {value && <span className="max-w-[40%] break-words text-right text-[18px] font-semibold tabular-nums">{value}</span>}
              <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Today's lectures still to come, laid out like the parent app's Upcoming Events: the time on the left. */
function Lectures({ data, now }: { data: HomeData | undefined; now: string }) {
  const L = useL();
  const lessons = data?.lessons || [];
  const nowIdx = lessons.findIndex((l) => l.start <= now && now < l.end);
  const nextIdx = lessons.findIndex((l) => l.start > now);
  const shown = lessons.filter((l) => l.end > now).slice(0, 3);
  return (
    <section className="border-t pt-2" style={{ borderColor: LINE }}>
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <h2 className="min-w-0 text-[18px] font-semibold leading-6">{L({ hi: "आज की कक्षाएँ", en: "Today's lectures" })}</h2>
        <Link href="/lectures/" className="flex min-h-11 shrink-0 items-center text-[13px] font-medium" style={{ color: INK }}>
          {L({ hi: "सब देखें", en: "View All" })}
        </Link>
      </div>
      {!data ? (
        <div className="flex min-h-[72px] items-center gap-3 py-3" aria-busy="true">
          <span className="h-[38px] w-11 shrink-0 animate-pulse rounded-[10px]" style={{ background: TILE }} />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-40 animate-pulse rounded" style={{ background: TILE }} />
            <span className="block h-3 w-28 animate-pulse rounded" style={{ background: TILE }} />
          </span>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-3.5 text-[13.5px]" style={{ color: MUTED }}>
          {lessons.length ? L({ hi: "आज की सारी कक्षाएँ हो गईं।", en: "All of today's classes are done." }) : L({ hi: "आज आपकी कोई कक्षा नहीं है।", en: "You have no classes today." })}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: LINE }}>
          {shown.map((l) => {
            const i = lessons.indexOf(l);
            const tag = i === nowIdx ? L({ hi: "अभी", en: "Now" }) : i === nextIdx ? L({ hi: "अगली", en: "Next" }) : "";
            return (
              <li key={l.id} style={{ borderColor: LINE }}>
                <Link href="/lectures/" className="flex min-h-[72px] items-center gap-3 py-3">
                  <span className="flex w-11 shrink-0 flex-col items-center justify-center self-start pt-0.5 leading-none" style={{ color: MUTED }}>
                    <span className="text-[17px] font-medium tabular-nums" style={{ color: INK }}>
                      {clock(l.start)}
                    </span>
                    <span className="mt-1 text-[12px]">{+l.start.slice(0, 2) < 12 ? "AM" : "PM"}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="break-words text-[15px] font-medium leading-5">
                        {l.subject} · {l.classSec}
                      </span>
                      {tag && (
                        <span className="shrink-0 rounded-full px-2 py-[1px] text-[11px] font-semibold" style={i === nowIdx ? { background: "#E8F1EC", color: "#21613F" } : { background: TILE, color: MUTED }}>
                          {tag}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: MUTED }}>
                      <Clock className="h-[14px] w-[14px] shrink-0" strokeWidth={2} aria-hidden />
                      {clock(l.start)} – {clock(l.end)}
                      {l.label ? ` · ${l.label}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
