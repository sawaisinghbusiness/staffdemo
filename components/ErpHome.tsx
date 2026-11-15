"use client";

/**
 * ERP-login Home in the Staff Home design (user, 2026-11-15: the old orange icon tiles go).
 * The top stays as before (banner + search); then the eight most-used ERP modules as picture tiles (the rest are in the side menu) in StaffHome's style; "Today at school" from
 * GET /erp/dashboard (the ERP's own dashboard figures).
 *
 * Each tile's picture is /img/tiles/erp/<art>.webp (transparent WebP, 128px tall, same glossy style as
 * /img/tiles). Until a picture is added, the tile shows a soft placeholder; dropping the file in is enough.
 */

import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-devanagari";
import "./staff-home.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Cake, CalendarCheck, ChevronRight, IndianRupee, Menu as MenuIcon, PhoneCall, RotateCw, Search, UserX, WifiOff } from "lucide-react";
import { useStaff } from "@/lib/staff";
import { useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { useMenu } from "@/lib/menu";
import { useUnseenNotices } from "@/lib/counts";
import { fmt, money, type Dashboard } from "@/lib/erpDashboard";
import { Avatar, CountBadge } from "./ui";

const INK = "#242628";
const MUTED = "#666A6E";
const LINE = "#DCE4ED";
const TILE = "#F3F4F4";

type Fx = "slide" | "rise" | "tilt" | "grow";
type Tile = { href: string; art: string; fx: Fx; text: Bi };

/** The modules the office opens most (user, 2026-11-15); every other module is in the side menu. `art` names the picture file. */
const TILES: Tile[] = [
  { href: "/erp/report/", art: "report", fx: "rise", text: { hi: "रिपोर्ट", en: "Report" } },
  { href: "/erp/students/", art: "students", fx: "slide", text: { hi: "बच्चे", en: "Students" } },
  { href: "/erp/fees/collect/", art: "fees", fx: "tilt", text: { hi: "फ़ीस", en: "Fees" } },
  { href: "/erp/attendance/mark/", art: "attendance", fx: "grow", text: { hi: "हाज़िरी", en: "Attendance" } },
  { href: "/erp/students/enquiries/", art: "enquiries", fx: "rise", text: { hi: "प्रवेश पूछताछ", en: "Enquiries" } },
  { href: "/erp/exams/marks/", art: "exams", fx: "tilt", text: { hi: "परीक्षा", en: "Exams" } },
  { href: "/erp/homework/", art: "homework", fx: "rise", text: { hi: "होमवर्क", en: "Homework" } },
  { href: "/erp/transport/", art: "transport", fx: "slide", text: { hi: "ट्रांसपोर्ट", en: "Transport" } },
];

export function ErpHome() {
  const { me, stale } = useStaff();
  const { data: res, error, stale: dashStale, reload } = useApi<{ data: Dashboard }>(me ? "/erp/dashboard" : null);
  const dash = res?.data;
  const unread = useUnseenNotices();
  const L = useL();
  const { openMenu } = useMenu();
  const hour = new Date().getHours();
  const greet = hour < 12 ? L({ hi: "सुप्रभात", en: "Good morning" }) : hour < 17 ? L({ hi: "नमस्ते", en: "Good afternoon" }) : L({ hi: "नमस्ते", en: "Good evening" });
  const first = me?.name.split(" ")[0] || "";
  const failed = error && error.status !== 401 && !dash ? error : null;

  // The top row stays put on a white strip; a soft edge shows under it once something has gone under it.
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
  }, []);

  return (
    <div className="staff-home erp-home pb-6" style={{ color: INK }}>
      {/* Kept as it was (user, 2026-11-15): menu, greeting, notices, profile; the "your school, in your control" banner; search. */}
      <div ref={headRef} className="erp-home-masthead pt-safe sticky top-0 z-20 bg-white px-4 pb-2 transition-shadow duration-300">
        <div className="flex items-center gap-1.5 pt-3">
          <button type="button" onClick={openMenu} aria-label={L({ hi: "मेन्यू", en: "Menu" })} aria-haspopup="dialog" className="-ml-2 grid h-11 w-10 shrink-0 place-items-center rounded-full text-ink-900 active:bg-ink-100">
            <MenuIcon className="h-6 w-6" strokeWidth={2} aria-hidden />
          </button>
          <h1 className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] font-medium text-ink-500">{greet}</span>
            <span className="block truncate text-[17px] font-bold text-ink-900">{first}</span>
          </h1>
          <Link href="/notice/" className="relative grid h-10 w-9 shrink-0 place-items-center rounded-full text-ink-900 active:bg-ink-100" aria-label={unread ? `${unread} ${L({ hi: "नई सूचनाएँ", en: "new notices" })}` : L({ hi: "सूचनाएँ", en: "Notices" })}>
            <Bell className="h-[21px] w-[21px]" strokeWidth={2} aria-hidden />
            {unread > 0 && <CountBadge n={unread} className="absolute -right-1.5 -top-0.5" />}
          </Link>
          <Link href="/profile/" className="shrink-0 rounded-full ring-2 ring-white shadow-sm active:scale-90" aria-label={L({ hi: "प्रोफ़ाइल", en: "Profile" })}>
            {me && <Avatar name={me.name} url={me.photoUrl} size={38} tint={0} />}
          </Link>
        </div>
      </div>

      <div className="erp-home-content space-y-6 px-4 pt-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home-top-erp.webp" alt={L({ hi: "एडमिन पोर्टल – आपका स्कूल, आपके हाथ में", en: "Admin portal – your school, in your control" })} className="aspect-[1366/768] w-full rounded-2xl border border-ink-100 bg-ink-100 object-cover" />
          <Link href="/erp/students/?search=1" className="mt-3.5 flex h-12 items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-4 text-ink-500 shadow-sm" aria-label={L({ hi: "बच्चे खोजें", en: "Search students" })}>
            <Search className="h-[18px] w-[18px] shrink-0 text-ink-700" strokeWidth={2.2} aria-hidden />
            <span className="truncate text-[14.5px]">{L({ hi: "बच्चे का नाम या SR नंबर खोजें", en: "Search a student by name or SR no." })}</span>
          </Link>
        </div>

        {(stale || dashStale) && me && (
          <p className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px]" style={{ background: TILE, color: MUTED }}>
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            {L({ hi: "इंटरनेट नहीं है, पिछली बार की जानकारी दिख रही है।", en: "You're offline. Showing what was saved last time." })}
          </p>
        )}

        {/* ── Eight modules, four to a row; the rest are in the side menu ── */}
        <div className="grid grid-cols-4 gap-2 border-b pb-5" style={{ borderColor: LINE }}>
          {TILES.map((t, i) => (
            <Link key={t.href} href={t.href} className="home-tile relative flex h-[76px] flex-col items-center justify-between overflow-hidden rounded-[10px] border px-0.5 pt-1.5 active:opacity-80" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <span className="line-clamp-2 text-center text-[11px] font-bold leading-[1.15]">{L(t.text)}</span>
              <Art art={t.art} fx={t.fx} delay={Math.min(i, 8) * 60 + 150} />
            </Link>
          ))}
        </div>

        {failed && (
          <div className="flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3.5" style={{ borderColor: LINE }}>
            <p className="min-w-0 flex-1 text-[13.5px]" style={{ color: MUTED }}>
              {failed.status === 0 ? L({ hi: "इंटरनेट नहीं है।", en: "No internet connection." }) : L({ hi: "आज की जानकारी नहीं आ पाई।", en: "Couldn't load today's figures." })}
            </p>
            <button type="button" onClick={reload} className="flex min-h-[40px] items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold text-white" style={{ background: INK }}>
              <RotateCw className="h-4 w-4" aria-hidden />
              {L({ hi: "फिर से", en: "Retry" })}
            </button>
          </div>
        )}

        {dash ? <TodayAtSchool d={dash} /> : !failed && <TodaySkeleton />}
      </div>
    </div>
  );
}

