/* Copied from the ERP (components/exams/report/ReportCardDocument.tsx) so app prints match the ERP exactly. Keep in step. */
import React from "react";
import type { SchoolInfo } from "@/components/erp/certs/CertificateDocument";
import type { Exam, ReportCard } from "@/lib/erpExams";
import { GRADES, PASS_PERCENT } from "@/lib/erpGrading";

export interface ReportSchool extends SchoolInfo {
  principal?: string;
  /** Town for "Place:" under the signatures (else the first part of `place`). */
  city?: string;
}

/** Same printing ink as the certificates, so the school's papers look like one set. */
const INK = "#1c2a5e";
const TINT = "#eef1f8";

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const up = (s?: string) => (s || "").toUpperCase();
/** "2015-03-15" -> "15.03.2015" */
const dotDate = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};
const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/** "91–100", "81–90" … "Below 33", read off the grade table so it can never disagree with it. */
const SCALE = GRADES.map((g, i) => ({
  grade: g.grade,
  range: g.min === 0 ? `Below ${GRADES[i - 1] ? GRADES[i - 1].min : PASS_PERCENT}` : `${g.min}–${i === 0 ? 100 : GRADES[i - 1].min - 1}`,
}));

/**
 * One student's report card on two A4 sheets (794 × 1123 px each), drawn like the
 * printed CBSE report cards schools hand out. Front: letterhead, title band, the
 * pupil's particulars on dotted lines, a ruled marks table, the result and three
 * signatures. Back (ReportCardBack): grading key, attendance, remarks, a note to
 * parents and the signatures. Prints only what the report data holds. The parent
 * app draws the same two sheets (components/report/ReportSheets.tsx there).
 */
