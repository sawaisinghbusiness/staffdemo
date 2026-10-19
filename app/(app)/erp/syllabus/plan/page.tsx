"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, MoreHorizontal, Plus } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { monthYear } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Empty, ErrorCard, ListSkeleton, SelectBox, Sheet } from "@/components/ui";
import { SetupNeeded } from "@/components/erp/SetupNeeded";

/*
 * ERP login → Syllabus → one class + subject: the chapter plan (same for every section) and, for the chosen
 * section, which chapters are done. Teachers, the exam cell and the admin tick a chapter done; the admin and the
 * exam cell add chapters (one per line, with the month they are planned for), rename, re-plan or delete them.
 * GET /api/syllabus?class=&subject=, POST/PATCH/DELETE /api/syllabus/chapters, PUT …/:id/done.
 */

type Chapter = { id: string; position: number; title: string; planMonth: string; done: Record<string, { on: string; by: string }> };
type Plan = { setupNeeded: boolean; sections: string[]; data: Chapter[] };
type Q = { cls: string; subject: string };

const todayMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);
const SESSION_MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 3 + i, 1)).toISOString().slice(0, 7));
const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function ErpSyllabusPlanPage() {
  const [q, setQ] = useState<Q | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ({ cls: p.get("class") || "", subject: p.get("subject") || "" });
  }, []);
  if (!q) return <ListSkeleton rows={6} />;
  return <PlanView {...q} />;
}

