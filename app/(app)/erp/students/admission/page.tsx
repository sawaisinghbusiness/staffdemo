"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Plus } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { classRank, type ErpStudent } from "@/lib/erpStudents";
import type { Enquiry } from "@/lib/erpEnquiry";
import { ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

/*
 * ERP login → New admission / Edit student: the ERP's AdmissionDrawer (same fields, same checks,
 * POST /api/students or PATCH /api/students/:id; the backend makes the fee ledger) in the staff app's parts.
 * Not here yet: the photo (Students → Photos) and the fee preview before saving.
 */

const CATEGORIES = ["General", "OBC", "SC", "ST"] as const;
const GENDERS = ["Male", "Female", "Other"] as const;

function nextNumber(ids: string[], fallback: number) {
  const nums = ids.map((v) => parseInt(String(v).match(/(\d+)\s*$/)?.[1] || "", 10)).filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : fallback - 1) + 1;
}

function blank(cls = "1st") {
  return {
    name: "",
    gender: "Male" as string,
    dob: "",
    category: "General" as string,
    penNo: "",
    class: cls,
    section: "",
    rollNo: "",
    house: "",
    srNo: "",
    admissionNo: "",
    fatherName: "",
    motherName: "",
    guardianName: "",
    mobile: "",
    altMobile: "",
    address: "",
    transport: false,
    busRoute: "",
  };
}
type Form = ReturnType<typeof blank>;
type Errors = Partial<Record<keyof Form, string>>;

function fromStudent(s: ErpStudent): Form {
  return {
    name: s.name || "",
    gender: (GENDERS as readonly string[]).includes(s.gender) ? s.gender : "Male",
    dob: (s.dob || "").slice(0, 10),
    category: (CATEGORIES as readonly string[]).includes(s.category) ? s.category : "General",
    penNo: s.penNo || "",
    class: s.class,
    section: s.section,
    rollNo: s.rollNo || "",
    house: s.house || "",
    srNo: s.srNo || "",
    admissionNo: s.admissionNo || "",
    fatherName: s.fatherName || "",
    motherName: s.motherName || "",
    guardianName: s.guardianName && s.guardianName !== s.fatherName ? s.guardianName : "",
    mobile: (s.mobile || "").replace(/\D/g, "").slice(-10),
    altMobile: s.contact && s.contact !== s.mobile ? s.contact.replace(/\D/g, "").slice(-10) : "",
    address: s.address || "",
    transport: !!s.transportOpted,
    busRoute: s.transportOpted ? s.busRoute || "" : "",
  };
}

type Say = (b: { hi: string; en: string }) => string;
function validate(f: Form, takenSr: Set<string>, L: Say): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = L({ hi: "बच्चे का पूरा नाम लिखें।", en: "Enter the student's full name." });
  if (!f.section) e.section = L({ hi: "सेक्शन चुनें।", en: "Choose a section." });
  if (!f.srNo.trim()) e.srNo = L({ hi: "SR नंबर लिखें।", en: "Enter the SR number." });
  else if (takenSr.has(f.srNo.trim())) e.srNo = L({ hi: "यह SR नंबर पहले से है।", en: "This SR number is already used." });
  if (!f.fatherName.trim()) e.fatherName = L({ hi: "पिता या अभिभावक का नाम लिखें।", en: "Enter the father's or guardian's name." });
  if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = L({ hi: "6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का नंबर लिखें।", en: "Enter a 10-digit mobile number starting with 6, 7, 8 or 9." });
  if (f.altMobile && !/^[6-9]\d{9}$/.test(f.altMobile)) e.altMobile = L({ hi: "10 अंकों का नंबर लिखें, या खाली छोड़ें।", en: "Enter a 10-digit number, or leave it empty." });
  if (f.dob && new Date(f.dob) > new Date()) e.dob = L({ hi: "जन्म तिथि आगे की नहीं हो सकती।", en: "Date of birth can't be in the future." });
  if (f.transport && !f.busRoute) e.busRoute = L({ hi: "बस रूट चुनें, या बस बंद करें।", en: "Choose a bus route, or turn the bus off." });
  return e;
}

