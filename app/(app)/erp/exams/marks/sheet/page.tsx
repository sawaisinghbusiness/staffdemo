"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { gradeFor, markProblem, totalOf } from "@/lib/erpGrading";
import type { Sheet } from "@/lib/erpExams";
import { Empty, ErrorCard, ListSkeleton, StickyBar } from "@/components/ui";

/*
 * ERP login → one subject's marks for one section: the ERP's MarkSheetDrawer down a phone screen. Type the marks
 * ("a" = absent), Next on the keyboard moves down; grades and the out-of-range check are the ERP's own
 * (lib/erpGrading). PUT /api/exams/:id/sheet saves. A locked exam is view only.
 */

interface Row {
  studentId: string;
  rollNo: string;
  name: string;
  values: Record<string, string>;
  absent: boolean;
}
type Q = { exam: string; section: string; subject: string };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function ErpMarkSheetPage() {
  const [q, setQ] = useState<Q | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ exam: p.get("exam") || "", section: p.get("section") || "", subject: p.get("subject") || "" });
  }, []);
  if (!q) return <ListSkeleton rows={6} />;
  return <MarkSheet key={`${q.exam}|${q.section}|${q.subject}`} {...q} />;
}

function MarkSheet({ exam: examId, section, subject }: Q) {
  const L = useL();
  const enc = encodeURIComponent;
  const { data: sheet, error, reload } = useApi<Sheet>(`/erp/exams/${examId}/sheet?section=${enc(section)}&subject=${enc(subject)}`);
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!sheet) return;
    const rs: Row[] = sheet.rows.map((r) => ({ studentId: r.studentId, rollNo: r.rollNo, name: r.name, absent: r.absent, values: Object.fromEntries(sheet.exam.components.map((p) => [p.key, typeof r.marks[p.key] === "number" ? String(r.marks[p.key]) : ""])) }));
    setRows(rs);
    setSaved(JSON.stringify(rs));
  }, [sheet]);

  const parts = useMemo(() => sheet?.exam.components || [], [sheet]);
  const max = sheet?.exam.max || 100;
  const locked = !!sheet?.exam.locked;
  const dirty = !!sheet && JSON.stringify(rows) !== saved;
  const problems = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (r.absent) continue;
      for (const p of parts) {
        const v = r.values[p.key];
        if (v === "") continue;
        const msg = markProblem(p, Number(v));
        if (msg) out[`${r.studentId}|${p.key}`] = msg;
      }
    }
    return out;
  }, [rows, parts]);
  const badCount = Object.keys(problems).length;
  const filled = rows.filter((r) => r.absent || parts.some((p) => r.values[p.key] !== "")).length;
  const partial = rows.filter((r) => !r.absent && parts.some((p) => r.values[p.key] !== "") && parts.some((p) => r.values[p.key] === "")).length;

  // Leaving with unsaved marks loses them: ask first.
  useEffect(() => {
    if (!dirty || locked) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty, locked]);

  if (!sheet) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={8} />;

  const setValue = (i: number, key: string, raw: string) => {
    // Typing "a" (or "ab") marks the child absent.
    if (/^a/i.test(raw.trim())) {
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, absent: true, values: Object.fromEntries(parts.map((p) => [p.key, ""])) } : r)));
      return;
    }
    const clean = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 6);
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, absent: false, values: { ...r.values, [key]: clean } } : r)));
  };
  const toggleAbsent = (i: number) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, absent: !r.absent, values: r.absent ? r.values : Object.fromEntries(parts.map((p) => [p.key, ""])) } : r)));
  const focusCell = (row: number, col: number) => {
    const el = list.current?.querySelector<HTMLInputElement>(`input[data-cell="${row}-${col}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  };

  async function save() {
    if (locked) return;
    if (badCount) return toast(false, L({ hi: "पहले लाल वाले अंक ठीक करें।", en: "Fix the marks shown in red first." }));
    setBusy(true);
    try {
      await api(`/erp/exams/${examId}/sheet`, {
        method: "PUT",
        body: { section, subject, rows: rows.map((r) => ({ studentId: r.studentId, absent: r.absent, marks: Object.fromEntries(parts.map((p) => [p.key, r.values[p.key] === "" ? null : Number(r.values[p.key])])) })) },
      });
      setSaved(JSON.stringify(rows));
      toast(true, L({ hi: `${subject}, ${section}: अंक सेव हुए।`, en: `${subject}, ${section}: marks saved.` }));
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "अंक सेव नहीं हुए।", en: "Could not save the marks." }));
    } finally {
      setBusy(false);
    }
  }

  const unit = sheet.exam.scope?.[section.split(" - ")[0]]?.units?.[subject];

  return (
    <div className="animate-rise space-y-3 pb-20">
      <div>
        <p className="text-[18px] font-bold">
          {subject} · {section}
        </p>
        <p className="text-[12.5px] text-ink-500">
          {sheet.exam.title} · {L({ hi: "पूर्णांक", en: "out of" })} {max}
          {unit ? ` · ${unit}` : ""}
          {sheet.lastSaved ? ` · ${L({ hi: "आख़िरी सेव", en: "last saved" })} ${when(sheet.lastSaved.at)}${sheet.lastSaved.by ? ` · ${sheet.lastSaved.by.split(" (")[0]}` : ""}` : ""}
        </p>
      </div>
      {locked ? (
        <p className="flex items-center gap-2 rounded-xl bg-ink-100 px-3 py-2 text-[13.5px] text-ink-700">
          <Lock className="h-4 w-4 shrink-0" aria-hidden /> {L({ hi: "एडमिन ने बंद किया है: सिर्फ़ देख सकते हैं", en: "Locked by the admin: view only" })}
        </p>
      ) : (
        <p className="text-[12.5px] text-ink-500">{L({ hi: "कीबोर्ड पर आगे दबाएँ तो अगला बच्चा · a लिखें = अनुपस्थित", en: "Next on the keyboard moves down · type a for absent" })}</p>
      )}

      {rows.length === 0 ? (
        <Empty>{L({ hi: `${sheet.classSec} में कोई बच्चा नहीं।`, en: `No students in ${sheet.classSec}.` })}</Empty>
      ) : (
        <ul ref={list}>
          {rows.map((r, i) => {
            const nums = Object.fromEntries(parts.map((p) => [p.key, r.values[p.key] === "" ? null : Number(r.values[p.key])]));
            const total = r.absent ? null : totalOf(parts, nums);
            const bad = parts.some((p) => problems[`${r.studentId}|${p.key}`]);
            return (
              <li key={r.studentId} className={clsx("border-b border-ink-100 py-2", r.absent && "bg-ink-50", bad && "bg-rose-50/60")}>
                <div className="flex items-center gap-2">
                  <span className="tnum w-6 shrink-0 text-right text-[13px] text-ink-400">{r.rollNo || i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{r.name}</span>
                  {parts.length === 1 &&
                    parts.map((p, c) => {
                      const msg = problems[`${r.studentId}|${p.key}`];
                      return (
                        <input
                          key={p.key}
                          data-cell={`${i}-${c}`}
                          value={r.absent ? "AB" : r.values[p.key]}
                          onChange={(e) => setValue(i, p.key, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), focusCell(i + 1, 0))}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={locked}
                          inputMode="decimal"
                          enterKeyHint="next"
                          aria-label={`${r.name}, ${p.name}`}
                          aria-invalid={!!msg}
                          className={clsx("tnum h-11 w-20 shrink-0 rounded-lg border bg-white px-2 text-right text-[16px] outline-none focus:border-brand-500 disabled:bg-transparent", msg ? "border-rose-400 text-rose-700" : r.absent ? "border-transparent bg-transparent font-semibold text-ink-400" : "border-ink-200")}
                        />
                      );
                    })}
                  <span className="w-8 shrink-0 text-center text-[13px] font-semibold text-ink-600">{total !== null && !bad ? gradeFor((total / max) * 100) : ""}</span>
                  <label className="flex w-12 shrink-0 flex-col items-center text-[10.5px] font-semibold text-ink-400">
                    <input type="checkbox" checked={r.absent} onChange={() => toggleAbsent(i)} disabled={locked} aria-label={`${r.name} ${L({ hi: "अनुपस्थित", en: "absent" })}`} className="h-5 w-5 accent-ink-700" />
                    AB
                  </label>
                </div>
                {parts.length > 1 && (
                  <div className="ml-8 mt-1.5 flex flex-wrap items-end gap-2">
                    {parts.map((p, c) => {
                      const msg = problems[`${r.studentId}|${p.key}`];
                      return (
                        <label key={p.key} className="w-[76px]">
                          <span className="block truncate text-[11px] text-ink-500">
                            {p.name} /{p.max}
                          </span>
                          <input
                            data-cell={`${i}-${c}`}
                            value={r.absent ? "AB" : r.values[p.key]}
                            onChange={(e) => setValue(i, p.key, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), c + 1 < parts.length ? focusCell(i, c + 1) : focusCell(i + 1, 0))}
                            onFocus={(e) => e.currentTarget.select()}
                            disabled={locked}
                            inputMode="decimal"
                            enterKeyHint="next"
                            aria-label={`${r.name}, ${p.name}`}
                            aria-invalid={!!msg}
                            className={clsx("tnum h-10 w-full rounded-lg border bg-white px-2 text-right text-[16px] outline-none focus:border-brand-500 disabled:bg-transparent", msg ? "border-rose-400 text-rose-700" : r.absent ? "border-transparent bg-transparent font-semibold text-ink-400" : "border-ink-200")}
                          />
                        </label>
                      );
                    })}
                    <span className="tnum pb-2 text-[14px] font-semibold">= {bad ? "" : total ?? ""}</span>
                  </div>
                )}
                {bad && <p className="ml-8 mt-1 text-[12px] text-rose-700">{parts.map((p) => problems[`${r.studentId}|${p.key}`]).filter(Boolean)[0]}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {!locked && (
        <StickyBar>
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-[12.5px] text-ink-600">
              {filled} / {rows.length} {L({ hi: "भरे", en: "entered" })}
              {partial > 0 && <span className="text-marigold-700"> · {partial} {L({ hi: "अधूरे", en: "incomplete" })}</span>}
              {badCount > 0 && <span className="font-semibold text-rose-600"> · {badCount} {L({ hi: "ग़लत", en: "to fix" })}</span>}
            </p>
            <button type="button" onClick={save} disabled={busy || !dirty || badCount > 0} className="btn-primary shrink-0 px-5">
              {busy ? "…" : dirty ? L({ hi: "अंक सेव करें", en: "Save marks" }) : L({ hi: "सेव है", en: "Saved" })}
            </button>
          </div>
        </StickyBar>
      )}
    </div>
  );
}
