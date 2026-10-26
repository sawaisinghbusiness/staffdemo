"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { classRank, matchesStudent, parentLine, type ErpStudent } from "@/lib/erpStudents";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Status } from "@/components/ui";

type View = "all" | "due" | "paid" | "bus";
const STEP = 30;

/**
 * ERP login → All students: the ERP website's students list (views, search, class/section
 * filters, fee due per student) drawn with the staff app's own parts.
 */
export default function ErpStudentsPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: ErpStudent[] }>("/erp/students");
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [cls, setCls] = useState("all");
  const [section, setSection] = useState("all");
  const [shown, setShown] = useState(STEP);
  const [focus, setFocus] = useState(false);
  // ?new=month (from Report → New admissions): only children admitted this month.
  const [newMonth, setNewMonth] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setFocus(qs.get("search") === "1");
    if (qs.get("new") === "month") {
      const d = new Date();
      setNewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setShown(STEP), [view, term, cls, section, newMonth]);

  const all = useMemo(() => data?.data || [], [data]);
  const classes = useMemo(() => Array.from(new Set(all.map((s) => s.class))).sort((a, b) => classRank(a) - classRank(b)), [all]);
  const sections = useMemo(() => Array.from(new Set(all.filter((s) => cls === "all" || s.class === cls).map((s) => s.section))).sort(), [all, cls]);
  const counts = useMemo(() => {
    const due = all.filter((s) => s.balanceFee > 0).length;
    return { all: all.length, due, paid: all.length - due, bus: all.filter((s) => s.transportOpted).length };
  }, [all]);

  const list = useMemo(
    () =>
      all
        .filter((s) => {
          if (view === "due" && !(s.balanceFee > 0)) return false;
          if (view === "paid" && s.balanceFee > 0) return false;
          if (view === "bus" && !s.transportOpted) return false;
          if (term && !matchesStudent(s, term)) return false;
          if (cls !== "all" && s.class !== cls) return false;
          if (section !== "all" && s.section !== section) return false;
          if (newMonth && (s.createdAt || "").slice(0, 7) !== newMonth) return false;
          return true;
        })
        .sort((a, b) => classRank(a.class) - classRank(b.class) || a.section.localeCompare(b.section) || (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }) || a.name.localeCompare(b.name)),
    [all, view, term, cls, section, newMonth]
  );

  const filtersOn = !!term || cls !== "all" || section !== "all" || !!newMonth;
  const reset = () => {
    setQ("");
    setCls("all");
    setSection("all");
    setNewMonth("");
  };
  const any = L({ hi: "सभी", en: "All" });
  const n = (k: number) => (data ? ` ${k.toLocaleString("en-IN")}` : "");

  return (
    <div className="animate-rise space-y-3">
      <LineTabs
        label={L({ hi: "बच्चे", en: "Students" })}
        value={view}
        onChange={setView}
        options={[
          { key: "all", text: `${L({ hi: "सभी", en: "All" })}${n(counts.all)}` },
          { key: "due", text: `${L({ hi: "बाकी", en: "Due" })}${n(counts.due)}` },
          { key: "paid", text: `${L({ hi: "पूरी", en: "Paid" })}${n(counts.paid)}` },
          { key: "bus", text: `${L({ hi: "बस", en: "Bus" })}${n(counts.bus)}` },
        ]}
      />

      {newMonth && (
        <div className="flex items-center gap-2 text-[14px]">
          <span className="flex-1 font-semibold">{L({ hi: "इस महीने नए प्रवेश", en: "New admissions this month" })}</span>
          <button type="button" onClick={() => setNewMonth("")} className="min-h-[40px] px-1 text-[13.5px] font-semibold text-brand-600">
            {L({ hi: "सभी बच्चे दिखाएँ", en: "Show all students" })}
          </button>
        </div>
      )}

      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input
          id="erp-student-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={L({ hi: "नाम, SR नं., पिता या मोबाइल", en: "Name, SR no., father or mobile" })}
          autoFocus={focus}
          enterKeyHint="search"
          autoComplete="off"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox
          label={L({ hi: "कक्षा", en: "Class" })}
          value={cls}
          onChange={(v) => {
            setCls(v);
            setSection("all");
          }}
        >
          <option value="all">{any}</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "सेक्शन", en: "Section" })} value={section} onChange={setSection}>
          <option value="all">{any}</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectBox>
      </div>

      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={6} />
      ) : list.length === 0 ? (
        <>
          <Empty>{L({ hi: "कोई बच्चा नहीं मिला।", en: "No student found." })}</Empty>
          {filtersOn && (
            <button type="button" onClick={reset} className="btn-line w-full">
              {L({ hi: "खोज और फ़िल्टर हटाएँ", en: "Clear search and filters" })}
            </button>
          )}
        </>
      ) : (
        <>
          {filtersOn && (
            <div className="flex justify-end">
              <button type="button" onClick={reset} className="min-h-[36px] px-1 text-[13.5px] font-semibold text-brand-600">
                {L({ hi: "फ़िल्टर हटाएँ", en: "Clear filters" })}
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {list.slice(0, shown).map((s) => (
              <li key={s.id}>
                <Link href={`/erp/students/detail/?id=${encodeURIComponent(s.id)}`} className="row-card flex min-h-[64px] items-center gap-2.5 !pr-2">
                  <Avatar name={s.name} url={s.photoUrl || null} size={40} />
                  <span className="min-w-0 flex-1">
                    {/* Name alone on the first line so it shows in full on a 360px phone; class moves under it. */}
                    <span className="flex min-w-0 items-baseline gap-1 text-[15.5px] font-medium">
                      <span className="truncate">{s.name}</span>
                      {s.status === "Inactive" && <span className="shrink-0 text-[12px] font-normal text-ink-400">({L({ hi: "छोड़ गया", en: "Left" })})</span>}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-400">
                      <span className="font-medium text-ink-600">
                        {s.class} {s.section}
                      </span>{" "}
                      · {parentLine(s)}
                    </span>
                  </span>
                  {s.balanceFee > 0 ? <Status tone="bad">{rupees(s.balanceFee)}</Status> : <Status tone="ok">{L({ hi: "पूरी", en: "Paid" })}</Status>}
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {list.length > shown && (
            <button type="button" onClick={() => setShown((k) => k + STEP * 2)} className="btn-line w-full">
              {L({ hi: "और लोड करें", en: "Load more" })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