/** The module's picture; a soft placeholder until its file exists. */
function Art({ art, fx, delay }: { art: string; fx: Fx; delay: number }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="mb-1.5 h-[34px] w-[38px] rounded-[8px] border border-dashed border-[#B9C6E6] bg-white/50" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/img/tiles/erp/${art}.webp`} alt="" onError={() => setMissing(true)} className={`home-art-${fx} h-[42px] max-w-full object-contain object-bottom`} style={{ animationDelay: `${delay}ms` }} />
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="block h-5 w-36 animate-pulse rounded" style={{ background: TILE }} />
      {[0, 1, 2].map((k) => (
        <span key={k} className="block h-[60px] animate-pulse rounded-[10px]" style={{ background: TILE }} />
      ))}
    </div>
  );
}

/** What the office checks each morning, from the ERP dashboard: each row opens its list. */
function TodayAtSchool({ d }: { d: Dashboard }) {
  const L = useL();
  const a = d.attention;
  const left = Math.max(a.sectionsTotal - a.sectionsMarkedToday, 0);
  const absent = d.attendance?.today.absent ?? 0;
  const followUps = d.admissions?.enquiries.followUpsDue ?? 0;
  const bdays = a.birthdaysToday.length;

  const rows = [
    {
      href: "/erp/attendance/mark/",
      icon: CalendarCheck,
      label: L({ hi: "कक्षाओं की हाज़िरी", en: "Class attendance" }),
      detail: left ? L({ hi: `${a.sectionsTotal} में से ${left} कक्षाओं की बाकी`, en: `${left} of ${a.sectionsTotal} classes not marked` }) : L({ hi: "सब कक्षाओं की लग गई", en: "All classes marked" }),
      value: left ? String(left) : "",
      warn: left > 0,
    },
    {
      href: "/erp/attendance/today/",
      icon: UserX,
      label: L({ hi: "आज अनुपस्थित", en: "Absent today" }),
      detail: absent ? L({ hi: "नाम और कक्षा देखें", en: "See names and classes" }) : L({ hi: "अभी कोई नहीं", en: "No one so far" }),
      value: absent ? fmt(absent) : "",
      warn: false,
    },
    {
      href: "/erp/fees/receipts/",
      icon: IndianRupee,
      label: L({ hi: "आज जमा फ़ीस", en: "Fees collected today" }),
      detail: d.today.receipts ? L({ hi: `${fmt(d.today.receipts)} रसीदें`, en: `${fmt(d.today.receipts)} receipts` }) : L({ hi: "आज अभी कोई रसीद नहीं", en: "No receipts yet today" }),
      value: d.today.amount ? money(d.today.amount) : "",
      warn: false,
    },
    {
      href: followUps ? "/erp/students/enquiries/?view=due" : "/erp/students/enquiries/",
      icon: PhoneCall,
      label: L({ hi: "पूछताछ पर फ़ॉलो-अप", en: "Enquiry follow-ups" }),
      detail: followUps ? L({ hi: "आज फ़ोन करना है", en: "Due to call today" }) : L({ hi: "कोई बाकी नहीं", en: "None due" }),
      value: followUps ? fmt(followUps) : "",
      warn: followUps > 0,
    },
    {
      href: "/erp/birthdays/",
      icon: Cake,
      label: L({ hi: "आज जन्मदिन", en: "Birthdays today" }),
      detail: bdays ? a.birthdaysToday.slice(0, 2).map((b) => `${b.name} (${b.classSec})`).join(", ") + (bdays > 2 ? ` +${bdays - 2}` : "") : L({ hi: "आज किसी का नहीं", en: "None today" }),
      value: bdays ? String(bdays) : "",
      warn: false,
    },
  ];

  return (
    <section aria-labelledby="erp-today-title">
      <h2 id="erp-today-title" className="mb-3 text-[18px] font-semibold">
        {L({ hi: "आज की जानकारी", en: "Today at school" })}
      </h2>
      <ul className="home-updates">
        {rows.map(({ href, icon: Icon, label, detail, value, warn }) => (
          <li key={label}>
            <Link href={href} className="home-update">
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.7} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{label}</span>
                <span className="mt-1 block break-words text-[12px] leading-5" style={{ color: warn ? "#9A5B00" : MUTED }}>
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
