"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarDays, Lock } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { DESIGNATIONS, type StaffInput, type StaffList, type StaffMember, type StaffType } from "@/lib/erpStaff";
import { Empty, ErrorCard, ListSkeleton, SelectBox } from "@/components/ui";

const EMPTY = {
  empCode: "",
  name: "",
  staffType: "teaching" as StaffType,
  department: "",
  designation: "",
  mobile: "",
  altMobile: "",
  email: "",
  qualification: "",
  joiningDate: "",
  gender: "",
  dob: "",
  address: "",
  experienceYears: "",
  notes: "",
};
type Form = typeof EMPTY;

/*
 * ERP login → Staff → Add staff (and ?id= to edit): the ERP's StaffFormDrawer. Same fields, same three checks,
 * POST /api/staff or PATCH /api/staff/:id. A new person gets the next employee code from /api/staff/next-code.
 * Admin only, as on the ERP.
 */
export default function ErpStaffFormPage() {
  const L = useL();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") || ""), []);
  const who = useApi<{ user: { role: string } }>("/erp/auth/me");
  const list = useApi<StaffList>(id ? "/erp/staff" : null);

  if (id === null || !who.data) return who.error && who.error.status !== 401 ? <ErrorCard offline={who.error.status === 0} onRetry={who.reload} /> : <ListSkeleton rows={5} />;
  if (who.data.user.role !== "admin")
    return (
      <p className="animate-rise flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 text-[14px] text-ink-700">
        <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
        {L({ hi: "स्टाफ़ सिर्फ़ एडमिन जोड़ या बदल सकते हैं।", en: "Only the admin can add or edit staff." })}
      </p>
    );
  if (!id) return <StaffForm staff={null} />;
  const staff = list.data?.data.find((s) => s.id === id);
  if (!staff) {
    if (list.data) return <Empty>{L({ hi: "यह स्टाफ़ नहीं मिला।", en: "This staff member was not found." })}</Empty>;
    return list.error && list.error.status !== 401 ? <ErrorCard offline={list.error.status === 0} onRetry={list.reload} /> : <ListSkeleton rows={5} />;
  }
  return <StaffForm key={staff.id} staff={staff} />;
}

