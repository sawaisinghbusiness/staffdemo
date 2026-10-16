"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarDays, CheckCircle2, Printer, Search } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { rupees } from "@/lib/format";
import { toast } from "@/lib/toast";
import { classInWords, nextClass } from "@/lib/erpWords";
import { CERT_TEXT, useSchoolInfo, type Certificate, type CertificateType } from "@/lib/erpCerts";
import type { ErpStudent } from "@/lib/erpStudents";
import { CertificateDocument } from "@/components/erp/certs/CertificateDocument";
import { PrintSheet, SheetPreview } from "@/components/erp/certs/SheetPreview";
import { Avatar, SelectBox } from "@/components/ui";

/*
 * ERP login → Issue a certificate: the ERP's IssueCertificateDrawer (same types, fields, defaults,
 * "mark as left" for a TC; POST /api/certificates gives the serial no.), then the same A4 print.
 */

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type FieldDef = { key: string; label: string; kind?: "text" | "date" | "select"; options?: string[]; placeholder?: string };

/** The ERP's fields, word for word: they are printed on the certificate in English. */
const FIELDS: Record<CertificateType, FieldDef[]> = {
  tc: [
    { key: "firstAdmission", label: "First admission (date and class)", placeholder: "e.g. 01/04/2021, Class 1st" },
    { key: "lastExam", label: "Last annual exam and result" },
    { key: "failed", label: "Failed in the same class?", kind: "select", options: ["No", "Once", "Twice"] },
    { key: "conduct", label: "General conduct", kind: "select", options: ["Excellent", "Very good", "Good", "Satisfactory"] },
    { key: "subjects", label: "Subjects studied", placeholder: "e.g. English, Hindi, Mathematics, EVS" },
    { key: "promotion", label: "Qualified for promotion?" },
    { key: "duesUpTo", label: "School dues paid up to" },
    { key: "concession", label: "Fee concession" },
    { key: "ncc", label: "NCC / Scout / Guide" },
    { key: "workingDays", label: "Working days" },
    { key: "daysPresent", label: "Days present" },
    { key: "games", label: "Games / activities" },
    { key: "reason", label: "Reason for leaving", kind: "select", options: ["Parents' request", "Parents transferred", "Shifting to another city", "Completed the school course", "Admission in another school"] },
    { key: "applicationDate", label: "Application date", kind: "date" },
    { key: "issueDate", label: "Issue date", kind: "date" },
    { key: "remarks", label: "Other remarks" },
  ],
  bonafide: [
    { key: "purpose", label: "Purpose", placeholder: "e.g. opening a bank account, scholarship" },
    { key: "issueDate", label: "Issue date", kind: "date" },
  ],
  character: [
    { key: "studiedFrom", label: "Studied here from", placeholder: "e.g. April 2019" },
    { key: "studiedTo", label: "Studied here till", placeholder: "e.g. March 2027" },
    { key: "conduct", label: "Conduct and character", kind: "select", options: ["Excellent", "Very good", "Good", "Satisfactory"] },
    { key: "issueDate", label: "Issue date", kind: "date" },
  ],
};

/** Everything the certificate prints, filled from the student's record (ERP defaults()). */
function defaults(type: CertificateType, s: ErpStudent | null): Record<string, string> {
  const today = todayIso();
  const base: Record<string, string> = s
    ? {
        name: s.name,
        father: s.fatherName,
        mother: s.motherName,
        gender: s.gender,
        admissionNo: s.admissionNo,
        srNo: s.srNo,
        pen: s.penNo,
        dob: (s.dob || "").slice(0, 10),
        class: s.class,
        classSec: s.classSec,
        session: "2026-27",
        nationality: "Indian",
        category: s.category === "General" || !s.category ? "No (General)" : `Yes (${s.category})`,
      }
    : { nationality: "Indian", session: "2026-27" };
  if (type === "bonafide") return { ...base, purpose: "", issueDate: today };
  if (type === "character") return { ...base, studiedFrom: "", studiedTo: "", conduct: "Good", issueDate: today };
  const next = s ? nextClass(s.class) : "";
  return {
    ...base,
    firstAdmission: "",
    lastExam: "Annual examination 2025-26: Passed",
    failed: "No",
    subjects: "",
    promotion: next ? `Yes, to Class ${next} (${classInWords(next)})` : "Not applicable",
    duesUpTo: s && s.balanceFee > 0 ? `${rupees(s.balanceFee)} still due` : "All dues paid up to March 2027",
    concession: "None",
    workingDays: "",
    daysPresent: "",
    ncc: "No",
    games: "",
    conduct: "Good",
    applicationDate: today,
    issueDate: today,
    reason: "Parents' request",
    remarks: "",
  };
}

