"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL, type Bi } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { TEMPLATES, unfilled, type Audience, type AudienceKind, type Lang, type Message, type Preview } from "@/lib/erpMessages";
import { ListSkeleton } from "@/components/ui";

/*
 * ERP login → New message: the ERP's ComposeDrawer. Who it goes to (whole school, classes, sections, or parents
 * with fees due), a ready message or your own, Hindi or English, {name} {class} {father} {school} {due} filled in
 * for each parent, a live preview of the first parent's text (POST /api/messages/preview), and "also on the
 * website". Saving (POST /api/messages) makes the list of parents to send to.
 */

interface ClassItem {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
const KINDS: { kind: AudienceKind; text: Bi }[] = [
  { kind: "school", text: { hi: "पूरा स्कूल", en: "Whole school" } },
  { kind: "classes", text: { hi: "कक्षाएँ", en: "Classes" } },
  { kind: "sections", text: { hi: "सेक्शन", en: "Sections" } },
  { kind: "dues", text: { hi: "फ़ीस बाकी", en: "Fees due" } },
];
const FIELDS: { key: string; text: Bi; duesOnly?: boolean }[] = [
  { key: "name", text: { hi: "बच्चे का नाम", en: "Child's name" } },
  { key: "class", text: { hi: "कक्षा", en: "Class" } },
  { key: "father", text: { hi: "पिता का नाम", en: "Father's name" } },
  { key: "school", text: { hi: "स्कूल का नाम", en: "School name" } },
  { key: "due", text: { hi: "बाकी रकम", en: "Amount due" }, duesOnly: true },
];
const plusDays = (n: number) => {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={clsx("min-h-[36px] rounded-lg px-2.5 text-[13px] font-semibold", on ? "bg-brand-600 text-white" : "border border-ink-200 bg-white text-ink-700")}>
      {children}
    </button>
  );
}

