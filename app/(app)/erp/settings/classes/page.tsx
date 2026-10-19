"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { COMMON_SUBJECTS, cleanSubject } from "@/lib/erpExamSetup";
import {
  addChips,
  cleanClassList,
  cleanSection,
  guessWing,
  isSetupMessage,
  STANDARD_CLASSES,
  streamsOf,
  SUBJECTS_SETUP_MESSAGE,
  takesStream,
  WING_HI,
  WINGS,
  type ClassItem,
  type SectionItem,
} from "@/lib/erpSettings";
import { Empty, ErrorCard, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Settings → Classes & subjects: the ERP's app/settings/classes page and its modals/drawer
 * (AddClassModal, AddSectionModal, SectionDrawer, rename/delete class). GET /api/classes, student counts from
 * GET /api/attendance/day; writes POST/PATCH/PUT/DELETE /api/classes… are admin-only on the backend, so only
 * an admin sees the add / edit controls here.
 */

type Counts = Record<string, number>;
interface Stray {
  cls: string;
  section: string;
  students: number;
}
interface AddPrefill {
  name?: string;
  sections?: string[];
}

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError && e.message) || fallback;

export default function ErpClassesPage() {
  const L = useL();
  const P = (n: number, one: Bi, many: Bi) => `${n.toLocaleString("en-IN")} ${L(n === 1 ? one : many)}`;
  const st = (n: number) => P(n, { hi: "बच्चा", en: "student" }, { hi: "बच्चे", en: "students" });
  const res = useApi<{ data: ClassItem[] }>("/erp/classes");
  const day = useApi<{ sections?: { class: string; section: string; students: number }[] }>("/erp/attendance/day");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";

  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  useEffect(() => {
    if (res.data) setClasses(cleanClassList(res.data.data));
  }, [res.data]);
  const counts = useMemo<Counts | null>(() => {
    if (!day.data && !day.error) return null;
    const c: Counts = {};
    for (const s of day.data?.sections || []) c[`${s.class}|${s.section}`] = (c[`${s.class}|${s.section}`] || 0) + (s.students || 0);
    return c;
  }, [day.data, day.error]);

  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState<AddPrefill | null>(null);
  const [addSection, setAddSection] = useState<{ classId: string; names: string[] | null } | null>(null);
  const [classOpen, setClassOpen] = useState<string | null>(null);
  const [open, setOpen] = useState<{ classId: string; sectionId: string } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const reload = useCallback(async () => {
    await Promise.all([res.reload(), day.reload()]);
  }, [res, day]);

  const secCount = (cls: string, sec: string) => counts?.[`${cls}|${sec}`] || 0;
  const classCount = (cls: string) => Object.keys(counts || {}).reduce((t, k) => (k.split("|")[0] === cls ? t + (counts as Counts)[k] : t), 0);

  const groups = useMemo(() => {
    const list = classes || [];
    const out = WINGS.map((w) => ({ wing: w, classes: list.filter((c) => c.wing === w) }));
    const other = list.filter((c) => !c.wing || !WINGS.includes(c.wing));
    if (other.length) out.push({ wing: "Other", classes: other });
    return out.filter((g) => g.classes.length);
  }, [classes]);

  const strays = useMemo(() => {
    if (!classes || !counts) return [] as Stray[];
    return Object.keys(counts)
      .map((k) => ({ cls: k.split("|")[0], section: k.split("|").slice(1).join("|"), students: counts[k] }))
      .filter((s) => s.students > 0 && !classes.some((c) => c.name === s.cls && c.sections.some((x) => x.name === s.section)));
  }, [classes, counts]);
  const missingClasses = useMemo(() => {
    const names = Array.from(new Set(strays.map((s) => s.cls))).filter((n) => !(classes || []).some((c) => c.name === n));
    return names.map((n) => ({ name: n, sections: strays.filter((s) => s.cls === n) }));
  }, [strays, classes]);

  const totals = {
    classes: (classes || []).length,
    sections: (classes || []).reduce((t, c) => t + c.sections.length, 0),
    students: Object.keys(counts || {}).reduce((t, k) => t + (counts as Counts)[k], 0),
  };

  /** Swap a class with its neighbour inside the same wing, then save the new order. */
  const move = async (c: ClassItem, dir: -1 | 1) => {
    if (!classes) return;
    const group = groups.find((g) => g.classes.some((x) => x.id === c.id));
    if (!group) return;
    const i = group.classes.findIndex((x) => x.id === c.id);
    const other = group.classes[i + dir];
    if (!other) return;
    const list = classes.slice();
    const a = list.findIndex((x) => x.id === c.id);
    const b = list.findIndex((x) => x.id === other.id);
    list[a] = other;
    list[b] = c;
    const next = list.map((x, idx) => ({ ...x, orderSeq: idx + 1 }));
    const changed = next.filter((x) => x.orderSeq !== classes.find((y) => y.id === x.id)?.orderSeq).map((x) => ({ id: x.id, orderSeq: x.orderSeq as number }));
    const before = classes;
    setClasses(next);
    setMoving(c.id);
    try {
      await api("/erp/classes/order", { method: "PUT", body: { order: changed } });
    } catch (e) {
      setClasses(before);
      toast(false, errMsg(e, L({ hi: "नया क्रम सेव नहीं हुआ।", en: "Could not save the new order." })));
    }
    setMoving(null);
  };

  const streams = streamsOf(classes || []);
  const drawerClass = open ? (classes || []).find((c) => c.id === open.classId) || null : null;
  const drawerSection = drawerClass?.sections.find((s) => s.id === open?.sectionId) || null;
  const addSectionClass = addSection ? (classes || []).find((c) => c.id === addSection.classId) || null : null;
  const openClass = classOpen ? (classes || []).find((c) => c.id === classOpen) || null : null;
  const openGroup = openClass ? groups.find((g) => g.classes.some((x) => x.id === openClass.id)) : null;
  const openIdx = openClass && openGroup ? openGroup.classes.findIndex((x) => x.id === openClass.id) : -1;

  if (!classes) return res.error && res.error.status !== 401 ? <ErrorCard offline={res.error.status === 0} onRetry={res.reload} /> : <ListSkeleton rows={6} />;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">
        {P(totals.classes, { hi: "कक्षा", en: "class" }, { hi: "कक्षाएँ", en: "classes" })} · {P(totals.sections, { hi: "सेक्शन", en: "section" }, { hi: "सेक्शन", en: "sections" })}
        {counts ? ` · ${st(totals.students)}` : ""}
        {isAdmin ? `. ${L({ hi: "सेक्शन छूकर नाम या विषय बदलें।", en: "Tap a section to rename it or set its subjects." })}` : ""}
      </p>
      {setupNotice && <p className="text-[13px] text-marigold-700">{setupNotice} {L({ hi: "बाकी सब काम करता है।", en: "Everything else on this page still works." })}</p>}
      {who.data && !isAdmin && <p className="text-[13px] text-ink-500">{L({ hi: "कक्षा, सेक्शन और विषय सिर्फ़ एडमिन बदल सकते हैं।", en: "Only an admin can change classes, sections and subjects." })}</p>}

      {isAdmin && (
        <button type="button" onClick={() => setAddOpen({})} className="btn-primary w-full">
          <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "कक्षा जोड़ें", en: "Add class" })}
        </button>
      )}

      {classes.length === 0 ? (
        <Empty>{L({ hi: "अभी कोई कक्षा नहीं। पहली कक्षा उसके सेक्शन के साथ जोड़ें। विषय अभी या बाद में डाल सकते हैं।", en: "No classes yet. Add your first class with its sections. Subjects can be added now or later." })}</Empty>
      ) : (
        groups.map((g) => {
          const wingStudents = g.classes.reduce((t, c) => t + classCount(c.name), 0);
          return (
            <section key={g.wing} className="space-y-2">
              <p className="mlabel flex justify-between gap-3 pt-1">
                <span>{L({ hi: WING_HI[g.wing] || g.wing, en: g.wing })}</span>
                <span className="tnum">
                  {P(g.classes.length, { hi: "कक्षा", en: "class" }, { hi: "कक्षाएँ", en: "classes" })}
                  {counts ? ` · ${st(wingStudents)}` : ""}
                </span>
              </p>
              {g.classes.map((c) => {
                const subjects = Array.from(new Set(c.sections.flatMap((s) => s.subjects)));
                const myStrays = strays.filter((s) => s.cls === c.name);
                return (
                  <div key={c.id} className="row-card space-y-2">
                    {isAdmin ? (
                      <button type="button" onClick={() => setClassOpen(c.id)} className="-my-1 flex min-h-[44px] w-full items-center gap-2 text-left">
                        <ClassHead name={c.name} students={counts ? st(classCount(c.name)) : ""} />
                        {moving === c.id ? <span className="text-ink-400">…</span> : <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-300" aria-hidden />}
                      </button>
                    ) : (
                      <div className="flex items-center">
                        <ClassHead name={c.name} students={counts ? st(classCount(c.name)) : ""} />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {c.sections.map((s) => {
                        const label = (
                          <>
                            <span className="truncate font-semibold">{s.name}</span>
                            {s.stream && !s.name.toLowerCase().startsWith(s.stream.toLowerCase()) && <span className="text-ink-500">{s.stream}</span>}
                            {counts && <span className="tnum text-ink-500">{secCount(c.name, s.name)}</span>}
                          </>
                        );
                        return isAdmin ? (
                          <button key={s.id} type="button" onClick={() => setOpen({ classId: c.id, sectionId: s.id })} className="inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-[14px] active:bg-ink-50">
                            {label}
                          </button>
                        ) : (
                          <span key={s.id} className="inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-[14px]">
                            {label}
                          </span>
                        );
                      })}
                      {isAdmin &&
                        myStrays.map((s) => (
                          <button key={s.section} type="button" onClick={() => setAddSection({ classId: c.id, names: [s.section] })} className="inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-lg border border-dashed border-marigold-400 bg-white px-3 text-[14px] text-marigold-800" title={L({ hi: "बच्चे हैं पर सेक्शन नहीं बना। छूकर जोड़ें।", en: "Has students but is not set up. Tap to add it." })}>
                            <span className="truncate font-semibold">{s.section}</span>
                            <span className="tnum opacity-70">{s.students}</span>
                          </button>
                        ))}
                      {isAdmin && (
                        <button type="button" onClick={() => setAddSection({ classId: c.id, names: null })} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-brand-100 bg-white px-3 text-[14px] font-semibold text-brand-600">
                          <Plus className="h-3.5 w-3.5" aria-hidden /> {L({ hi: "सेक्शन", en: "Section" })}
                        </button>
                      )}
                    </div>
                    {!c.sections.length ? (
                      <p className="text-[12.5px] text-ink-500">{myStrays.length && isAdmin ? L({ hi: "अभी सेक्शन नहीं बने। बिंदु वाली लाइन वाले में पहले से बच्चे हैं: छूकर जोड़ें।", en: "No sections set up yet. The dashed ones already have students: tap one to add it." }) : L({ hi: "अभी कोई सेक्शन नहीं।", en: "No sections yet." })}</p>
                    ) : (
                      subjects.length > 0 && <p className="text-[12.5px] leading-snug text-ink-500">{subjects.join(" · ")}</p>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })
      )}

      {isAdmin && missingClasses.length > 0 && (
        <div className="row-card space-y-2">
          <p className="text-[13.5px] text-ink-700">
            {missingClasses.map((m, i) => (
              <span key={m.name}>
                {i > 0 && "; "}
                <b>{m.name}</b> {L({ hi: "में", en: "has" })} {st(m.sections.reduce((t, s) => t + s.students, 0))} ({m.sections.map((s) => s.section).join(", ")})
              </span>
            ))}{" "}
            {L({ hi: "हैं, पर यहाँ कक्षा नहीं बनी।", en: missingClasses.length === 1 ? "but is not set up here yet." : "but are not set up here yet." })}
          </p>
          <div className="flex flex-wrap gap-2">
            {missingClasses.slice(0, 2).map((m) => (
              <button key={m.name} type="button" onClick={() => setAddOpen({ name: m.name, sections: m.sections.map((s) => s.section) })} className="btn-line min-h-[44px] px-3.5">
                <Plus className="h-4 w-4" aria-hidden /> {L({ hi: `${m.name} बनाएँ`, en: `Set up ${m.name}` })}
              </button>
            ))}
          </div>
        </div>
      )}

      {addOpen && (
        <AddClassSheet
          prefill={addOpen}
          existing={classes.map((c) => c.name)}
          onClose={() => setAddOpen(null)}
          onCreated={async () => {
            setAddOpen(null);
            await reload();
          }}
        />
      )}
      {addSectionClass && (
        <AddSectionSheet
          cls={addSectionClass}
          prefill={addSection?.names || null}
          streams={streams}
          onClose={() => setAddSection(null)}
          onAdded={async () => {
            setAddSection(null);
            await reload();
          }}
        />
      )}
      {openClass && (
        <ClassSheet
          cls={openClass}
          students={counts ? classCount(openClass.name) : null}
          taken={classes.map((c) => c.name)}
          first={openIdx <= 0}
          last={!!openGroup && openIdx === openGroup.classes.length - 1}
          onMove={(d) => move(openClass, d)}
          onClose={() => setClassOpen(null)}
          onDone={reload}
        />
      )}
      {drawerClass && drawerSection && (
        <SectionSheet
          cls={drawerClass}
          section={drawerSection}
          students={secCount(drawerClass.name, drawerSection.name)}
          streams={streams}
          setupNotice={setupNotice}
          onSetupNotice={setSetupNotice}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function ClassHead({ name, students }: { name: string; students: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[16px] font-bold">{name}</span>
      {students && <span className="block text-[12.5px] text-ink-500">{students}</span>}
    </span>
  );
}

/* ───────────── Chips (the ERP's ChipInput + subject suggestions) ───────────── */

function Chips({ values, onChange, clean, placeholder, label, max = 50, maxLength = 60 }: { values: string[]; onChange: (v: string[]) => void; clean: (s: string) => string; placeholder: string; label: string; max?: number; maxLength?: number }) {
  const L = useL();
  const [text, setText] = useState("");
  const add = (raw: string) => {
    onChange(addChips(values, raw, clean, max, maxLength));
    setText("");
  };
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v} className="flex min-h-[36px] max-w-full items-center gap-1 rounded-lg bg-white pl-2.5 text-[13.5px] font-semibold ring-1 ring-ink-200">
              <span className="truncate">{v}</span>
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid h-9 w-8 shrink-0 place-items-center text-ink-400" aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${v}`}>
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="field-box min-h-[48px]">
        <input
          value={text}
          maxLength={maxLength}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) add(text);
            }
          }}
          onBlur={() => text.trim() && add(text)}
          enterKeyHint="done"
          placeholder={placeholder}
          aria-label={label}
          className="text-[16px]"
        />
        {text.trim() && (
          <button type="button" onClick={() => add(text)} className="-mr-2 min-h-[44px] shrink-0 px-2 text-[14px] font-semibold text-brand-600">
            {L({ hi: "जोड़ें", en: "Add" })}
          </button>
        )}
      </label>
    </div>
  );
}

function SubjectSuggestions({ values, onAdd, limit = 8 }: { values: string[]; onAdd: (s: string) => void; limit?: number }) {
  const L = useL();
  const [all, setAll] = useState(false);
  const have = new Set(values.map((v) => v.toLowerCase()));
  const left = COMMON_SUBJECTS.filter((s) => !have.has(s.toLowerCase()));
  if (!left.length) return null;
  const shown = all ? left : left.slice(0, limit);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <button key={s} type="button" onClick={() => onAdd(s)} className="min-h-[34px] rounded-lg border border-dashed border-ink-300 px-2 text-[12.5px] text-ink-600">
          + {s}
        </button>
      ))}
      {left.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="min-h-[34px] px-1 text-[12.5px] font-semibold text-brand-600">
          {L({ hi: `${left.length - shown.length} और`, en: `${left.length - shown.length} more` })}
        </button>
      )}
    </div>
  );
}

/** Pick a stream, or type a new one. */
function StreamPicker({ value, onChange, streams }: { value: string; onChange: (v: string) => void; streams: string[] }) {
  const L = useL();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const list = value && !streams.includes(value) ? streams.concat(value) : streams;
  if (adding)
    return (
      <div className="flex gap-2">
        <label className="field-box min-h-[48px] flex-1">
          <input autoFocus value={draft} maxLength={30} onChange={(e) => setDraft(e.target.value)} placeholder={L({ hi: "जैसे Agriculture", en: "e.g. Agriculture" })} className="text-[16px]" />
        </label>
        <button type="button" disabled={!draft.trim()} onClick={() => { onChange(draft.trim().replace(/\s+/g, " ")); setAdding(false); }} className="btn-primary min-h-[48px] px-4">
          {L({ hi: "लें", en: "Use" })}
        </button>
        <button type="button" onClick={() => setAdding(false)} className="btn-line min-h-[48px] px-3">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  return (
    <SelectBox
      label={L({ hi: "स्ट्रीम", en: "Stream" })}
      value={value}
      onChange={(v) => {
        if (v === "__new") {
          setDraft("");
          setAdding(true);
        } else onChange(v);
      }}
    >
      <option value="">{L({ hi: "कोई स्ट्रीम नहीं", en: "No stream" })}</option>
      {list.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value="__new">{L({ hi: "+ नई स्ट्रीम…", en: "+ New stream…" })}</option>
    </SelectBox>
  );
}

/** Quick A/B/C/D toggles shown above a chips box. */
function QuickLetters({ letters, picked, onToggle }: { letters: string[]; picked: string[]; onToggle: (s: string) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Quick sections">
      {letters.map((s) => {
        const on = picked.includes(s);
        return (
          <button key={s} type="button" aria-pressed={on} onClick={() => onToggle(s)} className={clsx("h-11 w-11 rounded-lg border text-[15px] font-semibold", on ? "border-[#3099a4] bg-[#3099a4] text-white" : "border-ink-200 bg-white text-ink-600")}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── Add class ───────────── */

const QUICK = ["A", "B", "C", "D"];

function AddClassSheet({ prefill, existing, onClose, onCreated }: { prefill: AddPrefill; existing: string[]; onClose: () => void; onCreated: () => void }) {
  const L = useL();
  const [name, setName] = useState(prefill.name || "");
  const [wing, setWing] = useState(guessWing(prefill.name || ""));
  const [wingTouched, setWingTouched] = useState(false);
  const [sections, setSections] = useState<string[]>(prefill.sections?.length ? prefill.sections : ["A"]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const taken = new Set(existing.map((e) => e.toLowerCase()));
  const missing = STANDARD_CLASSES.filter((c) => !taken.has(c.toLowerCase()));
  const clash = taken.has(name.trim().toLowerCase());
  const setClassName = (v: string) => {
    setName(v);
    if (!wingTouched) setWing(guessWing(v));
  };
  const toggle = (s: string) => setSections(sections.includes(s) ? sections.filter((x) => x !== s) : QUICK.filter((q) => q === s || sections.includes(q)).concat(sections.filter((x) => !QUICK.includes(x))));

  const save = async () => {
    const clean = name.trim();
    if (!clean) return toast(false, L({ hi: "कक्षा का नाम लिखें।", en: "Enter the class name." }));
    if (clash) return toast(false, L({ hi: `कक्षा ${clean} पहले से है। उसमें सेक्शन जोड़ें।`, en: `Class ${clean} already exists. Add sections to it instead.` }));
    if (!sections.length) return toast(false, L({ hi: "कम से कम एक सेक्शन जोड़ें।", en: "Add at least one section." }));
    setSaving(true);
    try {
      await api("/erp/classes", { body: { name: clean, sections, subjects, ...(wing ? { wing } : {}) } });
      toast(true, L({ hi: `कक्षा ${clean} ${sections.length} सेक्शन के साथ जुड़ गई।`, en: `Class ${clean} added with ${sections.length} section${sections.length === 1 ? "" : "s"}.` }));
      onCreated();
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "कक्षा नहीं जुड़ी।", en: "Could not add the class." })));
      setSaving(false);
    }
  };

  return (
    <Sheet title={L({ hi: "कक्षा जोड़ें", en: "Add class" })} onClose={() => !saving && onClose()}>
      <div className="space-y-3">
        <label className={clsx("field-box", clash && "!border-rose-400")}>
          <small>{L({ hi: "कक्षा का नाम", en: "Class name" })}</small>
          <input value={name} onChange={(e) => setClassName(e.target.value)} maxLength={50} placeholder={L({ hi: "जैसे 12th", en: "e.g. 12th" })} className="text-[16px]" />
        </label>
        {clash ? (
          <p className="text-[13px] text-rose-600">{L({ hi: `${name.trim()} पहले से है। उस कक्षा पर “सेक्शन” से जोड़ें।`, en: `${name.trim()} already exists. Use “Section” on that class instead.` })}</p>
        ) : (
          missing.length > 0 &&
          !name && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px] text-ink-500">{L({ hi: "अभी नहीं बनीं:", en: "Not set up yet:" })}</span>
              {missing.map((c) => (
                <button key={c} type="button" onClick={() => setClassName(c)} className="min-h-[36px] rounded-lg border border-ink-200 bg-white px-2.5 text-[13px] font-semibold text-ink-700">
                  {c}
                </button>
              ))}
            </div>
          )
        )}
        <SelectBox
          label={L({ hi: "विंग", en: "Wing" })}
          value={wing}
          onChange={(v) => {
            setWing(v);
            setWingTouched(true);
          }}
        >
          <option value="">{L({ hi: "कोई विंग नहीं", en: "No wing" })}</option>
          {WINGS.map((w) => (
            <option key={w} value={w}>
              {L({ hi: WING_HI[w] || w, en: w })}
            </option>
          ))}
        </SelectBox>

        <div className="border-t border-ink-100 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold">{L({ hi: "सेक्शन", en: "Sections" })}</span>
            <QuickLetters letters={QUICK} picked={sections} onToggle={toggle} />
          </div>
          <Chips values={sections} onChange={setSections} clean={cleanSection} max={20} maxLength={30} placeholder={L({ hi: "या नाम लिखें, जैसे Science-Maths", en: "Or type a name, e.g. Science-Maths" })} label={L({ hi: "सेक्शन का नाम", en: "Section name" })} />
        </div>

        <div className="border-t border-ink-100 pt-3">
          <p className="mb-2 text-[14px] font-semibold">
            {L({ hi: "विषय", en: "Subjects" })} <span className="font-normal text-ink-500">{L({ hi: "(चाहें तो, हर सेक्शन को मिलेंगे)", en: "(optional, given to every section)" })}</span>
          </p>
          <Chips values={subjects} onChange={setSubjects} clean={cleanSubject} placeholder={L({ hi: "विषय लिखकर Enter दबाएँ", en: "Type a subject, press Enter" })} label={L({ hi: "विषय", en: "Subject" })} />
          <SubjectSuggestions values={subjects} onAdd={(s) => setSubjects(subjects.concat(s))} />
        </div>

        <button type="button" onClick={save} disabled={saving || !name.trim() || clash || !sections.length} className="btn-primary w-full">
          {saving ? L({ hi: "जुड़ रही है…", en: "Adding…" }) : L({ hi: "कक्षा जोड़ें", en: "Add class" })}
        </button>
      </div>
    </Sheet>
  );
}

/* ───────────── Add section ───────────── */

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function AddSectionSheet({ cls, prefill, streams, onClose, onAdded }: { cls: ClassItem; prefill: string[] | null; streams: string[]; onClose: () => void; onAdded: () => void }) {
  const L = useL();
  const have = new Set(cls.sections.map((s) => s.name.toLowerCase()));
  const nextLetters = LETTERS.filter((l) => !have.has(l.toLowerCase())).slice(0, 4);
  const from = cls.sections.find((s) => s.subjects.length);
  const [names, setNames] = useState<string[]>(() => (prefill?.length ? prefill : nextLetters.slice(0, 1)));
  const [subjects, setSubjects] = useState<string[]>(() => (from ? from.subjects.slice() : []));
  const [stream, setStream] = useState(() => cls.sections.find((s) => s.stream)?.stream || (takesStream(cls) ? "Science" : ""));
  const [saving, setSaving] = useState(false);
  const dupes = names.filter((n) => have.has(n.toLowerCase()));

  const save = async () => {
    if (!names.length) return toast(false, L({ hi: "कम से कम एक सेक्शन का नाम लिखें।", en: "Enter at least one section name." }));
    if (dupes.length) return toast(false, L({ hi: `${cls.name} में सेक्शन ${dupes.join(", ")} पहले से है।`, en: `${cls.name} already has section ${dupes.join(", ")}.` }));
    setSaving(true);
    try {
      await api(`/erp/classes/${encodeURIComponent(cls.id)}/sections`, { body: { names, subjects, ...(stream ? { stream } : {}) } });
      toast(true, L({ hi: `${cls.name} में ${names.length} सेक्शन जुड़ गए।`, en: `${names.length} section${names.length === 1 ? "" : "s"} added to ${cls.name}.` }));
      onAdded();
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "सेक्शन नहीं जुड़ा।", en: "Could not add the section." })));
      setSaving(false);
    }
  };

  return (
    <Sheet title={L({ hi: `${cls.name} में सेक्शन जोड़ें`, en: `Add section to ${cls.name}` })} onClose={() => !saving && onClose()}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">{cls.sections.length ? `${L({ hi: "अभी:", en: "Now:" })} ${cls.sections.map((s) => s.name).join(", ")}` : L({ hi: "अभी कोई सेक्शन नहीं", en: "No sections yet" })}</p>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold">{L({ hi: "नए सेक्शन", en: "New sections" })}</span>
            {nextLetters.length > 0 && <QuickLetters letters={nextLetters} picked={names} onToggle={(s) => setNames(names.includes(s) ? names.filter((x) => x !== s) : names.concat(s))} />}
          </div>
          <Chips values={names} onChange={setNames} clean={cleanSection} max={20} maxLength={30} placeholder={L({ hi: "या नाम लिखें, जैसे Science-Bio", en: "Or type a name, e.g. Science-Bio" })} label={L({ hi: "सेक्शन का नाम", en: "Section name" })} />
          {dupes.length > 0 && <p className="mt-1.5 text-[13px] text-rose-600">{L({ hi: `${cls.name} में पहले से: ${dupes.join(", ")}`, en: `Already in ${cls.name}: ${dupes.join(", ")}` })}</p>}
        </div>
        {takesStream(cls) && <StreamPicker value={stream} onChange={setStream} streams={streams} />}
        <div className="border-t border-ink-100 pt-3">
          <p className="mb-2 text-[14px] font-semibold">
            {L({ hi: "विषय", en: "Subjects" })}{" "}
            <span className="font-normal text-ink-500">{from ? L({ hi: `(${cls.name} - ${from.name} से लिए, चाहें तो बदलें)`, en: `(copied from ${cls.name} - ${from.name}, change if needed)` }) : L({ hi: "(चाहें तो)", en: "(optional)" })}</span>
          </p>
          <Chips values={subjects} onChange={setSubjects} clean={cleanSubject} placeholder={L({ hi: "विषय लिखकर Enter दबाएँ", en: "Type a subject, press Enter" })} label={L({ hi: "विषय", en: "Subject" })} />
          <SubjectSuggestions values={subjects} onAdd={(s) => setSubjects(subjects.concat(s))} />
        </div>
        <button type="button" onClick={save} disabled={saving || !names.length || dupes.length > 0} className="btn-primary w-full">
          {saving ? L({ hi: "जुड़ रहा है…", en: "Adding…" }) : names.length > 1 ? L({ hi: `${names.length} सेक्शन जोड़ें`, en: `Add ${names.length} sections` }) : L({ hi: "सेक्शन जोड़ें", en: "Add section" })}
        </button>
      </div>
    </Sheet>
  );
}