export default function ErpIssueCertificatePage() {
  const L = useL();
  const school = useSchoolInfo();
  const list = useApi<{ data: ErpStudent[] }>("/erp/students");
  const students = useMemo(() => (list.data?.data || []).filter((s) => s.status !== "Inactive"), [list.data]);
  const [type, setType] = useState<CertificateType>("tc");
  const [student, setStudent] = useState<ErpStudent | null>(null);
  const [q, setQ] = useState("");
  const [d, setD] = useState<Record<string, string>>(defaults("tc", null));
  const [markLeft, setMarkLeft] = useState(true);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Certificate | null>(null);
  const [printing, setPrinting] = useState(false);

  const choose = (t: CertificateType, s: ErpStudent | null) => {
    setType(t);
    setStudent(s);
    setD(defaults(t, s));
  };
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return students.filter((s) => s.name.toLowerCase().includes(t) || s.srNo.toLowerCase().includes(t) || (s.fatherName || "").toLowerCase().includes(t) || (s.mobile || "").includes(t)).slice(0, 8);
  }, [q, students]);

  async function issue() {
    if (!student) return toast(false, L({ hi: "पहले बच्चा चुनें।", en: "Choose the student first." }));
    setBusy(true);
    try {
      const res = await api<{ success: boolean; data: Certificate }>("/erp/certificates", { body: { studentId: student.id, type, details: d, markLeft: type === "tc" && markLeft } });
      setIssued(res.data);
      list.reload();
      window.scrollTo(0, 0);
      setPrinting(true);
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "सर्टिफ़िकेट नहीं बना।", en: "Could not issue the certificate." }));
    } finally {
      setBusy(false);
    }
  }

  const doc = <CertificateDocument type={type} d={d} serial={issued?.serial_no || "Draft"} school={school} />;

  if (issued)
    return (
      <div className="animate-rise space-y-4 pt-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-jade-600" aria-hidden />
        <div>
          <p className="text-[20px] font-bold">{L({ hi: "सर्टिफ़िकेट रजिस्टर में सेव हो गया", en: "Saved in the certificate register" })}</p>
          <p className="mt-1 text-[14px] text-ink-500">
            {L(CERT_TEXT[issued.type])} · {student?.name} · {L({ hi: "सीरियल नं.", en: "Serial no." })} {issued.serial_no}
            {type === "tc" && markLeft ? L({ hi: "। बच्चा अब स्कूल छोड़ा हुआ दिखेगा।", en: ". The student is now marked as left." }) : ""}
          </p>
        </div>
        <button type="button" onClick={() => setPrinting(true)} className="btn-primary w-full">
          <Printer className="h-4 w-4" aria-hidden /> {L({ hi: "फिर से प्रिंट करें", en: "Print again" })}
        </button>
        <button
          type="button"
          onClick={() => {
            setIssued(null);
            setQ("");
            choose(type, null);
          }}
          className="btn-line w-full"
        >
          {L({ hi: "एक और दें", en: "Issue another" })}
        </button>
        {printing && <PrintSheet onDone={() => setPrinting(false)}>{doc}</PrintSheet>}
      </div>
    );

  return (
    <div className="animate-rise space-y-3 pb-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label={L({ hi: "सर्टिफ़िकेट", en: "Certificate type" })}>
        {(["tc", "bonafide", "character"] as CertificateType[]).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => choose(t, student)} className={clsx("min-h-[40px] rounded-lg text-[13px] font-semibold", type === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>
            {t === "tc" ? "TC" : L(CERT_TEXT[t])}
          </button>
        ))}
      </div>

      <h2 className="pt-1 text-[16px] font-bold text-brand-800">{L({ hi: "बच्चा", en: "Student" })}</h2>
      {student ? (
        <div className="flex items-center gap-3">
          <Avatar name={student.name} url={student.photoUrl || null} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-semibold">{student.name}</span>
            <span className="block truncate text-[12.5px] text-ink-500">
              {student.classSec} · {student.srNo} · {student.fatherName}
            </span>
          </span>
          <button type="button" onClick={() => choose(type, null)} className="btn-line min-h-[40px] px-3 text-[13.5px]">
            {L({ hi: "बदलें", en: "Change" })}
          </button>
        </div>
      ) : (
        <>
          <label className="field-box min-h-[48px]">
            <Search aria-hidden />
            <input id="cert-find" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "नाम, SR नं., पिता या मोबाइल", en: "Name, SR no., father or mobile" })} autoComplete="off" autoFocus />
          </label>
          {results.length > 0 && (
            <ul>
              {results.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => choose(type, s)} className="flex min-h-[56px] w-full items-center gap-3 border-b border-ink-100 text-left active:bg-ink-50">
                    <Avatar name={s.name} url={s.photoUrl || null} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-400">
                        {s.classSec} · {s.srNo} · {s.fatherName}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && results.length === 0 && <p className="text-[13px] text-ink-500">{L({ hi: "कोई बच्चा नहीं मिला।", en: "No student matches." })}</p>}
        </>
      )}

      {student && type === "tc" && student.balanceFee > 0 && <p className="rounded-xl bg-marigold-50 px-3 py-2 text-[13.5px] font-semibold text-ink-800">{L({ hi: `${rupees(student.balanceFee)} फ़ीस बाकी है`, en: `${rupees(student.balanceFee)} fee due` })}</p>}

      {student && (
        <>
          <h2 className="pt-1 text-[16px] font-bold text-brand-800">{L({ hi: "सर्टिफ़िकेट पर छपने वाली जानकारी", en: "Details to print" })}</h2>
          {FIELDS[type].map((f) =>
            f.kind === "select" ? (
              <SelectBox key={f.key} label={f.label} value={d[f.key] || ""} onChange={(v) => setD({ ...d, [f.key]: v })}>
                {!f.options?.includes(d[f.key] || "") && d[f.key] ? <option value={d[f.key]}>{d[f.key]}</option> : null}
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </SelectBox>
            ) : (
              <label key={f.key} className="field-box">
                <small>{f.label}</small>
                <input id={`cert-${f.key}`} type={f.kind === "date" ? "date" : "text"} value={d[f.key] || ""} onChange={(e) => setD({ ...d, [f.key]: e.target.value })} placeholder={f.placeholder} />
                {f.kind === "date" && <CalendarDays aria-hidden />}
              </label>
            )
          )}
          {type === "tc" && (
            <label className="flex items-start gap-3 rounded-xl bg-white px-3.5 py-3 text-[14px]">
              <input type="checkbox" checked={markLeft} onChange={(e) => setMarkLeft(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
              <span>
                {L({ hi: `${student.name.split(" ")[0]} को स्कूल छोड़ा हुआ दिखाएँ`, en: `Mark ${student.name.split(" ")[0]} as left` })}
                <span className="block text-[12.5px] text-ink-500">{L({ hi: "रिकॉर्ड और फ़ीस का हिसाब रहेगा, बस बच्चा चालू सूची से हटेगा।", en: "Keeps the record and fee history, but takes the student off the active list." })}</span>
              </span>
            </label>
          )}

          <h2 className="pt-1 text-[16px] font-bold text-brand-800">{L({ hi: "ऐसा छपेगा", en: "Preview" })}</h2>
          <SheetPreview>{doc}</SheetPreview>
          <p className="text-[12.5px] text-ink-500">{L({ hi: "देने पर अगला सीरियल नंबर लगेगा।", en: "The next serial number is given when you issue." })}</p>
          <button type="button" onClick={issue} disabled={busy} className="btn-primary w-full">
            <Printer className="h-4 w-4" aria-hidden /> {busy ? "…" : L({ hi: "दें और प्रिंट करें", en: "Issue and print" })}
          </button>
        </>
      )}
    </div>
  );
}