export default function ErpNewMessagePage() {
  const L = useL();
  const cls = useApi<{ data: ClassItem[] }>("/erp/classes");
  const classes = useMemo(() => (cls.data?.data || []).filter((c) => (c.sections || []).length), [cls.data]);
  const [kind, setKind] = useState<AudienceKind>("school");
  const [picked, setPicked] = useState<string[]>([]);
  const [lang, setLang] = useState<Lang>("hi");
  const [template, setTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [onWebsite, setOnWebsite] = useState(false);
  const [until, setUntil] = useState(plusDays(7));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const audience: Audience = useMemo(() => (kind === "classes" ? { kind, classes: picked } : kind === "sections" ? { kind, sections: picked } : { kind }), [kind, picked]);
  const audienceReady = !((kind === "classes" || kind === "sections") && picked.length === 0);

  // Who it reaches and how the first parent reads it, after typing settles.
  useEffect(() => {
    if (!audienceReady) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        setPreview(await api<Preview>("/erp/messages/preview", { body: { audience, body, lang } }));
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [audience, audienceReady, body, lang]);

  const applyTemplate = (key: string) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setTemplate(key);
    setTitle(t.title[lang]);
    setBody(t.body[lang]);
    if (t.dues) setKind("dues");
    setTimeout(() => bodyRef.current?.focus(), 0);
  };
  const switchLang = (l: Lang) => {
    setLang(l);
    // A template not yet edited follows the language.
    const t = TEMPLATES.find((x) => x.key === template);
    if (t && body === t.body[lang]) {
      setBody(t.body[l]);
      setTitle(t.title[l]);
    }
  };
  const insert = (key: string) => {
    const el = bodyRef.current;
    const tag = `{${key}}`;
    if (!el) return setBody((b) => b + tag);
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + tag + body.slice(e));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(s + tag.length, s + tag.length);
    }, 0);
  };
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const left = unfilled(body);

  async function save() {
    if (!audienceReady) return toast(false, kind === "classes" ? L({ hi: "कम से कम एक कक्षा चुनें।", en: "Pick at least one class." }) : L({ hi: "कम से कम एक सेक्शन चुनें।", en: "Pick at least one section." }));
    if (title.trim().length < 2) return toast(false, L({ hi: "मैसेज का छोटा शीर्षक लिखें।", en: "Give the message a short title." }));
    if (body.trim().length < 5) return toast(false, L({ hi: "मैसेज लिखें।", en: "Write the message." }));
    if (left.length) return toast(false, L({ hi: `पहले ${left.map((k) => `{${k}}`).join(", ")} की जगह असली जानकारी लिखें।`, en: `Replace ${left.map((k) => `{${k}}`).join(", ")} with the real details first.` }));
    if (body.includes("{due}") && kind !== "dues") return toast(false, L({ hi: "{due} सिर्फ़ फ़ीस बाकी वाले माता-पिता को भेजने पर काम करता है।", en: "{due} only works when sending to parents with fees due." }));
    setBusy(true);
    try {
      const r = await api<{ data: Message }>("/erp/messages", { body: { title: title.trim(), body: body.trim(), lang, audience, showOnWebsite: onWebsite, websiteUntil: onWebsite ? until : null } });
      window.location.replace(`/erp/messages/detail/?id=${encodeURIComponent(r.data.id)}`);
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "मैसेज सेव नहीं हुआ।", en: "Could not save the message." }));
      setBusy(false);
    }
  }

  if (!cls.data && !cls.error) return <ListSkeleton rows={5} />;

  return (
    <div className="animate-rise space-y-4 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "माता-पिता को WhatsApp पर, हर एक के बच्चे के नाम के साथ", en: "Goes to parents on WhatsApp, each with their child's name filled in" })}</p>

      <section className="space-y-2.5">
        <h2 className="text-[16px] font-bold text-brand-800">{L({ hi: "किसे", en: "To" })}</h2>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={L({ hi: "किसे", en: "Send to" })}>
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              onClick={() => {
                setKind(k.kind);
                setPicked([]);
              }}
              className={clsx("min-h-[40px] rounded-lg px-1 text-[12.5px] font-semibold", kind === k.kind ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}
            >
              {L(k.text)}
            </button>
          ))}
        </div>
        {kind === "classes" && (
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <Chip key={c.id} on={picked.includes(c.name)} onClick={() => toggle(c.name)}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}
        {kind === "sections" && (
          <div className="space-y-2">
            {classes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 text-[13px] font-semibold text-ink-500">{c.name}</span>
                {c.sections.map((s) => {
                  const v = `${c.name} - ${s.name}`;
                  return (
                    <Chip key={v} on={picked.includes(v)} onClick={() => toggle(v)}>
                      {s.name}
                    </Chip>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {kind === "dues" && <p className="text-[13px] text-ink-500">{L({ hi: "आज जिनकी फ़ीस देर से बाकी है, उनके माता-पिता। हर परिवार की रकम डालने के लिए {due} लिखें।", en: "Parents whose fees are overdue today. Use {due} to put each family's amount in the message." })}</p>}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-brand-800">{L({ hi: "मैसेज", en: "Message" })}</h2>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-0.5" role="radiogroup" aria-label={L({ hi: "भाषा", en: "Language" })}>
            {(["hi", "en"] as Lang[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => switchLang(l)} className={clsx("min-h-[34px] rounded-md px-3 text-[13px] font-semibold", lang === l ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
                {l === "hi" ? "हिंदी" : "English"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <Chip key={t.key} on={template === t.key} onClick={() => applyTemplate(t.key)}>
              {lang === "hi" ? t.title.hi : t.label}
            </Chip>
          ))}
        </div>
        <label className="field-box">
          <small>{L({ hi: "शीर्षक (अपने रजिस्टर के लिए)", en: "Title (for your register)" })}</small>
          <input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L({ hi: "जैसे: दिवाली की छुट्टियाँ", en: "e.g. Diwali holidays" })} maxLength={120} />
        </label>
        <div>
          <textarea id="m-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={6} lang={lang} className="textarea-box leading-relaxed" placeholder={L({ hi: "ऊपर से तैयार मैसेज चुनें, या अपना लिखें।", en: "Choose a ready message above, or write your own." })} />
          <p className={clsx("tnum mt-0.5 text-right text-[12px]", body.length > 1000 ? "text-rose-600" : "text-ink-400")}>{body.length}/1000</p>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-ink-500">{L({ hi: "हर माता-पिता के लिए भरेगा:", en: "Fill in for each parent:" })}</span>
            {FIELDS.filter((f) => !f.duesOnly || kind === "dues").map((f) => (
              <button key={f.key} type="button" onClick={() => insert(f.key)} title={L(f.text)} className="min-h-[32px] rounded-md bg-ink-100 px-2 font-mono text-[12px] text-ink-700">
                {`{${f.key}}`}
              </button>
            ))}
          </div>
          {left.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-marigold-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {L({ hi: `${left.map((k) => `{${k}}`).join(", ")} की जगह असली जानकारी लिखें।`, en: `Replace ${left.map((k) => `{${k}}`).join(", ")} with the real details.` })}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[16px] font-bold text-brand-800">
          {L({ hi: "पहले माता-पिता को ऐसा मिलेगा", en: "How the first parent gets it" })} {previewing && <span className="text-[12px] font-normal text-ink-400">…</span>}
        </h2>
        {!audienceReady ? (
          <p className="text-[13px] text-ink-500">{kind === "classes" ? L({ hi: "कक्षा चुनें, तो दिखेगा किसे जाएगा।", en: "Pick a class to see who it reaches." }) : L({ hi: "सेक्शन चुनें, तो दिखेगा किसे जाएगा।", en: "Pick a section to see who it reaches." })}</p>
        ) : preview ? (
          <>
            <p className="text-[13px] text-ink-600">
              <b className="tnum text-ink-900">{preview.families.toLocaleString("en-IN")}</b> {L({ hi: "माता-पिता", en: "parents" })} ({preview.students.toLocaleString("en-IN")} {L({ hi: "बच्चे; भाई-बहन को एक ही मैसेज", en: "students; brothers and sisters share one message" })})
              {preview.noPhone > 0 && <span className="text-marigold-700"> · {preview.noPhone} {L({ hi: "का मोबाइल नहीं, छोड़े जाएँगे", en: "without a mobile are skipped" })}</span>}
            </p>
            {preview.sample && body.trim() ? (
              <p lang={lang} className="whitespace-pre-wrap rounded-xl bg-jade-50 px-3.5 py-3 text-[14.5px] leading-relaxed text-ink-800">
                {preview.sample.text}
              </p>
            ) : (
              <p className="text-[13px] text-ink-400">{L({ hi: "लिखते ही मैसेज यहाँ दिखेगा।", en: "The text appears here as you write." })}</p>
            )}
          </>
        ) : (
          <ListSkeleton rows={1} />
        )}
      </section>

      <label className="flex items-start gap-3 rounded-xl bg-white px-3.5 py-3">
        <input type="checkbox" checked={onWebsite} onChange={(e) => setOnWebsite(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
        <span className="text-[14.5px]">
          {L({ hi: "स्कूल वेबसाइट के नोटिस बोर्ड पर भी दिखाएँ", en: "Also show on the website notice board" })}
          <span className="block text-[12.5px] text-ink-500">{L({ hi: "वेबसाइट के ऊपर सिर्फ़ शीर्षक दिखेगा।", en: "Only the title is shown, at the top of the school website." })}</span>
        </span>
      </label>
      {onWebsite && (
        <label className="field-box">
          <small>{L({ hi: "कब तक", en: "Until" })}</small>
          <input id="m-until" type="date" value={until} min={plusDays(0)} onChange={(e) => setUntil(e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
      )}

      <button type="button" onClick={save} disabled={busy} className="btn-primary w-full">
        {busy ? "…" : `${L({ hi: "सेव करें और भेजना शुरू करें", en: "Save and start sending" })}${preview ? ` · ${preview.families.toLocaleString("en-IN")}` : ""}`}
      </button>
    </div>
  );
}
