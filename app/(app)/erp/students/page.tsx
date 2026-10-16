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
 * ERP login → All students: the ERP website's students list (views, search, class/section/gender/category
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
  const [gender, setGender] = useState("all");
  const [category, setCategory] = useState("all");
  const [shown, setShown] = useState(STEP);
  const [focus, setFocus] = useState(false);

  useEffect(() => setFocus(new URLSearchParams(window.location.search).get("search") === "1"), []);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setShown(STEP), [view, term, cls, section, gender, category]);

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
          if (gender !== "all" && s.gender !== gender) return false;
          if (category !== "all" && s.category !== category) return false;
          return true;
        })
        .sort((a, b) => classRank(a.class) - classRank(b.class) || a.section.localeCompare(b.section) || (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }) || a.name.localeCompare(b.name)),
    [all, view, term, cls, section, gender, category]
  );

  const filtersOn = !!term || cls !== "all" || section !== "all" || gender !== "all" || category !== "all";
  const reset = () => {
    setQ("");
    setCls("all");
    setSection("all");
    setGender("all");
    setCategory("all");
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
        <SelectBox label={L({ hi: "लड़का / लड़की", en: "Gender" })} value={gender} onChange={setGender}>
          <option value="all">{any}</option>
          <option value="Male">{L({ hi: "लड़के", en: "Boys" })}</option>
          <option value="Female">{L({ hi: "लड़कियाँ", en: "Girls" })}</option>
        </SelectBox>
        <SelectBox label={L({ hi: "श्रेणी", en: "Category" })} value={category} onChange={setCategory}>
          <option value="all">{any}</option>
          {["General", "OBC", "SC", "ST"].map((c) => (
            <option key={c} value={c}>
              {c}
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
          <div className="flex items-center justify-between">
            <p className="mlabel tnum">
              {list.length.toLocaleString("en-IN")} {L({ hi: "बच्चे", en: "students" })}
            </p>
            {filtersOn && (
              <button type="button" onClick={reset} className="min-h-[36px] px-1 text-[13.5px] font-semibold text-brand-600">
                {L({ hi: "फ़िल्टर हटाएँ", en: "Clear filters" })}
              </button>
            )}
          </div>
          <ul>
            {list.slice(0, shown).map((s) => (
              <li key={s.id}>
                <Link href={`/erp/students/detail/?id=${encodeURIComponent(s.id)}`} className="flex min-h-[64px] items-center gap-3 border-b border-ink-100 active:bg-ink-50">
                  <Avatar name={s.name} url={s.photoUrl || null} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium">
                      {s.name}
                      {s.status === "Inactive" && <span className="ml-1.5 text-[12px] font-normal text-ink-400">({L({ hi: "छोड़ गया", en: "Left" })})</span>}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-400">
                      {s.classSec} · {parentLine(s)}
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
              {L({ hi: "और दिखाएँ", en: "Show more" })} ({(list.length - shown).toLocaleString("en-IN")})
            </button>
          )}
        </>
      )}
    </div>
  );
}
