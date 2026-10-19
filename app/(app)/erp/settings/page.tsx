"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CalendarPlus, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import {
  BOARDS,
  boardLine,
  dayLong,
  dayShort,
  daysBetween,
  FALLBACK_SESSION,
  pickProfile,
  shrinkLogo,
  SUGGESTED_HOLIDAYS,
  todayIso,
  type Holiday,
  type SchoolProfile,
  type SessionInfo,
} from "@/lib/erpSettings";
import { Empty, ErrorCard, LineTabs, ListSkeleton, SelectBox, Sheet, StickyBar } from "@/components/ui";

/*
 * ERP login → Settings → School & sessions: the ERP's app/settings page.
 * GET/PUT /api/school (what prints on receipts and certificates), GET /api/school/session,
 * POST/DELETE /api/school/holidays. Saving is admin-only on the backend; others see it read-only.
 */

type Tab = "school" | "session";

export default function ErpSchoolSettingsPage() {
  const L = useL();
  const [tab, setTab] = useState<Tab>("school");
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const isAdmin = who.data?.user.role === "admin";
  return (
    <div className="animate-rise space-y-3 pb-4">
      <LineTabs
        label={L({ hi: "स्कूल और सत्र", en: "School & session" })}
        value={tab}
        onChange={setTab}
        options={[
          { key: "school", text: L({ hi: "स्कूल", en: "School" }) },
          { key: "session", text: L({ hi: "सत्र और छुट्टियाँ", en: "Session & holidays" }) },
        ]}
      />
      {tab === "school" ? <SchoolTab isAdmin={isAdmin} known={!!who.data} /> : <SessionTab isAdmin={isAdmin} />}
    </div>
  );
}

/* ───────────────────────── School ───────────────────────── */

