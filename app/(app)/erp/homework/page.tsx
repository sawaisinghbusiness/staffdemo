"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { dayMonth } from "@/lib/format";
import { todayIso, addDays } from "@/lib/timetable";
import { Empty, ErrorCard, ListSkeleton, SelectBox, Sheet } from "@/components/ui";

/*
 * ERP login → Homework: the ERP's page (GET /api/homework/options, /api/homework?section=&subject=). Look at any
 * class; post for the classes /options allows (admin: all, teacher: their own class + subject — the backend decides).
 * Change / delete only where the backend says canEdit.
 */

interface HwSection {
  id: string;
  name: string;
  subjects: string[];
}
interface HwClass {
  id: string;
  name: string;
  sections: HwSection[];
}
interface PostOption {
  sectionId: string;
  classSec: string;
  subjects: string[];
  anySubject: boolean;
}
interface Homework {
  id: string;
  subject: string;
  title: string;
  details: string;
  assignedOn: string;
  dueDate: string | null;
  canEdit: boolean;
  by: string;
}

export default function ErpHomeworkPage() {
  const L = useL();
  const { lang } = useLang();
  const opts = useApi<{ setupNeeded: boolean; options?: PostOption[]; classes?: HwClass[] }>("/erp/homework/options");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const classes = opts.data?.classes || [];
  const options = opts.data?.options || [];

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subject, setSubject] = useState("");
  const [sheet, setSheet] = useState<{ item: Homework | null } | null>(null);
  const [deleting, setDeleting] = useState<Homework | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Start on the first class the viewer can post for (a teacher's own), else the first class — as in the ERP.
  useEffect(() => {
    if (!opts.data || classId) return;
    const mine = options[0];
    const c = (mine && classes.find((x) => x.sections.some((s) => s.id === mine.sectionId))) || classes[0];
    setClassId(c?.id || "");
    setSectionId(mine?.sectionId || c?.sections[0]?.id || "");
  }, [opts.data, classId, classes, options]);

  const list = useApi<{ data: Homework[] }>(sectionId ? `/erp/homework?section=${encodeURIComponent(sectionId)}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}` : null);
  const cls = classes.find((c) => c.id === classId);
  const section = cls?.sections.find((s) => s.id === sectionId);

  const groups = useMemo(() => {
    const m = new Map<string, Homework[]>();
    for (const h of list.data?.data || []) m.set(h.assignedOn, [...(m.get(h.assignedOn) || []), h]);
    return Array.from(m.entries());
  }, [list.data]);

  if (opts.data?.setupNeeded) return <Empty>{L({ hi: "होमवर्क के लिए डेटाबेस में एक बार का बदलाव चाहिए (20261003_homework.sql)।", en: "Homework needs a one-time database setup (20261003_homework.sql)." })}</Empty>;
  if (!opts.data) return opts.error && opts.error.status !== 401 ? <ErrorCard offline={opts.error.status === 0} onRetry={opts.reload} /> : <ListSkeleton rows={5} />;
  if (!classes.length) return <Empty>{L({ hi: "अभी कोई कक्षा नहीं। सेटिंग → कक्षा में जोड़ें।", en: "No classes yet. Add them under Settings → Classes." })}</Empty>;

  const canPost = options.length > 0;
  const today = todayIso();
  const dayLabel = (iso: string) => (iso === today ? L({ hi: "आज", en: "Today" }) : iso === addDays(today, -1) ? L({ hi: "कल", en: "Yesterday" }) : dayMonth(iso, lang));

  const remove = async () => {
    if (!deleting) return;
    setDelBusy(true);
    try {
      await api(`/erp/homework/${deleting.id}`, { method: "DELETE" });
      toast(true, L({ hi: "होमवर्क हटा दिया।", en: "Homework deleted." }));
      setDeleting(null);
      list.reload();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "नहीं हटा।", en: "Could not delete." }));
    }
    setDelBusy(false);
  };

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox
          label={L({ hi: "कक्षा", en: "Class" })}
          value={classId}
          onChange={(v) => {
            setClassId(v);
            setSectionId(classes.find((c) => c.id === v)?.sections[0]?.id || "");
            setSubject("");
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectBox>
        <SelectBox
          label={L({ hi: "सेक्शन", en: "Section" })}
          value={sectionId}
          onChange={(v) => {
            setSectionId(v);
            setSubject("");
          }}
        >
          {(cls?.sections || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectBox>
      </div>
      {!!section?.subjects.length && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5" role="tablist" aria-label={L({ hi: "विषय", en: "Subject" })}>
          {["", ...section.subjects].map((s) => (
            <button key={s || "all"} role="tab" aria-selected={subject === s} onClick={() => setSubject(s)} className={clsx("min-h-[38px] shrink-0 rounded-lg px-3 text-[13.5px] font-semibold", subject === s ? "bg-[#3099a4] text-white" : "bg-white text-ink-700 ring-1 ring-ink-200")}>
              {s || L({ hi: "सभी विषय", en: "All subjects" })}
            </button>
          ))}
        </div>
      )}

      {who.data?.user.role === "teacher" && !canPost && <Empty>{L({ hi: "आपकी कक्षाएँ अभी नहीं जुड़ीं। एडमिन से स्टाफ़ में अपने विषय डलवाएँ, फिर यहाँ होमवर्क दे सकेंगे।", en: "Your classes are not set up yet. Ask the admin to give you your subjects under Staff, then you can post homework here." })}</Empty>}

      {!list.data ? (
        list.error && list.error.status !== 401 ? <ErrorCard offline={list.error.status === 0} onRetry={list.reload} /> : <ListSkeleton rows={4} />
      ) : groups.length === 0 ? (
        <Empty>
          {L({ hi: `${cls?.name || ""} - ${section?.name || ""}${subject ? ` (${subject})` : ""} में अभी कोई होमवर्क नहीं।`, en: `No homework for ${cls?.name || ""} - ${section?.name || ""}${subject ? ` in ${subject}` : ""} yet.` })}
        </Empty>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h2 className="mlabel">{dayLabel(day)}</h2>
            <ul className="space-y-2">
              {items.map((h) => {
                const long = h.details.length > 120 || h.details.split("\n").length > 2;
                const expanded = open.has(h.id);
                return (
                  <li key={h.id} className="row-card">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-title text-[17px] font-bold leading-tight text-ink-900">{h.subject}</p>
                      {h.canEdit && (
                        <span className="-my-2 -mr-2 flex shrink-0">
                          <button type="button" onClick={() => setSheet({ item: h })} className="grid h-10 w-10 place-items-center rounded-full text-ink-500 active:bg-ink-100" aria-label={`${L({ hi: "बदलें", en: "Change" })} ${h.title}`}>
                            <Pencil className="h-[16px] w-[16px]" aria-hidden />
                          </button>
                          <button type="button" onClick={() => setDeleting(h)} className="grid h-10 w-10 place-items-center rounded-full text-ink-500 active:bg-ink-100" aria-label={`${L({ hi: "हटाएँ", en: "Delete" })} ${h.title}`}>
                            <Trash2 className="h-[17px] w-[17px]" aria-hidden />
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink-900">{h.title}</p>
                    {h.details && <p className={clsx("mt-0.5 whitespace-pre-wrap text-[14px] text-ink-600", !expanded && "line-clamp-2")}>{h.details}</p>}
                    {long && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpen((s) => {
                            const n = new Set(s);
                            if (n.has(h.id)) n.delete(h.id);
                            else n.add(h.id);
                            return n;
                          })
                        }
                        className="mt-0.5 text-[13px] font-semibold text-brand-600"
                      >
                        {expanded ? L({ hi: "कम दिखाएँ", en: "Show less" }) : L({ hi: "और पढ़ें", en: "Read more" })}
                      </button>
                    )}
                    <div className="mt-1.5 flex items-end justify-between gap-3">
                      <span className="min-w-0 truncate text-[12.5px] text-ink-500">{h.by}</span>
                      {h.dueDate && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-bold text-ink-900">
                          <Clock3 className="h-[15px] w-[15px] text-ink-500" strokeWidth={2} aria-hidden />
                          {h.dueDate === today ? L({ hi: "आज जमा", en: "Due today" }) : `${L({ hi: "जमा", en: "Due" })} ${dayMonth(h.dueDate, lang)}`}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {canPost && (
        <button type="button" onClick={() => setSheet({ item: null })} className="btn-primary w-full">
          <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "नया होमवर्क", en: "New homework" })}
        </button>
      )}

      {sheet && (
        <HomeworkSheet
          options={options}
          sectionId={sectionId}
          editing={sheet.item}
          onClose={() => setSheet(null)}
          onSaved={() => {
            toast(true, sheet.item ? L({ hi: "होमवर्क सेव हो गया।", en: "Homework saved." }) : L({ hi: "होमवर्क भेज दिया।", en: "Homework posted." }));
            setSheet(null);
            list.reload();
          }}
        />
      )}
      {deleting && (
        <Sheet title={L({ hi: "यह होमवर्क हटाएँ?", en: "Delete this homework?" })} onClose={() => !delBusy && setDeleting(null)}>
          <p className="mb-4 text-[14.5px] text-ink-600">
            {deleting.subject} · {deleting.title}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setDeleting(null)} disabled={delBusy} className="btn-line">
              {L({ hi: "रहने दें", en: "Keep" })}
            </button>
            <button type="button" onClick={remove} disabled={delBusy} className="btn-primary !bg-rose-600">
              {delBusy ? "…" : L({ hi: "हटाएँ", en: "Delete" })}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

const OTHER = "__other__";

/** Post or change one homework (ERP HomeworkDrawer). The class can't change once posted. */
function HomeworkSheet({ options, sectionId, editing, onClose, onSaved }: { options: PostOption[]; sectionId: string; editing: Homework | null; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const start = options.find((o) => o.sectionId === sectionId) || options[0];
  const known = editing ? !!start?.subjects.includes(editing.subject) : true;
  const [sec, setSec] = useState(start?.sectionId || "");
  const [subject, setSubject] = useState(editing ? (known ? editing.subject : OTHER) : start?.subjects[0] || (start?.anySubject ? OTHER : ""));
  const [other, setOther] = useState(editing && !known ? editing.subject : "");
  const [title, setTitle] = useState(editing?.title || "");
  const [details, setDetails] = useState(editing?.details || "");
  const [due, setDue] = useState(editing?.dueDate || "");
  const [busy, setBusy] = useState(false);

  const opt = options.find((o) => o.sectionId === sec);
  const name = subject === OTHER ? other.trim() : subject;

  const pickSection = (id: string) => {
    setSec(id);
    const o = options.find((x) => x.sectionId === id);
    setSubject(o?.subjects[0] || (o?.anySubject ? OTHER : ""));
    setOther("");
  };

  const save = async () => {
    setBusy(true);
    const body = { sectionId: sec, subject: name, title, details, dueDate: due };
    try {
      await api(editing ? `/erp/homework/${editing.id}` : "/erp/homework", { method: editing ? "PATCH" : "POST", body });
      onSaved();
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  };

  return (
    <Sheet title={editing ? L({ hi: "होमवर्क बदलें", en: "Change homework" }) : L({ hi: "नया होमवर्क", en: "New homework" })} onClose={() => !busy && onClose()}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          {editing ? (
            <div className="field-box">
              <small>{L({ hi: "कक्षा", en: "Class" })}</small>
              <span className="text-[15px] font-semibold">{opt?.classSec || ""}</span>
            </div>
          ) : (
            <SelectBox label={L({ hi: "कक्षा", en: "Class" })} value={sec} onChange={pickSection}>
              {options.map((o) => (
                <option key={o.sectionId} value={o.sectionId}>
                  {o.classSec}
                </option>
              ))}
            </SelectBox>
          )}
          <SelectBox label={L({ hi: "विषय", en: "Subject" })} value={subject} onChange={setSubject}>
            {(opt?.subjects || []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {opt?.anySubject && <option value={OTHER}>{L({ hi: "दूसरा…", en: "Other…" })}</option>}
          </SelectBox>
        </div>
        {subject === OTHER && (
          <label className="field-box">
            <small>{L({ hi: "विषय का नाम", en: "Subject name" })}</small>
            <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={40} autoFocus />
          </label>
        )}
        <label className="field-box">
          <small>{L({ hi: "क्या करना है", en: "Homework" })}</small>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={L({ hi: "जैसे: प्रश्न 1 से 10 हल करें", en: "e.g. Exercise 4.2, questions 1 to 10" })} />
        </label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={2000} className="textarea-box" placeholder={L({ hi: "और जानकारी (ज़रूरी नहीं)", en: "More details (optional)" })} />
        <label className="field-box">
          <small>{L({ hi: "कब तक जमा करना है (ज़रूरी नहीं)", en: "Due date (optional)" })}</small>
          <input type="date" value={due} min={todayIso()} onChange={(e) => setDue(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
        <button type="button" onClick={save} disabled={busy || !sec || name.length < 2 || title.trim().length < 2} className="btn-primary w-full">
          {busy ? "…" : editing ? L({ hi: "सेव करें", en: "Save" }) : L({ hi: "होमवर्क भेजें", en: "Post homework" })}
        </button>
      </div>
    </Sheet>
  );
}
