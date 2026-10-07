"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Banknote, CalendarCheck, CalendarOff, ChevronRight, Clock, LogOut, Users, type LucideIcon } from "lucide-react";
import { api, clearCache } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang, type Bi } from "@/lib/i18n";
import { phoneText } from "@/lib/format";
import { CallOffice } from "@/components/ui";

const LINKS: { href: string; icon: LucideIcon; title: Bi; sub: Bi; teacherOnly?: boolean }[] = [
  { href: "/me/attendance/", icon: CalendarCheck, title: { hi: "मेरी हाज़िरी", en: "My attendance" }, sub: { hi: "महीने का कैलेंडर", en: "Month calendar" } },
  { href: "/me/timetable/", icon: Clock, title: { hi: "मेरी टाइम टेबल", en: "My timetable" }, sub: { hi: "पूरे हफ़्ते की कक्षाएँ", en: "Classes for the whole week" }, teacherOnly: true },
  { href: "/me/requests/", icon: Users, title: { hi: "बच्चों की छुट्टी की अर्ज़ियाँ", en: "Students' leave applications" }, sub: { hi: "मंज़ूर या नामंज़ूर करें", en: "Approve or reject" }, teacherOnly: true },
  { href: "/me/salary/", icon: Banknote, title: { hi: "सैलरी स्लिप", en: "Salary slips" }, sub: { hi: "पिछले महीने", en: "Past months" } },
  { href: "/me/leave/", icon: CalendarOff, title: { hi: "मेरी छुट्टी की अर्ज़ी", en: "My leave" }, sub: { hi: "अर्ज़ी भेजें, स्थिति देखें", en: "Apply and see the status" } },
];

export default function MePage() {
  const { me } = useStaff();
  const L = useL();
  const { lang, setLang } = useLang();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await api("/logout", { method: "POST" }).catch(() => null);
    clearCache();
    window.location.replace("/login/");
  }

  return (
    <div className="animate-rise space-y-3">
      <nav className="card overflow-hidden">
        <ul className="divide-y divide-ink-100">
          {LINKS.filter((l) => !l.teacherOnly || me?.role === "teacher").map(({ href, icon: Icon, title, sub }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5 active:bg-ink-50">
                <Icon className="h-[22px] w-[22px] shrink-0 text-ink-500" strokeWidth={1.9} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-ink-900">{L(title)}</span>
                  <span className="block truncate text-sm text-ink-500">{L(sub)}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {me && (
        <section className="card p-4">
          <p className="card-title">{L({ hi: "मेरी जानकारी", en: "My details" })}</p>
          <dl className="mt-1 divide-y divide-ink-100 text-[15px]">
            {[
              [L({ hi: "नाम", en: "Name" }), me.name],
              [L({ hi: "पद", en: "Role" }), L(me.roleLabel)],
              [L({ hi: "कर्मचारी कोड", en: "Employee code" }), me.empCode],
              [L({ hi: "मोबाइल", en: "Mobile" }), phoneText(me.phone)],
              [L({ hi: "जुड़े", en: "Joined" }), new Date(me.joined + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric" })],
              ...(me.role === "teacher" ? [[L({ hi: "मेरी कक्षाएँ", en: "My classes" }), me.sections.map((s) => s.classSec).join(", ")]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-right font-semibold text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="card p-4">
        <p className="card-title">{L({ hi: "भाषा", en: "Language" })}</p>
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup">
          {(["hi", "en"] as const).map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={clsx("btn border", lang === l ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-200 bg-white text-ink-700")}>
              {l === "hi" ? "हिंदी" : "English"}
            </button>
          ))}
        </div>
      </section>

      {me?.school.officePhone && (
        <section className="card space-y-3 p-4">
          <p className="card-title">{me.school.name}</p>
          <CallOffice phone={me.school.officePhone} className="w-full" />
        </section>
      )}

      <button onClick={logout} disabled={leaving} className="btn-quiet w-full text-rose-700">
        <LogOut className="h-5 w-5" aria-hidden /> {L({ hi: "लॉग आउट", en: "Sign out" })}
      </button>
    </div>
  );
}
