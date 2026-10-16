/* Copied from the ERP (components/students/IdCardPrint.tsx) so app cards print the same. Keep in step. */
import React from "react";
import QRCode from "qrcode";
import type { ErpStudent as Student } from "@/lib/erpStudents";
import { initials } from "@/lib/format";

/**
 * Printed student ID cards, sized in millimetres: CR80 portrait (54 × 85.6 mm), the way
 * Indian schools issue them for a lanyard, nine to an A4 sheet. Front: school band, photo,
 * name and class, key details, signature. Back: return address, emergency contact, rules.
 * The top 6 mm stay clear of text for the lanyard slot punch.
 */

export const CARD_W = 54;
export const CARD_H = 85.6;
export const PER_SHEET = 9;
const COLS = 3;
const COL_GAP = 6;
const ROW_GAP = 4;

/** Deep jade: the school colour on the card. White text on it is ~7.5:1. */
const BAND = "#0A5C4C";
const TINT = "#E6F1EE";

export interface CardSchool {
  name: string;
  short: string;
  logoUrl?: string;
  /** Street, city, state and pincode on one line. */
  address: string;
  phone?: string;
  /** e.g. "CBSE Affiliation No. 1730512" */
  affiliation?: string;
  session: string;
  validTill?: string;
}

const dob = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const phone = (p?: string) => {
  const d = (p || "").replace(/\D/g, "").slice(-10);
  if (/^(\d)\1{9}$/.test(d)) return "—"; // 9999999999-style placeholders
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p || "—";
};
const classLabel = (s: Student) => [s.class, s.section].filter(Boolean).join(" – ");

