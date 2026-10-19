"use client";

import { useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CalendarDays, Check, ChevronDown } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import type { ClassMoney, ClasswiseReport, CollectionReport } from "@/lib/erpReports";
import { Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Fees → Reports: the ERP's fee reports (GET /api/reports/collection and /classwise), same
 * ranges and the same four views, as lists instead of wide tables. Cancelled receipts are not counted.
 * Excel export stays on the ERP website.
 */

type Tab = "daybook" | "heads" | "collectors" | "classes";
type Preset = "today" | "week" | "month" | "session" | "custom";
const SESSION = { short: "2026-27", start: "2026-04-01", end: "2027-03-31" };
const MAX_DAYS = 400;
const MODE_COLOR = { Cash: "#2a78d6", UPI: "#eb6834", Cheque: "#1baf7a" } as const;

// The ERP's figure formats (components/fees/reports/tables).
const inr = (n: number) => (n < 0 ? "−" : "") + "₹" + Math.abs(Math.round(n || 0)).toLocaleString("en-IN");
const lakh = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : inr(n));
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const pctText = (p: number) => (p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`);
const dayLabel = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const num = (x: number) => x.toLocaleString("en-IN");

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
const long = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** ERP rangeFor: the week starts on Monday, the session runs April to March. */
function rangeFor(p: Exclude<Preset, "custom">): { from: string; to: string } {
  const today = todayIST();
  if (p === "today") return { from: today, to: today };
  if (p === "week") {
    const dow = new Date(today + "T00:00:00Z").getUTCDay();
    return { from: addDays(today, -((dow + 6) % 7)), to: today };
  }
  if (p === "month") return { from: today.slice(0, 8) + "01", to: today };
  return { from: SESSION.start, to: today < SESSION.end ? today : SESSION.end };
}
function rangeLabel(from: string, to: string) {
  if (from === to) return long(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${long(to)}`;
  return from.slice(0, 4) === to.slice(0, 4) ? `${short(from)} – ${long(to)}` : `${long(from)} – ${long(to)}`;
}

const PRESETS: [Preset, Bi][] = [
  ["today", { hi: "आज", en: "Today" }],
  ["week", { hi: "इस हफ़्ते", en: "This week" }],
  ["month", { hi: "इस महीने", en: "This month" }],
  ["session", { hi: "पूरा सत्र", en: "This session" }],
  ["custom", { hi: "तारीख चुनें", en: "Custom" }],
];

