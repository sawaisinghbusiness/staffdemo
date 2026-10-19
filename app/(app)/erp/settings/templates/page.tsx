"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { TEMPLATES, type Lang } from "@/lib/erpMessages";
import { Empty, ErrorCard, ListSkeleton, Sheet } from "@/components/ui";
import { SetupNeeded } from "@/components/erp/SetupNeeded";

/*
 * ERP login → Settings → Message templates: the school's own ready-made messages (GET /api/message-templates),
 * listed under the built-in ones. They show as chips when writing a new message. {name} {class} {father}
 * {school} {due} are filled in for each parent. The admin adds, edits and deletes.
 */

type Tpl = { id: string; title: string; body: string; lang: Lang; createdBy: string; updatedAt: string };
const FIELDS: { k: string; hi: string; en: string; sample: { hi: string; en: string } }[] = [
  { k: "name", hi: "बच्चे का नाम", en: "Child's name", sample: { hi: "आरव शर्मा", en: "Aarav Sharma" } },
  { k: "class", hi: "कक्षा", en: "Class", sample: { hi: "5th-A", en: "5th-A" } },
  { k: "father", hi: "पिता", en: "Father", sample: { hi: "राजेश शर्मा", en: "Rajesh Sharma" } },
  { k: "school", hi: "स्कूल", en: "School", sample: { hi: "", en: "" } },
  { k: "due", hi: "बाकी फ़ीस", en: "Fee due", sample: { hi: "₹4,500", en: "₹4,500" } },
];

