/* Copied from the ERP (components/certificates/CertificateDocument.tsx) so app prints match the ERP exactly. Keep in step. */
import React from "react";
import type { CertificateType } from "@/lib/erpCerts";
import { classInWords, dateInWords, genderWords } from "@/lib/erpWords";

export interface SchoolInfo {
  name: string;
  short: string;
  affiliationNo?: string;
  schoolCode?: string;
  place: string;
  pincode?: string;
  phone?: string;
  email?: string;
  /** Uploaded school logo (data URL); the drawn crest is used when there is none. */
  logoUrl?: string;
}

/** The school's printing colour: a deep navy, like the letterheads schools actually use. */
const INK = "#1c2a5e";

/** "2018-03-15" -> "15.03.2018", the way certificates write dates. */
const dotDate = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};
const up = (s?: string) => (s || "").toUpperCase();

/** TC books hold 100 leaves: serial 0001-0100 is book 1, 0101-0200 book 2… */
function bookAndSerial(serial: string) {
  const n = parseInt(serial.match(/(\d+)\s*$/)?.[1] || "", 10);
  return { book: Number.isFinite(n) ? String(Math.floor((n - 1) / 100) + 1) : "", sno: Number.isFinite(n) ? String(n).padStart(4, "0") : "" };
}

/**
 * A printed certificate on an A4 sheet (794 × 1123 px at 96 dpi), modelled on the
 * school leaving certificates CBSE schools issue: crest and letterhead, a coloured
 * title band, numbered entries written on dotted lines, and three signatures.
 * Everything it prints comes from `d` (the saved snapshot), so a reprint is identical.
 */