function SchoolTab({ isAdmin, known }: { isAdmin: boolean; known: boolean }) {
  const L = useL();
  const { data, error, reload } = useApi<SchoolProfile & { saved?: boolean; setupNeeded?: boolean }>("/erp/school");
  const saved = useMemo(() => (data ? pickProfile(data) : null), [data]);
  const [form, setForm] = useState<SchoolProfile | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (saved) setForm(saved);
  }, [saved]);

  if (!form || !saved) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />;

  const dirty = (Object.keys(form) as (keyof SchoolProfile)[]).some((k) => k !== "updated_at" && (form[k] || "") !== (saved[k] || ""));
  const set = (k: keyof SchoolProfile, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const ro = !isAdmin;

  const save = async () => {
    if (!form.school_name.trim()) return toast(false, L({ hi: "स्कूल का नाम लिखें।", en: "Enter the school's name." }));
    setSaving(true);
    try {
      const r = await api<{ success: boolean; data?: SchoolProfile & { partial?: boolean } }>("/erp/school", { method: "PUT", body: form });
      toast(
        true,
        r.data?.partial
          ? L({ hi: "मुख्य जानकारी सेव हुई। कुछ खानों के लिए डेटाबेस में एक बार का बदलाव चाहिए।", en: "Saved the main details. Some fields need the one-time settings update in the database." })
          : L({ hi: "स्कूल की जानकारी सेव हो गई।", en: "School details saved." })
      );
      reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
    }
    setSaving(false);
  };

  const place = [form.city, form.state].filter(Boolean).join(", ");

  return (
    <>
      {data?.setupNeeded && (
        <p className="text-[13px] text-marigold-700">
          {L({ hi: "कुछ खाने (बोर्ड, UDISE, शहर, लोगो, प्रिंसिपल…) सेव करने से पहले डेटाबेस में एक बार का बदलाव चाहिए। नाम, कोड, पता, फ़ोन और ई-मेल अभी सेव होते हैं।", en: "Some fields (board, UDISE, city, logo, principal…) need a one-time database update before they can be saved. Name, codes, address, phone and e-mail save now." })}
        </p>
      )}
      {known && ro && <p className="text-[13px] text-ink-500">{L({ hi: "यह जानकारी सिर्फ़ एडमिन बदल सकते हैं।", en: "Only an admin can change these details." })}</p>}

      {/* How it prints */}
      <p className="mlabel">{L({ hi: "ऐसे छपता है", en: "How it prints" })}</p>
      <div className="row-card text-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {form.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.logo_url} alt="" className="mx-auto h-14 w-14 object-contain" />
        ) : (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#1c2a5e] text-sm font-bold text-[#1c2a5e]">{form.short_name || "SPS"}</div>
        )}
        <p className="mt-2 break-words text-[17px] font-bold uppercase leading-tight text-[#1c2a5e]">{form.school_name || "School name"}</p>
        <p className="text-[12px] font-bold uppercase">
          {place || "City, State"}
          {form.pincode ? ` – ${form.pincode}` : ""}
        </p>
        <p className="mt-1 text-[11px] italic text-ink-600">Affiliated to {boardLine(form.board)}</p>
        <p className="text-[11px] text-ink-600">
          Affiliation No. {form.affiliation_no || "—"} · School No. {form.school_code || "—"}
        </p>
        {(form.contact1 || form.email) && <p className="break-words text-[11px] text-ink-600">{[form.contact1 && `Ph. ${form.contact1}`, form.email].filter(Boolean).join(" · ")}</p>}
      </div>
      <p className="text-[12.5px] text-ink-500">{L({ hi: "फ़ीस रसीद, TC, बोनाफ़ाइड और चरित्र प्रमाणपत्र, गेट पास और साइड मेन्यू में छपता है।", en: "Used on fee receipts, TC, bonafide and character certificates, gate passes and the sidebar." })}</p>

      <p className="mlabel pt-1">{L({ hi: "स्कूल", en: "School" })}</p>
      <Field label={L({ hi: "स्कूल का नाम *", en: "School name *" })} value={form.school_name} onChange={(v) => set("school_name", v)} ro={ro} />
      <Field label={L({ hi: "छोटा नाम (जैसे SPS)", en: "Short name (e.g. SPS)" })} value={form.short_name} onChange={(v) => set("short_name", v.toUpperCase().slice(0, 5))} ro={ro} />
      <Field label={L({ hi: "प्रिंसिपल का नाम (हस्ताक्षर के नीचे)", en: "Principal's name (under the signature)" })} value={form.principal_name} onChange={(v) => set("principal_name", v)} ro={ro} />
      <LogoPick value={form.logo_url} short={form.short_name} ro={ro} onChange={(v) => set("logo_url", v)} />

      <p className="mlabel pt-1">{L({ hi: "बोर्ड और पंजीकरण", en: "Board and registration" })}</p>
      {ro ? (
        <Field label={L({ hi: "बोर्ड", en: "Board" })} value={form.board || "CBSE"} onChange={() => undefined} ro />
      ) : (
        <SelectBox label={L({ hi: "बोर्ड", en: "Board" })} value={form.board || "CBSE"} onChange={(v) => set("board", v)}>
          {BOARDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </SelectBox>
      )}
      <Field label={L({ hi: "एफ़िलिएशन नं.", en: "Affiliation no." })} value={form.affiliation_no} onChange={(v) => set("affiliation_no", v)} ro={ro} />
      <Field label={L({ hi: "स्कूल नं. / कोड", en: "School no. / code" })} value={form.school_code} onChange={(v) => set("school_code", v)} ro={ro} />
      <Field label={L({ hi: "UDISE+ कोड (11 अंक)", en: "UDISE+ code (11 digits)" })} value={form.udise_code} onChange={(v) => set("udise_code", v.replace(/\D/g, "").slice(0, 11))} ro={ro} numeric />

      <p className="mlabel pt-1">{L({ hi: "पता और संपर्क", en: "Address and contact" })}</p>
      <Field label={L({ hi: "पता (गली / इलाका)", en: "Address (street / area)" })} value={form.address} onChange={(v) => set("address", v)} ro={ro} />
      <div className="grid grid-cols-2 gap-2.5">
        <Field label={L({ hi: "शहर", en: "City" })} value={form.city} onChange={(v) => set("city", v)} ro={ro} />
        <Field label={L({ hi: "ज़िला", en: "District" })} value={form.district} onChange={(v) => set("district", v)} ro={ro} />
        <Field label={L({ hi: "राज्य", en: "State" })} value={form.state} onChange={(v) => set("state", v)} ro={ro} />
        <Field label={L({ hi: "पिन कोड", en: "PIN code" })} value={form.pincode} onChange={(v) => set("pincode", v.replace(/\D/g, "").slice(0, 6))} ro={ro} numeric />
      </div>
      <Field label={L({ hi: "ऑफ़िस फ़ोन", en: "Office phone" })} value={form.contact1} onChange={(v) => set("contact1", v)} ro={ro} tel />
      <Field label={L({ hi: "दूसरा फ़ोन", en: "Second phone" })} value={form.contact2} onChange={(v) => set("contact2", v)} ro={ro} tel />
      <Field label={L({ hi: "ई-मेल", en: "E-mail" })} value={form.email} onChange={(v) => set("email", v.trim())} ro={ro} type="email" />
      <Field label={L({ hi: "वेबसाइट", en: "Website" })} value={form.website} onChange={(v) => set("website", v.trim())} ro={ro} type="url" />

      {dirty && isAdmin && (
        <StickyBar>
          <div className="grid grid-cols-[auto_1fr] gap-2.5">
            <button type="button" onClick={() => setForm(saved)} disabled={saving} className="btn-line">
              <RotateCcw className="h-4 w-4" aria-hidden /> {L({ hi: "वापस", en: "Undo" })}
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "…" : L({ hi: "सेव करें", en: "Save" })}
            </button>
          </div>
        </StickyBar>
      )}
    </>
  );
}

