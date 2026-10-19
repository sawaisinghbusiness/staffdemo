"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Lock } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { normClasses, type StaffList } from "@/lib/erpStaff";
import { Empty, ErrorCard, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";

/*
 * ERP login → Staff → Allocation (the ERP roadmap's "Subjects & class teachers"): who teaches which subject in
 * every section. Pick a section, then a teacher for each of its subjects (subjects come from Classes & subjects).
 * One teacher per subject per section here. Saving rebuilds each changed teacher's list and sends it through the
 * same PUT /api/staff/:id/assignments the staff profile uses, keeping their class-teacher section as it is.
 * This drives each teacher's homework, marks entry and attendance in the staff app. Admin and exam cell only.
 */

const cellKey = (classSec: string, subject: string) => `${classSec}|${subject}`;

export default function ErpAllocationPage() {
  const L = useL();
  const { data, error, reload } = useApi<StaffList>("/erp/staff");
  const cls = useApi<{ data: unknown[] }>("/erp/classes");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const me = who.data?.user.role || "";
  const canAssign = me === "admin" || me === "exam_cell";
  const [pick, setPick] = useState<Record<string, string>>({}); // classSec|subject -> staff id
  const [start, setStart] = useState<Record<string, string>>({});
  const [sec, setSec] = useState("");
  const [busy, setBusy] = useState(false);

  const teachers = useMemo(() => (data?.data || []).filter((s) => s.staffType === "teaching" && s.status !== "Relieved").sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const sections = useMemo(
    () => normClasses(cls.data as { data?: any[] } | undefined).flatMap((c) => c.sections.map((s) => ({ classSec: `${c.name} - ${s.name}`, subjects: s.subjects }))),
    [cls.data]
  );
  const ctOf = useMemo(() => new Map(teachers.filter((t) => t.classTeacherOf).map((t) => [t.classTeacherOf!, t.name])), [teachers]);

  useEffect(() => {
    const p: Record<string, string> = {};
    for (const t of teachers) for (const a of t.subjects) p[cellKey(a.classSec, a.subject)] = t.id;
    setPick(p);
    setStart(p);
  }, [teachers]);

  const gaps = (s: { classSec: string; subjects: string[] }) => s.subjects.filter((sub) => !pick[cellKey(s.classSec, sub)]).length;
  const totalCells = sections.reduce((n, s) => n + s.subjects.length, 0);
  const filled = sections.reduce((n, s) => n + s.subjects.length - gaps(s), 0);
  const changed = Object.keys({ ...pick, ...start }).filter((k) => (pick[k] || "") !== (start[k] || ""));

  useEffect(() => {
    if (!sec && sections.length) setSec((sections.find((s) => s.subjects.length && gaps(s)) || sections.find((s) => s.subjects.length) || sections[0]).classSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, sec]);

  const load = (t: { id: string }) => {
    // Teacher's subjects as they will be: every cell picked for them, in section order.
    const out: { classSec: string; subject: string }[] = [];
    for (const s of sections) for (const sub of s.subjects) if (pick[cellKey(s.classSec, sub)] === t.id) out.push({ classSec: s.classSec, subject: sub });
    return out;
  };

  async function save() {
    const ids = new Set<string>();
    for (const k of changed) {
      if (pick[k]) ids.add(pick[k]);
      if (start[k]) ids.add(start[k]);
    }
    const list = teachers.filter((t) => ids.has(t.id));
    if (!list.length) return;
    setBusy(true);
    for (const t of list) {
      try {
        await api(`/erp/staff/${t.id}/assignments`, { method: "PUT", body: { classTeacherOf: t.classTeacherOf, subjects: load(t) } });
      } catch (err) {
        setBusy(false);
        reload();
        return toast(false, `${t.name}: ${(err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." })}`);
      }
    }
    toast(true, L({ hi: `विषय बँटवारा सेव हुआ (${list.length} टीचर)।`, en: `Allocation saved (${list.length} teachers).` }));
    setBusy(false);
    reload();
  }

  if (who.data && !canAssign)
    return (
      <p className="animate-rise flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 text-[14px] text-ink-700">
        <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
        {L({ hi: "विषय बँटवारा सिर्फ़ एडमिन और परीक्षा सेल कर सकते हैं।", en: "Only the admin and the exam cell can allocate subjects." })}
      </p>
    );
  if (!data || !cls.data) {
    const e = error || cls.error;
    return e && e.status !== 401 ? <ErrorCard offline={e.status === 0} onRetry={() => (reload(), cls.reload())} /> : <ListSkeleton rows={6} />;
  }

  const cur = sections.find((s) => s.classSec === sec);
  const load1 = (id: string) => Object.values(pick).filter((v) => v === id).length;

  return (
    <div className="animate-rise space-y-3 pb-20">
      <p className="mlabel tnum">{L({ hi: `${totalCells} में से ${filled} विषयों को टीचर मिला`, en: `${filled} of ${totalCells} subjects have a teacher` })}</p>
      {!totalCells ? (
        <Empty>{L({ hi: "अभी किसी कक्षा के विषय नहीं हैं। पहले सेटिंग → कक्षा और विषय में विषय डालें।", en: "No class has subjects yet. Add them in Settings → Classes & subjects first." })}</Empty>
      ) : !teachers.length ? (
        <Empty>{L({ hi: "पहले टीचर जोड़ें।", en: "Add teaching staff first." })}</Empty>
      ) : (
        <>
          <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sec} onChange={setSec}>
            {sections.map((s) => {
              const g = gaps(s);
              return (
                <option key={s.classSec} value={s.classSec}>
                  {s.classSec}
                  {!s.subjects.length ? ` · ${L({ hi: "विषय नहीं", en: "no subjects" })}` : g ? ` · ${g} ${L({ hi: "खाली", en: "empty" })}` : " ✓"}
                </option>
              );
            })}
          </SelectBox>

          {cur && (
            <Link href="/erp/staff/class-teachers/" className="flex items-center justify-between gap-2 rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
              <span className="min-w-0">
                <span className="block text-[12px] text-ink-500">{L({ hi: "क्लास टीचर", en: "Class teacher" })}</span>
                <span className={clsx("block truncate text-[14.5px] font-semibold", !ctOf.get(cur.classSec) && "text-rose-600")}>{ctOf.get(cur.classSec) || L({ hi: "कोई नहीं", en: "None" })}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
            </Link>
          )}

          {cur && !cur.subjects.length ? (
            <Empty>{L({ hi: "इस सेक्शन के विषय नहीं डाले गए।", en: "This section has no subjects set." })}</Empty>
          ) : (
            <ul className="space-y-2">
              {cur?.subjects.map((sub) => {
                const k = cellKey(cur.classSec, sub);
                const id = pick[k] || "";
                return (
                  <li key={k} className="flex items-center gap-2.5">
                    <span className={clsx("w-[104px] shrink-0 text-[14px] font-semibold", (pick[k] || "") !== (start[k] || "") && "text-brand-700")}>{sub}</span>
                    <div className="min-w-0 flex-1">
                      <SelectBox label={L({ hi: "टीचर", en: "Teacher" })} value={id} onChange={(v) => setPick((p) => ({ ...p, [k]: v }))} className={clsx(!id && "!border-dashed")}>
                        <option value="">{L({ hi: "कोई नहीं", en: "Nobody" })}</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} · {load1(t.id)} {L({ hi: "विषय", en: "subjects" })}
                          </option>
                        ))}
                      </SelectBox>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <StickyBar>
        <button type="button" onClick={save} disabled={busy || !changed.length} className="btn-primary w-full">
          {busy ? "…" : changed.length ? L({ hi: `सेव करें (${changed.length} बदलाव)`, en: `Save (${changed.length} changes)` }) : L({ hi: "कोई बदलाव नहीं", en: "No changes" })}
        </button>
      </StickyBar>
    </div>
  );
}