export function CertificateDocument({ type, d, serial, school }: { type: CertificateType; d: Record<string, string>; serial: string; school: SchoolInfo }) {
  const title = type === "tc" ? "School Leaving Certificate" : type === "bonafide" ? "Bonafide Certificate" : "Character Certificate";
  const { book, sno } = bookAndSerial(serial);
  const draft = !sno;

  return (
    <div className="cert-sheet relative mx-auto h-[1123px] w-[794px] overflow-hidden bg-white text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Border: thick outer rule, fine inner rule, and a ribbon of small diamonds between them */}
      <div aria-hidden className="absolute inset-[18px] border-[3px]" style={{ borderColor: INK }} />
      <div aria-hidden className="absolute inset-[24px] border-[3px] border-dotted" style={{ borderColor: INK }} />
      <div aria-hidden className="absolute inset-[31px] border" style={{ borderColor: INK }} />

      {/* Watermark crest */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]">
        {school.logoUrl ? <img src={school.logoUrl} alt="" style={{ width: 380, height: 380, objectFit: "contain" }} /> : <Crest size={420} short={school.short} />}
      </div>

      <div className="relative flex h-full flex-col px-[56px] pb-[52px] pt-[46px]">
        {/* Letterhead */}
        <header className="flex items-start gap-4">
          <div className="shrink-0 pt-1">
            {school.logoUrl ? <img src={school.logoUrl} alt="" style={{ width: 92, height: 92, objectFit: "contain" }} /> : <Crest size={92} short={school.short} />}
          </div>
          <div className="flex-1 text-center">
            <div className="flex justify-between text-[11.5px] font-bold" style={{ color: INK }}>
              <span>Affiliation No. {school.affiliationNo || "—"}</span>
              <span>School No. {school.schoolCode || "—"}</span>
            </div>
            <h1 className="mt-1 text-[34px] font-bold uppercase leading-none tracking-wide" style={{ color: INK, fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {school.name}
            </h1>
            <p className="mt-1.5 text-[14px] font-bold uppercase tracking-wide">
              {school.place}
              {school.pincode ? ` – ${school.pincode}` : ""}
            </p>
            <p className="mt-0.5 text-[12px] italic">(An English Medium Co-educational School affiliated to C.B.S.E., New Delhi)</p>
            {(school.phone || school.email) && (
              <p className="mt-0.5 text-[11.5px]">
                {school.phone ? `Phone: ${school.phone}` : ""}
                {school.phone && school.email ? "  ·  " : ""}
                {school.email ? `E-mail: ${school.email}` : ""}
              </p>
            )}
          </div>
        </header>

        <div className="mt-3 border-t-[3px] border-double" style={{ borderColor: INK }} />

        <div className="mt-3 text-center">
          <span className="inline-block rounded-sm px-7 py-[5px] text-[17px] font-bold uppercase tracking-[0.18em] text-white" style={{ backgroundColor: INK }}>
            {title}
          </span>
        </div>

        {/* Register references */}
        {type === "tc" ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-6 text-[13.5px]">
              <Ref label="Book No." value={book} />
              <Ref label="S.No." value={draft ? "DRAFT" : sno} strong />
              <Ref label="Admission No." value={d.admissionNo} />
            </div>
            <div className="mt-1 grid grid-cols-3 gap-6 text-[13.5px]">
              <Ref label="S.R. No." value={d.srNo} />
              <Ref label="PEN" value={d.pen} />
              <Ref label="Session" value={d.session || "2026-27"} />
            </div>
          </>
        ) : (
          <div className="mt-3 grid grid-cols-[1.3fr_1fr_1fr] gap-6 text-[13.5px]">
            <Ref label="Ref. No." value={draft ? "DRAFT" : serial} strong />
            <Ref label="Admission No." value={d.admissionNo} />
            <Ref label="S.R. No." value={d.srNo} />
          </div>
        )}

        {type !== "tc" && <Concern />}
        {type === "tc" ? <TcBody d={d} /> : type === "bonafide" ? <BonafideBody d={d} /> : <CharacterBody d={d} school={school} />}

        {/* Signatures */}
        <footer className="mt-auto">
          {type === "tc" ? (
            <div className="grid grid-cols-3 items-end gap-8 text-center text-[12.5px]">
              <Sign label="Signature of Class Teacher" sub={" "} />
              <Sign label="Checked by" sub="(State full name & designation)" />
              <Sign label="Principal" sub="(Signature with seal)" />
            </div>
          ) : (
            <div className="flex items-end justify-between text-[13.5px]">
              <div className="space-y-1">
                <div>
                  Place: <b>{up(school.place.split(",")[0])}</b>
                </div>
                <div>
                  Date: <b>{dotDate(d.issueDate)}</b>
                </div>
              </div>
              <div className="w-60 text-center">
                <Sign label="Principal" sub="(Signature with seal)" />
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

function TcBody({ d }: { d: Record<string, string> }) {
  const subjects = (d.subjects || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return (
    <div className="mt-4 space-y-[9px] text-[13.5px]">
      <Line n={1} label="Name of Pupil" value={up(d.name)} />
      <Line n={2} label="Father's / Guardian's & Mother's Name" value={[d.father && `MR. ${up(d.father)}`, d.mother && `MRS. ${up(d.mother)}`].filter(Boolean).join("  &  ")} />
      <Pair>
        <Line n={3} label="Nationality" value={up(d.nationality)} nowrap />
        <Line n={4} label="SC / ST / OBC" value={up(d.category)} nowrap />
      </Pair>
      <Line n={5} label="Date of first admission in the School with class" value={up(d.firstAdmission)} />
      <Line n={6} label="Date of Birth as per Admission Register (in figures)" value={dotDate(d.dob)} />
      <Line label="(in words)" value={up(dateInWords(d.dob))} indent />
      <Line n={7} label="Class in which the pupil last studied (in figures and words)" value={d.class ? `${up(d.class)} (${up(classInWords(d.class))})` : ""} />
      <Line n={8} label="School / Board Annual examination last taken with result" value={up(d.lastExam)} />
      <Line n={9} label="Whether failed, if so once / twice in the same class" value={up(d.failed)} />
      <div className="flex items-start gap-2">
        <span className="w-6 shrink-0 pt-[2px]">10.</span>
        <span className="shrink-0 pt-[2px]">Subjects studied:</span>
        <div className="grid flex-1 grid-cols-3 gap-x-4 gap-y-[7px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex min-w-0 items-end gap-1">
              <span className="shrink-0">{i + 1}.</span>
              <Dots value={up(subjects[i])} small />
            </div>
          ))}
        </div>
      </div>
      <Line n={11} label="Whether qualified for promotion to higher class, if so, to which class" value={up(d.promotion)} />
      <Line n={12} label="Month up to which the pupil has paid School dues" value={up(d.duesUpTo)} />
      <Line n={13} label="Any fee concession availed of; if so, the nature of such concession" value={up(d.concession)} />
      <Pair>
        <Line n={14} label="Total No. of working days" value={d.workingDays} nowrap />
        <Line n={15} label="Working days present" value={d.daysPresent} nowrap />
      </Pair>
      <Line n={16} label="Whether NCC Cadet / Boy Scout / Girl Guide (details may be given)" value={up(d.ncc)} />
      <Line n={17} label="Games played or extra-curricular activities (mention achievement level)" value={up(d.games)} />
      <Pair>
        <Line n={18} label="General Conduct" value={up(d.conduct)} nowrap />
        <Line n={19} label="Date of application" value={dotDate(d.applicationDate)} nowrap />
      </Pair>
      <Line n={20} label="Date of issue of Certificate" value={dotDate(d.issueDate)} />
      <Line n={21} label="Reason for leaving the School" value={up(d.reason)} />
      <Line n={22} label="Any other remarks" value={up(d.remarks)} />
    </div>
  );
}

function BonafideBody({ d }: { d: Record<string, string> }) {
  const g = genderWords(d.gender);
  return (
    <div className="mt-6 flex gap-6">
      <div className="flex-1 space-y-5 text-justify text-[16px] leading-[2.1]">
        <p>
          This is to certify that <U>{up(d.name)}</U> {g.child === "ward" ? "ward" : g.child === "son" ? "S/o" : "D/o"} Shri <U>{up(d.father)}</U>
          {d.mother ? (
            <>
              {" "}
              and Smt. <U>{up(d.mother)}</U>
            </>
          ) : null}{" "}
          is a bonafide student of this school, studying in Class <U>{up(d.classSec)}</U> in the academic session <U>{d.session || "2026-27"}</U>.
        </p>
        <p>
          {g.his} date of birth as per the school Admission Register is <U>{dotDate(d.dob) || "—"}</U>
          {d.dob ? (
            <>
              {" "}
              (<i>{dateInWords(d.dob)}</i>)
            </>
          ) : null}
          , and {g.his.toLowerCase()} S.R. No. is <U>{d.srNo}</U>.
        </p>
        <p>
          This certificate is issued on the request of the parent{d.purpose ? (
            <>
              {" "}
              for the purpose of <U>{d.purpose}</U>
            </>
          ) : null}
          .
        </p>
      </div>
      <PhotoBox />
    </div>
  );
}

function Concern() {
  return <p className="mt-7 text-center text-[15px] font-bold uppercase tracking-wide underline underline-offset-4">To whom it may concern</p>;
}

function CharacterBody({ d, school }: { d: Record<string, string>; school: SchoolInfo }) {
  const g = genderWords(d.gender);
  return (
    <div className="mt-6 flex gap-6">
      <div className="flex-1 space-y-5 text-justify text-[16px] leading-[2.1]">
        <p>
          This is to certify that <U>{up(d.name)}</U> {g.child === "son" ? "S/o" : g.child === "daughter" ? "D/o" : "ward of"} Shri <U>{up(d.father)}</U> has been a student of{" "}
          {school.name}, {school.place.split(",")[0]}
          {d.studiedFrom || d.studiedTo ? (
            <>
              {" "}
              from <U>{d.studiedFrom || "—"}</U> to <U>{d.studiedTo || "—"}</U>
            </>
          ) : null}{" "}
          and last studied in Class <U>{up(d.classSec)}</U>.
        </p>
        <p>
          During this period {g.his.toLowerCase()} conduct and character have been <U>{up(d.conduct || "good")}</U>. To the best of my knowledge {g.he.toLowerCase()}{" "}
          {g.he === "They" ? "bear" : "bears"} a good moral character and {g.he === "They" ? "have" : "has"} not been involved in any act of indiscipline.
        </p>
        <p>I wish {g.him} every success in life.</p>
      </div>
      <PhotoBox />
    </div>
  );
}

/** Numbered entry: label, then the value written on a dotted line that fills the rest of the row. */
function Line({ n, label, value, indent, nowrap }: { n?: number; label: string; value?: string; indent?: boolean; nowrap?: boolean }) {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <span className="w-6 shrink-0">{n ? `${n}.` : ""}</span>
      <span className={`${nowrap ? "shrink-0 whitespace-nowrap" : "min-w-0 max-w-[70%] shrink"} ${indent ? "pl-4" : ""}`}>{label}</span>
      <Dots value={value} />
    </div>
  );
}

function Dots({ value, small }: { value?: string; small?: boolean }) {
  return (
    <span
      className={`min-w-[24%] flex-1 border-b-[1.5px] border-dotted border-black/70 px-1.5 pb-px font-bold leading-tight ${small ? "truncate whitespace-nowrap text-[12px]" : "text-[13.5px]"}`}
      style={{ color: INK }}
    >
      {value || " "}
    </span>
  );
}

function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-5">{children}</div>;
}

function Ref({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <span className="shrink-0">{label}</span>
      <span className={`flex-1 border-b-[1.5px] border-dotted border-black/70 px-1 pb-px ${strong ? "text-[16px]" : ""} font-bold`} style={{ color: INK }}>
        {value || " "}
      </span>
    </div>
  );
}

function U({ children }: { children: React.ReactNode }) {
  return (
    <b className="border-b-[1.5px] border-dotted border-black/70 px-1" style={{ color: INK }}>
      {children}
    </b>
  );
}

function Sign({ label, sub }: { label: string; sub?: string }) {
  return (
    <div>
      <div className="h-12" />
      <div className="border-t border-black pt-1 font-bold">{label}</div>
      {sub && <div className="text-[11.5px]">{sub}</div>}
    </div>
  );
}

function PhotoBox() {
  return (
    <div className="mt-2 flex h-[150px] w-[120px] shrink-0 items-center justify-center border-[1.5px] border-dashed border-black/60 p-2 text-center text-[11px] leading-snug text-black/60">
      Affix recent passport-size photograph, attested by the Principal
    </div>
  );
}

/** The school crest: a shield with an open book and a lamp flame, and the initials on a scroll. */
function Crest({ size, short }: { size: number; short: string }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" aria-hidden>
      <path d="M50 3 L92 14 V52 C92 80 72 98 50 108 C28 98 8 80 8 52 V14 Z" fill="none" stroke={INK} strokeWidth="3.5" />
      <path d="M50 10 L85 19 V52 C85 76 68 91 50 100 C32 91 15 76 15 52 V19 Z" fill="none" stroke={INK} strokeWidth="1.2" />
      {/* flame */}
      <path d="M50 22 C56 30 56 36 50 42 C44 36 44 30 50 22 Z" fill={INK} />
      <rect x="46" y="42" width="8" height="5" fill={INK} />
      {/* open book */}
      <path d="M22 54 C32 50 42 51 49 56 V78 C42 73 32 72 22 76 Z" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M78 54 C68 50 58 51 51 56 V78 C58 73 68 72 78 76 Z" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* scroll with initials */}
      <path d="M14 84 H86 L80 92 L86 100 H14 L20 92 Z" fill={INK} />
      <text x="50" y="95.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Georgia, serif" letterSpacing="1.5">
        {short}
      </text>
    </svg>
  );
}
