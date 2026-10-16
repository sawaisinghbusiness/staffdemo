"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, Lock, Plus, Trash2, X } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import type { Exam } from "@/lib/erpExams";
import { classRange, cleanClasses, cleanSubject, COMMON_SUBJECTS, examDates, examPattern, scopeNote, type ClassItem } from "@/lib/erpExamSetup";
import { Empty, ErrorCard, LineTabs, ListSkeleton, Sheet } from "@/components/ui";

/*
 * ERP login → Exams → Exam setup: the ERP's page (GET /api/exams, /api/classes). Tab 1 lists this session's exams:
 * tap one for lock (sends report cards to the parent app) / unlock, edit, delete. Tab 2 is subjects by class
 * (PATCH /api/classes/sections/:id). Same role rules as the ERP: admin + exam cell edit exams, only admin deletes
 * and sets subjects.
 */

type Tab = "exams" | "subjects";

export default function ErpExamSetupPage() {
  const L = useL();
  const [tab, setTab] = useState<Tab>("exams");
  const exams = useApi<{ data: Exam[]; setupNeeded: boolean }>("/erp/exams");
  const cls = useApi<{ data: ClassItem[] }>("/erp/classes");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const role = who.data?.user.role || "";
  const canEdit = role === "admin" || role === "exam_cell";
  const isAdmin = role === "admin";

  const [list, setList] = useState<Exam[] | null>(null);
  useEffect(() => {
    if (exams.data) setList(exams.data.data);
  }, [exams.data]);
  const classes = useMemo(() => cleanClasses(cls.data?.data).filter((c) => c.sections.length), [cls.data]);
  const classNames = classes.map((c) => c.name);
  const missing = classes.filter((c) => c.sections.some((s) => !s.subjects.length)).length;

  const [openId, setOpenId] = useState("");
  const [subjectsFor, setSubjectsFor] = useState<ClassItem | null>(null);
  const open = list?.find((e) => e.id === openId) || null;

  if (exams.data?.setupNeeded) return <Empty>{L({ hi: "परीक्षा के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261001_exams.sql)।", en: "Exams need a one-time database setup (20261001_exams.sql)." })}</Empty>;
  if (!list) return exams.error && exams.error.status !== 401 ? <ErrorCard offline={exams.error.status === 0} onRetry={exams.reload} /> : <ListSkeleton rows={5} />;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <LineTabs
        label={L({ hi: "परीक्षा सेटअप", en: "Exam setup" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "exams", text: L({ hi: `परीक्षाएँ (${list.length})`, en: `Exams (${list.length})` }) },
          { key: "subjects", text: missing ? L({ hi: `विषय · ${missing} बाकी`, en: `Subjects · ${missing} left` }) : L({ hi: "कक्षा के विषय", en: "Subjects" }) },
        ]}
      />

      {tab === "exams" ? (
        <>
          <p className="text-[13px] text-ink-500">{L({ hi: "परीक्षा बंद करने के बाद ही उसका रिपोर्ट कार्ड पेरेंट ऐप में दिखता है।", en: "Parents see an exam's report card only after it is locked." })}</p>
          {list.length === 0 ? (
            <Empty>{L({ hi: "अभी कोई परीक्षा नहीं जोड़ी। इस सत्र की परीक्षाएँ जोड़ें (Periodic Test 1, Half Yearly…), फिर टीचर अंक भर सकेंगे।", en: "No exam added yet. Add this session's exams (Periodic Test 1, Half Yearly…), then teachers can enter marks." })}</Empty>
          ) : (
            <ul>
              {list.map((e) => {
                const range = classRange(e.classes, classNames) || L({ hi: "सभी कक्षाएँ", en: "All classes" });
                const note = scopeNote(e);
                const dates = examDates(e);
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => setOpenId(e.id)} className="flex min-h-[64px] w-full items-center gap-3 border-b border-ink-100 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{e.title}</span>
                        <span className="block truncate text-[12.5px] text-ink-500">
                          {range}
                          {note ? ` (${note})` : ""} · {dates || L({ hi: "तारीख नहीं", en: "No dates" })}
                        </span>
                        <span className={clsx("mt-0.5 flex items-center gap-1.5 text-[12.5px]", e.locked ? "text-jade-700" : "text-ink-500")}>
                          <span className={clsx("h-1.5 w-1.5 rounded-full", e.locked ? "bg-jade-500" : "bg-ink-300")} aria-hidden />
                          {e.locked ? L({ hi: "बंद · पेरेंट ऐप में", en: "Locked · in parent app" }) : L({ hi: "खुली · अंक भर सकते हैं", en: "Open for marks" })}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-right text-[13px] font-semibold text-ink-700">
                        {e.components.length === 1 ? `${L({ hi: "पूर्णांक", en: "Out of" })} ${e.max}` : examPattern(e)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && (
            <Link href="/erp/exams/setup/edit/" className="btn-primary w-full">
              <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "परीक्षा जोड़ें", en: "Add exam" })}
            </Link>
          )}
          {list.length > 0 && (
            <Link href="/erp/exams/marks/" className="link w-full justify-center">
              {L({ hi: "अंक भरें →", en: "Enter marks →" })}
            </Link>
          )}
        </>
      ) : !cls.data ? (
        cls.error && cls.error.status !== 401 ? <ErrorCard offline={cls.error.status === 0} onRetry={cls.reload} /> : <ListSkeleton rows={6} />
      ) : (
        <>
          <p className="text-[13px] text-ink-500">{L({ hi: "इन्हीं विषयों के अंक भरे और छापे जाते हैं।", en: "Marks are entered and printed for these subjects." })}</p>
          <ul>
            {classes.map((c) => {
              const lists = c.sections.map((s) => s.subjects);
              const same = lists.every((l) => JSON.stringify(l) === JSON.stringify(lists[0]));
              const body = (
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{c.name}</span>
                  {same ? (
                    <span className={clsx("block text-[13px]", lists[0]?.length ? "text-ink-600" : "text-marigold-700")}>{lists[0]?.length ? lists[0].join(", ") : L({ hi: "विषय नहीं डले", en: "Not set" })}</span>
                  ) : (
                    c.sections.map((s) => (
                      <span key={s.id} className="block text-[13px] text-ink-600">
                        <b className="font-semibold text-ink-500">{s.name}:</b> {s.subjects.length ? s.subjects.join(", ") : <span className="text-marigold-700">{L({ hi: "नहीं डले", en: "Not set" })}</span>}
                      </span>
                    ))
                  )}
                </span>
              );
              return (
                <li key={c.id} className="border-b border-ink-100">
                  {isAdmin ? (
                    <button type="button" onClick={() => setSubjectsFor(c)} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left">
                      {body}
                      <span className="shrink-0 text-[13px] font-semibold text-brand-600">{lists.some((l) => l.length) ? L({ hi: "बदलें", en: "Change" }) : L({ hi: "डालें", en: "Set" })}</span>
                    </button>
                  ) : (
                    <div className="flex min-h-[56px] items-center py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {open && (
        <ExamSheet
          exam={open}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onClose={() => setOpenId("")}
          onChanged={(next) => {
            setList((prev) => (next ? (prev || []).map((x) => (x.id === next.id ? next : x)) : (prev || []).filter((x) => x.id !== open.id)));
            if (!next) setOpenId("");
            exams.reload();
          }}
        />
      )}
      {subjectsFor && (
        <SubjectsSheet
          cls={subjectsFor}
          onClose={() => setSubjectsFor(null)}
          onSaved={() => {
            toast(true, L({ hi: `${subjectsFor.name} के विषय सेव हो गए।`, en: `Subjects of ${subjectsFor.name} saved.` }));
            setSubjectsFor(null);
            cls.reload();
          }}
        />
      )}
    </div>
  );
}

/** One exam: what it covers, and lock / unlock, edit, delete (each as the ERP allows). */
function ExamSheet({ exam: e, canEdit, isAdmin, onClose, onChanged }: { exam: Exam; canEdit: boolean; isAdmin: boolean; onClose: () => void; onChanged: (e: Exam | null) => void }) {
  const L = useL();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<"" | "lock" | "delete">("");

  const lock = async () => {
    setBusy(true);
    try {
      await api(`/erp/exams/${e.id}/lock`, { body: { locked: !e.locked } });
      toast(true, e.locked ? L({ hi: `${e.title} फिर से अंकों के लिए खुली, पेरेंट ऐप से हटी।`, en: `${e.title} is open for marks again and hidden from the parent app.` }) : L({ hi: `${e.title} बंद हुई, रिपोर्ट कार्ड पेरेंट ऐप में भेज दिए।`, en: `${e.title} is locked and its report cards are now in the parent app.` }));
      onChanged({ ...e, locked: !e.locked });
      setAsk("");
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "नहीं हुआ।", en: "Could not change it." }));
    }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/erp/exams/${e.id}`, { method: "DELETE" });
      toast(true, L({ hi: "परीक्षा हटा दी।", en: "Exam deleted." }));
      onChanged(null);
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "नहीं हटी।", en: "Could not delete." }));
      setBusy(false);
    }
  };

  if (ask === "lock")
    return (
      <Sheet title={e.locked ? L({ hi: `${e.title} खोलें?`, en: `Unlock ${e.title}?` }) : L({ hi: `${e.title} बंद करें?`, en: `Lock ${e.title}?` })} onClose={() => !busy && setAsk("")}>
        <p className="mb-4 text-[14.5px] text-ink-600">
          {e.locked
            ? L({ hi: "अंक फिर बदले जा सकेंगे और रिपोर्ट कार्ड पेरेंट ऐप से हट जाएँगे।", en: "Marks can be changed again and the report cards leave the parent app." })
            : L({ hi: "इसके बाद अंक नहीं बदल सकेंगे, और रिपोर्ट कार्ड पेरेंट ऐप में दिखने लगेंगे।", en: "Marks can't be changed after this, and the report cards appear in the parent app." })}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setAsk("")} disabled={busy} className="btn-line">
            {L({ hi: "रहने दें", en: "Back" })}
          </button>
          <button type="button" onClick={lock} disabled={busy} className="btn-primary">
            {busy ? "…" : e.locked ? L({ hi: "खोलें", en: "Unlock" }) : L({ hi: "बंद करके भेजें", en: "Lock & send" })}
          </button>
        </div>
      </Sheet>
    );
  if (ask === "delete")
    return (
      <Sheet title={L({ hi: `${e.title} हटाएँ?`, en: `Delete ${e.title}?` })} onClose={() => !busy && setAsk("")}>
        <p className="mb-4 text-[14.5px] text-ink-600">{L({ hi: "इस परीक्षा के भरे सारे अंक भी हट जाएँगे। यह वापस नहीं होगा।", en: "All marks entered for this exam are deleted too. This cannot be undone." })}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setAsk("")} disabled={busy} className="btn-line">
            {L({ hi: "रहने दें", en: "Keep" })}
          </button>
          <button type="button" onClick={remove} disabled={busy} className="btn-primary !bg-rose-600">
            {busy ? "…" : L({ hi: "हटाएँ", en: "Delete exam" })}
          </button>
        </div>
      </Sheet>
    );

  const note = scopeNote(e);
  const units = Object.entries(e.scope || {}).flatMap(([c, v]) => Object.entries(v.units || {}).map(([sub, t]) => `${c} ${sub}: ${t}`));
  return (
    <Sheet title={e.title} onClose={onClose}>
      <dl className="divide-y divide-ink-100 text-[14px]">
        <Row k={L({ hi: "कक्षाएँ", en: "Classes" })} v={e.classes.join(", ")} />
        {note && <Row k={L({ hi: "सिर्फ़", en: "Only" })} v={note} />}
        <Row k={L({ hi: "तारीख", en: "Dates" })} v={examDates(e) || L({ hi: "नहीं डली", en: "Not set" })} />
        <Row k={L({ hi: "अंक", en: "Marks" })} v={e.components.map((p) => `${p.name} ${p.max}`).join(" + ") + (e.components.length > 1 ? ` = ${e.max}` : "")} />
        {units.length > 0 && <Row k={L({ hi: "यूनिट", en: "Units" })} v={units.join(" · ")} />}
        <Row k={L({ hi: "हालत", en: "Status" })} v={e.locked ? L({ hi: "बंद · पेरेंट ऐप में", en: "Locked · in parent app" }) : L({ hi: "खुली · पेरेंट ऐप में नहीं", en: "Open · not in parent app" })} />
      </dl>
      {canEdit ? (
        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={() => setAsk("lock")} className={e.locked ? "btn-line w-full" : "btn-primary w-full"}>
            {e.locked ? <X className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
            {e.locked ? L({ hi: "खोलें (पेरेंट ऐप से हटाएँ)", en: "Unlock (hide from parents)" }) : L({ hi: "बंद करें और पेरेंट को भेजें", en: "Lock & send to parents" })}
          </button>
          {!e.locked && (
            <div className={clsx("grid gap-2.5", isAdmin ? "grid-cols-2" : "grid-cols-1")}>
              <Link href={`/erp/exams/setup/edit/?id=${e.id}`} className="btn-line">
                {L({ hi: "बदलें", en: "Edit" })}
              </Link>
              {isAdmin && (
                <button type="button" onClick={() => setAsk("delete")} className="btn-line !border-rose-200 !text-rose-600">
                  <Trash2 className="h-4 w-4" aria-hidden /> {L({ hi: "हटाएँ", en: "Delete" })}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-ink-500">{L({ hi: "परीक्षा सिर्फ़ एडमिन या एग्ज़ाम सेल बदल सकते हैं।", en: "Only admin or exam cell can change exams." })}</p>
      )}
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 py-2.5">
      <dt className="w-20 shrink-0 text-ink-500">{k}</dt>
      <dd className="min-w-0 flex-1 font-medium">{v}</dd>
    </div>
  );
}

/** Subjects for one class: the same list for every section, or one list per section (ERP SubjectsDrawer). */
function SubjectsSheet({ cls, onClose, onSaved }: { cls: ClassItem; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const lists = cls.sections.map((s) => s.subjects);
  const [same, setSame] = useState(() => lists.every((l) => JSON.stringify(l) === JSON.stringify(lists[0] || [])) && !cls.sections.some((s) => s.name.length > 2));
  const [all, setAll] = useState<string[]>(() => lists.find((l) => l.length) || []);
  const [per, setPer] = useState<Record<string, string[]>>(() => Object.fromEntries(cls.sections.map((s) => [s.id, s.subjects])));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const out = cls.sections.map((s) => ({ id: s.id, subjects: same ? all : per[s.id] || [] }));
    if (out.some((l) => !l.subjects.length)) return toast(false, L({ hi: "हर सेक्शन में कम से कम एक विषय चाहिए।", en: "Every section needs at least one subject." }));
    setBusy(true);
    for (const l of out) {
      try {
        await api(`/erp/classes/sections/${encodeURIComponent(l.id)}`, { method: "PATCH", body: { subjects: l.subjects } });
      } catch (err) {
        setBusy(false);
        return toast(false, (err instanceof ApiError && err.message) || L({ hi: "विषय सेव नहीं हुए।", en: "Could not save the subjects." }));
      }
    }
    setBusy(false);
    onSaved();
  };

  return (
    <Sheet title={L({ hi: `${cls.name} के विषय`, en: `Subjects of ${cls.name}` })} onClose={() => !busy && onClose()}>
      {cls.sections.length > 1 && (
        <label className="mb-3 flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          <span>
            <span className="block text-[14.5px] font-semibold">{L({ hi: "हर सेक्शन में एक जैसे विषय", en: "Same subjects in every section" })}</span>
            <span className="block text-[12.5px] text-ink-500">{L({ hi: "Science/Commerce जैसे अलग हों तो हटाएँ।", en: "Untick when sections differ, like Science and Commerce." })}</span>
          </span>
        </label>
      )}
      {same ? (
        <SubjectEditor title={cls.sections.length > 1 ? `${L({ hi: "सेक्शन", en: "Sections" })} ${cls.sections.map((s) => s.name).join(", ")}` : `${L({ hi: "सेक्शन", en: "Section" })} ${cls.sections[0]?.name || ""}`} values={all} onChange={setAll} />
      ) : (
        cls.sections.map((s) => <SubjectEditor key={s.id} title={`${L({ hi: "सेक्शन", en: "Section" })} ${s.name}`} values={per[s.id] || []} onChange={(v) => setPer((p) => ({ ...p, [s.id]: v }))} />)
      )}
      <button type="button" onClick={save} disabled={busy} className="btn-primary mt-4 w-full">
        {busy ? "…" : L({ hi: "विषय सेव करें", en: "Save subjects" })}
      </button>
    </Sheet>
  );
}

/** The ERP's ChipInput + common-subject suggestions, sized for a thumb. */
function SubjectEditor({ title, values, onChange }: { title: string; values: string[]; onChange: (v: string[]) => void }) {
  const L = useL();
  const [text, setText] = useState("");
  const [more, setMore] = useState(false);
  const add = (raw: string) => {
    const have = new Set(values.map((v) => v.toLowerCase()));
    const next = [...values];
    for (const part of raw.split(",")) {
      const s = cleanSubject(part).slice(0, 60);
      if (s && !have.has(s.toLowerCase()) && next.length < 50) {
        next.push(s);
        have.add(s.toLowerCase());
      }
    }
    onChange(next);
    setText("");
  };
  const left = COMMON_SUBJECTS.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <section className="border-t border-ink-100 py-3">
      <h3 className="mb-2 text-[13px] font-bold text-ink-700">{title}</h3>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v} className="flex min-h-[36px] items-center gap-1 rounded-lg bg-white pl-2.5 text-[13.5px] font-semibold ring-1 ring-ink-200">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid h-9 w-8 place-items-center text-ink-400" aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${v}`}>
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="field-box min-h-[48px]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            }
          }}
          onBlur={() => text.trim() && add(text)}
          enterKeyHint="done"
          placeholder={L({ hi: "विषय लिखकर Enter दबाएँ", en: "Type a subject, press Enter" })}
          aria-label={title}
        />
      </label>
      {left.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(more ? left : left.slice(0, 8)).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="min-h-[34px] rounded-lg border border-dashed border-ink-300 px-2 text-[12.5px] text-ink-600">
              + {s}
            </button>
          ))}
          {!more && left.length > 8 && (
            <button type="button" onClick={() => setMore(true)} className="min-h-[34px] px-1 text-[12.5px] font-semibold text-brand-600">
              {L({ hi: "और", en: "More" })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
