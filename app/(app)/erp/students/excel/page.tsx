"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { dmy, downloadCsv, isoDate, parseCsv } from "@/lib/csv";
import type { ErpStudent } from "@/lib/erpStudents";
import { classRank } from "@/lib/erpStudents";
import { ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Students → Excel (user, 2026-10-26: "file export karo, pehle se bhari ho, bharke wapas import"):
 * 1 download the list (or an empty sheet), 2 fill or correct it in Excel and save as CSV, 3 upload it: the
 * backend (POST /api/students/import) first only checks it and shows new students, changes and errors by row;
 * Save then applies exactly that. Admin only. Class and bus of existing students and all money stay out of it.
 */

const HEADER = ["SR No", "Name", "Class", "Section", "Roll No", "Father", "Mother", "Mobile", "Gender", "DOB (DD-MM-YYYY)", "Category", "Address", "Bus (Yes/No)"];
const KEYS = ["srNo", "name", "class", "section", "rollNo", "fatherName", "motherName", "mobile", "gender", "dob", "category", "address", "bus"] as const;

interface Check {
  newCount: number;
  changedCount: number;
  unchanged: number;
  errorCount: number;
  newStudents: { srNo: string; name: string; classSec: string; father: string }[];
  changes: { row: number; srNo: string; name: string; fields: { label: string; from: string; to: string }[] }[];
  errors: { row: number; srNo: string; error: string }[];
  notes: { row: number; srNo: string; note: string }[];
}

export default function ErpStudentsExcelPage() {
  const L = useL();
  const { data, error, reload } = useApi<{ data: ErpStudent[] }>("/erp/students");
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string | number>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "save">("");

  function download(empty: boolean) {
    const list = empty ? [] : [...(data?.data || [])].sort((a, b) => classRank(a.class) - classRank(b.class) || a.section.localeCompare(b.section) || (a.rollNo || "").localeCompare(b.rollNo || "", undefined, { numeric: true }));
    downloadCsv(
      empty ? "students-blank.csv" : "students.csv",
      HEADER,
      list.map((s) => [s.srNo, s.name, s.class, s.section, s.rollNo, s.fatherName, s.motherName, s.mobile, s.gender, dmy(s.dob), s.category, s.address, s.transportOpted ? "Yes" : "No"])
    );
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setCheck(null);
    if (/\.xlsx?$/i.test(f.name)) return toast(false, L({ hi: "Excel में File → Save As → CSV चुनकर सेव करें, फिर वह फ़ाइल डालें।", en: "In Excel use File → Save As → CSV, then pick that file." }));
    const table = parseCsv(await f.text()).filter((r) => r.some((c) => c));
    if (table.length < 2) return toast(false, L({ hi: "फ़ाइल में कोई बच्चा नहीं।", en: "No students in the file." }));
    // Columns by their heading, so a moved column still works.
    const head = table[0].map((h) => h.toLowerCase());
    const at = HEADER.map((h) => head.findIndex((x) => x.startsWith(h.toLowerCase().split(" (")[0])));
    if (at[0] < 0) return toast(false, L({ hi: "पहली लाइन में 'SR No' वाला कॉलम नहीं मिला। डाउनलोड की गई फ़ाइल ही भरें।", en: "No 'SR No' column in the first line. Fill the downloaded file." }));
    const parsed = table.slice(1).map((r, i) => {
      const o: Record<string, string | number> = { row: i + 2 };
      KEYS.forEach((k, j) => {
        if (at[j] >= 0) o[k] = k === "dob" ? isoDate(r[at[j]] || "") : r[at[j]] || "";
      });
      return o;
    });
    setRows(parsed);
    setFileName(f.name);
    await run(parsed, false);
  }

  async function run(list: Record<string, string | number>[], apply: boolean) {
    setBusy(apply ? "save" : "check");
    try {
      const r = await api<Check & { added?: number; updated?: number }>("/erp/students/import", { body: { rows: list, apply }, timeoutMs: 120_000 });
      if (apply) {
        toast(true, L({ hi: `${r.added || 0} नए बच्चे जुड़े, ${r.updated || 0} बदले।`, en: `${r.added || 0} students added, ${r.updated || 0} updated.` }));
        setCheck(null);
        setRows(null);
        setFileName("");
        reload();
      } else setCheck(r);
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "फ़ाइल नहीं पढ़ी जा सकी।", en: "Could not read the file." }));
    } finally {
      setBusy("");
    }
  }

  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={4} />;

  return (
    <div className="animate-rise space-y-4 pb-6">
      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="text-[15px] font-bold">{L({ hi: "1. फ़ाइल डाउनलोड करें", en: "1. Download the file" })}</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-600">{L({ hi: `सभी ${data.data.length.toLocaleString("en-IN")} बच्चे भरे हुए आएँगे। Excel में खोलें, सुधारें या नीचे नए बच्चे जोड़ें।`, en: `All ${data.data.length.toLocaleString("en-IN")} students come filled in. Open it in Excel, correct it or add new students below.` })}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => download(false)} className="btn-primary">
            <Download className="h-4 w-4" aria-hidden /> {L({ hi: "बच्चों की लिस्ट", en: "Students list" })}
          </button>
          <button type="button" onClick={() => download(true)} className="btn-line">
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> {L({ hi: "खाली फ़ाइल", en: "Empty file" })}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="text-[15px] font-bold">{L({ hi: "2. भरकर वापस डालें", en: "2. Upload it back" })}</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-600">{L({ hi: "Excel में File → Save As → CSV चुनकर सेव करें। पहले जाँच होगी, सेव तभी होगा जब आप कहेंगे।", en: "In Excel, File → Save As → CSV. It is checked first; nothing is saved until you say so." })}</p>
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="btn-line mt-3 w-full disabled:opacity-60">
          <Upload className="h-4 w-4" aria-hidden /> {busy === "check" ? L({ hi: "जाँच हो रही है…", en: "Checking…" }) : fileName || L({ hi: "CSV फ़ाइल चुनें", en: "Choose CSV file" })}
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-[12.5px] text-ink-500">{L({ hi: "नए बच्चों की फ़ीस फ़ीस सेटअप से अपने आप बनती है (कक्षा + बस + प्रवेश फ़ीस)। पुराने बच्चों की कक्षा और बस यहाँ से नहीं बदलती। फ़ीस का पैसा सिर्फ़ फ़ीस जमा से।", en: "New students get their fee from the fee setup (class + bus + admission fee). Class and bus of existing students don't change here. Fee payments only through Collect fee." })}</p>
      </section>

      {check && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Figure n={check.newCount} text={L({ hi: "नए बच्चे", en: "New students" })} dot="bg-jade-500" />
            <Figure n={check.changedCount} text={L({ hi: "बदलाव", en: "Changes" })} dot="bg-[#3099a4]" />
            <Figure n={check.unchanged} text={L({ hi: "बिना बदलाव", en: "No change" })} dot="bg-ink-300" />
            <Figure n={check.errorCount} text={L({ hi: "गलती वाली लाइन", en: "Rows with errors" })} dot="bg-rose-500" />
          </div>

          {check.errors.length > 0 && (
            <Block title={L({ hi: "गलतियाँ (ये सेव नहीं होंगी)", en: "Errors (these won't be saved)" })}>
              {check.errors.map((e) => (
                <li key={`${e.row}-${e.srNo}`} className="border-b border-ink-100 py-2 last:border-b-0">
                  <span className="text-[13px] font-semibold">
                    {L({ hi: "लाइन", en: "Row" })} {e.row}
                    {e.srNo ? ` · ${e.srNo}` : ""}
                  </span>
                  <span className="block text-[13.5px] text-rose-700">{e.error}</span>
                </li>
              ))}
            </Block>
          )}

          {check.newStudents.length > 0 && (
            <Block title={L({ hi: "नए बच्चे", en: "New students" })}>
              {check.newStudents.map((s) => (
                <li key={s.srNo} className="border-b border-ink-100 py-2 last:border-b-0">
                  <span className="block text-[14.5px] font-medium">{s.name}</span>
                  <span className="block text-[12.5px] text-ink-600">
                    {s.srNo} · {s.classSec} · {s.father}
                  </span>
                </li>
              ))}
            </Block>
          )}

          {check.changes.length > 0 && (
            <Block title={L({ hi: "बदलाव", en: "Changes" })}>
              {check.changes.map((c) => (
                <li key={c.srNo} className="border-b border-ink-100 py-2 last:border-b-0">
                  <span className="block text-[14.5px] font-medium">
                    {c.name} <span className="font-normal text-ink-500">· {c.srNo}</span>
                  </span>
                  {c.fields.map((f) => (
                    <span key={f.label} className="block text-[13px] text-ink-700">
                      {f.label}: <span className="text-ink-500 line-through">{f.from}</span> → <b className="font-semibold">{f.to}</b>
                    </span>
                  ))}
                </li>
              ))}
            </Block>
          )}

          {check.notes.length > 0 && (
            <p className="text-[13px] text-ink-600">
              {L({ hi: `${check.notes.length} लाइनों में कक्षा या बस बदली थी: वह नहीं बदलेगी।`, en: `${check.notes.length} rows changed class or bus: that part is not saved.` })}
            </p>
          )}

          {check.newCount + check.changedCount > 0 ? (
            <button type="button" onClick={() => rows && run(rows, true)} disabled={!!busy} className="btn-primary w-full">
              {busy === "save" ? "…" : L({ hi: `सेव करें: ${check.newCount} नए, ${check.changedCount} बदलाव`, en: `Save: ${check.newCount} new, ${check.changedCount} changes` })}
            </button>
          ) : (
            <p className="text-center text-[14px] text-ink-600">{L({ hi: "सेव करने को कुछ नया नहीं।", en: "Nothing new to save." })}</p>
          )}
        </section>
      )}
    </div>
  );
}

function Figure({ n, text, dot }: { n: number; text: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
        <i className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {text}
      </span>
      <b className="tnum block text-[22px] font-extrabold">{n.toLocaleString("en-IN")}</b>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      <ul className="rounded-2xl border border-ink-100 bg-white px-3.5">{children}</ul>
    </div>
  );
}
