"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Banknote, CalendarCheck, CalendarX2, ChevronRight, Languages, LogOut, Phone, type LucideIcon } from "lucide-react";
import { api, clearCache } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { phoneText } from "@/lib/format";
import { Avatar, Skeleton } from "@/components/ui";

function Row({ icon: Icon, text, value, href }: { icon: LucideIcon; text: string; value?: string; href: string }) {
  const cls = "flex min-h-[54px] w-full items-center gap-3 border-b border-ink-100 px-0.5 active:bg-ink-50";
  const inner = (
    <>
      <Icon className="h-[21px] w-[21px] shrink-0 text-ink-700" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1 text-[15.5px]">{text}</span>
      {value && <span className="shrink-0 text-[14px] text-ink-400">{value}</span>}
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
    </>
  );
  return href.startsWith("tel:") ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Who is signed in, their details as the office has them, then salary, attendance, leave and settings. */
export default function ProfilePage() {
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

  if (!me) {
    return (
      <div className="flex flex-col items-center gap-2 pt-2">
        <Skeleton className="h-[76px] w-[76px] rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  const ct = me.sections.filter((s) => s.classTeacher).map((s) => s.classSec);
  const subjects = Array.from(new Set(me.sections.flatMap((s) => s.subjects)));
  const rows: [string, string][] = [
    ...(ct.length ? [[L({ hi: "क्लास टीचर", en: "Class teacher of" }), ct.join(", ")] as [string, string]] : []),
    ...(me.sections.length ? [[L({ hi: "पढ़ाते हैं", en: "Teaches" }), `${subjects.join(", ")} · ${me.sections.map((s) => s.classSec).join(", ")}`] as [string, string]] : []),
    [L({ hi: "जुड़े", en: "Joined" }), new Date(me.joined + "T00:00:00").toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })],
    [L({ hi: "मोबाइल", en: "Mobile" }), phoneText(me.phone)],
  ];

  return (
    <div className="animate-rise space-y-4 pb-2">
      <section className="flex flex-col items-center pt-1 text-center">
        <Avatar name={me.name} size={76} tint={5} />
        <h2 className="mt-2.5 text-[19px] font-bold">{me.name}</h2>
        <p className="text-[13.5px] text-ink-500">
          {L(me.roleLabel)} · {me.empCode}
        </p>
      </section>

      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <Row icon={Banknote} text={L({ hi: "सैलरी स्लिप", en: "Salary slips" })} href="/salary/" />
        <Row icon={CalendarCheck} text={L({ hi: "मेरी हाज़िरी", en: "My attendance" })} href="/my-attendance/" />
        <Row icon={CalendarX2} text={L({ hi: "मेरी छुट्टी", en: "My leave" })} href="/leave/" />
        <div className="flex min-h-[54px] items-center gap-3 border-b border-ink-100 px-0.5">
          <Languages className="h-[21px] w-[21px] shrink-0 text-ink-700" strokeWidth={1.8} aria-hidden />
          <span className="min-w-0 flex-1 text-[15.5px]">{L({ hi: "भाषा", en: "Language" })}</span>
          <div className="flex rounded-[10px] bg-ink-50 p-[3px]" role="radiogroup" aria-label={L({ hi: "भाषा", en: "Language" })}>
            {(["en", "hi"] as const).map((l) => (
              <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={clsx("min-h-[38px] rounded-lg px-3 text-[14px]", lang === l ? "bg-white font-semibold text-brand-600 shadow-sm" : "font-medium text-ink-500")}>
                {l === "hi" ? "हिंदी" : "English"}
              </button>
            ))}
          </div>
        </div>
        {me.school.officePhone && <Row icon={Phone} text={L({ hi: "स्कूल ऑफ़िस को कॉल करें", en: "Call school office" })} value={me.school.officePhone} href={`tel:${me.school.officePhone.replace(/\s/g, "")}`} />}
        <button onClick={logout} disabled={leaving} className="flex min-h-[54px] w-full items-center gap-3 px-0.5 text-left font-semibold text-rose-600 active:bg-ink-50">
          <LogOut className="h-[21px] w-[21px] shrink-0" strokeWidth={1.8} aria-hidden />
          {L({ hi: "लॉग आउट", en: "Log out" })}
        </button>
      </div>

      <p className="text-center text-[12px] text-ink-400">{me.school.name}</p>
    </div>
  );
}