/* ───────────── One class: rename, move, delete ───────────── */

function ClassSheet({ cls, students, taken, first, last, onMove, onClose, onDone }: { cls: ClassItem; students: number | null; taken: string[]; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onClose: () => void; onDone: () => Promise<void> }) {
  const L = useL();
  const [name, setName] = useState(cls.name);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const next = name.trim();
  const clash = next.toLowerCase() !== cls.name.toLowerCase() && taken.some((t) => t.toLowerCase() === next.toLowerCase());
  const changed = !!next && next !== cls.name;
  const n = students || 0;
  const stu = `${n} ${L(n === 1 ? { hi: "बच्चा", en: "student" } : { hi: "बच्चे", en: "students" })}`;

  const rename = async () => {
    if (!changed || clash) return;
    setBusy(true);
    try {
      await api(`/erp/classes/${encodeURIComponent(cls.id)}`, { method: "PATCH", body: { name: next } });
      await onDone();
      toast(true, L({ hi: `${cls.name} का नाम ${next} हो गया।`, en: `${cls.name} renamed to ${next}.` }));
      onClose();
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "नाम नहीं बदला।", en: "Could not rename the class." })));
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/erp/classes/${encodeURIComponent(cls.id)}`, { method: "DELETE" });
      toast(true, L({ hi: `कक्षा ${cls.name} हटा दी।`, en: `Class ${cls.name} deleted.` }));
      onClose();
      await onDone();
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "कक्षा नहीं हटी।", en: "Could not delete the class." })));
      setBusy(false);
    }
  };

  if (ask)
    return (
      <Sheet title={L({ hi: `कक्षा ${cls.name} हटाएँ?`, en: `Delete class ${cls.name}?` })} onClose={() => !busy && setAsk(false)}>
        <p className="mb-4 text-[14.5px] text-ink-600">
          {cls.sections.length
            ? L({ hi: `${cls.name} और उसके ${cls.sections.length} सेक्शन (${cls.sections.map((s) => s.name).join(", ")}) विषयों के साथ हट जाएँगे।`, en: `${cls.name} and its ${cls.sections.length} section${cls.sections.length === 1 ? "" : "s"} (${cls.sections.map((s) => s.name).join(", ")}) are removed, with their subject lists.` })
            : L({ hi: `${cls.name} में कोई सेक्शन नहीं, यह हट जाएगी।`, en: `${cls.name} has no sections and is removed.` })}{" "}
          {L({ hi: "यह वापस नहीं होगा।", en: "This cannot be undone." })}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setAsk(false)} disabled={busy} className="btn-line">
            {L({ hi: "रहने दें", en: "Cancel" })}
          </button>
          <button type="button" onClick={remove} disabled={busy} className="btn-primary !bg-rose-600">
            {busy ? "…" : L({ hi: "कक्षा हटाएँ", en: "Delete class" })}
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet title={cls.name} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <p className="mlabel">{L({ hi: "नाम बदलें", en: "Rename" })}</p>
        <label className={clsx("field-box", clash && "!border-rose-400")}>
          <small>{L({ hi: "नया नाम", en: "New name" })}</small>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename()} maxLength={50} className="text-[16px]" />
        </label>
        {clash ? (
          <p className="text-[13px] text-rose-600">{L({ hi: `${next} नाम की कक्षा पहले से है।`, en: `A class named ${next} already exists.` })}</p>
        ) : n > 0 ? (
          <p className="rounded-xl bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
            {L({ hi: `नाम बदलने पर ${cls.name} के सारे ${stu} नए नाम में चले जाते हैं। उनका रिकॉर्ड, हाज़िरी और फ़ीस वैसे ही रहते हैं।`, en: `Renaming moves all ${stu} of ${cls.name} to the new name. Their records, attendance and fees stay the same.` })}
          </p>
        ) : (
          <p className="text-[13px] text-ink-500">{L({ hi: `${cls.name} में अभी कोई बच्चा नहीं।`, en: `No students are in ${cls.name} yet.` })}</p>
        )}
        <button type="button" onClick={rename} disabled={busy || !changed || clash} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "नाम बदलें", en: "Rename class" })}
        </button>

        <p className="mlabel pt-2">{L({ hi: "क्रम", en: "Order" })}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => onMove(-1)} disabled={first || busy} className="btn-line">
            <ArrowUp className="h-4 w-4" aria-hidden /> {L({ hi: "ऊपर", en: "Move up" })}
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={last || busy} className="btn-line">
            <ArrowDown className="h-4 w-4" aria-hidden /> {L({ hi: "नीचे", en: "Move down" })}
          </button>
        </div>

        <p className="mlabel pt-2">{L({ hi: "कक्षा हटाएँ", en: "Delete class" })}</p>
        {students === null ? (
          <p className="text-[13px] text-ink-500">{L({ hi: "बच्चों की गिनती आने के बाद ही हटा सकते हैं।", en: "Can be deleted once the student count has loaded." })}</p>
        ) : n > 0 ? (
          <p className="text-[13px] text-ink-500">{L({ hi: `${cls.name} में ${stu} हैं। हटाने से पहले उन्हें दूसरी कक्षा में भेजें।`, en: `${stu} ${n === 1 ? "is" : "are"} in ${cls.name}. Move them before deleting.` })}</p>
        ) : null}
        <button type="button" onClick={() => setAsk(true)} disabled={busy || students === null || n > 0} className="btn-line w-full !border-rose-200 !text-rose-600">
          <Trash2 className="h-4 w-4" aria-hidden /> {L({ hi: "हटाएँ", en: "Delete" })}
        </button>
      </div>
    </Sheet>
  );
}

/* ───────────── One section: rename, stream, subjects, delete (ERP SectionDrawer) ───────────── */

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function SectionSheet({
  cls,
  section,
  students,
  streams,
  setupNotice,
  onSetupNotice,
  onClose,
  onChanged,
}: {
  cls: ClassItem;
  section: SectionItem;
  students: number;
  streams: string[];
  setupNotice: string | null;
  onSetupNotice: (msg: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const L = useL();
  const [name, setName] = useState(section.name);
  const [subjects, setSubjects] = useState<string[]>(() => section.subjects.slice());
  const [allSections, setAllSections] = useState(false);
  const [confirm, setConfirm] = useState<"rename" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(section.name), [section.name]);

  const label = `${cls.name} - ${section.name}`;
  const newName = cleanSection(name);
  const renamed = !!newName && newName !== section.name;
  const clash = renamed && cls.sections.some((s) => s.id !== section.id && s.name.toLowerCase() === newName.toLowerCase());
  const others = cls.sections.filter((s) => s.id !== section.id);
  const dirty = !same(subjects, section.subjects) || (allSections && others.some((s) => !same(s.subjects, subjects)));
  const stu = `${students} ${L(students === 1 ? { hi: "बच्चा", en: "student" } : { hi: "बच्चे", en: "students" })}`;
  const patch = (id: string, body: unknown) => api(`/erp/classes/sections/${encodeURIComponent(id)}`, { method: "PATCH", body });

  const rename = async () => {
    setBusy(true);
    try {
      await patch(section.id, { name: newName.trim() });
      await onChanged();
      toast(true, L({ hi: `${label} अब ${cls.name} - ${newName} है।`, en: `${label} renamed to ${cls.name} - ${newName}.` }));
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "सेक्शन का नाम नहीं बदला।", en: "Could not rename the section." })));
    }
    setBusy(false);
    setConfirm(null);
  };

  const saveSubjects = async () => {
    setBusy(true);
    const targets = allSections ? [section].concat(others) : [section];
    let failed = "";
    let setup = "";
    for (const t of targets) {
      try {
        await patch(t.id, { subjects });
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "";
        if (isSetupMessage(msg)) setup = msg || SUBJECTS_SETUP_MESSAGE;
        else failed = msg || L({ hi: "विषय सेव नहीं हुए।", en: "Could not save the subjects." });
        break;
      }
    }
    if (!setup) await onChanged();
    setBusy(false);
    if (setup) return onSetupNotice(setup);
    if (failed) return toast(false, failed);
    toast(true, allSections ? L({ hi: `${cls.name} के सारे ${targets.length} सेक्शन के विषय सेव हुए।`, en: `Subjects saved for all ${targets.length} sections of ${cls.name}.` }) : L({ hi: `${label} के विषय सेव हुए।`, en: `Subjects saved for ${label}.` }));
  };

  /** Saved as soon as it is picked. */
  const saveStream = async (v: string) => {
    if (v === (section.stream || "")) return;
    setBusy(true);
    try {
      await patch(section.id, { stream: v });
      await onChanged();
      toast(true, v ? L({ hi: `${label} अब ${v} है।`, en: `${label} is now ${v}.` }) : L({ hi: `${label} से स्ट्रीम हटी।`, en: `Stream removed from ${label}.` }));
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "स्ट्रीम सेव नहीं हुई।", en: "Could not save the stream." })));
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/erp/classes/sections/${encodeURIComponent(section.id)}`, { method: "DELETE" });
      toast(true, L({ hi: `सेक्शन ${label} हटा दिया।`, en: `Section ${label} deleted.` }));
      onClose();
      await onChanged();
    } catch (e) {
      toast(false, errMsg(e, L({ hi: "सेक्शन नहीं हटा।", en: "Could not delete the section." })));
      setBusy(false);
      setConfirm(null);
    }
  };

  if (confirm === "rename")
    return (
      <Sheet title={L({ hi: `${label} का नाम बदलें?`, en: `Rename ${label}?` })} onClose={() => !busy && setConfirm(null)}>
        <p className="mb-2 text-[14.5px] text-ink-600">
          {label} {L({ hi: "बन जाएगा", en: "becomes" })} <b className="text-ink-900">{cls.name} - {newName}</b>.
        </p>
        <p className="mb-4 text-[14px] text-ink-600">
          {students > 0
            ? L({ hi: `${label} के सारे ${stu} नए नाम में चले जाएँगे। रिकॉर्ड, हाज़िरी और फ़ीस वैसे ही रहेंगे।`, en: `Renaming moves all ${stu} of ${label} to the new name. Their records, attendance and fees stay the same.` })
            : L({ hi: "इस सेक्शन में अभी कोई बच्चा नहीं।", en: "No students are in this section yet." })}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="btn-line">
            {L({ hi: "रहने दें", en: "Cancel" })}
          </button>
          <button type="button" onClick={rename} disabled={busy} className="btn-primary">
            {busy ? "…" : L({ hi: "नाम बदलें", en: "Rename section" })}
          </button>
        </div>
      </Sheet>
    );
  if (confirm === "delete")
    return (
      <Sheet title={L({ hi: `${label} हटाएँ?`, en: `Delete ${label}?` })} onClose={() => !busy && setConfirm(null)}>
        <p className="mb-4 text-[14.5px] text-ink-600">{L({ hi: `सेक्शन ${section.name} और उसके विषय ${cls.name} से हट जाएँगे। यह वापस नहीं होगा।`, en: `Section ${section.name} and its subject list are removed from ${cls.name}. This cannot be undone.` })}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="btn-line">
            {L({ hi: "रहने दें", en: "Cancel" })}
          </button>
          <button type="button" onClick={remove} disabled={busy} className="btn-primary !bg-rose-600">
            {busy ? "…" : L({ hi: "सेक्शन हटाएँ", en: "Delete section" })}
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet title={label} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-500">
          {stu} · {section.subjects.length ? `${section.subjects.length} ${L({ hi: "विषय", en: section.subjects.length === 1 ? "subject" : "subjects" })}` : L({ hi: "अभी कोई विषय नहीं", en: "no subjects yet" })}
        </p>

        <p className="mlabel">{L({ hi: "सेक्शन का नाम", en: "Section name" })}</p>
        <div className="flex gap-2">
          <label className={clsx("field-box min-h-[48px] flex-1", clash && "!border-rose-400")}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="text-[16px]" aria-label={L({ hi: "सेक्शन का नाम", en: "Section name" })} />
          </label>
          <button type="button" onClick={() => setConfirm("rename")} disabled={!renamed || clash || busy} className="btn-line min-h-[48px] px-4">
            {L({ hi: "बदलें", en: "Rename" })}
          </button>
        </div>
        <p className={clsx("text-[12.5px]", clash ? "text-rose-600" : "text-ink-500")}>
          {clash ? L({ hi: `${cls.name} में सेक्शन ${newName} पहले से है।`, en: `${cls.name} already has section ${newName}.` }) : students ? L({ hi: `इसके ${stu} नए नाम में चले जाएँगे।`, en: `Its ${stu} move to the new name.` }) : L({ hi: "इस सेक्शन में अभी कोई बच्चा नहीं।", en: "No students in this section yet." })}
        </p>

        {takesStream(cls) && (
          <>
            <p className="mlabel pt-1">{L({ hi: "स्ट्रीम (चुनते ही सेव)", en: "Stream (saved as soon as you pick it)" })}</p>
            <StreamPicker value={section.stream || ""} onChange={saveStream} streams={streams} />
          </>
        )}

        <p className="mlabel pt-1">{L({ hi: "विषय", en: "Subjects" })}</p>
        {setupNotice && <p className="text-[13px] text-marigold-700">{setupNotice}</p>}
        <Chips values={subjects} onChange={setSubjects} clean={cleanSubject} placeholder={L({ hi: "विषय लिखकर Enter दबाएँ", en: "Type a subject, press Enter" })} label={L({ hi: "विषय", en: "Subject" })} />
        <SubjectSuggestions values={subjects} onAdd={(s) => setSubjects(subjects.concat(s))} limit={10} />
        {others.length > 0 && (
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 border-t border-ink-100 pt-2 text-[14px]">
            <input type="checkbox" checked={allSections} onChange={(e) => setAllSections(e.target.checked)} className="h-5 w-5 shrink-0 accent-brand-600" />
            {others.length === 1
              ? L({ hi: `${cls.name} - ${others[0].name} में भी यही विषय`, en: `Use the same subjects for ${cls.name} - ${others[0].name}` })
              : L({ hi: `${cls.name} के सारे सेक्शन (${others.map((s) => s.name).join(", ")}) में यही विषय`, en: `Use the same subjects for all sections of ${cls.name} (${others.map((s) => s.name).join(", ")})` })}
          </label>
        )}
        <button type="button" onClick={saveSubjects} disabled={busy || !dirty || !!setupNotice} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "विषय सेव करें", en: "Save subjects" })}
        </button>

        <p className="mlabel pt-2">{L({ hi: "सेक्शन हटाएँ", en: "Delete section" })}</p>
        <p className="text-[12.5px] text-ink-500">
          {students
            ? L({ hi: `${label} में ${stu} हैं। पहले प्रमोट और ट्रांसफ़र से उन्हें भेजें।`, en: `${stu} ${students === 1 ? "is" : "are"} in ${label}. Move them from Promote & transfer first.` })
            : L({ hi: "सेक्शन हट जाएगा। यह वापस नहीं होगा।", en: "Removes the section. This cannot be undone." })}
        </p>
        <button type="button" onClick={() => setConfirm("delete")} disabled={!!students || busy} className="btn-line w-full !border-rose-200 !text-rose-600">
          <Trash2 className="h-4 w-4" aria-hidden /> {L({ hi: "हटाएँ", en: "Delete" })}
        </button>
      </div>
    </Sheet>
  );
}
