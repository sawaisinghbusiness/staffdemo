"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Printer, RotateCw, Search } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { classRank, type ErpStudent } from "@/lib/erpStudents";
import { CARD_H, CARD_W, IdCardBack, IdCardFront, IdCardSheet, PER_SHEET, type CardSchool } from "@/components/erp/IdCardPrint";
import { PrintReportCards } from "@/components/erp/PrintReportCards";
import { Avatar, Empty, ErrorCard, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";

/*
 * ERP login → Students → ID cards: the ERP's ID card page. Pick a class/section, untick anyone who
 * should not get one, see a child's card (tap to turn it over), and print nine to an A4 sheet,
 * fronts then mirrored backs, exactly as the ERP prints them (same card component, copied).
 */

const MM = 96 / 25.4;
const bySectionRoll = (a: ErpStudent, b: ErpStudent) => a.section.localeCompare(b.section) || (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }) || a.name.localeCompare(b.name);
const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export default function ErpIdCardsPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: ErpStudent[] }>("/erp/students");
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const { data: ses } = useApi<{ session: { label: string; end: string } }>("/erp/school/session");
  const [cls, setCls] = useState("");
  const [sec, setSec] = useState("");
  const [q, setQ] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const school: CardSchool = {
    name: p?.school_name || "School",
    short: p?.short_name || "SCH",
    logoUrl: p?.logo_url || undefined,
    address: [p?.address, p?.city, [p?.state, p?.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    phone: p?.contact1 || undefined,
    affiliation: p?.affiliation_no ? `${p.board || "CBSE"} Affiliation No. ${p.affiliation_no}` : undefined,
    session: ses?.session.label || "2026-27",
    validTill: ses?.session.end ? longDate(ses.session.end) : undefined,
  };

  const students = useMemo(() => (data?.data || []).filter((s) => s.status !== "Inactive"), [data]);
  const classes = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const s of students) {
      if (!m.has(s.class)) m.set(s.class, new Map());
      const secs = m.get(s.class)!;
      secs.set(s.section, (secs.get(s.section) || 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => classRank(a[0]) - classRank(b[0]))
      .map(([name, secs]) => ({ name, total: Array.from(secs.values()).reduce((a, b) => a + b, 0), sections: Array.from(secs.entries()).sort((a, b) => a[0].localeCompare(b[0])) }));
  }, [students]);
  useEffect(() => {
    if (!cls && classes.length) setCls(classes[0].name);
  }, [classes, cls]);
  // A new class or section starts with everyone ticked.
  useEffect(() => {
    setExcluded(new Set());
    setQ("");
    setPreviewId(null);
  }, [cls, sec]);

  const inClass = useMemo(() => students.filter((s) => s.class === cls && (!sec || s.section === sec)).sort(bySectionRoll), [students, cls, sec]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? inClass.filter((s) => s.name.toLowerCase().includes(t) || s.srNo.toLowerCase().includes(t) || (s.rollNo || "").replace(/^0+/, "") === t.replace(/^0+/, "")) : inClass;
  }, [inClass, q]);
  const chosen = useMemo(() => inClass.filter((s) => !excluded.has(s.id)), [inClass, excluded]);
  const sheets = useMemo(() => chunk(chosen, PER_SHEET), [chosen]);
  const preview = inClass.find((s) => s.id === previewId) || chosen[0] || inClass[0];

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShownTicked = shown.length > 0 && shown.every((s) => !excluded.has(s.id));
  const tickShown = (on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      shown.forEach((s) => (on ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  const sections = classes.find((c) => c.name === cls)?.sections || [];

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />;
  if (!students.length) return <Empty>{L({ hi: "अभी कोई बच्चा नहीं। पहले बच्चे जोड़ें; उनके कार्ड यहाँ कक्षा के हिसाब से दिखेंगे।", en: "No students yet. Add students first; their cards appear here class by class." })}</Empty>;

  return (
    <div className="animate-rise space-y-3 pb-20">
      {preview && <FlipCard key={preview.id} s={preview} school={school} />}

      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox
          label={L({ hi: "कक्षा", en: "Class" })}
          value={cls}
          onChange={(v) => {
            setCls(v);
            setSec("");
          }}
        >
          {classes.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.total})
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={sec} onChange={setSec}>
          <option value="">{L({ hi: "सभी", en: "All" })}</option>
          {sections.map(([name, n]) => (
            <option key={name} value={name}>
              {name} ({n})
            </option>
          ))}
        </SelectBox>
      </div>
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="idc-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, SR या रोल नं.", en: "Name, SR or roll no." })} autoComplete="off" />
      </label>

      <label className="flex min-h-[48px] items-center gap-3 border-b border-ink-100 text-[14px]">
        <input type="checkbox" checked={allShownTicked} onChange={(e) => tickShown(e.target.checked)} className="h-5 w-5 accent-brand-600" />
        <span className="font-semibold">{q ? L({ hi: "जितने मिले, सब", en: "All matching" }) : L({ hi: "सभी", en: "Everyone" })}</span>
        <span className="tnum ml-auto text-ink-500">
          {chosen.length} {L({ hi: "चुने", en: "selected" })}
        </span>
      </label>
      <ul>
        {shown.map((s) => {
          const on = !excluded.has(s.id);
          const active = preview?.id === s.id;
          return (
            <li key={s.id} className={clsx("flex items-center border-b border-ink-100", active && "bg-brand-50")}>
              <label className="flex h-14 w-10 shrink-0 cursor-pointer items-center">
                <input type="checkbox" checked={on} onChange={() => toggle(s.id)} aria-label={`${L({ hi: "कार्ड छापें", en: "Print card for" })} ${s.name}`} className="h-5 w-5 accent-brand-600" />
              </label>
              <button
                type="button"
                onClick={() => {
                  setPreviewId(s.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                aria-current={active || undefined}
                className="flex h-14 min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Avatar name={s.name} url={s.photoUrl || null} size={36} />
                <span className={clsx("min-w-0 flex-1 truncate text-[15px] font-medium", !on && "text-ink-400")}>{s.name}</span>
                <span className="tnum shrink-0 text-[12.5px] text-ink-400">{s.rollNo || "—"}</span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="py-8 text-center text-[14px] text-ink-500">{L({ hi: `“${q}” से कोई नहीं मिला।`, en: `Nobody matches “${q}”.` })}</li>}
      </ul>

      <StickyBar>
        <button type="button" onClick={() => setPrinting(true)} disabled={!chosen.length} className="btn-primary w-full">
          <Printer className="h-4 w-4" aria-hidden /> {chosen.length === 1 ? L({ hi: "1 कार्ड छापें", en: "Print 1 card" }) : L({ hi: `${chosen.length} कार्ड छापें`, en: `Print ${chosen.length} cards` })}
        </button>
      </StickyBar>

      {printing && (
        <PrintReportCards onDone={() => setPrinting(false)}>
          {sheets.flatMap((group, i) => [<IdCardSheet key={`f${i}`} students={group} side="front" school={school} />, <IdCardSheet key={`b${i}`} students={group} side="back" school={school} />])}
        </PrintReportCards>
      )}
    </div>
  );
}

/** The chosen child's card at a readable size; a tap turns it over (ERP FlipCard). */
function FlipCard({ s, school }: { s: ErpStudent; school: CardSchool }) {
  const L = useL();
  const ref = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [scale, setScale] = useState(1.2);
  useEffect(() => {
    const fit = () => setScale(Math.max(0.8, Math.min(1.35, (ref.current?.clientWidth || 0) / (CARD_W * MM))));
    fit();
    const ro = new ResizeObserver(fit);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const w = CARD_W * MM * scale;
  const h = CARD_H * MM * scale;
  const turn = () => setFlipped((f) => !f);

  return (
    <div ref={ref} className="flex w-full flex-col items-center pt-1">
      <div className="[perspective:1600px]" style={{ width: w, height: h }}>
        <div
          role="button"
          tabIndex={0}
          onClick={turn}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              turn();
            }
          }}
          aria-pressed={flipped}
          aria-label={flipped ? `${L({ hi: "आगे का हिस्सा", en: "Show the front of" })} ${s.name}` : `${L({ hi: "पीछे का हिस्सा", en: "Show the back of" })} ${s.name}`}
          className="relative h-full w-full cursor-pointer select-none rounded-[3mm] transition-transform duration-700 [transform-style:preserve-3d] [transition-timing-function:cubic-bezier(0.3,0.9,0.3,1)] motion-reduce:duration-0"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          <Face scale={scale}>
            <IdCardFront s={s} school={school} />
          </Face>
          <Face scale={scale} back>
            <IdCardBack s={s} school={school} />
          </Face>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-500">
        <RotateCw className="h-3.5 w-3.5" aria-hidden />
        {flipped ? L({ hi: "पीछे · आगे देखने के लिए छुएँ", en: "Back · tap to see the front" }) : L({ hi: "आगे · पीछे देखने के लिए छुएँ", en: "Front · tap to see the back" })}
      </p>
    </div>
  );
}

function Face({ scale, back, children }: { scale: number; back?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx("absolute inset-0 overflow-hidden rounded-[3mm] shadow-[0_1px_2px_rgba(16,24,40,0.06),0_10px_24px_-8px_rgba(16,24,40,0.22)] [backface-visibility:hidden]", back && "[transform:rotateY(180deg)]")}>
      <div style={{ width: `${CARD_W}mm`, height: `${CARD_H}mm`, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