export default function ErpFeeReportsPage() {
  const L = useL();
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState(() => rangeFor("month"));
  const [draft, setDraft] = useState(range);
  const [tab, setTab] = useState<Tab>("daybook");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rep = useApi<CollectionReport>(`/erp/reports/collection?from=${range.from}&to=${range.to}`);
  const cls = useApi<ClasswiseReport>(tab === "classes" ? "/erp/reports/classwise" : null);
  // Never show another range's figures under this range's title.
  const report = rep.data && rep.data.from === range.from && rep.data.to === range.to ? rep.data : undefined;

  const pickPreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return setDraft(range);
    setRange(rangeFor(p));
  };
  const draftProblem = !draft.from || !draft.to ? L({ hi: "दोनों तारीखें चुनें।", en: "Pick both dates." }) : draft.from > draft.to ? L({ hi: "शुरू की तारीख बाद की है।", en: "The start date is after the end date." }) : daysBetween(draft.from, draft.to) > MAX_DAYS ? L({ hi: `${MAX_DAYS} दिन या कम चुनें।`, en: `Pick ${MAX_DAYS} days or less.` }) : null;
  const setDraftDate = (k: "from" | "to", v: string) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    if (next.from && next.to && next.from <= next.to && daysBetween(next.from, next.to) <= MAX_DAYS) setRange(next);
  };

  const t = report?.totals;
  const fig = (v: number | undefined) => (v === undefined ? "…" : lakh(v));
  const share = (v: number) => (t && t.total ? `${pctText(pct(v, t.total))} ${L({ hi: "जमा का", en: "of collected" })}` : "");

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="no-scrollbar stick-chips flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label={L({ hi: "तारीख", en: "Date range" })}>
        {PRESETS.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={preset === k} onClick={() => pickPreset(k)} className={clsx("min-h-[38px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold", preset === k ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-600")}>
            {L(label)}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="field-box">
              <small>{L({ hi: "से", en: "From" })}</small>
              <input id="rep-from" type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraftDate("from", e.target.value)} />
              <CalendarDays aria-hidden />
            </label>
            <label className="field-box">
              <small>{L({ hi: "तक", en: "To" })}</small>
              <input id="rep-to" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraftDate("to", e.target.value)} />
              <CalendarDays aria-hidden />
            </label>
          </div>
          {draftProblem && <p className="text-[13px] font-medium text-rose-700">{draftProblem}</p>}
        </>
      )}
      <p className="text-[13px] text-ink-500">
        {rangeLabel(range.from, range.to)}
        {report ? ` · ${num(report.totals.receipts)} ${L({ hi: "रसीदें", en: "receipts" })}` : ""} · {L({ hi: "रद्द रसीदें नहीं गिनीं", en: "cancelled receipts not counted" })}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Figure label={L({ hi: "जमा", en: "Collected" })} value={fig(t?.total)} note={t ? `${num(t.receipts)} ${L({ hi: "रसीदें", en: "receipts" })}${t.byMode.Other ? ` · ${inr(t.byMode.Other)} other` : ""}` : ""} dot="bg-jade-500" />
        <Figure label={L({ hi: "नकद", en: "Cash" })} value={fig(t?.byMode.Cash)} note={t ? share(t.byMode.Cash) : ""} color={MODE_COLOR.Cash} />
        <Figure label="UPI" value={fig(t?.byMode.UPI)} note={t ? share(t.byMode.UPI) : ""} color={MODE_COLOR.UPI} />
        <Figure label={L({ hi: "चेक / DD", en: "Cheque / DD" })} value={fig(t?.byMode.Cheque)} note={t ? share(t.byMode.Cheque) : ""} color={MODE_COLOR.Cheque} />
      </div>

      <LineTabs
        label={L({ hi: "रिपोर्ट", en: "Report" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "daybook", text: L({ hi: "रोज़", en: "Day book" }) },
          { key: "heads", text: L({ hi: "हेड", en: "Heads" }) },
          { key: "collectors", text: L({ hi: "किसने", en: "Collector" }) },
          { key: "classes", text: L({ hi: "कक्षा", en: "Classes" }) },
        ]}
      />

      {tab === "classes" ? (
        !cls.data ? (
          cls.error && cls.error.status !== 401 ? <ErrorCard offline={cls.error.status === 0} onRetry={cls.reload} /> : <ListSkeleton rows={5} />
        ) : cls.data.classes.length === 0 ? (
          <Empty>{L({ hi: "इस सत्र में अभी किसी बच्चे का फ़ीस खाता नहीं।", en: "No active students have a fee ledger for this session yet." })}</Empty>
        ) : (
          <ClassList report={cls.data} open={open} onToggle={(c) => setOpen((p) => (p.has(c) ? new Set(Array.from(p).filter((x) => x !== c)) : new Set(p).add(c)))} />
        )
      ) : !report ? (
        rep.error && rep.error.status !== 401 ? <ErrorCard offline={rep.error.status === 0} onRetry={rep.reload} /> : <ListSkeleton rows={5} />
      ) : report.totals.receipts === 0 ? (
        <Empty>{range.from === range.to ? L({ hi: `${long(range.from)} को कोई फ़ीस जमा नहीं हुई।`, en: `No fee was collected on ${long(range.from)}.` }) : L({ hi: `${short(range.from)} से ${long(range.to)} तक कोई फ़ीस जमा नहीं हुई।`, en: `No fee was collected between ${short(range.from)} and ${long(range.to)}.` })}</Empty>
      ) : tab === "daybook" ? (
        <DayBook report={report} />
      ) : tab === "heads" ? (
        <HeadWise report={report} />
      ) : (
        <ByCollector report={report} />
      )}
    </div>
  );
}

function Figure({ label, value, note, dot, color }: { label: string; value: string; note: string; dot?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500">
        <i className={clsx("h-2 w-2 shrink-0 rounded-full", dot)} style={color ? { background: color } : undefined} />
        <span className="truncate">{label}</span>
      </span>
      <span className="tnum mt-0.5 block text-[20px] font-extrabold">{value}</span>
      <span className="block truncate text-[12px] text-ink-400">{note}</span>
    </div>
  );
}