export default function ErpAdmissionPage() {
  const L = useL();
  const [editId, setEditId] = useState<string | null>(null);
  const [enquiryId, setEnquiryId] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setEnquiryId(p.get("enquiry") || "");
    setEditId(p.get("id") || "");
  }, []);
  const list = useApi<{ data: ErpStudent[] }>("/erp/students");
  const one = useApi<{ data: ErpStudent }>(editId ? `/erp/students/${encodeURIComponent(editId)}` : null);
  // Admitting from an admission enquiry: its details fill the form (ERP enquiries page → AdmissionDrawer prefill).
  const enquiries = useApi<{ data: Enquiry[] }>(enquiryId ? "/erp/enquiries" : null);
  const enquiry = enquiryId ? enquiries.data?.data.find((x) => x.id === enquiryId) || null : null;
  const students = useMemo(() => list.data?.data || [], [list.data]);
  const editing = editId ? one.data?.data || null : null;

  const lookups = useMemo(() => {
    const sectionsByClass = new Map<string, Set<string>>();
    const routes = new Set<string>();
    const houses = new Set<string>();
    for (const s of students) {
      if (!sectionsByClass.has(s.class)) sectionsByClass.set(s.class, new Set());
      sectionsByClass.get(s.class)!.add(s.section);
      if (s.transportOpted && s.busRoute) routes.add(s.busRoute);
      if (s.house) houses.add(s.house);
    }
    return {
      classes: Array.from(sectionsByClass.keys()).sort((a, b) => classRank(a) - classRank(b)),
      sectionsOf: (c: string) => Array.from(sectionsByClass.get(c) || new Set(["A"])).sort(),
      routes: Array.from(routes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      houses: Array.from(houses).sort(),
      takenSr: new Set(students.filter((s) => s.id !== editId).map((s) => s.srNo)),
      nextSr: `SR-2026-${nextNumber(students.map((s) => s.srNo), 1001)}`,
      nextAdm: `ADM-${nextNumber(students.map((s) => s.admissionNo), 1)}`,
    };
  }, [students, editId]);

  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<ErpStudent | null>(null);
  const [closedEnquiry, setClosedEnquiry] = useState(false);

  const start = (keepClass?: string) => {
    const cls = keepClass || lookups.classes[0] || "1st";
    const fresh = { srNo: lookups.nextSr, admissionNo: lookups.nextAdm };
    if (enquiry && !keepClass) {
      const pc = lookups.classes.includes(enquiry.class_wanted) ? enquiry.class_wanted : cls;
      setForm({
        ...blank(pc),
        name: enquiry.student_name,
        gender: enquiry.gender === "Female" ? "Female" : "Male",
        dob: enquiry.dob || "",
        fatherName: enquiry.father_name || "",
        motherName: enquiry.mother_name || "",
        mobile: enquiry.mobile,
        altMobile: enquiry.alt_mobile || "",
        address: enquiry.area || "",
        section: lookups.sectionsOf(pc)[0] || "",
        ...fresh,
      });
    } else setForm({ ...blank(cls), section: lookups.sectionsOf(cls)[0] || "", ...fresh });
    setErrors({});
    setTried(false);
    setSaved(null);
    window.scrollTo(0, 0);
  };
  // Fill the form once what it needs has arrived: the student for an edit, the register for a new admission.
  useEffect(() => {
    if (form || editId === null || !list.data) return;
    if (editId) {
      if (editing) setForm(fromStudent(editing));
    } else if (!enquiryId || enquiries.data) start();
  }, [editId, list.data, editing, enquiryId, enquiries.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const err = list.error || one.error;
  if (!form) return err && err.status !== 401 ? <ErrorCard offline={err.status === 0} onRetry={() => (list.reload(), one.reload())} /> : <ListSkeleton rows={5} />;

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => {
      const next = { ...prev!, [key]: value };
      if (key === "class") next.section = lookups.sectionsOf(value as string)[0] || "";
      if (tried) setErrors(validate(next, lookups.takenSr, L));
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f = form!;
    setTried(true);
    const found = validate(f, lookups.takenSr, L);
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) {
      document.getElementById(`adm-${firstBad}`)?.focus();
      return toast(false, found[firstBad as keyof Form]!);
    }
    setBusy(true);
    const common = {
      srNo: f.srNo.trim(),
      penNo: f.penNo.trim() || undefined,
      name: f.name.trim(),
      gender: f.gender,
      category: f.category,
      class: f.class,
      section: f.section,
      fatherName: f.fatherName.trim(),
      motherName: f.motherName.trim(),
      guardianName: f.guardianName.trim() || f.fatherName.trim(),
      mobile: f.mobile,
      contact: f.altMobile || f.mobile,
      address: f.address.trim(),
      transportOpted: f.transport,
      busRoute: f.transport ? f.busRoute : undefined,
    };
    try {
      if (editing) {
        const res = await api<{ success: boolean; data?: ErpStudent }>(`/erp/students/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: { ...common, admissionNo: f.admissionNo.trim(), penNo: f.penNo.trim(), dob: f.dob, rollNo: f.rollNo, house: f.house },
        });
        toast(true, L({ hi: `${res.data?.name || f.name} की जानकारी सेव हो गई।`, en: `${res.data?.name || f.name}'s details are saved.` }));
        window.location.replace(`/erp/students/detail/?id=${encodeURIComponent(editing.id)}`);
        return;
      }
      const res = await api<{ success: boolean; data: ErpStudent }>("/erp/students", {
        body: { ...common, admissionNo: f.admissionNo.trim() || f.srNo.trim(), dob: f.dob || undefined, classSec: `${f.class} - ${f.section}`, rollNo: f.rollNo || undefined, house: f.house || undefined, status: "Active" },
      });
      setSaved(res.data);
      list.reload();
      window.scrollTo(0, 0);
      // As the ERP does: the first admission from an enquiry closes it, with a note ("Admit another" is a different child).
      if (enquiry && enquiry.status !== "admitted" && !closedEnquiry) {
        setClosedEnquiry(true);
        api(`/erp/enquiries/${enquiry.id}`, { method: "PATCH", body: { status: "admitted", next_follow_up: null, admitted_student_id: res.data.id } })
          .then(() => api(`/erp/enquiries/${enquiry.id}/notes`, { body: { text: `Admitted to ${res.data.classSec} with SR no. ${res.data.srNo}.` } }))
          .catch(() => toast(false, L({ hi: "प्रवेश हो गया, पर पूछताछ अपने-आप बंद नहीं हुई। उसे खोलकर बदलें।", en: "Admitted, but the enquiry was not closed. Open it and update it." })));
      }
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सेव नहीं हुआ। दोबारा कोशिश करें।", en: "Could not save. Please try again." }));
    } finally {
      setBusy(false);
    }
  }

  if (saved)
    return (
      <div className="animate-rise space-y-4 pt-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-jade-600" aria-hidden />
        <div>
          <p className="text-[20px] font-bold">{L({ hi: `${saved.name} का प्रवेश हो गया`, en: `${saved.name} is admitted` })}</p>
          <p className="mt-1 text-[14px] text-ink-500">
            {saved.classSec} · SR {saved.srNo} · {L({ hi: "सत्र की फ़ीस", en: "fee for the session" })} {rupees(saved.totalFee)}
          </p>
        </div>
        <Link href={`/erp/students/detail/?id=${encodeURIComponent(saved.id)}`} className="btn-primary w-full">
          {L({ hi: "प्रोफ़ाइल खोलें", en: "Open profile" })}
        </Link>
        <button type="button" onClick={() => start(saved.class)} className="btn-line w-full">
          <Plus className="h-4 w-4" aria-hidden /> {L({ hi: "एक और प्रवेश", en: "Admit another" })}
        </button>
      </div>
    );

  const f = form;
  const bad = (k: keyof Form) => (errors[k] ? "!border-rose-400" : "");
  const msg = (k: keyof Form) => errors[k] && <p className="-mt-1.5 text-[13px] font-medium text-rose-700">{errors[k]}</p>;
  const text = (k: keyof Form, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <>
      <label className={`field-box ${bad(k)}`}>
        <small>{label}</small>
        <input id={`adm-${k}`} value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} {...extra} />
      </label>
      {msg(k)}
    </>
  );
  const phone = (k: "mobile" | "altMobile", label: string) => (
    <>
      <label className={`field-box ${bad(k)}`}>
        <small>{label}</small>
        <span className="pt-4 font-medium text-ink-500">+91</span>
        <input id={`adm-${k}`} type="tel" inputMode="numeric" maxLength={10} value={f[k]} onChange={(e) => set(k, e.target.value.replace(/\D/g, ""))} className="tnum" />
      </label>
      {msg(k)}
    </>
  );
  const head = (t: string, note?: string) => (
    <div className="pt-2">
      <h2 className="text-[16px] font-bold text-brand-800">{t}</h2>
      {note && <p className="text-[12.5px] text-ink-500">{note}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{editing ? `${editing.name} · ${editing.srNo}` : L({ hi: "सत्र 2026-27", en: "Session 2026-27" })}</p>

      {head(L({ hi: "बच्चा", en: "Student" }), L({ hi: "जन्म प्रमाण पत्र के अनुसार", en: "As on the birth certificate" }))}
      {text("name", L({ hi: "पूरा नाम *", en: "Full name *" }), { placeholder: "Aryan Singh Rathore", autoComplete: "off" })}
      <div className="flex gap-6" role="radiogroup" aria-label={L({ hi: "लिंग", en: "Gender" })}>
        {GENDERS.map((g) => (
          <label key={g} className="radio">
            <input type="radio" name="gender" checked={f.gender === g} onChange={() => set("gender", g)} />
            {g === "Male" ? L({ hi: "लड़का", en: "Boy" }) : g === "Female" ? L({ hi: "लड़की", en: "Girl" }) : L({ hi: "अन्य", en: "Other" })}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-3">
          <label className={`field-box ${bad("dob")}`}>
            <small>{L({ hi: "जन्म तिथि", en: "Date of birth" })}</small>
            <input id="adm-dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
            <CalendarDays aria-hidden />
          </label>
          {msg("dob")}
        </div>
        <SelectBox label={L({ hi: "श्रेणी", en: "Category" })} value={f.category} onChange={(v) => set("category", v)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectBox>
      </div>
      {text("penNo", L({ hi: "PEN (UDISE+), अगर हो", en: "PEN (UDISE+), optional" }))}

      {head(L({ hi: "कक्षा और रजिस्टर", en: "Class and register" }))}
      <div className="grid grid-cols-2 gap-2.5">
        <SelectBox label={L({ hi: "कक्षा *", en: "Class *" })} value={f.class} onChange={(v) => set("class", v)}>
          {lookups.classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectBox>
        <SelectBox label={L({ hi: "सेक्शन *", en: "Section *" })} value={f.section} onChange={(v) => set("section", v)}>
          {lookups.sectionsOf(f.class).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectBox>
        <label className="field-box">
          <small>{L({ hi: "रोल नं.", en: "Roll no." })}</small>
          <input id="adm-rollNo" inputMode="numeric" value={f.rollNo} onChange={(e) => set("rollNo", e.target.value.replace(/\D/g, ""))} className="tnum" />
        </label>
        <SelectBox label={L({ hi: "हाउस", en: "House" })} value={f.house} onChange={(v) => set("house", v)}>
          <option value="">{L({ hi: "अभी नहीं", en: "Not yet" })}</option>
          {lookups.houses.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </SelectBox>
      </div>
      {text("srNo", L({ hi: "SR नं. *", en: "SR no. *" }), { className: "tnum" })}
      {text("admissionNo", L({ hi: "प्रवेश नं.", en: "Admission no." }), { className: "tnum" })}

      {head(L({ hi: "माता-पिता और संपर्क", en: "Parents and contact" }), L({ hi: "फ़ीस रसीद और गैरहाज़िरी की सूचना इसी मोबाइल पर जाती है", en: "Fee receipts and absence alerts go to this mobile" }))}
      {text("fatherName", L({ hi: "पिता का नाम *", en: "Father's name *" }))}
      {text("motherName", L({ hi: "माता का नाम", en: "Mother's name" }))}
      {phone("mobile", L({ hi: "मोबाइल *", en: "Parent mobile *" }))}
      {phone("altMobile", L({ hi: "दूसरा मोबाइल, अगर हो", en: "Other mobile, optional" }))}
      {text("guardianName", L({ hi: "स्थानीय अभिभावक (पिता हों तो खाली छोड़ें)", en: "Local guardian (empty if same as father)" }))}
      <textarea id="adm-address" value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} className="textarea-box" placeholder={L({ hi: "घर का पता: मकान नं., गली, मोहल्ला, बाड़मेर", en: "Home address: house no., street, area, Barmer" })} />

      {head(L({ hi: "स्कूल बस", en: "School bus" }), editing ? L({ hi: "यहाँ बदलने से फ़ीस नहीं बदलती।", en: "Changing this here does not change the fee." }) : L({ hi: "बस लेने पर सत्र की बस फ़ीस जुड़ेगी।", en: "The session's bus fee is added." }))}
      <div className="flex gap-6" role="radiogroup" aria-label={L({ hi: "स्कूल बस", en: "School bus" })}>
        <label className="radio">
          <input type="radio" name="bus" checked={!f.transport} onChange={() => set("transport", false)} />
          {L({ hi: "बस नहीं", en: "No bus" })}
        </label>
        <label className="radio">
          <input type="radio" name="bus" checked={f.transport} onChange={() => set("transport", true)} />
          {L({ hi: "बस से आएगा", en: "Uses the bus" })}
        </label>
      </div>
      {f.transport && (
        <>
          <SelectBox label={L({ hi: "बस रूट *", en: "Bus route *" })} value={f.busRoute} onChange={(v) => set("busRoute", v)}>
            <option value="">{L({ hi: "रूट चुनें", en: "Choose a route" })}</option>
            {lookups.routes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectBox>
          {msg("busRoute")}
        </>
      )}
      {editing && (editing.class !== f.class || !!editing.transportOpted !== f.transport) && (
        <p className="rounded-xl bg-marigold-50 px-3 py-2 text-[13px] text-ink-700">{L({ hi: `कक्षा या बस बदली है। फ़ीस ${rupees(editing.totalFee)} ही रहेगी; ज़रूरत हो तो फ़ीस में बदलें।`, en: `Class or bus changed. The fee stays ${rupees(editing.totalFee)}; change it from Fees if needed.` })}</p>
      )}

      <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
        {busy ? "…" : editing ? L({ hi: "बदलाव सेव करें", en: "Save changes" }) : L({ hi: "प्रवेश सेव करें", en: "Save admission" })}
      </button>
    </form>
  );
}
