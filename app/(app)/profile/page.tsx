"use client";

import { useState } from "react";
import clsx from "clsx";
import { Banknote, BellRing, CalendarCheck, CalendarX2, CircleHelp, Languages, Phone } from "lucide-react";
import { useAlertClose } from "@/lib/driverPrefs";
import { api, ApiError, markSignedIn, clearCache } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { phoneText } from "@/lib/format";
import { Avatar, Skeleton } from "@/components/ui";
import { isErpMode } from "@/lib/erpMode";
import { ErpProfile, Group, InfoRow, Row as GRow } from "@/components/erp/ErpProfile";

/** Who is signed in, their details as the office has them, then salary, attendance, leave and settings. */
export default function ProfilePage() {
  const { me } = useStaff();
  const L = useL();
  const { lang, setLang } = useLang();
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [erp] = useState(isErpMode);

  async function logout() {
    setLeaving(true);
    setLogoutError("");
    try { await api("/logout", { method: "POST" }); } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        setLogoutError(L({ hi: "\u0932\u0949\u0917 \u0906\u0909\u091f \u0928\u0939\u0940\u0902 \u0939\u0941\u0906\u0964 \u0926\u094b\u092c\u093e\u0930\u093e \u0915\u094b\u0936\u093f\u0936 \u0915\u0930\u0947\u0902\u0964", en: "Could not log out. Check your connection and try again." }));
        setLeaving(false); return;
      }
    }
    clearCache();
    markSignedIn(false);
    window.location.replace("/login/");
  }

  // ERP login has its own profile (school, users, password), not a staff member's.
  if (erp) return <ErpProfile />;

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

  // Same layout as the ERP login's profile (user, 2026-10-26): who, then grouped rows, then Log out.
  return (
    <div className="space-y-5 pb-6 pt-1">
      <section className="flex items-center gap-3.5 rounded-xl border border-[#DCE4ED] bg-white p-4">
        <Avatar name={me.name} url={me.photoUrl} size={60} tint={0} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[18px] font-semibold">{me.name}</span>
          <span className="block truncate text-[13.5px] text-ink-600">
            {L(me.roleLabel)} · {me.empCode}
          </span>
          {me.school.name && <span className="block truncate text-[13px] text-ink-500">{me.school.name}</span>}
        </span>
      </section>

      <Group title={L({ hi: "मेरी जानकारी", en: "My details" })}>
        {rows.map(([k, v], i) => (
          <InfoRow key={k} text={k} value={v} last={i === rows.length - 1} />
        ))}
      </Group>

      <Group title={L({ hi: "मेरा", en: "Mine" })}>
        <GRow icon={Banknote} text={L({ hi: "सैलरी स्लिप", en: "Salary slips" })} href="/salary/" />
        <GRow icon={CalendarCheck} text={L({ hi: "मेरी हाज़िरी", en: "My attendance" })} href="/my-attendance/" />
        <GRow icon={CalendarX2} text={L({ hi: "मेरी छुट्टी", en: "My leave" })} href="/leave/" last />
      </Group>

      <Group title={L({ hi: "सेटिंग", en: "Settings" })}>
        <GRow icon={Languages} text={L({ hi: "भाषा", en: "Language" })} value={lang === "hi" ? "हिंदी" : "English"} onClick={() => setLang(lang === "hi" ? "en" : "hi")} last={me.role !== "driver"} />
        {me.role === "driver" && <AlertSetting />}
      </Group>

      <Group title={L({ hi: "मदद", en: "Help" })}>
        {me.school.officePhone && <GRow icon={Phone} text={L({ hi: "स्कूल ऑफ़िस को कॉल करें", en: "Call school office" })} value={me.school.officePhone} href={`tel:${me.school.officePhone.replace(/\s/g, "")}`} />}
        {me.role !== "driver" && <GRow icon={CircleHelp} text={L({ hi: "स्कूल सहायक से पूछें", en: "Ask School Sahayak" })} href="/assistant/" last />}
      </Group>

      <button type="button" onClick={logout} disabled={leaving} className="min-h-[50px] w-full rounded-2xl border border-ink-100 bg-white text-[15px] font-semibold text-rose-700 active:bg-ink-50 disabled:opacity-60">
        {leaving ? "…" : L({ hi: "लॉग आउट", en: "Log out" })}
      </button>
      {logoutError && <p role="alert" className="text-[14px] leading-relaxed text-rose-700">{logoutError}</p>}
    </div>
  );
}

/** Drivers: whether the drop / pickup alert closes on its own after 3 seconds or waits for them. */
function AlertSetting() {
  const L = useL();
  const [mode, setMode] = useAlertClose();
  return (
    <div className="py-3 pr-3.5">
      <div className="flex items-center gap-3">
        <BellRing className="h-[21px] w-[21px] shrink-0 text-ink-700" strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1 text-[15.5px]">{L({ hi: "स्टॉप का अलर्ट", en: "Stop alert" })}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 rounded-[10px] bg-ink-100 p-[3px]" role="radiogroup" aria-label={L({ hi: "स्टॉप का अलर्ट", en: "Stop alert" })}>
        {(["auto", "manual"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={clsx("min-h-[48px] rounded-lg px-2 text-[14px]", mode === m ? "bg-white font-semibold text-ink-900 shadow-sm" : "font-medium text-ink-500")}>
            {m === "auto" ? L({ hi: "3 सेकंड में अपने आप बंद", en: "Closes by itself in 3 s" }) : L({ hi: "मैं खुद बंद करूँगा", en: "I close it myself" })}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-500">
        {mode === "auto"
          ? L({ hi: "अलर्ट 3 सेकंड दिखकर अपने आप हट जाएगा।", en: "The alert shows for 3 seconds, then goes." })
          : L({ hi: "आप बंद करें, या बस स्टॉप पर रुककर आगे चले तो अपने आप हट जाएगा।", en: "You close it, or it goes once the bus has stopped there and moved on." })}
      </p>
    </div>
  );
}
