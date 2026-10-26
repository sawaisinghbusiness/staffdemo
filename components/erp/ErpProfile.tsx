"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, CircleHelp, Languages, Lock, MessageCircle, Users, type LucideIcon } from "lucide-react";
import { api, ApiError, clearCache, markSignedIn, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { phoneText } from "@/lib/format";
import { Avatar, Sheet, Skeleton } from "@/components/ui";

/*
 * ERP login → Profile (user's approved preview, 2026-10-26, PhonePe-like): who is signed in, then grouped rows:
 * Account (password, language), School (school, users, WhatsApp), Help (School Sahayak), and Log out.
 */

const ROLE: Record<string, { hi: string; en: string }> = {
  admin: { hi: "एडमिन", en: "Admin" },
  accountant: { hi: "अकाउंटेंट", en: "Accountant" },
  teacher: { hi: "टीचर", en: "Teacher" },
  exam_cell: { hi: "परीक्षा सेल", en: "Exam cell" },
};

function Row({ icon: Icon, text, value, href, onClick, last }: { icon: LucideIcon; text: string; value?: string; href?: string; onClick?: () => void; last?: boolean }) {
  const cls = `flex min-h-[52px] w-full items-center gap-3.5 pr-3.5 text-left active:bg-ink-50 ${last ? "" : "border-b border-ink-100"}`;
  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-ink-900" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1 text-[15px]">{text}</span>
      {value && <span className="shrink-0 text-[14px] text-ink-600">{value}</span>}
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-400" aria-hidden />
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mx-1 mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">{title}</h2>
      <div className="rounded-2xl border border-ink-100 bg-white pl-4">{children}</div>
    </section>
  );
}

export function ErpProfile() {
  const L = useL();
  const { lang, setLang } = useLang();
  const { data: who } = useApi<{ user: { name: string; role: string; identifier: string } }>("/erp/auth/me");
  const { data: school } = useApi<Record<string, string>>("/erp/school");
  const [pw, setPw] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const user = who?.user;
  const isAdmin = user?.role === "admin";

  async function logout() {
    setLeaving(true);
    await api("/logout", { method: "POST" }).catch(() => null);
    clearCache();
    markSignedIn(false);
    window.location.replace("/login/");
  }

  return (
    <div className="animate-rise space-y-3.5 pb-6 pt-1">
      <section className="flex items-center gap-3.5 rounded-2xl border border-ink-100 bg-white p-4">
        {user ? <Avatar name={user.name} size={60} /> : <Skeleton className="h-[60px] w-[60px] rounded-full" />}
        <span className="min-w-0 flex-1">
          {user ? (
            <>
              <span className="block truncate text-[17px] font-bold">{user.name}</span>
              <span className="block truncate text-[13.5px] text-ink-600">
                {L(ROLE[user.role] || { hi: user.role, en: user.role })}
                {/^\d{10}$/.test(user.identifier) ? ` · ${phoneText(user.identifier)}` : ` · ${user.identifier}`}
              </span>
              {school?.school_name && (
                <span className="block truncate text-[13px] text-ink-500">
                  {school.school_name}
                  {school.city ? `, ${school.city}` : ""}
                </span>
              )}
            </>
          ) : (
            <>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-1.5 h-4 w-28" />
            </>
          )}
        </span>
      </section>

      <Group title={L({ hi: "खाता", en: "Account" })}>
        <Row icon={Lock} text={L({ hi: "पासवर्ड बदलें", en: "Change password" })} onClick={() => setPw(true)} />
        <Row icon={Languages} text={L({ hi: "भाषा", en: "Language" })} value={lang === "hi" ? "हिंदी" : "English"} onClick={() => setLang(lang === "hi" ? "en" : "hi")} last />
      </Group>

      <Group title={L({ hi: "स्कूल", en: "School" })}>
        <Row icon={Building2} text={L({ hi: "स्कूल और सत्र", en: "School & session" })} href="/erp/settings/" />
        {isAdmin && <Row icon={Users} text={L({ hi: "यूज़र और रोल", en: "Users & roles" })} href="/erp/settings/users/" />}
        <Row icon={MessageCircle} text="WhatsApp" href="/erp/settings/whatsapp/" last />
      </Group>

      <Group title={L({ hi: "मदद", en: "Help" })}>
        <Row icon={CircleHelp} text={L({ hi: "स्कूल सहायक से पूछें", en: "Ask School Sahayak" })} href="/assistant/" last />
      </Group>

      <button type="button" onClick={logout} disabled={leaving} className="min-h-[50px] w-full rounded-2xl border border-ink-100 bg-white text-[15px] font-semibold text-rose-700 active:bg-ink-50 disabled:opacity-60">
        {leaving ? "…" : L({ hi: "लॉग आउट", en: "Log out" })}
      </button>

      {pw && <PasswordSheet onClose={() => setPw(false)} />}
    </div>
  );
}

/** POST /api/auth/password { current, next }: the ERP's own "change your password". */
function PasswordSheet({ onClose }: { onClose: () => void }) {
  const L = useL();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (next.length < 6) return toast(false, L({ hi: "नया पासवर्ड कम से कम 6 अक्षर का हो।", en: "The new password needs at least 6 characters." }));
    if (next !== again) return toast(false, L({ hi: "दोनों नए पासवर्ड एक जैसे नहीं हैं।", en: "The two new passwords don't match." }));
    setBusy(true);
    try {
      await api("/erp/auth/password", { body: { current, next } });
      toast(true, L({ hi: "पासवर्ड बदल गया।", en: "Password changed." }));
      onClose();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "पासवर्ड नहीं बदला।", en: "Could not change the password." }));
    } finally {
      setBusy(false);
    }
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <label className="field-box">
      <small>{label}</small>
      <input id={id} type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} />
    </label>
  );
  return (
    <Sheet title={L({ hi: "पासवर्ड बदलें", en: "Change password" })} onClose={() => !busy && onClose()}>
      <div className="space-y-2.5">
        {field("pw-current", L({ hi: "अभी का पासवर्ड", en: "Current password" }), current, setCurrent, "current-password")}
        {field("pw-next", L({ hi: "नया पासवर्ड", en: "New password" }), next, setNext, "new-password")}
        {field("pw-again", L({ hi: "नया पासवर्ड फिर से", en: "New password again" }), again, setAgain, "new-password")}
        <button type="button" onClick={save} disabled={busy || !current || !next || !again} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "पासवर्ड बदलें", en: "Change password" })}
        </button>
      </div>
    </Sheet>
  );
}
