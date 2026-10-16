"use client";

import { useMemo, useState } from "react";
import { Printer, Search, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { useL, useLang } from "@/lib/i18n";
import { CERT_TEXT, useSchoolInfo, type Certificate, type CertificateType } from "@/lib/erpCerts";
import { CertificateDocument } from "@/components/erp/certs/CertificateDocument";
import { PrintSheet } from "@/components/erp/certs/SheetPreview";
import { Empty, ErrorCard, LineTabs, ListSkeleton } from "@/components/ui";

type Filter = "all" | CertificateType;

/** ERP login → Students → Certificates: the ERP's certificate register (TC, bonafide, character), tap a row to print it again. */
export default function ErpCertificatesPage() {
  const L = useL();
  const { lang } = useLang();
  const school = useSchoolInfo();
  const { data, error, reload } = useApi<{ data: Certificate[] }>("/erp/certificates?limit=500");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [printing, setPrinting] = useState<Certificate | null>(null);
  const certs = useMemo(() => data?.data || [], [data]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, tc: 0, bonafide: 0, character: 0 };
    for (const x of certs) {
      c.all++;
      c[x.type]++;
    }
    return c;
  }, [certs]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return certs.filter((c) => (filter === "all" || c.type === filter) && (!t || c.serial_no.toLowerCase().includes(t) || (c.details.name || c.student?.name || "").toLowerCase().includes(t) || (c.details.srNo || "").toLowerCase().includes(t)));
  }, [certs, filter, q]);
  const n = (k: number) => (data ? ` ${k}` : "");

  return (
    <div className="animate-rise space-y-3">
      <LineTabs
        label={L({ hi: "सर्टिफ़िकेट", en: "Certificates" })}
        value={filter}
        onChange={setFilter}
        options={[
          { key: "all", text: `${L({ hi: "सभी", en: "All" })}${n(counts.all)}` },
          { key: "tc", text: `TC${n(counts.tc)}` },
          { key: "bonafide", text: `${L({ hi: "बोनाफ़ाइड", en: "Bonafide" })}${n(counts.bonafide)}` },
          { key: "character", text: `${L({ hi: "चरित्र", en: "Character" })}${n(counts.character)}` },
        ]}
      />
      <label className="field-box min-h-[48px]">
        <Search aria-hidden />
        <input id="erp-cert-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ hi: "सीरियल नं., बच्चा या SR नं.", en: "Serial no., student or SR no." })} enterKeyHint="search" autoComplete="off" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L({ hi: "खोज हटाएँ", en: "Clear search" })} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center text-ink-400">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </label>

      {!data ? (
        error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={5} />
      ) : shown.length === 0 ? (
        <Empty>{certs.length ? L({ hi: "कुछ नहीं मिला। दूसरा नाम या सीरियल नं. देखें।", en: "Nothing matches. Try another name or serial number." }) : L({ hi: "अभी कोई सर्टिफ़िकेट नहीं दिया। ऊपर + से दें; हर TC, बोनाफ़ाइड और चरित्र सर्टिफ़िकेट यहाँ सीरियल नं. के साथ दिखेगा।", en: "No certificate issued yet. Issue one with + above; each is listed here with its serial number." })}</Empty>
      ) : (
        <ul>
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setPrinting(c)} aria-label={`${L({ hi: "प्रिंट", en: "Print" })} ${c.serial_no}`} className="flex min-h-[64px] w-full items-center gap-3 border-b border-ink-100 py-2 text-left active:bg-ink-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-medium">{c.details.name || c.student?.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-400">
                    {L(CERT_TEXT[c.type])} · {c.serial_no} · {c.details.classSec || c.student?.class_sec}
                  </span>
                  <span className="block truncate text-[12px] text-ink-400">
                    {new Date(c.issued_at).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })} · {(c.issued_by_name || L({ hi: "ऑफ़िस", en: "Office" })).split(" (")[0]}
                  </span>
                </span>
                <Printer className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {printing && (
        <PrintSheet onDone={() => setPrinting(null)}>
          <CertificateDocument type={printing.type} d={printing.details} serial={printing.serial_no} school={school} />
        </PrintSheet>
      )}
    </div>
  );
}
