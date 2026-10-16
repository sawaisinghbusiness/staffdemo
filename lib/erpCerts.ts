"use client";

import { useApi } from "./api";
import type { Bi } from "./i18n";
import type { SchoolInfo } from "@/components/erp/certs/CertificateDocument";

/** As the ERP backend's /api/certificates returns it (ERP lib/services/certificateService). */
export type CertificateType = "tc" | "bonafide" | "character";
export interface Certificate {
  id: string;
  serial_no: string;
  type: CertificateType;
  session: string;
  student_id: string;
  /** A snapshot of everything printed, so a reprint matches the original. */
  details: Record<string, string>;
  issued_by_name: string;
  issued_at: string;
  student?: { name: string; sr_no: string; class_sec: string; father_name: string };
}

export const CERT_TEXT: Record<CertificateType, Bi> = {
  tc: { hi: "TC (स्कूल छोड़ना)", en: "Transfer (TC)" },
  bonafide: { hi: "बोनाफ़ाइड", en: "Bonafide" },
  character: { hi: "चरित्र", en: "Character" },
};

/** The school's letterhead details from GET /api/school, laid out as the ERP's certificates page does. */
export function useSchoolInfo(): SchoolInfo {
  const { data: p } = useApi<Record<string, string>>("/erp/school");
  return {
    name: p?.school_name || "St. Paul School",
    short: p?.short_name || "SPS",
    affiliationNo: p?.affiliation_no || "1730512",
    schoolCode: p?.school_code || "10492",
    place: [p?.address, p?.city || "Barmer", p?.state || "Rajasthan"].filter(Boolean).join(", "),
    pincode: p?.pincode || "344001",
    phone: [p?.contact1, p?.contact2].filter(Boolean).join(", "),
    email: p?.email,
    logoUrl: p?.logo_url || undefined,
  };
}
