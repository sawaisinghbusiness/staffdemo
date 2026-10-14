"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Check, Clock3, Trash2 } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useToastMsg } from "@/lib/toast";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { dayMonth } from "@/lib/format";
import { Avatar, Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, StickyBar } from "@/components/ui";

interface Options {
  sections: { id: string; classSec: string; subjects: string[] }[];
}
interface Item {
  id: string;
  sectionId: string;
  classSec: string;
  subject: string;
  title: string;
  details: string;
  assignedOn: string;
  dueDate: string | null;
  /** False for homework someone else (or the office) posted: only its poster may delete it. */
  mine?: boolean;
}
interface Subs {
  homework: Item;
  checked: boolean;
  students: { id: string; name: string; rollNo: string; submitted: boolean | null; photoUrl?: string | null }[];
}

type Tab = "create" | "check";

export default function HomeworkPage() {
  const L = useL();
  const [tab, setTab] = useState<Tab>("create");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "check") setTab("check");
  }, []);

  return (
    <div className="animate-rise space-y-4">
      <LineTabs
        label={L({ hi: "होमवर्क", en: "Homework" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "create", text: L({ hi: "नया दें", en: "Create" }) },
          { key: "check", text: L({ hi: "जाँचें", en: "Check" }) },
        ]}
      />
      {tab === "create" ? <Create /> : <CheckTab />}
    </div>
  );
}