function Logo({ school, size, onWhite }: { school: CardSchool; size: string; onWhite?: boolean }) {
  return school.logoUrl ? (
    <img src={school.logoUrl} alt="" className="shrink-0 rounded-full object-contain p-[0.5mm]" style={{ width: size, height: size, background: onWhite ? TINT : "#fff" }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full text-[6pt] font-extrabold" style={{ width: size, height: size, color: BAND, background: onWhite ? TINT : "#fff" }}>
      {school.short}
    </span>
  );
}

export function IdCardFront({ s, school }: { s: Student; school: CardSchool }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[3mm] bg-white text-[#141519] ring-[0.2mm] ring-[#C9CCD5]">
      {/* School band */}
      <div className="px-[3mm] pb-[8mm] pt-[6mm] text-white" style={{ background: BAND }}>
        <div className="flex items-center gap-[1.8mm]">
          <Logo school={school} size="8.5mm" />
          <div className="min-w-0 leading-[1.15]">
            <div className="line-clamp-2 text-[8.4pt] font-bold">{school.name}</div>
            <div className="mt-[0.4mm] truncate text-[5.6pt] text-white/85">{school.address}</div>
            {school.affiliation && <div className="truncate text-[5.4pt] text-white/75">{school.affiliation}</div>}
          </div>
        </div>
      </div>
      <span aria-hidden className="h-[0.8mm] bg-[#FAB124]" />

      {/* Photo over the band */}
      <div className="-mt-[7.6mm] flex justify-center">
        {s.photoUrl ? (
          <img src={s.photoUrl} alt="" className="h-[24mm] w-[19.5mm] rounded-[1.5mm] border-[0.8mm] border-white object-cover shadow-[0_0.3mm_1mm_rgba(0,0,0,0.25)]" />
        ) : (
          <span className="flex h-[24mm] w-[19.5mm] items-center justify-center rounded-[1.5mm] border-[0.8mm] border-white text-[15pt] font-bold shadow-[0_0.3mm_1mm_rgba(0,0,0,0.25)]" style={{ background: TINT, color: BAND }}>
            {initials(s.name)}
          </span>
        )}
      </div>

      {/* Name and class */}
      <div className="px-[3mm] pt-[1.6mm] text-center">
        <div className="line-clamp-2 text-[10.5pt] font-bold leading-[1.15]">{s.name}</div>
        <span className="mt-[1mm] inline-block rounded-[1mm] px-[1.8mm] py-[0.4mm] text-[6.8pt] font-bold" style={{ background: TINT, color: BAND }}>
          Class {classLabel(s)}
        </span>
      </div>

      {/* Details */}
      <dl className="mt-[2mm] space-y-[0.7mm] px-[3.4mm] text-[6.6pt] leading-tight">
        <Row label="Adm. no." value={s.admissionNo || s.srNo || "—"} />
        <Row label="Roll no." value={s.rollNo || "—"} />
        <Row label="Father" value={s.fatherName || "—"} />
        <Row label="D.O.B." value={dob(s.dob)} />
        <Row label="Mobile" value={phone(s.mobile)} />
      </dl>

      {/* Session and signature */}
      <div className="mt-auto flex items-end justify-between px-[3.4mm] pb-[1.6mm] pt-[2mm]">
        <span className="text-[5.8pt] text-[#454957]">Session {school.session}</span>
        <span className="w-[17mm] border-t-[0.2mm] border-[#62677A] pt-[0.4mm] text-center text-[5.6pt] text-[#454957]">Principal</span>
      </div>
      <div className="flex h-[4mm] items-center justify-center text-[5.6pt] font-semibold text-white" style={{ background: BAND }}>
        {school.phone ? `Ph. ${phone(school.phone)}` : school.name}
      </div>
    </div>
  );
}

export function IdCardBack({ s, school }: { s: Student; school: CardSchool }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[3mm] bg-white text-[#141519] ring-[0.2mm] ring-[#C9CCD5]">
      <span aria-hidden className="h-[1.6mm]" style={{ background: BAND }} />
      <div className="flex flex-1 flex-col px-[3.4mm] pt-[5mm]">
        <p className="text-center text-[5.8pt] text-[#454957]">If found, please return to</p>
        <div className="mt-[1mm] flex flex-col items-center text-center">
          <Logo school={school} size="7mm" onWhite />
          <div className="mt-[0.8mm] text-[8pt] font-bold leading-tight" style={{ color: BAND }}>
            {school.name}
          </div>
          <div className="mt-[0.4mm] text-[6pt] leading-snug text-[#2E313B]">{school.address}</div>
          {school.phone && <div className="text-[6.2pt] font-semibold tabular-nums">Ph. {phone(school.phone)}</div>}
        </div>

        <div className="mt-[2.6mm] rounded-[1.4mm] px-[2.2mm] py-[1.6mm]" style={{ background: TINT }}>
          <div className="text-[5.6pt] font-semibold" style={{ color: BAND }}>
            In emergency, call
          </div>
          <div className="text-[7pt] font-semibold leading-tight">{s.fatherName || s.guardianName || "Parent"}</div>
          <div className="text-[9pt] font-bold tabular-nums leading-tight">{phone(s.mobile)}</div>
        </div>

        <div className="mt-[2mm] flex items-start gap-[2mm]">
          <dl className="min-w-0 flex-1 space-y-[1mm] text-[6.4pt] leading-snug">
            <div>
              <dt className="text-[5.6pt] text-[#62677A]">Address</dt>
              <dd className="line-clamp-3">{s.address || "—"}</dd>
            </div>
            <div>
              <dt className="text-[5.6pt] text-[#62677A]">Transport</dt>
              <dd className="line-clamp-2">{s.transportOpted ? s.busRoute || "School bus" : "Own"}</dd>
            </div>
          </dl>
          <StudentQr s={s} school={school} />
        </div>

        <ul className="mt-auto list-disc space-y-[0.3mm] pb-[1.6mm] pl-[3mm] text-[5.4pt] leading-snug text-[#454957]">
          <li>This card belongs to the school and cannot be transferred.</li>
          <li>Carry it every day and show it when asked.</li>
          <li>Tell the school office at once if it is lost.</li>
        </ul>
      </div>
      <div className="flex h-[4.6mm] items-center justify-center text-[6pt] font-semibold text-white" style={{ background: BAND }}>
        {school.validTill ? `Valid till ${school.validTill}` : `Session ${school.session}`}
      </div>
    </div>
  );
}

/**
 * QR with the student's identity as plain text, so any phone camera shows who the card
 * belongs to (gate, bus, exam hall). Drawn as SVG from the code's modules: sharp at any
 * print size and needs no async image.
 */
function StudentQr({ s, school }: { s: Student; school: CardSchool }) {
  const text = [s.name, `Class ${classLabel(s)}`, `SR no. ${s.srNo}`, s.admissionNo ? `Adm. no. ${s.admissionNo}` : "", school.name].filter(Boolean).join("\n");
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="h-[16mm] w-[16mm] shrink-0" role="img" aria-label={`QR code for ${s.name}`} shapeRendering="crispEdges">
      <rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#fff" />
      <path d={d} fill="#141519" />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-[1.4mm]">
      <dt className="w-[11mm] shrink-0 text-[#62677A]">{label}</dt>
      <dd className="min-w-0 truncate font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * One A4 sheet of up to nine cards. The back sheet mirrors the columns, so that printed
 * double-sided (flip on long edge) each back lands behind its own front.
 */
export function IdCardSheet({ students, side, school }: { students: Student[]; side: "front" | "back"; school: CardSchool }) {
  const rows = Math.ceil(PER_SHEET / COLS);
  return (
    <div className="report-sheet flex h-[297mm] w-[210mm] items-center justify-center overflow-hidden bg-white">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, ${CARD_W}mm)`,
          gridTemplateRows: `repeat(${rows}, ${CARD_H}mm)`,
          columnGap: `${COL_GAP}mm`,
          rowGap: `${ROW_GAP}mm`,
        }}
      >
        {students.map((s, i) => {
          const col = i % COLS;
          return (
            <div key={s.id} style={{ gridRow: Math.floor(i / COLS) + 1, gridColumn: (side === "back" ? COLS - 1 - col : col) + 1 }}>
              {side === "front" ? <IdCardFront s={s} school={school} /> : <IdCardBack s={s} school={school} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
