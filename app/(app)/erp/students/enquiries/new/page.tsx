"use client";

import { useState } from "react";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { dayIso, ENQUIRY_CLASSES, enquiryNo, FOLLOW_UP_CHIPS, SOURCES, type Enquiry } from "@/lib/erpEnquiry";
import { SelectBox } from "@/components/ui";

const blank = () => ({
  student_name: "",
  class_wanted: "Nursery",
  gender: "Male",
  dob: "",
  father_name: "",
  mother_name: "",
  mobile: "",
  alt_mobile: "",
  area: "",
  previous_school: "",
  source: "Walk-in",
  next_follow_up: dayIso(2),
  note: "",
});
type Form = ReturnType<typeof blank>;

/** ERP login → New enquiry: the ERP's enquiry form (POST /api/enquiries), same fields and checks. */
export default function ErpNewEnquiryPage() {
  const L = useL();
  const [f, setF] = useState<Form>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.student_name.trim()) e.student_name = L({ hi: "बच्चे का नाम लिखें।", en: "Enter the child's name." });
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = L({ hi: "10 अंकों का मोबाइल नंबर लिखें।", en: "Enter a 10-digit mobile number." });
    if (f.alt_mobile && !/^[6-9]\d{9}$/.test(f.alt_mobile)) e.alt_mobile = L({ hi: "10 अंकों का नंबर लिखें, या खाली छोड़ें।", en: "Enter a 10-digit number, or leave it empty." });
    setErrors(e);
    const first = Object.keys(e)[0] as keyof Form | undefined;
    if (first) {
      document.getElementById(`enq-${first}`)?.focus();
      return toast(false, e[first]!);
    }
    setBusy(true);
    const { note, ...rest } = f;
    try {
      const res = await api<{ success: boolean; data: Enquiry }>("/erp/enquiries", { body: { ...rest, note: note.trim() || undefined } });
      toast(true, L({ hi: `${res.data.student_name} की पूछताछ ${enquiryNo(res.data.enquiry_no)} से सेव हो गई।`, en: `${res.data.student_name}'s enquiry is saved as ${enquiryNo(res.data.enquiry_no)}.` }));
      window.location.replace(`/erp/students/enquiries/detail/?id=${encodeURIComponent(res.data.id)}`);
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  const bad = (k: keyof Form) => (errors[k] ? "!border-rose-400" : "");
  const msg = (k: keyof Form) => errors[k] && <p className="-mt-1.5 text-[13px] font-medium text-rose-700">{errors[k]}</p>;
  const text = (k: keyof Form, label: string, placeholder?: string) => (
    <label className="field-box">
      <small>{label}</small>
      <input id={`enq-${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </label>
  );
  const phone = (k: "mobile" | "alt_mobile", label: string) => (
    <>
      <label className={`field-box ${bad(k)}`}>
        <small>{label}</small>
        <span className="pt-4 font-medium text-ink-500">+91</span>
        <input id={`enq-${k}`} type="tel" inputMode="numeric" maxLength={10} value={f[k]} onChange={(e) => set(k, e.target.value.replace(/\D/g, ""))} className="tnum" />
      </label>
      {msg(k)}
    </>
  );
  const head = (t: string) => <h2 className="pt-2 text-[16px] font-bold text-brand-800">{t}</h2>;

  return (
    <form onSubmit={save} noValidate className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{L({ hi: "प्रवेश के बारे में पूछने वाले माता-पिता", en: "A parent asking about admission" })}</p>

      {head(L({ hi: "बच्चा", en: "Child" }))}
      <label className={`field-box ${bad("student_name")}`}>
        <small>{L({ hi: "बच्चे का नाम *", en: "Child's name *" })}</small>
        <input id="enq-student_name" value={f.student_name} onChange={(e) => set("student_name", e.target.value)} autoComplete="off" />
      </label>
      {msg("student_name")}
      <div className="flex gap-6" role="radiogroup" aria-label={L({ hi: "लिंग", en: "Gender" })}>
        {[
          ["Male", L({ hi: "लड़का", en: "Boy" })],
          ["Female", L({ hi: "लड़की", en: "Girl" })],
        ].map(([v, t]) => (
          <label key={v} className="radio">
            <input type="radio" name="enq-gender" checked={f.gender === v} onChange={() => set("gender", v)} />
            {t}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "कक्षा *", en: "Class *" })} value={f.class_wanted} onChange={(v) => set("class_wanted", v)}>
          {ENQUIRY_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectBox>
        <label className="field-box">
          <small>{L({ hi: "जन्म तिथि", en: "Date of birth" })}</small>
          <input id="enq-dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
          <CalendarDays aria-hidden />
        </label>
      </div>
      {text("previous_school", L({ hi: "अभी का स्कूल, अगर हो", en: "Present school, optional" }))}

      {head(L({ hi: "माता-पिता", en: "Parent" }))}
      {text("father_name", L({ hi: "पिता का नाम", en: "Father's name" }))}
      {text("mother_name", L({ hi: "माता का नाम", en: "Mother's name" }))}
      {phone("mobile", L({ hi: "मोबाइल *", en: "Mobile *" }))}
      {phone("alt_mobile", L({ hi: "दूसरा मोबाइल, अगर हो", en: "Other mobile, optional" }))}
      {text("area", L({ hi: "इलाका / कॉलोनी", en: "Area / colony" }), "Rai Colony")}
      <SelectBox label={L({ hi: "स्कूल के बारे में कैसे पता चला", en: "How did they hear of us" })} value={f.source} onChange={(v) => set("source", v)}>
        {SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectBox>

      {head(L({ hi: "दोबारा कॉल", en: "Follow-up" }))}
      <label className="field-box">
        <small>{L({ hi: "अगली बार कब कॉल करें", en: "Next follow-up" })}</small>
        <input id="enq-next_follow_up" type="date" value={f.next_follow_up} onChange={(e) => set("next_follow_up", e.target.value)} />
        <CalendarDays aria-hidden />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {FOLLOW_UP_CHIPS.map((c) => (
          <button key={c.days} type="button" onClick={() => set("next_follow_up", dayIso(c.days))} className={clsx("btn-line min-h-[40px] px-2 text-[13.5px]", f.next_follow_up === dayIso(c.days) && "!border-brand-600")}>
            {L(c.text)}
          </button>
        ))}
      </div>
      <textarea id="enq-note" value={f.note} onChange={(e) => set("note", e.target.value)} rows={3} className="textarea-box" placeholder={L({ hi: "माता-पिता ने क्या पूछा? जैसे: राय कॉलोनी से बस चाहिए, फ़ीस पूछी", en: "What did the parent ask? e.g. wants school bus from Rai Colony, asked about fees" })} />

      <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
        {busy ? "…" : L({ hi: "पूछताछ सेव करें", en: "Save enquiry" })}
      </button>
    </form>
  );
}