export default function ErpMessageTemplatesPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ setupNeeded: boolean; data: Tpl[] }>("/erp/message-templates");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const { data: school } = useApi<Record<string, string>>("/erp/school");
  const isAdmin = who.data?.user.role === "admin";
  const [edit, setEdit] = useState<Tpl | "new" | null>(null);
  const schoolName = school?.school_name || "School";

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />;
  if (data.setupNeeded) return <SetupNeeded file="20261019_syllabus_copycheck.sql" what={{ hi: "मैसेज टेम्पलेट", en: "Message templates" }} />;

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="mlabel">{L({ hi: "स्कूल के अपने", en: "The school's own" })}</h2>
        {isAdmin && (
          <button type="button" onClick={() => setEdit("new")} className="flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] border-ink-900 bg-white px-3.5 text-[13.5px] font-semibold text-ink-900 active:bg-ink-100">
            <Plus className="h-4 w-4" aria-hidden />
            {L({ hi: "नया टेम्पलेट", en: "New template" })}
          </button>
        )}
      </div>
      {!data.data.length ? (
        <Empty>{L({ hi: "अभी कोई अपना टेम्पलेट नहीं। जो मैसेज बार-बार भेजते हैं, उन्हें यहाँ एक बार लिख लें।", en: "No templates of your own yet. Write the messages you send often here once." })}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {data.data.map((t) => (
            <li key={t.id}>
              <button type="button" disabled={!isAdmin} onClick={() => setEdit(t)} className="glass-line card-in block w-full !rounded-2xl px-4 py-3 text-left disabled:cursor-default">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink-900">{t.title}</span>
                  <span className="shrink-0 rounded-full border border-ink-200 px-2 text-[11.5px] text-ink-500">{t.lang === "hi" ? "हिंदी" : "English"}</span>
                </span>
                <span className="mt-1 block line-clamp-3 whitespace-pre-line text-[13px] text-ink-600">{t.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mlabel pt-2">{L({ hi: "पहले से बने", en: "Built in" })}</h2>
      <ul className="space-y-2">
        {TEMPLATES.map((t) => (
          <li key={t.key} className="rounded-2xl border border-ink-100 bg-white px-4 py-3">
            <span className="block text-[14.5px] font-semibold text-ink-900">{L(t.title)}</span>
            <span className="mt-1 block line-clamp-2 whitespace-pre-line text-[13px] text-ink-500">{L(t.body)}</span>
          </li>
        ))}
      </ul>

      {edit && <TplSheet t={edit === "new" ? null : edit} school={schoolName} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
    </div>
  );
}

function TplSheet({ t, school, onClose, onSaved }: { t: Tpl | null; school: string; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const [f, setF] = useState({ title: t?.title || "", body: t?.body || "प्रिय अभिभावक, \n\n– {school}", lang: (t?.lang || "hi") as Lang });
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const insert = (k: string) => {
    const el = box.current;
    const tag = `{${k}}`;
    const at = el ? el.selectionStart : f.body.length;
    const body = f.body.slice(0, at) + tag + f.body.slice(el ? el.selectionEnd : at);
    setF((p) => ({ ...p, body }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + tag.length, at + tag.length);
    });
  };
  const preview = f.body.replace(/\{(\w+)\}/g, (m, k) => {
    if (k === "school") return school;
    const fl = FIELDS.find((x) => x.k === k);
    return fl ? fl.sample[f.lang] : m;
  });

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
  const save = () => {
    if (!f.title.trim() || !f.body.trim()) return toast(false, L({ hi: "नाम और मैसेज दोनों लिखें।", en: "Write both a name and the message." }));
    run(() => (t ? api(`/erp/message-templates/${t.id}`, { method: "PATCH", body: f }) : api("/erp/message-templates", { body: f })), L({ hi: "टेम्पलेट सेव हुआ।", en: "Template saved." }));
  };

  return (
    <Sheet title={t ? L({ hi: "टेम्पलेट बदलें", en: "Edit template" }) : L({ hi: "नया टेम्पलेट", en: "New template" })} onClose={onClose}>
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={L({ hi: "भाषा", en: "Language" })}>
          {(
            [
              ["hi", "हिंदी"],
              ["en", "English"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={f.lang === k} onClick={() => setF((p) => ({ ...p, lang: k }))} className={clsx("min-h-[44px] rounded-lg text-[13.5px] font-semibold", f.lang === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
              {label}
            </button>
          ))}
        </div>
        <label className="field-box">
          <small>{L({ hi: "नाम *", en: "Name *" })}</small>
          <input id="tpl-title" value={f.title} maxLength={60} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} placeholder={L({ hi: "जैसे बस देर से", en: "e.g. Bus running late" })} />
        </label>
        <textarea ref={box} id="tpl-body" value={f.body} maxLength={1000} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} rows={5} className="textarea-box" />
        <div>
          <p className="mb-1.5 text-[12.5px] text-ink-500">{L({ hi: "हर अभिभावक के लिए अपने आप भरेगा, दबाकर जोड़ें:", en: "Filled in for each parent, tap to add:" })}</p>
          <div className="flex flex-wrap gap-1.5">
            {FIELDS.map((x) => (
              <button key={x.k} type="button" onClick={() => insert(x.k)} className="min-h-[34px] rounded-full border border-ink-200 bg-white px-3 text-[12.5px] font-medium text-ink-700 active:bg-ink-100">
                {L(x)}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-ink-50 px-3.5 py-3">
          <p className="text-[12px] font-semibold text-ink-500">{L({ hi: "एक अभिभावक को ऐसा दिखेगा", en: "One parent will see" })}</p>
          <p className="mt-1 whitespace-pre-line text-[14px] text-ink-900">{preview}</p>
        </div>
        <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "सेव करें", en: "Save" })}
        </button>
        {t && (
          <button type="button" disabled={busy} onClick={() => (sure ? run(() => api(`/erp/message-templates/${t.id}`, { method: "DELETE" }), L({ hi: "टेम्पलेट हटाया।", en: "Template deleted." })) : setSure(true))} className={clsx("btn-line w-full", sure && "!border-rose-500 !text-rose-600")}>
            {sure ? L({ hi: "पक्का हटाएँ?", en: "Really delete?" }) : L({ hi: "हटाएँ", en: "Delete" })}
          </button>
        )}
      </div>
    </Sheet>
  );
}
