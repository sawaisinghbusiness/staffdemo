"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDown, Check } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ErpStudent } from "@/lib/erpStudents";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";

/*
 * ERP login → Students → Promote & transfer: the ERP's page, same rules. A whole section moves to the next
 * class (each child Promote / Detain / Left; 12th passes out), or picked students shift section.
 * Both go through POST /api/students/move; records and fee history stay.
 */

type Tab = "promote" | "section";
type Decision = "promote" | "detain" | "left";
type Move = { id: string; class?: string; section?: string; status?: "Inactive" };

const ORDER = ["Pre Nursery", "Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const rank = (c: string) => (ORDER.indexOf(c) === -1 ? 99 : ORDER.indexOf(c));
/** The class a pupil moves up to, or "" after 12th (ERP lib/words nextClass). */
const nextClass = (c: string) => {
  const i = ORDER.indexOf(c);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : "";
};
const byRoll = (a: ErpStudent, b: ErpStudent) => (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }) || a.name.localeCompare(b.name);
type Structure = { cls: string; sections: string[] }[];

async function moveStudents(moves: Move[]) {
  return api<{ success: boolean; moved: number; failed?: unknown[] }>("/erp/students/move", { body: { moves } });
}

export default function ErpPromotePage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: ErpStudent[] }>("/erp/students");
  const [tab, setTab] = useState<Tab>("promote");
  const students = useMemo(() => (data?.data || []).filter((s) => s.status !== "Inactive"), [data]);
  const structure: Structure = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of students) {
      if (!m.has(s.class)) m.set(s.class, new Set());
      m.get(s.class)!.add(s.section);
    }
    return Array.from(m.entries())
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([cls, secs]) => ({ cls, sections: Array.from(secs).sort() }));
  }, [students]);

  return (
    <div className="animate-rise space-y-3">
      <LineTabs
        label={L({ hi: "प्रमोट और ट्रांसफ़र", en: "Promote & transfer" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "promote", text: L({ hi: "अगली कक्षा में", en: "Promote" }) },
          { key: "section", text: L({ hi: "सेक्शन बदलें", en: "Change section" }) },
        ]}
      />
      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : tab === "promote" ? (
        <PromoteTab students={students} structure={structure} onDone={reload} />
      ) : (
        <SectionTab students={students} structure={structure} onDone={reload} />
      )}
    </div>
  );
}

/* ───────────────────────────── Promote ───────────────────────────── */

