"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { api, ApiError, useApi } from "@/lib/api";
import { useL } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Syllabus → Excel (2026-10-26): download every class + subject's chapters (a blank line for those with
 * none yet), fill it in Excel, save as CSV and upload. POST /api/syllabus/import checks first (new chapters,
 * renamed ones, errors by row); Save applies it. Chapters left out of the file are not deleted.
 */

const HEADER = ["Class", "Subject", "Chapter No", "Chapter", "Month (MM-YYYY)"];
interface Row {
  className: string;
  subject: string;
  no: number;
  title: string;
  planMonth: string;
}
interface Check {
  newCount: number;
  changedCount: number;
  unchanged: number;
  errorCount: number;
  added: { label: string; title: string }[];
  changes: { row: number; label: string; from: string; to: string }[];
  errors: { row: number; error: string }[];
}
/** "2026-10" ↔ "10-2026" */
const toFile = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${m.slice(5)}-${m.slice(0, 4)}` : "");
const fromFile = (v: string) => {
  const m = /^(\d{1,2})[-/.](\d{4})$/.exec(v.trim());
  return m ? `${m[2]}-${m[1].padStart(2, "0")}` : v.trim();
};

export default function ErpSyllabusExcelPage() {
  const L = useL();
  const summary = useApi<{ setupNeeded: boolean; data: { className: string; subject: string; chapters: number }[] }>("/erp/syllabus/summary");
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string | number>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState<"" | "down" | "check" | "save">("");

  async function download() {
    setBusy("down");
    try {
      const { data } = await api<{ data: Row[] }>("/erp/syllabus/export");
      // Every class + subject: its chapters, or one blank line to start from.
      const out: unknown[][] = [];
      for (const g of summary.data?.data || []) {
        const list = data.filter((c) => c.className === g.className && c.subject === g.subject);
        if (list.length) list.forEach((c) => out.push([c.className, c.subject, c.no, c.title, toFile(c.planMonth)]));
        else out.push([g.className, g.subject, 1, "", ""]);
      }
      downloadCsv("syllabus.csv", HEADER, out);
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "फ़ाइल नहीं बनी।", en: "Could not make the file." }));
    } finally {
      setBusy("");
    }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setCheck(null);
    if (/\.xlsx?$/i.test(f.name)) return toast(false, L({ hi: "Excel में File → Save As → CSV चुनकर सेव करें, फिर वह फ़ाइल डालें।", en: "In Excel use File → Save As → CSV, then pick that file." }));
    const table = parseCsv(await f.text()).filter((r) => r.some((c) => c));
    if (table.length < 2) return toast(false, L({ hi: "फ़ाइल में कोई अध्याय नहीं।", en: "No chapters in the file." }));
    const head = table[0].map((h) => h.toLowerCase());
    const col = (name: string) => head.findIndex((x) => x.startsWith(name));
    const at = { className: col("class"), subject: col("subject"), no: col("chapter no"), title: head.findIndex((x) => x === "chapter" || x.startsWith("chapter name")), planMonth: col("month") };
    if (at.className < 0 || at.subject < 0 || at.no < 0 || at.title < 0) return toast(false, L({ hi: "कॉलम नहीं मिले। डाउनलोड की गई फ़ाइल ही भरें।", en: "Columns not found. Fill the downloaded file." }));
    const parsed = table
      .slice(1)
      .map((r, i) => ({ row: i + 2, className: r[at.className] || "", subject: r[at.subject] || "", no: r[at.no] || "", title: r[at.title] || "", planMonth: at.planMonth >= 0 ? fromFile(r[at.planMonth] || "") : "" }))
      .filter((r) => r.title); // blank starter lines are skipped
    if (!parsed.length) return toast(false, L({ hi: "किसी लाइन में अध्याय का नाम नहीं भरा।", en: "No chapter names filled in." }));
    setRows(parsed);
    setFileName(f.name);
    await run(parsed, false);
  }

  async function run(list: Record<string, string | number>[], apply: boolean) {
    setBusy(apply ? "save" : "check");
    try {
      // A dry run sends the lists; applying sends how many were added and updated.
      const r = await api<Check & { updated?: number }>("/erp/syllabus/import", { body: { rows: list, apply }, timeoutMs: 120_000 });
      if (apply) {
        const added = Number((r as unknown as { added: number }).added) || 0;
        toast(true, L({ hi: `${added} अध्याय जुड़े, ${r.updated || 0} बदले।`, en: `${added} chapters added, ${r.updated || 0} changed.` }));
        setCheck(null);
        setRows(null);
        setFileName("");
        summary.reload();
      } else setCheck(r);
    } catch (e) {
      toast(false, (e instanceof ApiError && e.message) || L({ hi: "फ़ाइल नहीं पढ़ी जा सकी।", en: "Could not read the file." }));
    } finally {
      setBusy("");
    }
  }

  if (!summary.data) return summary.error && summary.error.status !== 401 ? <ErrorCard offline={summary.error.status === 0} onRetry={summary.reload} /> : <ListSkeleton rows={4} />;

  return (
    <div className="animate-rise space-y-4 pb-6">
      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="text-[15px] font-bold">{L({ hi: "1. फ़ाइल डाउनलोड करें", en: "1. Download the file" })}</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-600">{L({ hi: "हर कक्षा और विषय के अध्याय, जिनके नहीं हैं उनकी एक खाली लाइन। अध्याय नं. 1, 2, 3… और महीना जैसे 10-2026।", en: "Every class and subject's chapters, with a blank line where there are none. Chapter no. 1, 2, 3… and month like 10-2026." })}</p>
        <button type="button" onClick={download} disabled={!!busy} className="btn-primary mt-3 w-full disabled:opacity-60">
          <Download className="h-4 w-4" aria-hidden /> {busy === "down" ? "…" : L({ hi: "सिलेबस फ़ाइल", en: "Syllabus file" })}
        </button>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="text-[15px] font-bold">{L({ hi: "2. भरकर वापस डालें", en: "2. Upload it back" })}</h2>
        <p className="mt-0.5 text-[13.5px] text-ink-600">{L({ hi: "Excel में File → Save As → CSV। फ़ाइल से हटाए अध्याय मिटते नहीं, वे सिलेबस पेज से हटाएँ।", en: "In Excel, File → Save As → CSV. Chapters left out are not deleted; remove those on the Syllabus page." })}</p>
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
      </section>

      {check && (
        <section className="space-y-3">
          <p className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-[14px] leading-relaxed">
            {L({
              hi: `${check.newCount} नए अध्याय · ${check.changedCount} बदले · ${check.unchanged} वैसे ही · ${check.errorCount} गलती वाली लाइन`,
              en: `${check.newCount} new chapters · ${check.changedCount} changed · ${check.unchanged} same · ${check.errorCount} rows with errors`,
            })}
          </p>
          {check.errors.length > 0 && (
            <List title={L({ hi: "गलतियाँ (ये सेव नहीं होंगी)", en: "Errors (these won't be saved)" })}>
              {check.errors.map((e, i) => (
                <li key={i} className="border-b border-ink-100 py-2 text-[13.5px] last:border-b-0">
                  <b className="font-semibold">
                    {L({ hi: "लाइन", en: "Row" })} {e.row}
                  </b>{" "}
                  <span className="text-rose-700">{e.error}</span>
                </li>
              ))}
            </List>
          )}
          {check.added.length > 0 && (
            <List title={L({ hi: "नए अध्याय", en: "New chapters" })}>
              {check.added.map((a) => (
                <li key={a.label} className="border-b border-ink-100 py-2 last:border-b-0">
                  <span className="block text-[14.5px]">{a.title}</span>
                  <span className="block text-[12.5px] text-ink-600">{a.label}</span>
                </li>
              ))}
            </List>
          )}
          {check.changes.length > 0 && (
            <List title={L({ hi: "बदले हुए", en: "Changed" })}>
              {check.changes.map((c) => (
                <li key={c.label} className="border-b border-ink-100 py-2 text-[13.5px] last:border-b-0">
                  <span className="block text-[12.5px] text-ink-600">{c.label}</span>
                  <span className="text-ink-500 line-through">{c.from}</span> → <b className="font-semibold">{c.to}</b>
                </li>
              ))}
            </List>
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

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[14px] font-semibold text-ink-700">{title}</h3>
      <ul className="rounded-2xl border border-ink-100 bg-white px-3.5">{children}</ul>
    </div>
  );
}
