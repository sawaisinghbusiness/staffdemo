"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useL, useLang } from "@/lib/i18n";
import { dayMonth } from "@/lib/format";
import { ErrorCard, Skeleton } from "@/components/ui";

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
}

export default function HomeworkPage() {
  const { me } = useStaff();
  const L = useL();
  const { lang } = useLang();
  const opts = useApi<Options>(me ? "/homework/options" : null);
  const list = useApi<{ items: Item[] }>(me ? "/homework" : null);
  const [form, setForm] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    return <Skeleton className="h-48 w-full" />;
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/homework", { body: { sectionId, subject, title, details, dueDate: dueDate || undefined } });
      setTitle("");
      setDetails("");
      setDueDate("");
      setForm(false);
      list.reload();
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : L({ hi: "भेजा नहीं जा सका। दोबारा कोशिश करें।", en: "Could not post. Please try again." }));
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
    <div className="animate-rise space-y-3">
      {!form ? (
        <button onClick={() => setForm(true)} className="btn-primary w-full">
          <Plus className="h-5 w-5" aria-hidden /> {L({ hi: "नया होमवर्क दें", en: "Give new homework" })}
        </button>
      ) : (
        <form onSubmit={post} className="card space-y-3 p-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "कक्षा", en: "Class" })}</span>
              <select
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setSubject(sections.find((s) => s.id === e.target.value)?.subjects[0] || "");
                }}
                className="field"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.classSec}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "विषय", en: "Subject" })}</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="field">
                {(sec?.subjects || []).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "क्या करना है?", en: "What to do?" })}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="field" placeholder={L({ hi: "जैसे: प्रश्न 1 से 10 हल करें", en: "e.g. Solve Q 1 to 10" })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "और जानकारी (ज़रूरी नहीं)", en: "More details (optional)" })}</span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} className="field py-3" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{L({ hi: "जमा करने की तारीख (ज़रूरी नहीं)", en: "Due date (optional)" })}</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field" />
          </label>
          {error && (
            <p className="font-medium text-rose-700" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setForm(false)} className="btn-quiet">
              {L({ hi: "रद्द करें", en: "Cancel" })}
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "…" : L({ hi: "भेजें", en: "Post" })}
            </button>
          </div>
          <p className="text-xs text-ink-500">{L({ hi: "यह माता-पिता के ऐप में दिखेगा।", en: "Parents will see this in their app." })}</p>
        </form>
      )}

      <section className="card p-4">
        <p className="card-title">{L({ hi: "हाल का होमवर्क", en: "Recent homework" })}</p>
        {list.data.items.length === 0 ? (
          <p className="mt-1 text-ink-600">{L({ hi: "अभी कोई होमवर्क नहीं दिया।", en: "No homework yet." })}</p>
        ) : (
          <ul className="mt-1 divide-y divide-ink-100">
            {list.data.items.map((h) => (
              <li key={h.id} className="flex items-start gap-2 py-3 first:pt-2 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-700">
                    {h.classSec} · {h.subject}
                  </p>
                  <p className="font-medium text-ink-900">{h.title}</p>
                  {h.details && <p className="text-sm text-ink-600">{h.details}</p>}
                  <p className="mt-0.5 text-sm text-ink-500">
                    {dayMonth(h.assignedOn, lang)}
                    {h.dueDate ? ` → ${dayMonth(h.dueDate, lang)}` : ""}
                  </p>
                </div>
                {!h.id.startsWith("seed") && (
                  <button onClick={() => remove(h.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-500" aria-label={L({ hi: "हटाएँ", en: "Delete" })}>
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
