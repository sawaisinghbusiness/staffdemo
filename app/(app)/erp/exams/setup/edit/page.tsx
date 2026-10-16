"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { maxOf, PART_PRESETS, partsProblem, type ExamPart } from "@/lib/erpGrading";
import type { Exam, ExamInput, ExamScope } from "@/lib/erpExams";
import { cleanClasses, EXAM_NAMES, type ClassItem } from "@/lib/erpExamSetup";
import { ListSkeleton, StickyBar } from "@/components/ui";

/*
 * ERP login → Exam setup → add (no ?id) or change (?id=) an exam: the ERP's ExamDrawer down a phone screen. Name,
 * dates, classes (and per class which sections / subjects sit it, units), and the marks pattern. POST or PATCH
 * /api/exams; the backend checks everything again.
 */

const keyFor = (name: string, taken: string[]) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 16) || "part";
  let k = base;
  for (let i = 2; taken.includes(k); i++) k = `${base}_${i}`;
  return k;
};
const uniq = (xs: string[]) => Array.from(new Set(xs));
const flip = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function ErpExamEditPage() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const exams = useApi<{ data: Exam[] }>("/erp/exams");
  const cls = useApi<{ data: ClassItem[] }>("/erp/classes");
  if (id === null || !exams.data || !cls.data) return <ListSkeleton rows={6} />;
  const exam = id ? exams.data.data.find((e) => e.id === id) || null : null;
  return <ExamForm key={id} exam={exam} nextOrder={exams.data.data.length} classes={cleanClasses(cls.data.data).filter((c) => c.sections.length)} />;
}

