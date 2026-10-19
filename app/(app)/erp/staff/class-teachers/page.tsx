"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { normClasses, type StaffList } from "@/lib/erpStaff";
import { Empty, ErrorCard, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";

/*
 * ERP login → Staff → Class teachers: the ERP's ClassTeachersDrawer. Every section with a teacher picker; a teacher
 * can be class teacher of one section. Saves through PUT /api/staff/:id/assignments, clearing first and then
 * assigning, so a section never has two class teachers mid-way. The admin and the exam cell only.
 */
export default function ErpClassTeachersPage() {
  const L = useL();
  const { data, error, reload } = useApi<StaffList>("/erp/staff");
  const cls = useApi<{ data: unknown[] }>("/erp/classes");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const me = who.data?.user.role || "";
  const canAssign = me === "admin" || me === "exam_cell";
  const [pick, setPick] = useState<Record<string, string>>({}); // classSec -> staff id
  const [busy, setBusy] = useState(false);

  const teachers = useMemo(() => (data?.data || []).filter((s) => s.staffType === "teaching" && s.status !== "Relieved").sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const classes = useMemo(() => normClasses(cls.data as { data?: any[] } | undefined), [cls.data]);
  const sections = classes.flatMap((c) => c.sections.map((s) => `${c.name} - ${s.name}`));

  useEffect(() => {
    const p: Record<string, string> = {};
    for (const t of teachers) if (t.classTeacherOf) p[t.classTeacherOf] = t.id;
    setPick(p);
  }, [teachers]);

  const assigned = Object.values(pick).filter(Boolean).length;
  const doubles = useMemo(() => {
    const seen: Record<string, string[]> = {};
    for (const cs of Object.keys(pick)) if (pick[cs]) (seen[pick[cs]] ||= []).push(cs);
    return Object.keys(seen)
      .filter((id) => seen[id].length > 1)
      .map((id) => ({ id, secs: seen[id] }));
  }, [pick]);

  async function save() {
    if (doubles.length) {
      const t = teachers.find((x) => x.id === doubles[0].id);
      return toast(false, L({ hi: `${t?.name} को ${doubles[0].secs.join(" और ")} दोनों के लिए चुना है। एक टीचर एक ही सेक्शन का क्लास टीचर हो सकता है।`, en: `${t?.name} is picked for ${doubles[0].secs.join(" and ")}. A teacher can be class teacher of one section.` }));
    }
    const target: Record<string, string | null> = {};
    for (const t of teachers) target[t.id] = null;
    for (const cs of Object.keys(pick)) if (pick[cs]) target[pick[cs]] = cs;
    const changes = teachers.filter((t) => (t.classTeacherOf || null) !== target[t.id]);
    if (!changes.length) return window.location.assign("/erp/staff/");
    setBusy(true);
    const ordered = changes.slice().sort((a, b) => Number(!!target[a.id]) - Number(!!target[b.id]));
    for (const t of ordered) {
      try {
        await api(`/erp/staff/${t.id}/assignments`, { method: "PUT", body: { classTeacherOf: target[t.id], subjects: t.subjects } });
      } catch (err) {
        setBusy(false);
        reload();
        return toast(false, `${t.name}: ${(err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." })}`);
      }
    }
    toast(true, L({ hi: `क्लास टीचर सेव हुए (${changes.length} बदले)।`, en: `Class teachers saved (${changes.length} changed).` }));
    window.location.assign("/erp/staff/");
  }

  if (who.data && !canAssign)
    return (
      <p className="animate-rise flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 text-[14px] text-ink-700">
        <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
        {L({ hi: "क्लास टीचर सिर्फ़ एडमिन और परीक्षा सेल तय कर सकते हैं।", en: "Only the admin and the exam cell can assign class teachers." })}
      </p>
    );
  if (!data || !cls.data) {
    const e = error || cls.error;
    return e && e.status !== 401 ? <ErrorCard offline={e.status === 0} onRetry={() => (reload(), cls.reload())} /> : <ListSkeleton rows={6} />;
  }

  return (
    <div className="animate-rise space-y-2.5 pb-20">
      <p className="mlabel tnum">{L({ hi: `${sections.length} में से ${assigned} सेक्शन का क्लास टीचर है`, en: `${assigned} of ${sections.length} sections have one` })}</p>
      {!teachers.length ? (
        <Empty>{L({ hi: "पहले टीचर जोड़ें, फिर उन्हें यहाँ क्लास टीचर बनाएँ।", en: "Add teaching staff first, then make them class teachers here." })}</Empty>
      ) : (
        <ul className="space-y-2">
          {sections.map((cs) => {
            const id = pick[cs] || "";
            const clash = doubles.some((d) => d.id === id);
            return (
              <li key={cs} className="flex items-center gap-2.5">
                <span className="w-[92px] shrink-0 text-[14px] font-semibold">{cs}</span>
                <div className="min-w-0 flex-1">
                  <SelectBox label={L({ hi: "टीचर", en: "Teacher" })} value={id} onChange={(v) => setPick((p) => ({ ...p, [cs]: v }))} className={clsx(clash && "!border-rose-400")}>
                    <option value="">{L({ hi: "कोई नहीं", en: "No class teacher" })}</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.designation}
                      </option>
                    ))}
                  </SelectBox>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <StickyBar>
        <button type="button" onClick={save} disabled={busy || !teachers.length} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "क्लास टीचर सेव करें", en: "Save class teachers" })}
        </button>
      </StickyBar>
    </div>
  );
}
