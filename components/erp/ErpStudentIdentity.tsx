"use client";
import { useState } from "react";
import { School } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { fullDate } from "@/lib/format";
import type { ErpStudentFull } from "@/lib/erpStudents";
import "./erp-student-identity.css";

export function ErpStudentIdentity({ student: s }: { student: ErpStudentFull }) {
  const L = useL(), { lang } = useLang();
  const { data: school } = useApi<{ school_name: string; logo_url: string }>("/erp/school");
  const [failed, setFailed] = useState<string | null>(null);
  const logo = school?.logo_url;
  const facts = [
    [L({ hi: "SR नंबर", en: "SR no." }), s.srNo],
    [L({ hi: "प्रवेश नंबर", en: "Admission no." }), s.admissionNo],
    [L({ hi: "जन्म तिथि", en: "Date of birth" }), s.dob ? fullDate(s.dob, lang) : "—"],
  ];
  return <section className="erp-student-identity" aria-label={L({ hi: "बच्चे की पहचान", en: "Student identity" })}>
    <div className="esi-school">
      {logo && failed !== logo ? <img src={logo} alt="" onError={() => setFailed(logo)} /> : <School size={26} aria-hidden />}
      <span title={school?.school_name}>{school?.school_name || L({ hi: "स्कूल", en: "School" })}</span>
      <small>{s.status === "Inactive" ? L({ hi: "स्कूल छोड़ा", en: "Left school" }) : L({ hi: "सक्रिय छात्र", en: "Active student" })}</small>
    </div>
    <div className="esi-person"><Avatar name={s.name} url={s.photoUrl || null} size={52} /><div className="esi-copy"><h2 title={s.name}>{s.name}</h2><p>{L({ hi: "कक्षा", en: "Class" })} {s.classSec} · {L({ hi: "रोल", en: "Roll" })} {s.rollNo || "—"}</p></div></div>
    <dl className="esi-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>
  </section>;
}