function PromoteTab({ students, structure, onDone }: { students: ErpStudent[]; structure: Structure; onDone: () => void }) {
  const L = useL();
  // Nothing is pre-selected: promotion moves a whole section, so the office must pick it on purpose.
  const [from, setFrom] = useState("");
  const [fromCls, fromSec] = from ? from.split("|") : ["", ""];
  const toCls = fromCls ? nextClass(fromCls) : "";
  const toSections = structure.find((x) => x.cls === toCls)?.sections || (toCls ? ["A"] : []);
  const [toSec, setToSec] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => students.filter((s) => s.class === fromCls && s.section === fromSec).sort(byRoll), [students, fromCls, fromSec]);
  useEffect(() => {
    setDecisions(Object.fromEntries(list.map((s) => [s.id, "promote" as Decision])));
    setToSec(toSections.includes(fromSec) ? fromSec : toSections[0] || "");
  }, [from, students]); // eslint-disable-line react-hooks/exhaustive-deps

  const passOut = !!fromCls && !toCls; // 12th: promotion means passing out of school
  const count = (d: Decision) => list.filter((s) => (decisions[s.id] || "promote") === d).length;
  const setAll = (d: Decision) => setDecisions(Object.fromEntries(list.map((s) => [s.id, d])));
  const dueCount = list.filter((s) => s.balanceFee > 0 && (decisions[s.id] || "promote") !== "detain").length;
  const promoteWord = passOut ? L({ hi: "पास आउट", en: "Pass out" }) : L({ hi: "प्रमोट", en: "Promote" });

  async function apply() {
    const moves = list
      .map((s): Move | null => {
        const d = decisions[s.id] || "promote";
        if (d === "detain") return null;
        if (d === "left" || passOut) return { id: s.id, status: "Inactive" };
        return { id: s.id, class: toCls, section: toSec };
      })
      .filter((m): m is Move => !!m);
    if (!moves.length) {
      setConfirm(false);
      return toast(false, L({ hi: "किसी को नहीं भेजना: सब रोके गए हैं।", en: "Nobody to move: everyone is marked Detain." }));
    }
    setSaving(true);
    try {
      const res = await moveStudents(moves);
      const failed = res.failed?.length || 0;
      toast(
        !failed,
        passOut
          ? L({ hi: `${fromCls} - ${fromSec} के ${res.moved} बच्चे पास आउट हुए।`, en: `${res.moved} students of ${fromCls} - ${fromSec} marked as passed out.` })
          : L({ hi: `${count("promote")} बच्चे ${toCls} - ${toSec} में गए।`, en: `${count("promote")} students moved to ${toCls} - ${toSec}.` }) + (failed ? L({ hi: ` ${failed} नहीं जा सके।`, en: ` ${failed} could not be moved.` }) : "")
      );
      setFrom("");
      onDone();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "प्रमोट नहीं हुआ।", en: "Could not promote." }));
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  }

  const OPTIONS: { v: Decision; text: Bi; on: string }[] = [
    { v: "promote", text: passOut ? { hi: "पास आउट", en: "Pass out" } : { hi: "प्रमोट", en: "Promote" }, on: "bg-brand-600 text-white" },
    { v: "detain", text: { hi: "रोकें", en: "Detain" }, on: "bg-marigold-400 text-ink-900" },
    { v: "left", text: { hi: "छोड़ा", en: "Left" }, on: "bg-ink-700 text-white" },
  ];

  return (
    <>
      <SelectBox label={L({ hi: "किस कक्षा से", en: "From" })} value={from} onChange={setFrom}>
        <option value="">{L({ hi: "कक्षा और सेक्शन चुनें", en: "Choose class and section" })}</option>
        {structure.flatMap((c) =>
          c.sections.map((s) => (
            <option key={`${c.cls}|${s}`} value={`${c.cls}|${s}`}>
              {c.cls} - {s}
            </option>
          ))
        )}
      </SelectBox>
      {from && (
        <>
          <ArrowDown className="mx-auto h-5 w-5 text-ink-400" aria-hidden />
          {passOut ? (
            <p className="field-box text-ink-700">{L({ hi: "स्कूल से पास आउट", en: "Passed out of school" })}</p>
          ) : (
            <SelectBox label={L({ hi: "किस कक्षा में (सत्र 2027-28)", en: "To (session 2027-28)" })} value={toSec} onChange={setToSec}>
              {toSections.map((s) => (
                <option key={s} value={s}>
                  {toCls} - {s}
                </option>
              ))}
            </SelectBox>
          )}
        </>
      )}

      {!from ? (
        <Empty>{L({ hi: "जिस कक्षा और सेक्शन को आगे भेजना है, उसे चुनें। पक्का करने से पहले कुछ नहीं बदलेगा।", en: "Choose the class and section to promote. Nothing moves until you confirm." })}</Empty>
      ) : list.length === 0 ? (
        <Empty>{L({ hi: "इस सेक्शन में कोई बच्चा नहीं।", en: "No active students in this section." })}</Empty>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="mlabel">
              {fromCls} - {fromSec} · {list.length} {L({ hi: "बच्चे", en: "students" })}
            </p>
            <span className="flex gap-1">
              <button type="button" onClick={() => setAll("promote")} className="min-h-[36px] px-2 text-[13px] font-semibold text-brand-600">
                {L({ hi: "सब", en: "All" })} {promoteWord}
              </button>
              <button type="button" onClick={() => setAll("detain")} className="min-h-[36px] px-2 text-[13px] font-semibold text-brand-600">
                {L({ hi: "सब रोकें", en: "All detain" })}
              </button>
            </span>
          </div>
          <ul className="pb-20">
            {list.map((s) => {
              const d = decisions[s.id] || "promote";
              return (
                <li key={s.id} className="border-b border-ink-100 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="tnum w-6 shrink-0 text-right text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                    <Avatar name={s.name} url={s.photoUrl || null} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-400">{s.fatherName || "—"}</span>
                    </span>
                    {s.balanceFee > 0 && <span className="tnum shrink-0 text-[12.5px] font-semibold text-rose-600">{rupees(s.balanceFee)}</span>}
                  </div>
                  <div className="ml-9 mt-2 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={s.name}>
                    {OPTIONS.map((o) => (
                      <button key={o.v} type="button" role="radio" aria-checked={d === o.v} onClick={() => setDecisions({ ...decisions, [s.id]: o.v })} className={clsx("min-h-[34px] rounded-lg text-[13px] font-semibold transition-colors", d === o.v ? o.on : "text-ink-500")}>
                        {L(o.text)}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <StickyBar>
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-[13px] text-ink-600">
                {passOut
                  ? L({ hi: `${count("promote") + count("left")} जाएँगे · ${count("detain")} रुकेंगे`, en: `${count("promote") + count("left")} leave · ${count("detain")} stay` })
                  : L({ hi: `${count("promote")} आगे · ${count("detain")} रुके · ${count("left")} छोड़ा`, en: `${count("promote")} up · ${count("detain")} stay · ${count("left")} left` })}
              </p>
              <button type="button" onClick={() => setConfirm(true)} className="btn-primary shrink-0 px-5">
                {passOut ? L({ hi: "पास आउट करें", en: "Mark passed out" }) : L({ hi: "प्रमोट करें", en: "Promote" })}
              </button>
            </div>
          </StickyBar>
        </>
      )}

      {confirm && (
        <Sheet title={passOut ? L({ hi: "पास आउट करें?", en: "Mark as passed out?" }) : L({ hi: `${fromCls} - ${fromSec} को प्रमोट करें?`, en: `Promote ${fromCls} - ${fromSec}?` })} onClose={() => !saving && setConfirm(false)}>
          <div className="space-y-3">
            <dl className="kv">
              <div>
                <dt>{passOut ? L({ hi: "पास आउट होकर सूची से हटेंगे", en: "Pass out and leave the list" }) : L({ hi: `${toCls} - ${toSec} में जाएँगे`, en: `Move to ${toCls} - ${toSec}` })}</dt>
                <dd className="tnum">{count("promote")}</dd>
              </div>
              <div>
                <dt>{L({ hi: `${fromCls} - ${fromSec} में रुकेंगे`, en: `Stay in ${fromCls} - ${fromSec}` })}</dt>
                <dd className="tnum">{count("detain")}</dd>
              </div>
              <div>
                <dt>{L({ hi: "स्कूल छोड़ा", en: "Marked as left" })}</dt>
                <dd className="tnum">{count("left")}</dd>
              </div>
            </dl>
            {dueCount > 0 && <p className="rounded-xl bg-marigold-50 px-3 py-2 text-[13.5px] text-ink-700">{L({ hi: `इनमें से ${dueCount} की फ़ीस बाकी है। बाकी फ़ीस रिकॉर्ड में रहेगी।`, en: `${dueCount} of them still have fees due. Their dues stay on record.` })}</p>}
            <p className="text-[13.5px] text-ink-500">{L({ hi: "रिकॉर्ड और फ़ीस का हिसाब रहेगा। गलती से गया बच्चा \"सेक्शन बदलें\" या उसकी प्रोफ़ाइल से वापस लाया जा सकता है।", en: "Records and fee history are kept. A student moved by mistake can be put back from \"Change section\" or their profile." })}</p>
            <button type="button" onClick={apply} disabled={saving} className="btn-primary w-full">
              {saving ? "…" : L({ hi: "हाँ, आगे बढ़ें", en: "Yes, go ahead" })}
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/* ─────────────────────────── Change section ─────────────────────────── */

function SectionTab({ students, structure, onDone }: { students: ErpStudent[]; structure: Structure; onDone: () => void }) {
  const L = useL();
  const multi = structure.filter((c) => c.sections.length > 1);
  const [cls, setCls] = useState(multi[0]?.cls || "");
  const sections = multi.find((c) => c.cls === cls)?.sections || [];
  const [fromSec, setFromSec] = useState(sections[0] || "");
  const [toSec, setToSec] = useState(sections[1] || "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFromSec(sections[0] || "");
    setToSec(sections[1] || "");
  }, [cls]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (toSec === fromSec) setToSec(sections.find((s) => s !== fromSec) || "");
  }, [fromSec]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPicked(new Set()), [cls, fromSec, students]);

  const list = useMemo(() => students.filter((s) => s.class === cls && s.section === fromSec).sort(byRoll), [students, cls, fromSec]);
  const size = (sec: string) => students.filter((s) => s.class === cls && s.section === sec).length;

  if (!multi.length) return <Empty>{L({ hi: "हर कक्षा में एक ही सेक्शन है, इसलिए बदलने को कुछ नहीं।", en: "Every class has a single section, so there is nothing to shift." })}</Empty>;

  async function move() {
    if (!picked.size || !toSec || toSec === fromSec) return;
    setSaving(true);
    try {
      const res = await moveStudents(Array.from(picked).map((id) => ({ id, class: cls, section: toSec })));
      toast(true, L({ hi: `${res.moved} बच्चे ${cls} - ${fromSec} से ${cls} - ${toSec} में गए।`, en: `${res.moved} moved from ${cls} - ${fromSec} to ${cls} - ${toSec}.` }));
      onDone();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "नहीं बदला।", en: "Could not move." }));
    } finally {
      setSaving(false);
    }
  }
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const studentsWord = L({ hi: "बच्चे", en: "students" });

  return (
    <>
      <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={cls} onChange={setCls}>
        {multi.map((c) => (
          <option key={c.cls} value={c.cls}>
            {c.cls}
          </option>
        ))}
      </SelectBox>
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "इस सेक्शन से", en: "From" })} value={fromSec} onChange={setFromSec}>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s} ({size(s)} {studentsWord})
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "इसमें", en: "To" })} value={toSec} onChange={setToSec}>
          {sections
            .filter((s) => s !== fromSec)
            .map((s) => (
              <option key={s} value={s}>
                {s} ({size(s)} {studentsWord})
              </option>
            ))}
        </SelectBox>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="mlabel">
          {cls} - {fromSec} · {L({ hi: "जिन्हें बदलना है उन्हें चुनें", en: "tick the students to shift" })}
        </p>
        <button type="button" onClick={() => setPicked(picked.size === list.length ? new Set() : new Set(list.map((s) => s.id)))} className="min-h-[36px] px-1 text-[13px] font-semibold text-brand-600">
          {picked.size === list.length ? L({ hi: "हटाएँ", en: "Clear" }) : L({ hi: "सब चुनें", en: "Select all" })}
        </button>
      </div>
      <ul className="pb-20">
        {list.map((s) => {
          const on = picked.has(s.id);
          return (
            <li key={s.id}>
              <button type="button" onClick={() => toggle(s.id)} aria-pressed={on} className={clsx("flex min-h-[60px] w-full items-center gap-3 border-b border-ink-100 text-left", on && "bg-brand-50")}>
                <span className={clsx("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px]", on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white")}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />}</span>
                <span className="tnum w-6 shrink-0 text-right text-[13px] text-ink-400">{s.rollNo || "—"}</span>
                <Avatar name={s.name} url={s.photoUrl || null} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{s.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-400">{s.fatherName || "—"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {picked.size > 0 && (
        <StickyBar>
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-[13px] text-ink-600">
              {picked.size} {L({ hi: "चुने", en: "selected" })}
            </p>
            <button type="button" onClick={move} disabled={saving} className="btn-primary shrink-0 px-5">
              {saving ? "…" : L({ hi: `${cls} - ${toSec} में भेजें`, en: `Move to ${cls} - ${toSec}` })}
            </button>
          </div>
        </StickyBar>
      )}
    </>
  );
}