function ExamForm({ exam, classes, nextOrder }: { exam: Exam | null; classes: ClassItem[]; nextOrder: number }) {
  const L = useL();
  const names = classes.map((c) => c.name);
  const [title, setTitle] = useState(exam?.title || "");
  const [picked, setPicked] = useState<string[]>(exam?.classes || []);
  const [start, setStart] = useState(exam?.start_date || "");
  const [end, setEnd] = useState(exam?.end_date || "");
  const [parts, setParts] = useState<ExamPart[]>(exam?.components || PART_PRESETS[0].parts);
  const [scope, setScope] = useState<ExamScope>(exam?.scope || {});
  const [open, setOpen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Saved parts come back from the database with their keys in another order, so compare the values.
  const shape = (ps: ExamPart[]) => JSON.stringify(ps.map((p) => [p.key, p.name, p.max]));
  const preset = PART_PRESETS.find((p) => shape(p.parts) === shape(parts))?.key || "custom";
  const toggle = (c: string) => {
    const on = !picked.includes(c);
    setPicked((p) => (on ? [...p, c] : p.filter((x) => x !== c)));
    setOpen((o) => (on ? uniq([...o, c]) : o.filter((x) => x !== c)));
  };

  /* What a class sits: chosen sections (default all) and the subjects of those sections (default all). */
  const sectionsOf = (c: string) => classes.find((x) => x.name === c)?.sections || [];
  const chosenSecs = (c: string) => {
    const all = sectionsOf(c).map((x) => x.name);
    const sel = (scope[c]?.sections || []).filter((x) => all.includes(x));
    return sel.length ? sel : all;
  };
  const subjectsOf = (c: string) => uniq(sectionsOf(c).filter((x) => chosenSecs(c).includes(x.name)).flatMap((x) => x.subjects));
  const chosenSubs = (c: string) => {
    const all = subjectsOf(c);
    const sel = (scope[c]?.subjects || []).filter((x) => all.includes(x));
    return sel.length ? sel : all;
  };
  const patchScope = (c: string, patch: Partial<ExamScope[string]>) => setScope((sc) => ({ ...sc, [c]: { ...sc[c], ...patch } }));
  const toggleSec = (c: string, sec: string) => {
    const next = flip(chosenSecs(c), sec);
    if (next.length) patchScope(c, { sections: next.length === sectionsOf(c).length ? [] : next });
  };
  const toggleSub = (c: string, sub: string) => {
    const next = flip(chosenSubs(c), sub);
    if (next.length) patchScope(c, { subjects: next.length === subjectsOf(c).length ? [] : next });
  };
  const setUnit = (c: string, sub: string, text: string) => patchScope(c, { units: { ...scope[c]?.units, [sub]: text } });

  /** Only what differs from "everything", for the classes still picked. */
  const scopeToSave = (): ExamScope => {
    const out: ExamScope = {};
    for (const c of picked) {
      const secs = chosenSecs(c);
      const subs = chosenSubs(c);
      const units = Object.fromEntries(
        Object.entries(scope[c]?.units || {})
          .filter(([sub, t]) => subs.includes(sub) && t.trim())
          .map(([sub, t]) => [sub, t.trim()])
      );
      const entry = {
        ...(secs.length < sectionsOf(c).length ? { sections: secs } : {}),
        ...(subs.length < subjectsOf(c).length ? { subjects: subs } : {}),
        ...(Object.keys(units).length ? { units } : {}),
      };
      if (Object.keys(entry).length) out[c] = entry;
    }
    return out;
  };
  const setPart = (i: number, patch: Partial<ExamPart>) =>
    setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch, key: patch.name !== undefined ? keyFor(patch.name, ps.filter((_, k) => k !== i).map((x) => x.key)) : p.key } : p)));
  const total = useMemo(() => maxOf(parts), [parts]);

  const save = async () => {
    if (title.trim().length < 2) return toast(false, L({ hi: "परीक्षा का नाम लिखें।", en: "Give the exam a name." }));
    if (!picked.length) return toast(false, L({ hi: "कौन-सी कक्षाएँ यह परीक्षा देंगी, चुनें।", en: "Choose the classes that sit this exam." }));
    const problem = partsProblem(parts);
    if (problem) return toast(false, problem);
    const noSubjects = picked.find((c) => !subjectsOf(c).length);
    if (noSubjects) return toast(false, L({ hi: `${noSubjects} में अभी विषय नहीं डले। पहले "कक्षा के विषय" में डालें।`, en: `${noSubjects} has no subjects yet. Set them under "Subjects" first.` }));
    const input: ExamInput = { title: title.trim(), classes: names.filter((c) => picked.includes(c)), start_date: start || null, end_date: end || start || null, components: parts, order_seq: exam ? exam.order_seq : nextOrder, scope: scopeToSave() };
    setBusy(true);
    try {
      const r = await api<{ data: Exam }>(exam ? `/erp/exams/${exam.id}` : "/erp/exams", { method: exam ? "PATCH" : "POST", body: input });
      toast(true, L({ hi: `${r.data?.title || input.title} सेव हो गई।`, en: `${r.data?.title || input.title} saved.` }));
      window.location.replace("/erp/exams/setup/");
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  };

  if (exam?.locked) return <p className="rounded-xl bg-ink-100 px-3 py-3 text-[14px] text-ink-700">{L({ hi: "यह परीक्षा बंद है। बदलने के लिए पहले उसे खोलें।", en: "This exam is locked. Unlock it first to change it." })}</p>;

  return (
    <div className="animate-rise space-y-5 pb-24">
      <section className="space-y-2.5">
        <label className="field-box">
          <small>{L({ hi: "परीक्षा का नाम *", en: "Exam name *" })}</small>
          <input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Half Yearly" maxLength={80} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {EXAM_NAMES.map((n) => (
            <button key={n} type="button" onClick={() => setTitle(n)} className={clsx("min-h-[36px] rounded-lg px-2.5 text-[13px] font-semibold ring-1", title === n ? "bg-brand-50 text-brand-700 ring-brand-300" : "bg-white text-ink-600 ring-ink-200")}>
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field-box">
            <small>{L({ hi: "पहला पेपर", en: "First paper" })}</small>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field-box">
            <small>{L({ hi: "आखिरी पेपर", en: "Last paper" })}</small>
            <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">{L({ hi: "कक्षाएँ *", en: "Classes *" })}</h2>
          <span className="flex gap-4 text-[13px] font-semibold">
            <button type="button" onClick={() => setPicked(names)} className="min-h-[36px] text-brand-600">
              {L({ hi: "सभी", en: "All" })}
            </button>
            <button
              type="button"
              onClick={() => {
                setPicked([]);
                setOpen([]);
              }}
              className="min-h-[36px] text-ink-500"
            >
              {L({ hi: "कोई नहीं", en: "None" })}
            </button>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {names.map((c) => (
            <button key={c} type="button" aria-pressed={picked.includes(c)} onClick={() => toggle(c)} className={clsx("min-h-[40px] rounded-lg px-3 text-[13.5px] font-semibold ring-1", picked.includes(c) ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-700 ring-ink-200")}>
              {c}
            </button>
          ))}
        </div>

        {picked.length > 0 && (
          <ul className="mt-3 divide-y divide-ink-100 rounded-xl bg-white ring-1 ring-ink-200">
            {names
              .filter((c) => picked.includes(c))
              .map((c) => {
                const secs = sectionsOf(c);
                const cs = chosenSecs(c);
                const subs = subjectsOf(c);
                const csub = chosenSubs(c);
                const isOpen = open.includes(c);
                return (
                  <li key={c}>
                    <button type="button" onClick={() => setOpen((o) => flip(o, c))} aria-expanded={isOpen} className="flex min-h-[48px] w-full items-center gap-3 px-3 text-left">
                      <span className="w-16 shrink-0 text-[14px] font-bold">{c}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-500">
                        {secs.length > 1 ? (cs.length === secs.length ? L({ hi: `सभी ${secs.length} सेक्शन`, en: `All ${secs.length} sections` }) : `${L({ hi: "सेक्शन", en: "Section" })} ${cs.join(", ")}`) : `${L({ hi: "सेक्शन", en: "Section" })} ${secs[0]?.name || "—"}`}
                        {" · "}
                        {!subs.length ? (
                          <span className="font-semibold text-marigold-700">{L({ hi: "विषय नहीं डले", en: "no subjects set" })}</span>
                        ) : csub.length === subs.length ? (
                          L({ hi: `सभी ${subs.length} विषय`, en: `all ${subs.length} subjects` })
                        ) : (
                          L({ hi: `${subs.length} में से ${csub.length} विषय`, en: `${csub.length} of ${subs.length} subjects` })
                        )}
                      </span>
                      <ChevronDown className={clsx("h-4 w-4 shrink-0 text-ink-400 transition", isOpen && "rotate-180")} aria-hidden />
                    </button>
                    {isOpen && (
                      <div className="space-y-3 px-3 pb-3">
                        {secs.length > 1 && (
                          <div>
                            <p className="mb-1 text-[12px] font-semibold text-ink-500">{L({ hi: "सेक्शन", en: "Sections" })}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {secs.map((x) => (
                                <Chip key={x.id} on={cs.includes(x.name)} onClick={() => toggleSec(c, x.name)}>
                                  {x.name}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="mb-1 text-[12px] font-semibold text-ink-500">{L({ hi: "विषय", en: "Subjects" })}</p>
                          {subs.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {subs.map((sub) => (
                                <Chip key={sub} on={csub.includes(sub)} onClick={() => toggleSub(c, sub)}>
                                  {sub}
                                </Chip>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[13px] text-ink-700">{L({ hi: `${c} में अभी विषय नहीं डले। परीक्षा सेटअप → "कक्षा के विषय" में डालें।`, en: `No subjects set for ${c} yet. Set them in Exam setup → Subjects.` })}</p>
                          )}
                        </div>
                        {csub.length > 0 && (
                          <div>
                            <p className="mb-1 text-[12px] font-semibold text-ink-500">
                              {L({ hi: "यूनिट", en: "Units" })} <span className="font-normal text-ink-400">({L({ hi: "चाहें तो", en: "optional" })})</span>
                            </p>
                            <div className="space-y-1.5">
                              {csub.map((sub) => (
                                <label key={sub} className="flex items-center gap-2">
                                  <span className="w-24 shrink-0 truncate text-[13px] text-ink-700">{sub}</span>
                                  <input value={scope[c]?.units?.[sub] || ""} onChange={(e) => setUnit(c, sub, e.target.value)} placeholder="Units 1–4" maxLength={120} aria-label={`${sub} ${c}`} className="field !min-h-[44px] min-w-0 flex-1 !px-3 text-[14px]" />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
        <p className="mt-2 text-[12.5px] text-ink-500">{L({ hi: "IX–X में अलग पैटर्न (80 + 20) हो तो उन कक्षाओं के लिए उसी नाम की अलग परीक्षा जोड़ें।", en: "For a different pattern in IX–X (80 + 20), add a separate exam with the same name for those classes." })}</p>
      </section>

      <section>
        <h2 className="text-[15px] font-bold">{L({ hi: "हर विषय में अंक", en: "Marks in each subject" })}</h2>
        {exam && <p className="text-[12.5px] text-ink-500">{L({ hi: "अंक भरने के बाद यह नहीं बदलता।", en: "Can't be changed once marks are entered." })}</p>}
        <div className="mt-1.5">
          {PART_PRESETS.map((p) => (
            <label key={p.key} className="radio border-b border-ink-100">
              <input type="radio" name="ex-preset" checked={preset === p.key} onChange={() => setParts(p.parts)} />
              {p.label}
            </label>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} aria-label={`${L({ hi: "हिस्सा", en: "Part" })} ${i + 1}`} maxLength={30} className="field !min-h-[46px] min-w-0 flex-1 !px-3" />
              <span className="text-[12.5px] text-ink-500">{L({ hi: "में से", en: "out of" })}</span>
              <input type="number" inputMode="numeric" min={1} max={200} value={p.max} onChange={(e) => setPart(i, { max: Math.round(Number(e.target.value)) })} aria-label={`${p.name} max`} className="field tnum !min-h-[46px] w-20 !px-3 text-right" />
              <button type="button" onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))} disabled={parts.length === 1} className="grid h-11 w-9 place-items-center text-ink-400 disabled:opacity-30" aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${p.name}`}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          {parts.length < 4 && (
            <button type="button" onClick={() => setParts((ps) => [...ps, { key: keyFor("Practical", ps.map((x) => x.key)), name: "Practical", max: 20 }])} className="link">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "हिस्सा जोड़ें", en: "Add a part" })}
            </button>
          )}
        </div>
      </section>

      <StickyBar>
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : exam ? L({ hi: `बदलाव सेव करें · पूर्णांक ${total}`, en: `Save changes · out of ${total}` }) : L({ hi: `परीक्षा जोड़ें · पूर्णांक ${total}`, en: `Add exam · out of ${total}` })}
        </button>
      </StickyBar>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={clsx("inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-white px-2.5 text-[13px] font-semibold", on ? "text-ink-900 ring-2 ring-brand-500" : "text-ink-500 ring-1 ring-ink-200")}>
      {on && <Check className="h-3.5 w-3.5 text-brand-600" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  );
}