function StaffForm({ staff }: { staff: StaffMember | null }) {
  const L = useL();
  const [f, setF] = useState<Form>(() =>
    staff
      ? {
          empCode: staff.empCode,
          name: staff.name,
          staffType: staff.staffType,
          department: staff.department,
          designation: staff.designation,
          mobile: staff.mobile,
          altMobile: staff.altMobile,
          email: staff.email,
          qualification: staff.qualification,
          joiningDate: staff.joiningDate,
          gender: staff.gender,
          dob: staff.dob,
          address: staff.address,
          experienceYears: staff.experienceYears === null ? "" : String(staff.experienceYears),
          notes: staff.notes,
        }
      : EMPTY
  );
  const [bad, setBad] = useState<keyof Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (staff) return;
    api<{ code: string }>("/erp/staff/next-code")
      .then((r) => setF((x) => (x.empCode ? x : { ...x, empCode: r.code || "" })))
      .catch(() => null);
  }, [staff]);

  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }));
  // Same as the ERP's setType.
  const setType = (t: StaffType) => setF((x) => ({ ...x, staffType: t, designation: DESIGNATIONS[t].includes(x.designation) || !x.designation ? "" : x.designation }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const fail = (k: keyof Form, m: string) => {
      setBad(k);
      document.getElementById(`st-${k}`)?.focus();
      toast(false, m);
    };
    if (f.name.trim().length < 2) return fail("name", L({ hi: "पूरा नाम लिखें।", en: "Enter the full name." }));
    if (!/^[6-9]\d{9}$/.test(f.mobile)) return fail("mobile", L({ hi: "10 अंकों का मोबाइल नंबर लिखें।", en: "Enter a 10-digit mobile number." }));
    if (!f.designation.trim()) return fail("designation", L({ hi: "पद चुनें या लिखें।", en: "Choose or type a designation." }));
    setBad(null);
    setBusy(true);
    const input: StaffInput = { ...f, experienceYears: f.experienceYears === "" ? null : Number(f.experienceYears) };
    try {
      const r = staff
        ? await api<{ success: boolean; data: StaffMember }>(`/erp/staff/${staff.id}`, { method: "PATCH", body: input })
        : await api<{ success: boolean; data: StaffMember }>("/erp/staff", { method: "POST", body: input });
      toast(true, staff ? L({ hi: `${r.data.name} की जानकारी सेव हुई।`, en: `${r.data.name}'s details saved.` }) : L({ hi: `${r.data.name} स्टाफ़ में जुड़ गए (${r.data.empCode})।`, en: `${r.data.name} added to staff (${r.data.empCode}).` }));
      window.location.replace(`/erp/staff/detail/?id=${encodeURIComponent(r.data.id)}`);
    } catch (err) {
      toast(false, (err instanceof ApiError && err.message) || L({ hi: "सेव नहीं हुआ।", en: "Could not save." }));
      setBusy(false);
    }
  }

  const err = (k: keyof Form) => (bad === k ? "!border-rose-400" : "");
  const text = (k: keyof Form, label: string, opts: { placeholder?: string; max?: number; type?: string } = {}) => (
    <label className={`field-box ${err(k)}`}>
      <small>{label}</small>
      <input id={`st-${k}`} type={opts.type || "text"} value={f[k]} onChange={(e) => set(k, e.target.value)} maxLength={opts.max} placeholder={opts.placeholder} autoComplete="off" />
    </label>
  );
  const mobile = (k: "mobile" | "altMobile", label: string) => (
    <label className={`field-box ${err(k)}`}>
      <small>{label}</small>
      <input id={`st-${k}`} type="tel" inputMode="numeric" maxLength={10} value={f[k]} onChange={(e) => set(k, e.target.value.replace(/\D/g, ""))} className="tnum" />
    </label>
  );
  const date = (k: "dob" | "joiningDate", label: string) => (
    <label className="field-box">
      <small>{label}</small>
      <input id={`st-${k}`} type="date" value={f[k]} onChange={(e) => set(k, e.target.value)} />
      <CalendarDays aria-hidden />
    </label>
  );
  const head = (t: string) => <h2 className="pt-2 text-[16px] font-bold text-brand-800">{t}</h2>;
  const teaching = f.staffType === "teaching";

  return (
    <form onSubmit={save} noValidate className="animate-rise space-y-3 pb-4">
      <p className="text-[13px] text-ink-500">{staff ? `${staff.empCode} · ${staff.designation}` : L({ hi: "टीचर और ऑफ़िस स्टाफ़", en: "Teachers and office staff" })}</p>

      <div className="flex gap-6" role="radiogroup" aria-label={L({ hi: "स्टाफ़ का प्रकार", en: "Staff type" })}>
        {(
          [
            ["teaching", L({ hi: "टीचर", en: "Teaching" })],
            ["non_teaching", L({ hi: "अन्य स्टाफ़", en: "Non-teaching" })],
          ] as [StaffType, string][]
        ).map(([t, label]) => (
          <label key={t} className="radio">
            <input type="radio" name="st-type" checked={f.staffType === t} onChange={() => setType(t)} />
            {label}
          </label>
        ))}
      </div>

      <label className={`field-box ${err("name")}`}>
        <small>{L({ hi: "पूरा नाम *", en: "Full name *" })}</small>
        <input id="st-name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={150} placeholder="Sunita Sharma" autoComplete="off" />
      </label>
      <label className="field-box">
        <small>{L({ hi: "कर्मचारी कोड", en: "Employee code" })}</small>
        <input id="st-empCode" value={f.empCode} onChange={(e) => set("empCode", e.target.value.toUpperCase())} disabled={!!staff} maxLength={30} className="font-mono disabled:text-ink-500" />
      </label>

      {text("designation", L({ hi: "पद *", en: "Designation *" }), { max: 100, placeholder: teaching ? "TGT" : "Office Clerk" })}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label={L({ hi: "पद चुनें", en: "Pick a designation" })}>
        {DESIGNATIONS[f.staffType].map((d) => (
          <button key={d} type="button" onClick={() => set("designation", d)} className={clsx("min-h-[36px] shrink-0 rounded-full border bg-white px-3 text-[13.5px]", f.designation === d ? "border-[#3099a4] font-semibold text-[#3099a4]" : "border-ink-200 text-ink-700")}>
            {d}
          </button>
        ))}
      </div>
      {text("department", L({ hi: "विभाग", en: "Department" }), { max: 100, placeholder: teaching ? "Science, Primary wing" : "Office, Transport" })}

      {head(L({ hi: "संपर्क और जानकारी", en: "Contact and details" }))}
      {mobile("mobile", L({ hi: "मोबाइल *", en: "Mobile *" }))}
      {mobile("altMobile", L({ hi: "दूसरा मोबाइल, अगर हो", en: "Other mobile (optional)" }))}
      {text("email", L({ hi: "ईमेल, अगर हो", en: "Email (optional)" }), { max: 150, type: "email" })}
      <SelectBox label={L({ hi: "लिंग", en: "Gender" })} value={f.gender} onChange={(v) => set("gender", v)}>
        <option value="">—</option>
        <option value="Female">{L({ hi: "महिला", en: "Female" })}</option>
        <option value="Male">{L({ hi: "पुरुष", en: "Male" })}</option>
        <option value="Other">{L({ hi: "अन्य", en: "Other" })}</option>
      </SelectBox>
      <div className="grid grid-cols-2 gap-2.5">
        {date("dob", L({ hi: "जन्म तिथि", en: "Date of birth" }))}
        {date("joiningDate", L({ hi: "कब जुड़े", en: "Joined on" }))}
      </div>
      {text("qualification", L({ hi: "योग्यता", en: "Qualification" }), { max: 150, placeholder: "M.Sc., B.Ed." })}
      <label className="field-box">
        <small>{L({ hi: "यहाँ से पहले का अनुभव (साल)", en: "Experience before joining (years)" })}</small>
        <input id="st-experienceYears" type="number" inputMode="numeric" min={0} max={60} value={f.experienceYears} onChange={(e) => set("experienceYears", e.target.value)} className="tnum" />
      </label>
      <div className="space-y-1">
        <p className="mlabel">{L({ hi: "पता", en: "Address" })}</p>
        <textarea id="st-address" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={300} className="textarea-box" />
      </div>
      <div className="space-y-1">
        <p className="mlabel">{L({ hi: "नोट (सिर्फ़ ऑफ़िस के लिए)", en: "Notes (office only)" })}</p>
        <textarea id="st-notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} className="textarea-box" />
      </div>

      <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
        {busy ? "…" : staff ? L({ hi: "बदलाव सेव करें", en: "Save changes" }) : L({ hi: "स्टाफ़ जोड़ें", en: "Add staff" })}
      </button>
    </form>
  );
}