function Bar({ value, tone = "bg-brand-500" }: { value: number; tone?: string }) {
  return (
    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-ink-100">
      <span className={clsx("block h-full rounded-full", tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

function Total({ children }: { children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2.5 text-[14px] font-semibold">{children}</div>;
}

/* ── Day book ── */
function DayBook({ report }: { report: CollectionReport }) {
  const L = useL();
  const t = report.totals;
  return (
    <>
      <ul>
        {report.days.map((d) => (
          <li key={d.date} className="border-b border-ink-100 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium">{dayLabel(d.date)}</span>
              <span className="tnum text-[15px] font-bold">{inr(d.total)}</span>
            </div>
            <p className="tnum mt-0.5 text-[12.5px] text-ink-500">
              {num(d.receipts)} {L({ hi: d.receipts === 1 ? "रसीद" : "रसीदें", en: d.receipts === 1 ? "receipt" : "receipts" })}
              {(["Cash", "UPI", "Cheque", "Other"] as const)
                .filter((k) => d.byMode[k])
                .map((k) => ` · ${k} ${inr(d.byMode[k])}`)
                .join("")}
            </p>
          </li>
        ))}
      </ul>
      <Total>
        <span>
          {L({ hi: "कुल", en: "Total" })}{" "}
          <span className="font-normal text-ink-500">
            · {num(report.days.length)} {L({ hi: "दिन", en: report.days.length === 1 ? "day" : "days" })} · {num(t.receipts)} {L({ hi: "रसीदें", en: "receipts" })}
          </span>
        </span>
        <span className="tnum text-jade-700">{inr(t.total)}</span>
      </Total>
    </>
  );
}

/* ── Head-wise ── */
function HeadWise({ report }: { report: CollectionReport }) {
  const L = useL();
  const total = report.totals.total;
  const headSum = Math.round(report.heads.reduce((a, h) => a + h.amount, 0) * 100) / 100;
  const gap = Math.round((total - headSum) * 100) / 100;
  return (
    <>
      <ul>
        {report.heads.map((h) => {
          const p = pct(h.amount, total);
          return (
            <li key={h.key} className="border-b border-ink-100 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-[15px] font-medium">
                  {h.label}
                  {h.key === "unsplit" && <span className="block text-[12px] font-normal text-ink-500">{L({ hi: "जिन रसीदों का बँटवारा पूरा नहीं जुड़ा", en: "receipts whose split did not add up" })}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className={clsx("tnum text-[15px] font-bold", h.amount < 0 && "text-rose-700")}>{inr(h.amount)}</span>
                  <span className="tnum ml-2 text-[12.5px] text-ink-500">{pctText(p)}</span>
                </span>
              </div>
              <Bar value={p} tone={h.key === "unsplit" ? "bg-ink-400" : "bg-brand-500"} />
            </li>
          );
        })}
      </ul>
      <Total>
        <span>{L({ hi: "कुल", en: "Total" })}</span>
        <span className="tnum text-jade-700">{inr(headSum)}</span>
      </Total>
      <p className="flex items-center justify-end gap-1.5 text-[12.5px] text-ink-500">
        {gap === 0 ? (
          <>
            <Check className="h-3.5 w-3.5 text-jade-600" strokeWidth={3} aria-hidden /> {L({ hi: "रोज़ के हिसाब से मिलता है", en: "Matches day book total" })}
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-hidden /> <span className="text-rose-700">{L({ hi: `रोज़ के हिसाब से ${inr(gap)} का फ़र्क`, en: `Differs from the day book by ${inr(gap)}` })}</span>
          </>
        )}
      </p>
    </>
  );
}

/* ── By collector ── */
function ByCollector({ report }: { report: CollectionReport }) {
  const L = useL();
  const total = report.totals.total;
  return (
    <>
      <ul>
        {report.byCollector.map((c) => {
          const p = pct(c.total, total);
          return (
            <li key={c.name} className="border-b border-ink-100 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={clsx("min-w-0 truncate text-[15px] font-medium", c.name === "Not recorded" && "italic text-ink-500")}>{c.name}</span>
                <span className="shrink-0">
                  <span className="tnum text-[15px] font-bold">{inr(c.total)}</span>
                  <span className="tnum ml-2 text-[12.5px] text-ink-500">{pctText(p)}</span>
                </span>
              </div>
              <p className="tnum text-[12.5px] text-ink-500">
                {num(c.receipts)} {L({ hi: "रसीदें", en: "receipts" })}
              </p>
              <Bar value={p} />
            </li>
          );
        })}
      </ul>
      <Total>
        <span>
          {L({ hi: "कुल", en: "Total" })} <span className="font-normal text-ink-500">· {num(report.totals.receipts)}</span>
        </span>
        <span className="tnum text-jade-700">{inr(total)}</span>
      </Total>
    </>
  );
}

/* ── Class-wise ── */
function Money({ m, strong }: { m: ClassMoney; strong?: boolean }) {
  const L = useL();
  const net = m.total - m.discount;
  const p = pct(m.paid, net);
  return (
    <>
      <span className="tnum mt-1 grid grid-cols-3 gap-2 text-[12.5px]">
        <span>
          <span className="block text-ink-400">{L({ hi: "फ़ीस", en: "Fee" })}</span>
          <span className={strong ? "font-semibold text-ink-900" : "text-ink-700"}>{inr(m.total)}</span>
          {m.discount ? <span className="block text-[11.5px] text-ink-400">−{inr(m.discount)} {L({ hi: "छूट", en: "conc." })}</span> : null}
        </span>
        <span>
          <span className="block text-ink-400">{L({ hi: "जमा", en: "Paid" })}</span>
          <span className={clsx("text-jade-700", strong && "font-semibold")}>{inr(m.paid)}</span>
        </span>
        <span>
          <span className="block text-ink-400">{L({ hi: "बाकी", en: "Due" })}</span>
          <span className={clsx(m.balance > 0 ? "text-rose-700" : "text-ink-500", strong && "font-semibold")}>{inr(m.balance)}</span>
        </span>
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
          <span className={clsx("block h-full rounded-full", p >= 75 ? "bg-jade-500" : p >= 50 ? "bg-marigold-400" : "bg-rose-500")} style={{ width: `${Math.min(100, p)}%` }} />
        </span>
        <span className="tnum w-10 text-right text-[12.5px] text-ink-700">{net > 0 ? pctText(p) : "—"}</span>
      </span>
    </>
  );
}

function ClassList({ report, open, onToggle }: { report: ClasswiseReport; open: Set<string>; onToggle: (c: string) => void }) {
  const L = useL();
  return (
    <>
      <p className="text-[12.5px] text-ink-500">
        {L({ hi: `सत्र ${SESSION.short} · चालू बच्चे · ऊपर की तारीखें यहाँ नहीं लगतीं`, en: `Session ${SESSION.short} · active students · the dates above don't apply` })}
      </p>
      <ul>
        {report.classes.map((c) => {
          const isOpen = open.has(c.class);
          return (
            <li key={c.class} className="border-b border-ink-100">
              <button type="button" onClick={() => onToggle(c.class)} aria-expanded={isOpen} className="block w-full py-2.5 text-left active:bg-ink-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold">
                    {c.class}{" "}
                    <span className="text-[12.5px] font-normal text-ink-400">
                      · {num(c.students)} {L({ hi: "बच्चे", en: "students" })}
                    </span>
                  </span>
                  <ChevronDown className={clsx("h-4 w-4 text-ink-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
                </span>
                <Money m={c} strong />
              </button>
              {isOpen &&
                c.sections.map((s) => (
                  <div key={s.section} className="ml-3 border-l-2 border-ink-100 py-2 pl-3">
                    <span className="text-[14px] font-medium text-ink-700">
                      {c.class} {s.section} <span className="text-[12px] font-normal text-ink-400">· {num(s.students)}</span>
                    </span>
                    <Money m={s} />
                  </div>
                ))}
            </li>
          );
        })}
      </ul>
      <div className="rounded-xl bg-ink-50 px-3 py-2.5">
        <span className="text-[14px] font-semibold">
          {L({ hi: "सभी कक्षाएँ", en: "All classes" })} <span className="font-normal text-ink-500">· {num(report.totals.students)}</span>
        </span>
        <Money m={report.totals} strong />
      </div>
    </>
  );
}