export function ReportCardDocument({ exam, classSec, card, school }: { exam: Exam; classSec: string; card: ReportCard; school: ReportSchool }) {
  const parts = exam.components || [];
  const split = parts.length > 1;
  const many = card.subjects.length > 11;
  const cell = many ? "px-2 py-[3px]" : "px-2 py-[6px]";
  const missing = card.subjects.filter((s) => !s.entered).map((s) => s.subject);
  const session = exam.session || "2026-27";

  return (
    <div className="report-sheet relative mx-auto h-[1123px] w-[794px] overflow-hidden bg-white text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <div aria-hidden className="absolute inset-[18px] border-[3px]" style={{ borderColor: INK }} />
      <div aria-hidden className="absolute inset-[24px] border" style={{ borderColor: INK }} />

      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]">
        {school.logoUrl ? <img src={school.logoUrl} alt="" style={{ width: 360, height: 360, objectFit: "contain" }} /> : <Crest size={380} short={school.short} />}
      </div>

      <div className="relative flex h-full flex-col px-[50px] pb-[44px] pt-[40px]">
        {/* Letterhead */}
        <header className="flex items-start gap-4">
          <div className="shrink-0">
            {school.logoUrl ? <img src={school.logoUrl} alt="" style={{ width: 84, height: 84, objectFit: "contain" }} /> : <Crest size={80} short={school.short} />}
          </div>
          <div className="flex-1 pr-[84px] text-center">
            <h1 className="text-[31px] font-bold uppercase leading-none tracking-wide" style={{ color: INK, fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {school.name}
            </h1>
            <p className="mt-1.5 text-[13.5px] font-bold uppercase tracking-wide">
              {school.place}
              {school.pincode ? ` – ${school.pincode}` : ""}
            </p>
            <p className="mt-0.5 text-[12.5px]">
              Affiliated to C.B.S.E., New Delhi &nbsp;·&nbsp; Affiliation No. <b>{school.affiliationNo || "—"}</b> &nbsp;·&nbsp; School Code <b>{school.schoolCode || "—"}</b>
            </p>
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
          <span className="inline-block rounded-sm px-7 py-[4px] text-[17px] font-bold uppercase tracking-[0.2em] text-white" style={{ backgroundColor: INK }}>
            Report Card
          </span>
          <p className="mt-1.5 text-[14px] font-bold uppercase tracking-wide" style={{ color: INK }}>
            {exam.title} &nbsp;—&nbsp; Session {session}
          </p>
        </div>

        {/* Particulars */}
        <div className="mt-4 space-y-[9px] text-[13.5px]">
          <div className="grid grid-cols-[2fr_1fr] gap-6">
            <Entry label="Name of Student" value={up(card.name)} strong />
            <Entry label="Roll No." value={card.rollNo} strong />
          </div>
          <div className="grid grid-cols-3 gap-6">
            <Entry label="Class & Section" value={up(classSec)} />
            <Entry label="S.R. No." value={card.srNo} />
            <Entry label="Date of Birth" value={dotDate(card.dob)} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Entry label="Father's Name" value={card.fatherName ? `MR. ${up(card.fatherName)}` : ""} />
            <Entry label="Mother's Name" value={card.motherName ? `MRS. ${up(card.motherName)}` : ""} />
          </div>
        </div>

        {/* Scholastic areas */}
        <div className="mt-5 flex items-end justify-between text-[12.5px]">
          <span className="font-bold uppercase tracking-[0.12em]" style={{ color: INK }}>
            Scholastic Areas
          </span>
          <span>Maximum marks in each subject: {exam.max}</span>
        </div>
        <table className="mt-1 w-full border-collapse text-[13px]" style={{ borderColor: INK }}>
          <thead>
            <tr style={{ backgroundColor: TINT, color: INK }} className="text-[12px] font-bold leading-tight">
              <Th className="w-[46px]">S.No.</Th>
              <Th className="text-left">Subject</Th>
              {split ? (
                parts.map((p) => (
                  <Th key={p.key} className="w-[86px]">
                    {p.name}
                    <br />({p.max})
                  </Th>
                ))
              ) : (
                <Th className="w-[120px]">
                  Marks Obtained
                  <br />({exam.max})
                </Th>
              )}
              {split && (
                <Th className="w-[86px]">
                  Total
                  <br />({exam.max})
                </Th>
              )}
              <Th className="w-[64px]">Grade</Th>
            </tr>
          </thead>
          <tbody>
            {card.subjects.map((s, i) => {
              const mark = (v: number | undefined | null) => (s.absent ? "AB" : typeof v === "number" ? num(v) : "—");
              return (
                <tr key={s.subject}>
                  <Td className={`${cell} text-center`}>{i + 1}</Td>
                  <Td className={`${cell} font-bold uppercase`}>{s.subject}</Td>
                  {split && parts.map((p) => <Td key={p.key} className={`${cell} text-center tabular-nums`}>{mark(s.marks[p.key])}</Td>)}
                  <Td className={`${cell} text-center font-bold tabular-nums`}>{mark(s.total)}</Td>
                  <Td className={`${cell} text-center font-bold`}>{s.absent ? "AB" : s.grade || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 grid grid-cols-5 border text-center" style={{ borderColor: INK }}>
          <Box label="Grand Total" value={card.complete ? `${num(card.grand)} / ${num(card.outOf)}` : "—"} />
          <Box label="Percentage" value={card.complete ? `${card.percent.toFixed(2)}%` : "—"} />
          <Box label="Overall Grade" value={card.grade || "—"} />
          <Box label="Rank in Class" value={card.rank ? String(card.rank) : "—"} />
          <Box label="Attendance" value={card.attendance ? `${num(card.attendance.present)} / ${card.attendance.days}` : "—"} last />
        </div>

        <div className="mt-3 flex items-baseline gap-2 border px-3 py-2 text-[14px]" style={{ borderColor: INK }}>
          <span className="shrink-0 font-bold">Result:</span>
          <span className="font-bold uppercase" style={{ color: INK }}>
            {card.result}
          </span>
          {!card.complete && missing.length > 0 && <span className="text-[12.5px]">(marks not entered: {missing.join(", ")})</span>}
        </div>

        {/* Signatures */}
        <footer className="mt-auto grid grid-cols-3 items-end gap-10 text-center text-[12.5px]">
          <Sign label="Class Teacher" />
          <Sign label="Exam In-charge" />
          <Sign label="Principal" sub={school.principal || "(Signature with seal)"} />
        </footer>
      </div>
    </div>
  );
}

/** The back of the card: grading key, attendance, remarks left blank for the teacher, a note to parents. */
export function ReportCardBack({ card, school }: { card: ReportCard; school: ReportSchool }) {
  const att = card.attendance && card.attendance.days > 0 ? card.attendance : null;
  return (
    <div className="report-sheet relative mx-auto h-[1123px] w-[794px] overflow-hidden bg-white text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <div aria-hidden className="absolute inset-[18px] border-[3px]" style={{ borderColor: INK }} />
      <div aria-hidden className="absolute inset-[24px] border" style={{ borderColor: INK }} />

      <div className="relative flex h-full flex-col px-[50px] pb-[44px] pt-[50px]">
        <BackHead>Grading Scale (8-point, in % of marks)</BackHead>
        <table className="w-full border-collapse text-center text-[12.5px]">
          <tbody>
            <tr style={{ backgroundColor: TINT, color: INK }} className="font-bold">
              <Td className="w-[80px] px-1.5 py-[4px] text-left">Grade</Td>
              {SCALE.map((g) => (
                <Td key={g.grade} className="px-1 py-[4px]">
                  {g.grade}
                </Td>
              ))}
            </tr>
            <tr>
              <Td className="px-1.5 py-[4px] text-left font-bold">Marks %</Td>
              {SCALE.map((g) => (
                <Td key={g.grade} className="px-1 py-[4px] tabular-nums">
                  {g.range}
                </Td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-1.5 text-[12px]">AB = Absent. A pupil needs at least {PASS_PERCENT}% marks in each subject. Attendance is days present out of school days marked this session.</p>

        <BackHead>Attendance</BackHead>
        <table className="w-full border-collapse text-center text-[13.5px]">
          <thead>
            <tr style={{ backgroundColor: TINT, color: INK }} className="text-[12.5px] font-bold">
              <Th>Working Days</Th>
              <Th>Days Present</Th>
              <Th>Percentage</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold tabular-nums">
              <Td className="py-[7px]">{att ? att.days : "—"}</Td>
              <Td className="py-[7px]">{att ? num(att.present) : "—"}</Td>
              <Td className="py-[7px]">{att ? `${((att.present / att.days) * 100).toFixed(1)}%` : "—"}</Td>
            </tr>
          </tbody>
        </table>

        {/* Left blank for the class teacher to write by hand */}
        <BackHead>Class Teacher&apos;s Remarks</BackHead>
        <div className="space-y-[22px] text-[13.5px]">
          <div className="border-b-[1.5px] border-dotted border-black/70">&nbsp;</div>
          <div className="border-b-[1.5px] border-dotted border-black/70">&nbsp;</div>
          <div className="border-b-[1.5px] border-dotted border-black/70">&nbsp;</div>
        </div>

        <BackHead>Instructions to Parents</BackHead>
        <ol className="list-decimal space-y-1 pl-5 text-[13.5px] leading-snug">
          <li>Please go through the report card and discuss it with your ward.</li>
          <li>The parent-teacher meeting will be held on the date given by the school.</li>
          <li>Please tell the school office about any change of address or mobile number.</li>
        </ol>

        <BackHead>Parent&apos;s Signature</BackHead>
        <div className="w-1/2 border-b-[1.5px] border-dotted border-black/70 text-[13.5px]">&nbsp;</div>

        <footer className="mt-auto">
          <div className="mb-1 flex gap-10 text-[13px]">
            <span>
              Place: <b>{up(school.city || school.place.split(",").filter((x) => x.trim())[0] || "")}</b>
            </span>
            <span>
              Date: <b>{today()}</b>
            </span>
          </div>
          <div className="grid grid-cols-3 items-end gap-10 text-center text-[12.5px]">
            <Sign label="Class Teacher" />
            <Sign label="Exam In-charge" />
            <Sign label="Principal" sub={school.principal || "(Signature with seal)"} />
          </div>
        </footer>
      </div>
    </div>
  );
}

function BackHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-7 text-[12.5px] font-bold uppercase tracking-[0.12em] first:mt-0" style={{ color: INK }}>
      {children}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border px-2 py-[5px] text-center align-middle ${className}`} style={{ borderColor: INK }}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`border ${className}`} style={{ borderColor: INK }}>
      {children}
    </td>
  );
}

function Entry({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 items-end gap-2">
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <span className={`min-w-0 flex-1 truncate border-b-[1.5px] border-dotted border-black/70 px-1.5 pb-px font-bold ${strong ? "text-[15px]" : ""}`} style={{ color: INK }}>
        {value || " "}
      </span>
    </div>
  );
}

function Box({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? "" : "border-r"} style={{ borderColor: INK }}>
      <div className="border-b py-[3px] text-[11.5px] font-bold uppercase tracking-wide" style={{ backgroundColor: TINT, color: INK, borderColor: INK }}>
        {label}
      </div>
      <div className="py-[6px] text-[16px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Sign({ label, sub }: { label: string; sub?: string }) {
  return (
    <div>
      <div className="h-12" />
      <div className="border-t border-black pt-1 font-bold">{label}</div>
      <div className="text-[11.5px]">{sub || " "}</div>
    </div>
  );
}

/** Drawn crest for schools without an uploaded logo (same design as on the certificates). */
function Crest({ size, short }: { size: number; short: string }) {
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" aria-hidden>
      <path d="M50 3 L92 14 V52 C92 80 72 98 50 108 C28 98 8 80 8 52 V14 Z" fill="none" stroke={INK} strokeWidth="3.5" />
      <path d="M50 10 L85 19 V52 C85 76 68 91 50 100 C32 91 15 76 15 52 V19 Z" fill="none" stroke={INK} strokeWidth="1.2" />
      <path d="M50 22 C56 30 56 36 50 42 C44 36 44 30 50 22 Z" fill={INK} />
      <rect x="46" y="42" width="8" height="5" fill={INK} />
      <path d="M22 54 C32 50 42 51 49 56 V78 C42 73 32 72 22 76 Z" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M78 54 C68 50 58 51 51 56 V78 C58 73 68 72 78 76 Z" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 84 H86 L80 92 L86 100 H14 L20 92 Z" fill={INK} />
      <text x="50" y="95.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Georgia, serif" letterSpacing="1.5">
        {short}
      </text>
    </svg>
  );
}