function PlanView({ cls, subject }: Q) {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Plan>(`/erp/syllabus?class=${encodeURIComponent(cls)}&subject=${encodeURIComponent(subject)}`);
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const role = who.data?.user.role || "";
  const canPlan = role === "admin" || role === "exam_cell";
  const canTick = canPlan || role === "teacher";
  const [sec, setSec] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Chapter | null>(null);
  const month = todayMonth();

  useEffect(() => {
    if (!sec && data?.sections.length) setSec(data.sections[0]);
  }, [data, sec]);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={6} />;
  if (data.setupNeeded) return <SetupNeeded file="20261019_syllabus_copycheck.sql" what={{ hi: "सिलेबस", en: "Syllabus" }} />;

  const chapters = data.data;
  const done = chapters.filter((c) => c.done[sec]).length;
  const due = chapters.filter((c) => c.planMonth && c.planMonth <= month).length;

  async function tick(c: Chapter) {
    if (!canTick || busy) return;
    setBusy(c.id);
    try {
      await api(`/erp/syllabus/chapters/${c.id}/done`, { method: "PUT", body: { classSec: sec, done: !c.done[sec] } });
      await reload();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    }
    setBusy(null);
  }

  return (
    <div className="animate-rise space-y-3 pb-4">
      <h1 className="text-[18px] font-bold text-ink-900">
        {cls} · {subject}
      </h1>
      {data.sections.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={L({ hi: "सेक्शन", en: "Section" })}>
          {data.sections.map((s) => (
            <button key={s} type="button" onClick={() => setSec(s)} aria-pressed={sec === s} className={clsx("h-9 rounded-full border px-3.5 text-[13px] font-semibold", sec === s ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700")}>
              {s.split(" - ")[1]}
            </button>
          ))}
        </div>
      )}
      {chapters.length > 0 && (
        <div className="rounded-2xl border border-ink-100 bg-white px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-500">
              {sec} · {L({ hi: "पढ़ाए गए", en: "taught" })}
            </span>
            <span className="tnum text-[22px] font-extrabold">
              {done}/{chapters.length}
            </span>
          </div>
          <p className={clsx("text-[12.5px]", done < due ? "text-rose-600" : "text-ink-500")}>
            {due === 0 ? L({ hi: "इस महीने तक कोई अध्याय तय नहीं था।", en: "No chapter was due by this month." }) : done < due ? L({ hi: `प्लान से ${due - done} अध्याय पीछे (अब तक ${due} होने थे)।`, en: `${due - done} behind plan (${due} due by now).` }) : L({ hi: "प्लान के हिसाब से ठीक चल रहा है।", en: "On track with the plan." })}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="mlabel">{L({ hi: "अध्याय", en: "Chapters" })}</h2>
        {canPlan && (
          <button type="button" onClick={() => setAdding(true)} className="flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] border-ink-900 bg-white px-3.5 text-[13.5px] font-semibold text-ink-900 active:bg-ink-100">
            <Plus className="h-4 w-4" aria-hidden />
            {L({ hi: "अध्याय जोड़ें", en: "Add chapters" })}
          </button>
        )}
      </div>

      {!chapters.length ? (
        <Empty>{canPlan ? L({ hi: "अभी प्लान नहीं बना। 'अध्याय जोड़ें' से सारे अध्याय एक साथ लिख दें।", en: "No plan yet. Use 'Add chapters' to write them all at once." }) : L({ hi: "अभी इस विषय का प्लान नहीं बना।", en: "This subject has no plan yet." })}</Empty>
      ) : (
        <ul>
          {chapters.map((c) => {
            const d = c.done[sec];
            const late = !d && c.planMonth && c.planMonth < month;
            return (
              <li key={c.id} className="flex items-center gap-3 border-b border-ink-100 py-2">
                <button
                  type="button"
                  onClick={() => tick(c)}
                  disabled={!canTick || busy === c.id}
                  role="checkbox"
                  aria-checked={!!d}
                  aria-label={c.title}
                  className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-full", !canTick && "cursor-default")}
                >
                  <span className={clsx("grid h-7 w-7 place-items-center rounded-full border-2", d ? "border-jade-600 bg-jade-600 text-white" : late ? "border-rose-400" : "border-ink-300", busy === c.id && "opacity-50")}>
                    {d && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                  </span>
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-ink-900">
                    <span className="tnum mr-1.5 text-ink-400">{c.position}.</span>
                    {c.title}
                  </span>
                  <span className={clsx("block text-[12.5px]", late ? "text-rose-600" : "text-ink-500")}>
                    {c.planMonth ? `${L({ hi: "प्लान", en: "Plan" })}: ${monthYear(c.planMonth, lang)}` : L({ hi: "महीना तय नहीं", en: "No month set" })}
                    {d ? ` · ${L({ hi: "पूरा", en: "done" })} ${short(d.on)}${d.by ? ` · ${d.by.split(" (")[0]}` : ""}` : late ? ` · ${L({ hi: "पीछे", en: "behind" })}` : ""}
                  </span>
                </span>
                {canPlan && (
                  <button type="button" onClick={() => setEdit(c)} aria-label={L({ hi: "बदलें", en: "Edit" })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-500 active:bg-ink-100">
                    <MoreHorizontal className="h-5 w-5" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding && <AddSheet cls={cls} subject={subject} onClose={() => setAdding(false)} onSaved={() => (setAdding(false), reload())} />}
      {edit && <EditSheet c={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
    </div>
  );
}

function MonthBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const L = useL();
  const { lang } = useLang();
  return (
    <SelectBox label={L({ hi: "किस महीने पढ़ाना है", en: "Month planned" })} value={value} onChange={onChange}>
      <option value="">{L({ hi: "तय नहीं", en: "Not set" })}</option>
      {SESSION_MONTHS.map((m) => (
        <option key={m} value={m}>
          {monthYear(m, lang)}
        </option>
      ))}
    </SelectBox>
  );
}

function AddSheet({ cls, subject, onClose, onSaved }: { cls: string; subject: string; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [text, setText] = useState("");
  const [planMonth, setPlanMonth] = useState(todayMonth());
  const [busy, setBusy] = useState(false);
  const titles = text.split("\n").map((t) => t.trim()).filter(Boolean);

  async function save() {
    if (!titles.length) return toast(false, L({ hi: "कम से कम एक अध्याय लिखें।", en: "Write at least one chapter." }));
    setBusy(true);
    try {
      await api("/erp/syllabus/chapters", { body: { className: cls, subject, titles, planMonth } });
      toast(true, L({ hi: `${titles.length} अध्याय जुड़े।`, en: `${titles.length} chapters added.` }));
      onSaved();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: "अध्याय जोड़ें", en: "Add chapters" })} onClose={onClose}>
      <div className="space-y-3 pt-1">
        <textarea id="syl-titles" value={text} onChange={(e) => setText(e.target.value)} rows={7} className="textarea-box" placeholder={L({ hi: "हर लाइन में एक अध्याय\nजैसे:\nसंख्याएँ\nजोड़ और घटाव", en: "One chapter per line\ne.g.\nNumbers\nAddition and subtraction" })} />
        <MonthBox value={planMonth} onChange={setPlanMonth} />
        <p className="text-[12.5px] text-ink-500">{L({ hi: "सब अध्याय इसी महीने में जुड़ेंगे; बाद में हर एक का महीना बदल सकते हैं।", en: "All get this month; you can change each one later." })}</p>
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : titles.length ? L({ hi: `${titles.length} अध्याय जोड़ें`, en: `Add ${titles.length} chapters` }) : L({ hi: "जोड़ें", en: "Add" })}
        </button>
      </div>
    </Sheet>
  );
}

function EditSheet({ c, onClose, onSaved }: { c: Chapter; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [title, setTitle] = useState(c.title);
  const [planMonth, setPlanMonth] = useState(c.planMonth);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(true, ok);
      onSaved();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "नहीं हुआ।", en: "Could not do that." }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={L({ hi: "अध्याय बदलें", en: "Edit chapter" })} onClose={onClose}>
      <div className="space-y-3 pt-1">
        <label className="field-box">
          <small>{L({ hi: "नाम", en: "Name" })}</small>
          <input id="syl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <MonthBox value={planMonth} onChange={setPlanMonth} />
        <button type="button" disabled={busy} onClick={() => run(() => api(`/erp/syllabus/chapters/${c.id}`, { method: "PATCH", body: { title, planMonth } }), L({ hi: "सेव हुआ।", en: "Saved." }))} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => (sure ? run(() => api(`/erp/syllabus/chapters/${c.id}`, { method: "DELETE" }), L({ hi: "अध्याय हटाया।", en: "Chapter deleted." })) : setSure(true))}
          className={clsx("btn-line w-full", sure && "!border-rose-500 !text-rose-600")}
        >
          {sure ? L({ hi: "पक्का हटाएँ? सब सेक्शन की टिक भी हटेगी", en: "Really delete? Ticks in every section go too" }) : L({ hi: "हटाएँ", en: "Delete" })}
        </button>
      </div>
    </Sheet>
  );
}
