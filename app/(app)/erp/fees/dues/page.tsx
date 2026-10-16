"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, Check, MessageCircle, Search, Send, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { DEFAULT_TEMPLATES, fillTemplate, whatsappLink, type DuesReport, type ReminderLang, type StudentDues } from "@/lib/erpDues";
import { classRank } from "@/lib/erpStudents";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";

/*
 * ERP login → Fees → Dues & reminders: the ERP's page. Every student's overdue instalments and late fine
 * come from GET /api/fees/dues (worked out by the backend's fee engine); tap a row to collect, the green
 * icon to WhatsApp that parent, or tick many and send reminders (one by one, or all from the school's
 * WhatsApp when it is linked: POST /api/whatsapp/queue). Excel export stays on the ERP website.
 */

type Tab = "students" | "classes";
type Filter = "all" | "one" | "two";
type Sort = "amount" | "oldest" | "class";
const TPL_KEY = "sd.reminder.tpl";
const lakh = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : rupees(n));
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const shortQ = (n: string) => n.replace(/^Quarter\s*/i, "Q");

export default function ErpDuesPage() {
  const L = useL();
  const { data: report, error, reload } = useApi<DuesReport>("/erp/fees/dues");
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  const school = `${p?.school_name || "School"}, ${p?.city || "Barmer"}`;
  const [tab, setTab] = useState<Tab>("students");
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("amount");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remindOpen, setRemindOpen] = useState(false);
  const [limit, setLimit] = useState(50);

  const rows = useMemo(() => report?.students || [], [report]);
  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.class))).sort((a, b) => classRank(a) - classRank(b)), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (cls !== "all" && r.class !== cls) return false;
        if (filter === "one" && r.overdue.length !== 1) return false;
        if (filter === "two" && r.overdue.length < 2) return false;
        return !t || r.name.toLowerCase().includes(t) || r.srNo.toLowerCase().includes(t) || r.fatherName.toLowerCase().includes(t) || r.mobile.includes(t);
      })
      .sort((a, b) =>
        sort === "amount"
          ? b.dueNow + b.fine - (a.dueNow + a.fine)
          : sort === "oldest"
            ? (b.overdue[0]?.daysLate || 0) - (a.overdue[0]?.daysLate || 0) || b.dueNow - a.dueNow
            : classRank(a.class) - classRank(b.class) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name)
      );
  }, [rows, q, cls, filter, sort]);
  useEffect(() => setLimit(50), [q, cls, filter, sort]);

  const byClass = useMemo(() => {
    const m = new Map<string, { cls: string; students: number; due: number; fine: number }>();
    for (const r of rows) {
      const x = m.get(r.class) || { cls: r.class, students: 0, due: 0, fine: 0 };
      x.students++;
      x.due += r.dueNow;
      x.fine += r.fine;
      m.set(r.class, x);
    }
    return Array.from(m.values()).sort((a, b) => classRank(a.cls) - classRank(b.cls));
  }, [rows]);

  const picked = rows.filter((r) => selected.has(r.studentId));
  const allShown = shown.length > 0 && shown.every((r) => selected.has(r.studentId));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const s = report?.summary;
  const dueNames = report ? report.instalments.filter((i) => i.due <= report.asOf).map((i) => i.name) : [];

  return (
    <div className="animate-rise space-y-3 pb-20">
      <p className="text-[13px] text-ink-500">
        {report
          ? `${L({ hi: "आज तक", en: "As on" })} ${day(report.asOf)} · ${dueNames.length ? `${dueNames.join(", ")} ${L({ hi: "की फ़ीस देनी थी", en: dueNames.length > 1 ? "are due" : "is due" })}` : L({ hi: "अभी कोई किस्त देय नहीं", en: "no instalment is due yet" })}`
          : L({ hi: "हर बच्चे की बाकी फ़ीस निकाली जा रही है…", en: "Working out every student's dues…" })}
      </p>
      {error && !report && error.status !== 401 && <ErrorCard offline={error.status === 0} onRetry={reload} />}

      <div className="grid grid-cols-2 gap-2">
        <Figure label={L({ hi: "अभी देर वाली", en: "Overdue now" })} value={s ? lakh(s.dueNow) : "…"} note={s ? `${s.withDues.toLocaleString("en-IN")} ${L({ hi: "बच्चे", en: "students" })}` : ""} dot="bg-rose-500" />
        <Figure label={L({ hi: "अब तक लेट फ़ाइन", en: "Late fine so far" })} value={s ? lakh(s.fine) : "…"} note={L({ hi: "फ़ीस सेटअप के हिसाब से", en: "As per fee setup" })} dot="bg-marigold-400" />
        <Figure
          label={s?.next ? `${s.next.name} · ${day(s.next.due)}` : L({ hi: "अगली किस्त", en: "Next instalment" })}
          value={s?.next ? lakh(s.next.amount) : "—"}
          note={s?.next ? `${s.next.students.toLocaleString("en-IN")} ${L({ hi: "बच्चों से", en: "students" })}` : L({ hi: "सारी किस्तें देय हैं", en: "All instalments are due" })}
          dot="bg-brand-500"
        />
        <Figure label={L({ hi: "समय पर", en: "Up to date" })} value={s ? s.upToDate.toLocaleString("en-IN") : "…"} note={s ? `${L({ hi: "कुल", en: "of" })} ${s.active.toLocaleString("en-IN")} ${L({ hi: "बच्चे", en: "students" })}` : ""} dot="bg-jade-500" />
      </div>

      <LineTabs
        label={L({ hi: "बाकी फ़ीस", en: "Dues" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "students", text: L({ hi: "बच्चे", en: "Students" }) },
          { key: "classes", text: L({ hi: "कक्षा के हिसाब से", en: "By class" }) },
        ]}
      />

      {tab === "students" && (
        <>
          <label className="field-box min-h-[48px]">
            <Search aria-hidden />
            <input id="dues-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, SR नं., पिता या मोबाइल", en: "Name, SR no., father or mobile" })} autoComplete="off" />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={cls} onChange={setCls}>
              <option value="all">{L({ hi: "सभी", en: "All" })}</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectBox>
            <SelectBox label={L({ hi: "देर", en: "Overdue" })} value={filter} onChange={(v) => setFilter(v as Filter)}>
              <option value="all">{L({ hi: "कोई भी", en: "Any" })}</option>
              <option value="one">{L({ hi: "1 किस्त", en: "1 instalment" })}</option>
              <option value="two">{L({ hi: "2 या ज़्यादा", en: "2 or more" })}</option>
            </SelectBox>
          </div>
          <SelectBox label={L({ hi: "क्रम", en: "Sort" })} value={sort} onChange={(v) => setSort(v as Sort)}>
            <option value="amount">{L({ hi: "सबसे ज़्यादा बाकी पहले", en: "Most due first" })}</option>
            <option value="oldest">{L({ hi: "सबसे पुरानी देर पहले", en: "Longest overdue" })}</option>
            <option value="class">{L({ hi: "कक्षा के क्रम में", en: "Class order" })}</option>
          </SelectBox>
        </>
      )}

      {!report ? (
        !error ? <ListSkeleton rows={6} /> : null
      ) : tab === "classes" ? (
        <ul>
          {byClass.map((r) => {
            const max = Math.max(1, ...byClass.map((x) => x.due));
            return (
              <li key={r.cls}>
                <button type="button" onClick={() => (setCls(r.cls), setTab("students"))} className="block w-full border-b border-ink-100 py-2.5 text-left active:bg-ink-50">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">
                      {r.cls} <span className="text-[12.5px] font-normal text-ink-400">· {r.students} {L({ hi: "बच्चे", en: "students" })}</span>
                    </span>
                    <span className="tnum text-[15px] font-semibold">
                      {rupees(r.due)}
                      {r.fine > 0 && <span className="ml-1 text-[12px] font-medium text-marigold-700">+{rupees(r.fine)}</span>}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-ink-100">
                    <span className="block h-full rounded-full bg-rose-500" style={{ width: `${(r.due / max) * 100}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : shown.length === 0 ? (
        <Empty>{rows.length ? L({ hi: "इन फ़िल्टर से कोई नहीं मिला।", en: "Nobody matches these filters." }) : L({ hi: "किसी की कोई किस्त देर से नहीं है।", en: "Nobody has an overdue instalment." })}</Empty>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setSelected(allShown ? new Set() : new Set(shown.map((r) => r.studentId)))} className="min-h-[36px] text-[13.5px] font-semibold text-brand-600">
              {allShown ? L({ hi: "चुनाव हटाएँ", en: "Clear" }) : L({ hi: "सबको चुनें", en: "Select all shown" })}
            </button>
            <span className="tnum text-[12.5px] text-ink-500">
              {shown.length.toLocaleString("en-IN")} · {rupees(shown.reduce((a, r) => a + r.dueNow, 0))} + {L({ hi: "फ़ाइन", en: "fine" })} {rupees(shown.reduce((a, r) => a + r.fine, 0))}
            </span>
          </div>
          <ul>
            {shown.slice(0, limit).map((r) => {
              const on = selected.has(r.studentId);
              const wa = whatsappLink(r.mobile, fillTemplate(DEFAULT_TEMPLATES.hi, r, school, "hi"));
              return (
                <li key={r.studentId} className={clsx("flex items-center border-b border-ink-100", on && "bg-brand-50")}>
                  <button type="button" role="checkbox" aria-checked={on} aria-label={r.name} onClick={() => toggle(r.studentId)} className="flex h-[68px] w-10 shrink-0 items-center">
                    <span className={clsx("grid h-[22px] w-[22px] place-items-center rounded-md border-[1.5px]", on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white")}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />}</span>
                  </button>
                  <Link href={`/erp/fees/collect/?student=${encodeURIComponent(r.studentId)}`} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-2 py-2 active:bg-ink-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{r.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-400">
                        {r.classSec} · {r.fatherName}
                      </span>
                      <span className="block truncate text-[12px] font-medium text-rose-600">{r.overdue.map((o) => `${shortQ(o.name)} ${o.daysLate}${L({ hi: " दिन", en: "d" })}`).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block text-[15px] font-bold">{rupees(r.dueNow)}</span>
                      {r.fine > 0 && <span className="tnum block text-[12px] font-medium text-marigold-700">+{rupees(r.fine)}</span>}
                    </span>
                  </Link>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" aria-label={`${L({ hi: "WhatsApp याद दिलाएँ", en: "WhatsApp reminder to the parent of" })} ${r.name}`} className="grid h-11 w-11 shrink-0 place-items-center text-jade-600 active:bg-jade-50">
                      <MessageCircle className="h-5 w-5" aria-hidden />
                    </a>
                  ) : (
                    <span className="w-11 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
          {shown.length > limit && (
            <button type="button" onClick={() => setLimit((n) => n + 50)} className="btn-line w-full">
              {L({ hi: "और दिखाएँ", en: "Show more" })} ({(shown.length - limit).toLocaleString("en-IN")})
            </button>
          )}
        </>
      )}

      {picked.length > 0 && (
        <StickyBar>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[13px] text-ink-600">
              <b className="text-ink-900">{picked.length}</b> {L({ hi: "चुने", en: "selected" })} · <b className="tnum text-ink-900">{rupees(picked.reduce((a, r) => a + r.dueNow, 0))}</b>
            </p>
            <button type="button" onClick={() => setSelected(new Set())} aria-label={L({ hi: "चुनाव हटाएँ", en: "Clear selection" })} className="grid h-10 w-10 place-items-center text-ink-400">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={() => setRemindOpen(true)} className="btn-primary shrink-0 px-4">
              <Send className="h-4 w-4" aria-hidden /> {L({ hi: "याद दिलाएँ", en: "Send reminders" })}
            </button>
          </div>
        </StickyBar>
      )}

      {remindOpen && <ReminderSheet students={picked} school={school} onClose={() => setRemindOpen(false)} />}
    </div>
  );
}

function Figure({ label, value, note, dot }: { label: string; value: string; note: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500">
        <i className={clsx("h-2 w-2 shrink-0 rounded-full", dot)} />
        <span className="truncate">{label}</span>
      </span>
      <span className="tnum mt-0.5 block text-[20px] font-extrabold">{value}</span>
      <span className="block truncate text-[12px] text-ink-400">{note}</span>
    </div>
  );
}

interface WaStatus {
  state: "off" | "connecting" | "qr" | "open";
  me: { number: string; name: string } | null;
  setupNeeded: boolean;
}

/**
 * Reminders through WhatsApp (ERP ReminderModal): each button opens WhatsApp on this phone with the
 * message typed in; when the school's WhatsApp is linked, "Send to all" hands them to the backend.
 */
function ReminderSheet({ students, school, onClose }: { students: StudentDues[]; school: string; onClose: () => void }) {
  const L = useL();
  const [lang, setLang] = useState<ReminderLang>("hi");
  const [tpl, setTpl] = useState(DEFAULT_TEMPLATES.hi);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [queueing, setQueueing] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);
  const { data: wa } = useApi<WaStatus>("/erp/whatsapp/status");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TPL_KEY) || "null");
      if (saved?.lang && saved?.tpl) {
        setLang(saved.lang);
        setTpl(saved.tpl);
      }
    } catch {
      /* private window: keep the default */
    }
  }, []);
  const remember = (l: ReminderLang, t: string) => {
    try {
      localStorage.setItem(TPL_KEY, JSON.stringify({ lang: l, tpl: t }));
    } catch {
      /* ignore */
    }
  };
  const switchLang = (l: ReminderLang) => {
    setLang(l);
    setTpl(DEFAULT_TEMPLATES[l]);
    remember(l, DEFAULT_TEMPLATES[l]);
  };

  const first = students[0];
  const noPhone = students.filter((s) => !whatsappLink(s.mobile, "x")).length;
  const linked = wa?.state === "open" && !wa.setupNeeded;

  async function sendAll() {
    setQueueing(true);
    try {
      const r = await api<{ success: boolean; queued?: number; alreadyQueued?: number }>("/erp/whatsapp/queue", {
        body: { kind: "dues", items: students.filter((s) => whatsappLink(s.mobile, "x")).map((s) => ({ studentId: s.studentId, text: fillTemplate(tpl, s, school, lang) })) },
      });
      setQueued(r.queued || 0);
      toast(true, L({ hi: `${r.queued} रिमाइंडर भेजने को लगे${r.alreadyQueued ? `; ${r.alreadyQueued} को आज पहले ही भेजा` : ""}।`, en: `${r.queued} reminders queued${r.alreadyQueued ? `; ${r.alreadyQueued} already reminded today` : ""}.` }));
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "रिमाइंडर नहीं लगे।", en: "Could not queue the reminders." }));
    } finally {
      setQueueing(false);
    }
  }

  return (
    <Sheet title={L({ hi: `${students.length} माता-पिता को याद दिलाएँ`, en: `Remind ${students.length} parent${students.length === 1 ? "" : "s"}` })} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
            {(
              [
                ["hi", "हिंदी"],
                ["en", "English"],
              ] as [ReminderLang, string][]
            ).map(([k, t]) => (
              <button key={k} type="button" onClick={() => switchLang(k)} className={clsx("min-h-[36px] rounded-lg px-3 text-[13.5px] font-semibold", lang === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
                {t}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => switchLang(lang)} className="text-[13px] font-semibold text-brand-600">
            {L({ hi: "मैसेज पहले जैसा", en: "Reset message" })}
          </button>
        </div>
        <textarea
          id="dues-tpl"
          value={tpl}
          onChange={(e) => {
            setTpl(e.target.value);
            remember(lang, e.target.value);
          }}
          rows={4}
          className="textarea-box"
        />
        <p className="text-[12px] text-ink-500">{L({ hi: "हर बच्चे के लिए भरता है:", en: "Filled in for each student:" })} {"{name} {class} {due} {fine} {total} {quarters} {fine_line} {school}"}</p>
        {first && (
          <div className="rounded-xl bg-jade-50 p-3 text-[13.5px] leading-relaxed text-ink-900">
            <div className="mb-1 text-[12px] font-semibold text-jade-800">
              {L({ hi: "नमूना:", en: "Preview for" })} {first.name}
            </div>
            {fillTemplate(tpl, first, school, lang)}
          </div>
        )}
        <ul className="max-h-60 overflow-y-auto rounded-xl border border-ink-100">
          {students.map((s) => {
            const link = whatsappLink(s.mobile, fillTemplate(tpl, s, school, lang));
            const done = opened.has(s.studentId);
            return (
              <li key={s.studentId} className="flex items-center gap-3 border-b border-ink-100 px-3 py-2 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{s.name}</span>
                  <span className="block truncate text-[12px] text-ink-500">
                    {s.classSec} · {s.mobile || L({ hi: "मोबाइल नहीं", en: "no mobile" })} · {rupees(s.dueNow)}
                  </span>
                </span>
                {link ? (
                  <a href={link} target="_blank" rel="noreferrer" onClick={() => setOpened((p) => new Set(p).add(s.studentId))} className={clsx("flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold", done ? "border border-ink-200 text-ink-600" : "bg-jade-600 text-white")}>
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <MessageCircle className="h-3.5 w-3.5" aria-hidden />}
                    {done ? L({ hi: "खोला", en: "Opened" }) : "WhatsApp"}
                  </a>
                ) : (
                  <span className="shrink-0 text-[12px] text-rose-600">{L({ hi: "मोबाइल सही नहीं", en: "Mobile not valid" })}</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="flex gap-2 rounded-xl bg-ink-50 p-3 text-[12.5px] leading-relaxed text-ink-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-600" aria-hidden />
          <span>
            {linked
              ? L({ hi: `"सबको भेजें" स्कूल के WhatsApp (+${wa?.me?.number}) से कुछ-कुछ सेकंड में एक-एक भेजता है; आज जिन्हें भेज चुके, उन्हें छोड़ देता है।`, en: `"Send to all" sends from the school's WhatsApp (+${wa?.me?.number}), one message every few seconds; a parent already reminded today is skipped.` })
              : L({ hi: "हर बटन इस फ़ोन पर WhatsApp में मैसेज लिखकर खोलता है; वहाँ भेजें दबाएँ। थोड़े-थोड़े करके भेजें, ताकि WhatsApp नंबर न रोके।", en: "Each button opens WhatsApp on this phone with the message typed in; press send there. Send a few at a time so WhatsApp does not flag the number." })}
            {noPhone ? L({ hi: ` ${noPhone} का मोबाइल सही नहीं है।`, en: ` ${noPhone} parent(s) have no valid mobile.` }) : ""}
          </span>
        </p>
        {linked ? (
          <button type="button" onClick={sendAll} disabled={queueing || queued !== null || students.length === noPhone} className="btn-primary w-full">
            {queued !== null ? <Check className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {queueing ? "…" : queued !== null ? L({ hi: `${queued} लगे`, en: `${queued} queued` }) : L({ hi: `सबको भेजें (${students.length - noPhone})`, en: `Send to all ${students.length - noPhone}` })}
          </button>
        ) : (
          <button type="button" onClick={onClose} className="btn-line w-full">
            {L({ hi: `हो गया (${opened.size} / ${students.length} खोले)`, en: `Done (${opened.size} of ${students.length} opened)` })}
          </button>
        )}
      </div>
    </Sheet>
  );
}