function Field({ label, value, onChange, ro, numeric, tel, type }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; numeric?: boolean; tel?: boolean; type?: string }) {
  return (
    <label className={clsx("field-box", ro && "bg-ink-50")}>
      <small>{label}</small>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} readOnly={ro} type={type || "text"} inputMode={numeric ? "numeric" : tel ? "tel" : undefined} className="text-[16px]" autoComplete="off" />
    </label>
  );
}

/** Pick the logo from the phone; it is shrunk here before saving (as the ERP does). */
function LogoPick({ value, short, ro, onChange }: { value: string; short: string; ro: boolean; onChange: (v: string) => void }) {
  const L = useL();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await shrinkLogo(file, L));
    } catch (e) {
      toast(false, e instanceof Error ? e.message : L({ hi: "फ़ोटो नहीं पढ़ी जा सकी।", en: "Could not read that picture." }));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="row-card flex items-center gap-3">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-[13px] font-bold text-ink-400">{short || "SPS"}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{L({ hi: "लोगो", en: "Logo" })}</span>
        <span className="block text-[12.5px] text-ink-500">{value ? L({ hi: "लोगो लगा है", en: "Logo uploaded" }) : L({ hi: "लोगो नहीं: छोटे नाम वाला निशान छपता है", en: "No logo yet: the crest with your short name is used" })}</span>
      </span>
      {!ro && (
        <span className="flex shrink-0 flex-col gap-1">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[14px] font-semibold text-brand-600">
            <ImagePlus className="h-4 w-4" aria-hidden /> {busy ? "…" : value ? L({ hi: "बदलें", en: "Change" }) : L({ hi: "लगाएँ", en: "Upload" })}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="min-h-[36px] px-1 text-[13px] font-semibold text-rose-600">
              {L({ hi: "हटाएँ", en: "Remove" })}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/* ───────────────────────── Session & holidays ───────────────────────── */

function SessionTab({ isAdmin }: { isAdmin: boolean }) {
  const L = useL();
  const { data, error, reload } = useApi<SessionInfo>("/erp/school/session");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={4} />;
  const s = data.session || FALLBACK_SESSION;
  const holidays = data.holidays || [];
  const today = todayIso();
  const total = daysBetween(s.start, s.end);
  const gone = Math.min(total, Math.max(0, daysBetween(s.start, today < s.start ? s.start : today) - (today < s.start ? 1 : 0)));
  const holidayDays = holidays.reduce((a, h) => a + daysBetween(h.start_date, h.end_date), 0);
  const suggestions = SUGGESTED_HOLIDAYS.filter((x) => x.date >= today && !holidays.some((h) => h.start_date <= x.date && h.end_date >= x.date));
  const pct = Math.round((gone / total) * 100);

  const add = async (t: string, a: string, b: string) => {
    if (!t.trim() || !a) {
      toast(false, L({ hi: "छुट्टी का नाम और तारीख चुनें।", en: "Name the holiday and pick its date." }));
      return false;
    }
    setBusy("add");
    try {
      await api("/erp/school/holidays", { body: { title: t.trim(), start: a, end: b || a } });
      toast(true, L({ hi: `${t.trim()} जुड़ गई।`, en: `${t.trim()} added.` }));
      reload();
      return true;
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "नहीं जुड़ी।", en: "Could not add." }));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const remove = async (h: Holiday) => {
    setBusy(h.id);
    try {
      await api(`/erp/school/holidays/${h.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "नहीं हटी।", en: "Could not remove." }));
    }
    setBusy(null);
  };

  return (
    <>
      <div className="row-card">
        <p className="text-[13px] font-semibold text-ink-500">{L({ hi: "चालू सत्र", en: "Current session" })}</p>
        <p className="tnum mt-0.5 text-[28px] font-bold leading-none">{s.label}</p>
        <p className="mt-1.5 text-[13px] text-ink-500">
          {dayLong(s.start)} – {dayLong(s.end)}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-[#3099a4]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-[12.5px] text-ink-500">
          {L({
            hi: `सत्र का ${pct}% बीत गया · ${holidayDays} छुट्टी के दिन · रविवार हमेशा बंद`,
            en: `${pct}% of the session gone · ${holidayDays} holiday day${holidayDays === 1 ? "" : "s"} listed · Sundays are always off`,
          })}
        </p>
        <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-[12.5px] leading-relaxed text-ink-600">
          {L({ hi: "अगला सत्र (2027-28) मार्च के अंत में शुरू होता है, बच्चे → प्रमोट और ट्रांसफ़र के साथ।", en: "The next session (2027-28) starts at the end of March, together with promoting classes from Students → Promote & transfer." })}
        </p>
      </div>

      <div className="sec-head pt-1">
        <h2>{L({ hi: "छुट्टियाँ", en: "Holidays" })}</h2>
      </div>
      <p className="-mt-2 text-[13px] text-ink-500">{L({ hi: "हाज़िरी इन दिनों को बंद मानती है, रजिस्टर में ये धूसर दिखते हैं।", en: "Attendance treats these days as closed, and the register greys them out." })}</p>

      {isAdmin && (
        <>
          <button type="button" onClick={() => setAdding(true)} className="btn-primary w-full">
            <CalendarPlus className="h-4 w-4" aria-hidden /> {L({ hi: "छुट्टी जोड़ें", en: "Add holiday" })}
          </button>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500">
              {L({ hi: "जल्दी जोड़ें:", en: "Add quickly:" })}
              {suggestions.map((x) => (
                <button key={x.date} type="button" disabled={busy === "add"} onClick={() => add(x.title, x.date, x.date)} className="min-h-[38px] rounded-full border border-ink-200 bg-white px-3 text-[13px] font-semibold text-ink-700">
                  {x.title} · {dayShort(x.date)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {data.error && <p className="text-[13px] text-rose-600">{data.error}</p>}

      {holidays.length === 0 ? (
        <Empty>{L({ hi: `अभी कोई छुट्टी नहीं डली। ${s.label} की दिवाली, होली, गर्मी की छुट्टियाँ वगैरह जोड़ें।`, en: `No holidays listed yet. Add Diwali, Holi, summer vacation and the rest for ${s.label}.` })}</Empty>
      ) : (
        <ul>
          {holidays.map((h) => {
            const n = daysBetween(h.start_date, h.end_date);
            const past = h.end_date < today;
            return (
              <li key={h.id} className={clsx("flex min-h-[60px] items-center gap-3 border-b border-ink-100 py-2", past && "opacity-60")}>
                <span className="w-12 shrink-0 text-center">
                  <span className="block text-[11px] font-semibold uppercase text-ink-400">{new Date(h.start_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}</span>
                  <span className="block text-[18px] font-bold leading-none">{new Date(h.start_date + "T00:00:00").getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{h.title}</span>
                  <span className="block truncate text-[12.5px] text-ink-500">{n === 1 ? dayLong(h.start_date) : `${dayLong(h.start_date)} – ${dayLong(h.end_date)} · ${n} ${L({ hi: "दिन", en: "days" })}`}</span>
                </span>
                {isAdmin && (
                  <button type="button" onClick={() => remove(h)} disabled={busy === h.id} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-400 active:bg-rose-50" aria-label={`${L({ hi: "हटाएँ", en: "Remove" })} ${h.title}`}>
                    {busy === h.id ? "…" : <Trash2 className="h-[18px] w-[18px]" aria-hidden />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding && <HolidaySheet session={s} busy={busy === "add"} onClose={() => setAdding(false)} onAdd={async (t, a, b) => (await add(t, a, b)) && setAdding(false)} />}
    </>
  );
}

function HolidaySheet({ session: s, busy, onClose, onAdd }: { session: SessionInfo["session"]; busy: boolean; onClose: () => void; onAdd: (t: string, a: string, b: string) => void }) {
  const L = useL();
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <Sheet title={L({ hi: "छुट्टी जोड़ें", en: "Add holiday" })} onClose={() => !busy && onClose()}>
      <div className="space-y-2.5">
        <label className="field-box">
          <small>{L({ hi: "छुट्टी", en: "Holiday" })}</small>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={L({ hi: "जैसे दिवाली की छुट्टियाँ", en: "e.g. Diwali vacation" })} className="text-[16px]" />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="field-box">
            <small>{L({ hi: "से", en: "From" })}</small>
            <input type="date" value={from} min={s.start} max={s.end} onChange={(e) => setFrom(e.target.value)} className="text-[16px]" />
          </label>
          <label className="field-box">
            <small>{L({ hi: "तक (चाहें तो)", en: "To (optional)" })}</small>
            <input type="date" value={to} min={from || s.start} max={s.end} onChange={(e) => setTo(e.target.value)} className="text-[16px]" />
          </label>
        </div>
        <button type="button" onClick={() => onAdd(title, from, to)} disabled={busy} className="btn-primary w-full">
          {busy ? "…" : L({ hi: "जोड़ें", en: "Add" })}
        </button>
      </div>
    </Sheet>
  );
}
