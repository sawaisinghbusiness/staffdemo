"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Plus, Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { normClasses, roleLabel, type StaffList } from "@/lib/erpStaff";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

type View = "all" | "teaching" | "non_teaching" | "left";

/*
 * ERP login → Staff → Directory: the ERP's staff page (GET /api/staff). Tabs All / Teaching / Non-teaching / Left,
 * the same search, and the "sections have no class teacher" nudge. Tap someone for their profile.
 * Only the admin adds staff; the admin and the exam cell assign class teachers (same as the ERP).
 */
export default function ErpStaffPage() {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<StaffList>("/erp/staff");
  const cls = useApi<{ data: unknown[] }>("/erp/classes");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const me = who.data?.user.role || "";
  const isAdmin = me === "admin";
  const canAssign = isAdmin || me === "exam_cell";
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");

  // Old "Add staff" links (/erp/staff/?new=1) open the form, as the ERP's /staff?new=1 does.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") window.location.replace("/erp/staff/new/");
  }, []);

  const list = useMemo(() => data?.data || [], [data]);
  const classes = useMemo(() => normClasses(cls.data as { data?: any[] } | undefined), [cls.data]);
  const current = list.filter((s) => s.status !== "Relieved");
  const teachers = current.filter((s) => s.staffType === "teaching");
  const counts: Record<View, number> = {
    all: current.length,
    teaching: teachers.length,
    non_teaching: current.length - teachers.length,
    left: list.length - current.length,
  };
  const withLogin = current.filter((s) => s.login).length;
  const sectionTotal = classes.reduce((n, c) => n + c.sections.length, 0);
  const taken = new Set(teachers.map((s) => s.classTeacherOf).filter(Boolean) as string[]);
  const sectionsWithoutCT = classes.reduce((n, c) => n + c.sections.filter((s) => !taken.has(`${c.name} - ${s.name}`)).length, 0);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((s) => {
      if (view === "left" ? s.status !== "Relieved" : s.status === "Relieved") return false;
      if (view === "teaching" && s.staffType !== "teaching") return false;
      if (view === "non_teaching" && s.staffType !== "non_teaching") return false;
      if (!term) return true;
      return [s.name, s.empCode, s.mobile, s.designation, s.department, s.classTeacherOf || ""].some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [list, view, q]);

  const n = (k: number) => (data ? ` ${k}` : "");

  if (data?.setupNeeded)
    return (
      <div className="animate-rise space-y-3">
        <Empty>{L({ hi: "स्टाफ़ के लिए डेटाबेस में एक बार का बदलाव चाहिए: Supabase SQL editor में sms backend/supabase/migrations/20261002_staff.sql चलाएँ।", en: "Staff needs a one-time database setup: run sms backend/supabase/migrations/20261002_staff.sql in the Supabase SQL editor." })}</Empty>
        <button type="button" onClick={reload} className="btn-line w-full">
          {L({ hi: "फिर से देखें", en: "Check again" })}
        </button>
      </div>
    );

  return (
    <div className="animate-rise space-y-3">
      <LineTabs
        label={L({ hi: "स्टाफ़", en: "Staff" })}
        value={view}
        onChange={setView}
        options={[
          { key: "all", text: `${L({ hi: "सभी", en: "All" })}${n(counts.all)}` },
          { key: "teaching", text: `${L({ hi: "टीचर", en: "Teaching" })}${n(counts.teaching)}` },
          { key: "non_teaching", text: `${L({ hi: "अन्य", en: "Non-teaching" })}${n(counts.non_teaching)}` },
          { key: "left", text: `${L({ hi: "छोड़ गए", en: "Left" })}${n(counts.left)}` },
        ]}
      />

      {data && (
        <div className="flex items-center justify-between gap-3">
          <p className="mlabel tnum">
            {L({ hi: `${counts.all} स्टाफ़ · ${withLogin} का लॉगिन`, en: `${counts.all} on staff · ${withLogin} with a login` })}
          </p>
          {isAdmin && (
            <Link href="/erp/staff/new/" className="flex min-h-[44px] items-center gap-1 px-1 text-[14px] font-semibold text-brand-600">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "नया स्टाफ़", en: "Add staff" })}
            </Link>
          )}
        </div>
      )}

      {/* The one thing to act on, when there is something */}
      {data && teachers.length > 0 && sectionsWithoutCT > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-marigold-300/70 bg-marigold-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          <p className="min-w-0 flex-1 text-[14px] font-semibold text-ink-800">
            {L({ hi: `${sectionTotal} में से ${sectionsWithoutCT} सेक्शन का कोई क्लास टीचर नहीं`, en: `${sectionsWithoutCT} of ${sectionTotal} sections have no class teacher` })}
          </p>
          {canAssign && (
            <Link href="/erp/staff/class-teachers/" className="flex min-h-[44px] shrink-0 items-center text-[14px] font-semibold text-brand-600">
              {L({ hi: "तय करें", en: "Assign" })}
            </Link>
          )}
        </div>
      )}

      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="erp-staff-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, कोड, मोबाइल या कक्षा", en: "Search name, code, mobile or class" })} enterKeyHint="search" autoComplete="off" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>

      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={6} />
      ) : shown.length === 0 ? (
        <>
          <Empty>
            {list.length === 0
              ? L({ hi: "अभी कोई स्टाफ़ नहीं जोड़ा। हर टीचर और ऑफ़िस स्टाफ़ को एक बार जोड़ें। फिर क्लास टीचर बनाएँ, विषय दें और लॉगिन दें।", en: "No staff added yet. Add each teacher and office staff member once. Then make class teachers, assign subjects and give logins." })
              : q
              ? L({ hi: "कोई नहीं मिला। दूसरा टैब या खोज देखें।", en: "Nobody matches. Try another tab or search." })
              : view === "left"
              ? L({ hi: "कोई नहीं गया।", en: "Nobody has left." })
              : L({ hi: "यहाँ अभी कोई नहीं।", en: "Nobody here yet." })}
          </Empty>
          {list.length === 0 && isAdmin && (
            <Link href="/erp/staff/new/" className="btn-primary w-full">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "पहला स्टाफ़ जोड़ें", en: "Add the first staff member" })}
            </Link>
          )}
        </>
      ) : (
        <>
          <ul>
            {shown.map((s) => {
              const left = s.status === "Relieved";
              return (
                <li key={s.id}>
                  <Link href={`/erp/staff/detail/?id=${encodeURIComponent(s.id)}`} className="flex min-h-[64px] items-center gap-3 border-b border-ink-100 py-2 active:bg-ink-50">
                    <Avatar name={s.name} url={s.photoUrl || null} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-medium">{s.name}</span>
                      <span className="tnum block truncate text-[12.5px] text-ink-400">
                        {s.empCode} · {s.designation}
                      </span>
                    </span>
                    <span className="max-w-[40%] shrink-0 text-right text-[13px]">
                      {left ? (
                        <span className="block font-semibold text-ink-500">{L({ hi: "छोड़ गए", en: "Left" })}</span>
                      ) : s.classTeacherOf ? (
                        <span className="block truncate font-semibold text-ink-800">{s.classTeacherOf}</span>
                      ) : null}
                      <span className={s.login ? "block truncate text-[12px] text-ink-500" : "block text-[12px] font-semibold text-brand-600"}>
                        {s.login ? `${roleLabel(s.login.role, lang)}${s.login.active ? "" : L({ hi: " · बंद", en: " · off" })}` : left ? "" : L({ hi: "लॉगिन नहीं", en: "No login" })}
                      </span>
                    </span>
                    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mlabel tnum">
            {shown.length} {L({ hi: "लोग", en: shown.length === 1 ? "person" : "people" })}
            {q ? L({ hi: ` “${q}” से मिले`, en: ` match “${q}”` }) : ""}
          </p>
        </>
      )}
    </div>
  );
}