/** Give homework: only the teacher's own classes and subjects are in the lists. */
function Create() {
  const { me } = useStaff();
  const L = useL();
  const { lang } = useLang();
  const opts = useApi<Options>(me ? "/homework/options" : null);
  const list = useApi<{ items: Item[] }>(me ? "/homework" : null);
  const [sectionId, setSectionId] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const setMsg = useToastMsg();

  const sections = opts.data?.sections || [];
  const sec = sections.find((s) => s.id === sectionId);
  useEffect(() => {
    if (sections.length && !sectionId) {
      setSectionId(sections[0].id);
      setSubject(sections[0].subjects[0]);
    }
  }, [sections, sectionId]);

  if (!opts.data || !list.data) {
    const err = opts.error || list.error;
    if (err && err.status !== 401) return <ErrorCard offline={err.status === 0} onRetry={() => { opts.reload(); list.reload(); }} />;
    return <ListSkeleton rows={3} />;
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setMsg({ ok: false, text: L({ hi: "पहले लिखें कि क्या करना है।", en: "Write the homework first." }) });
    setBusy(true);
    setMsg(null);
    try {
      await api("/homework", { body: { sectionId, subject, title, details, dueDate: dueDate || undefined } });
      setTitle("");
      setDetails("");
      setDueDate("");
      setMsg({ ok: true, text: L({ hi: "होमवर्क भेज दिया। माता-पिता के ऐप में दिखेगा।", en: "Homework posted. Parents will see it in their app." }) });
      list.reload();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.message ? err.message : L({ hi: "भेजा नहीं जा सका। दोबारा कोशिश करें।", en: "Could not post. Please try again." }) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(L({ hi: "यह होमवर्क हटाएँ?", en: "Delete this homework?" }))) return;
    await api(`/homework/${id}`, { method: "DELETE" }).catch(() => null);
    list.reload();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={post} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-2.5">
          <SelectBox
            label={L({ hi: "कक्षा", en: "Class" })}
            value={sectionId}
            onChange={(v) => {
              setSectionId(v);
              setSubject(sections.find((s) => s.id === v)?.subjects[0] || "");
            }}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.classSec}
              </option>
            ))}
          </SelectBox>
          <SelectBox label={L({ hi: "विषय", en: "Subject" })} value={subject} onChange={setSubject}>
            {(sec?.subjects || []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectBox>
        </div>
        <label className="field-box">
          <small>{L({ hi: "क्या करना है", en: "Title" })}</small>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={L({ hi: "जैसे: प्रश्न 1 से 10 हल करें", en: "e.g. Exercise 4.2, questions 1–8" })} />
        </label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} className="textarea-box" placeholder={L({ hi: "और जानकारी (ज़रूरी नहीं)", en: "Details for the child (optional)" })} />
        <label className="field-box">
          <small>{L({ hi: "कब तक जमा करना है", en: "Submit by" })}</small>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
        <button type="submit" disabled={busy} className="btn-go w-full">
          {busy ? "…" : L({ hi: "होमवर्क भेजें", en: "Send homework" })}
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="mlabel">{L({ hi: "हाल में दिया", en: "Recently given" })}</h2>
        {list.data.items.length === 0 ? (
          <Empty>{L({ hi: "अभी कोई होमवर्क नहीं दिया।", en: "No homework yet." })}</Empty>
        ) : (
          <ul className="space-y-2">
            {list.data.items.map((h) => (
              <li key={h.id} className="row-card">
                {/* Top: subject - class, and the day it was given in the corner. Then the work. Bottom: due date, delete. */}
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-title text-[17px] font-bold leading-tight text-ink-900">
                    {h.subject} <span className="text-[13.5px] font-medium text-ink-500">- {h.classSec}</span>
                  </p>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-[14px] font-bold text-ink-900">{dayMonth(h.assignedOn, lang)}</span>
                    {!h.id.startsWith("seed") && h.mine !== false && (
                      <button onClick={() => remove(h.id)} className="-my-2 -mr-2 grid h-9 w-9 place-items-center rounded-full text-ink-500 active:bg-ink-100" aria-label={L({ hi: "हटाएँ", en: "Delete" })}>
                        <Trash2 className="h-[17px] w-[17px]" aria-hidden />
                      </button>
                    )}
                  </span>
                </div>
                {/* The work on the left; the due date in the bottom-right corner. */}
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug text-ink-900">{h.title}</p>
                    {h.details && <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-600">{h.details}</p>}
                  </div>
                  {h.dueDate && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-bold text-ink-900">
                      <Clock3 className="h-[15px] w-[15px] text-ink-500" strokeWidth={2} aria-hidden />
                      {L({ hi: "जमा", en: "Due" })} {dayMonth(h.dueDate, lang)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Tick who submitted. Parents then see Checked or Not submitted. */
function CheckTab() {
  const { me } = useStaff();
  const L = useL();
  const { lang } = useLang();
  const list = useApi<{ items: Item[] }>(me ? "/homework" : null);
  const [hwId, setHwId] = useState("");

  const items = list.data?.items || [];
  useEffect(() => {
    if (items.length && !hwId) setHwId(items[0].id);
  }, [items, hwId]);

  if (!list.data) {
    if (list.error && list.error.status !== 401) return <ErrorCard offline={list.error.status === 0} onRetry={list.reload} />;
    return <ListSkeleton rows={3} />;
  }
  if (!items.length) return <Empty>{L({ hi: "जाँचने के लिए कोई होमवर्क नहीं।", en: "No homework to check yet." })}</Empty>;

  return (
    <div className="space-y-3">
      <SelectBox label={L({ hi: "होमवर्क", en: "Homework" })} value={hwId} onChange={setHwId}>
        {items.map((h) => (
          <option key={h.id} value={h.id}>
            {h.classSec} · {h.subject} · {dayMonth(h.assignedOn, lang)} — {h.title}
          </option>
        ))}
      </SelectBox>
      {hwId && <Ticks key={hwId} id={hwId} />}
    </div>
  );
}

function Ticks({ id }: { id: string }) {
  const L = useL();
  const { lang } = useLang();
  const { data, error, reload } = useApi<Subs>(`/homework/submissions?id=${encodeURIComponent(id)}`);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const setMsg = useToastMsg();

  // First check: everyone ticked, so the teacher only un-ticks the few who did not bring it.
  useEffect(() => {
    if (data) setDone(Object.fromEntries(data.students.map((s) => [s.id, s.submitted ?? true])));
  }, [data]);
  const count = useMemo(() => Object.values(done).filter(Boolean).length, [done]);

  if (!data) {
    if (error && error.status !== 401) return <ErrorCard offline={error.status === 0} onRetry={reload} />;
    return <ListSkeleton rows={4} />;
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/homework/submissions", { body: { id, submitted: done } });
      setMsg({ ok: true, text: L({ hi: "सेव हो गया। माता-पिता को दिखेगा।", en: "Saved. Parents will see it." }) });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError && e.message ? e.message : L({ hi: "सेव नहीं हुआ।", en: "Could not save." }) });
    } finally {
      setBusy(false);
    }
  }

  const h = data.homework;
  return (
    <div className="space-y-2 pb-20">
      <div className="row-card">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-title text-[17px] font-bold leading-tight text-ink-900">
            {h.subject} <span className="text-[13.5px] font-medium text-ink-500">- {h.classSec}</span>
          </p>
          <span className="shrink-0 text-[14px] font-bold text-ink-900">{dayMonth(h.assignedOn, lang)}</span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold text-ink-900">{h.title}</p>
      </div>
      <p className="text-[13px] text-ink-500">{data.checked ? L({ hi: "पहले जाँचा जा चुका है, बदल सकते हैं।", en: "Already checked; you can change it." }) : L({ hi: "जिसने जमा नहीं किया, उसका टिक हटाएँ।", en: "Untick anyone who did not submit." })}</p>
      <ul className="glass-line overflow-hidden px-3.5">
        {data.students.map((s) => (
          <li key={s.id} className="border-b border-ink-900/10 last:border-b-0">
            <button onClick={() => setDone((d) => ({ ...d, [s.id]: !d[s.id] }))} aria-pressed={!!done[s.id]} className="flex min-h-[56px] w-full items-center gap-3 text-left">
              <Avatar name={s.name} url={s.photoUrl} size={36} />
              <span className="min-w-0 flex-1 truncate font-title text-[16px] font-semibold text-ink-900">{s.name}</span>
              <span className={clsx("grid h-7 w-7 place-items-center rounded-lg transition-colors", done[s.id] ? "border border-[#16a34a] bg-[#22c55e] text-black" : "border-[1.6px] border-ink-300 bg-white")}>{done[s.id] && <Check className="h-4 w-4" strokeWidth={3.2} aria-hidden />}</span>
            </button>
          </li>
        ))}
      </ul>
      <StickyBar>
        <button onClick={save} disabled={busy} className="btn-go w-full">
          {busy ? "…" : `${L({ hi: "सेव करें", en: "Save" })} · ${count} / ${data.students.length} ${L({ hi: "ने जमा किया", en: "submitted" })}`}
        </button>
      </StickyBar>
    </div>
  );
}
